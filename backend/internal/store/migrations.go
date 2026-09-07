package store

import (
	"context"
	"crypto/sha256"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"strings"
	"time"
	"unicode"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// migrationsFS deliberately embeds only executable migrations. Test fixtures
// live under testdata and cannot be selected by the production runner.
//
//go:embed migrations/*.sql
var migrationsFS embed.FS

const migrationLockKey int64 = 0x534f42414d4947

type migration struct {
	version  int64
	name     string
	script   []byte
	checksum [sha256.Size]byte
}

type recordedMigration struct {
	name     string
	checksum []byte
}

// Migrate applies all embedded migrations in version order. Each migration
// runs in one transaction and is recorded in schema_migrations in that same
// transaction. A session advisory lock prevents two service instances from
// applying migrations at the same time.
func Migrate(ctx context.Context, pool *pgxpool.Pool) (retErr error) {
	if ctx == nil {
		return errors.New("store: nil context")
	}
	if pool == nil {
		return errors.New("store: nil pool")
	}

	migrations, err := loadMigrations()
	if err != nil {
		return err
	}

	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("store: acquire migration connection: %w", err)
	}
	locked := false
	defer func() {
		if !locked {
			conn.Release()
			return
		}

		// Use a fresh context so a cancelled migration context does not leave a
		// session advisory lock attached to a pooled connection.
		unlockCtx, cancel := context.WithTimeout(context.Background(), time.Second)
		_, unlockErr := conn.Exec(unlockCtx, `SELECT pg_advisory_unlock($1)`, migrationLockKey)
		cancel()
		if unlockErr != nil {
			// Hijack removes the connection from the pool. Closing it releases
			// the backend session and therefore the advisory lock.
			rawConn := conn.Hijack()
			closeCtx, closeCancel := context.WithTimeout(context.Background(), time.Second)
			_ = rawConn.Close(closeCtx)
			closeCancel()
			if retErr == nil {
				retErr = fmt.Errorf("store: release migration lock: %w", unlockErr)
			}
			return
		}
		conn.Release()
	}()

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, migrationLockKey); err != nil {
		return fmt.Errorf("store: acquire migration lock: %w", err)
	}
	locked = true

	if _, err := conn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version bigint PRIMARY KEY,
			name text NOT NULL,
			checksum bytea NOT NULL CHECK (octet_length(checksum) = 32),
			applied_at timestamptz NOT NULL DEFAULT now()
		)`); err != nil {
		return fmt.Errorf("store: create schema_migrations: %w", err)
	}

	recorded, err := readRecordedMigrations(ctx, conn)
	if err != nil {
		return err
	}

	for version, applied := range recorded {
		if _, ok := migrations[version]; !ok {
			return fmt.Errorf("store: database migration %d (%s) is newer than this binary", version, applied.name)
		}
	}

	for _, current := range migrationsInOrder(migrations) {
		previous, ok := recorded[current.version]
		if ok {
			if previous.name != current.name || !bytesEqual(previous.checksum, current.checksum[:]) {
				return fmt.Errorf("store: checksum mismatch for migration %03d_%s", current.version, current.name)
			}
			continue
		}
		if err := applyMigration(ctx, conn, current); err != nil {
			return err
		}
	}
	return nil
}

func loadMigrations() (map[int64]migration, error) {
	paths, err := fs.Glob(migrationsFS, "migrations/*.sql")
	if err != nil {
		return nil, fmt.Errorf("store: list embedded migrations: %w", err)
	}
	if len(paths) == 0 {
		return nil, errors.New("store: no embedded migrations")
	}

	result := make(map[int64]migration, len(paths))
	for _, path := range paths {
		version, name, ok := parseMigrationFilename(path)
		if !ok {
			return nil, fmt.Errorf("store: invalid migration filename %q", path)
		}
		script, err := migrationsFS.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("store: read embedded migration %q: %w", path, err)
		}
		if _, exists := result[version]; exists {
			return nil, fmt.Errorf("store: duplicate migration version %d", version)
		}
		result[version] = migration{
			version:  version,
			name:     name,
			script:   script,
			checksum: sha256.Sum256(script),
		}
	}
	return result, nil
}

func parseMigrationFilename(path string) (int64, string, bool) {
	base := path
	if slash := strings.LastIndexByte(base, '/'); slash >= 0 {
		base = base[slash+1:]
	}
	if !strings.HasSuffix(base, ".sql") {
		return 0, "", false
	}
	base = strings.TrimSuffix(base, ".sql")
	separator := strings.IndexByte(base, '_')
	if separator <= 0 || separator == len(base)-1 {
		return 0, "", false
	}
	versionText := base[:separator]
	for _, r := range versionText {
		if r < '0' || r > '9' {
			return 0, "", false
		}
	}
	var version int64
	for _, r := range versionText {
		version = version*10 + int64(r-'0')
		if version < 0 {
			return 0, "", false
		}
	}
	name := base[separator+1:]
	for _, r := range name {
		if !(unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_') {
			return 0, "", false
		}
	}
	return version, name, true
}

func migrationsInOrder(migrations map[int64]migration) []migration {
	ordered := make([]migration, 0, len(migrations))
	for _, item := range migrations {
		ordered = append(ordered, item)
	}
	for i := 1; i < len(ordered); i++ {
		for j := i; j > 0 && ordered[j].version < ordered[j-1].version; j-- {
			ordered[j], ordered[j-1] = ordered[j-1], ordered[j]
		}
	}
	return ordered
}

func readRecordedMigrations(ctx context.Context, conn *pgxpool.Conn) (map[int64]recordedMigration, error) {
	rows, err := conn.Query(ctx, `SELECT version, name, checksum FROM schema_migrations ORDER BY version`)
	if err != nil {
		return nil, fmt.Errorf("store: read schema_migrations: %w", err)
	}
	defer rows.Close()

	result := make(map[int64]recordedMigration)
	for rows.Next() {
		var version int64
		var item recordedMigration
		if err := rows.Scan(&version, &item.name, &item.checksum); err != nil {
			return nil, fmt.Errorf("store: scan schema_migrations: %w", err)
		}
		if len(item.checksum) != sha256.Size {
			return nil, fmt.Errorf("store: invalid checksum length for migration %d", version)
		}
		result[version] = item
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("store: read schema_migrations rows: %w", err)
	}
	return result, nil
}

func applyMigration(ctx context.Context, conn *pgxpool.Conn, item migration) error {
	script, err := stripOuterTransaction(item.script)
	if err != nil {
		return fmt.Errorf("store: prepare migration %03d_%s: %w", item.version, item.name, err)
	}

	tx, err := conn.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("store: begin migration %03d_%s: %w", item.version, item.name, err)
	}
	rollback := true
	defer func() {
		if rollback {
			_ = tx.Rollback(ctx)
		}
	}()

	if _, err := tx.Exec(ctx, string(script)); err != nil {
		return fmt.Errorf("store: apply migration %03d_%s: %w", item.version, item.name, err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO schema_migrations(version, name, checksum)
		VALUES ($1, $2, $3)`, item.version, item.name, item.checksum[:]); err != nil {
		return fmt.Errorf("store: record migration %03d_%s: %w", item.version, item.name, err)
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit migration %03d_%s: %w", item.version, item.name, err)
	}
	rollback = false
	return nil
}

// stripOuterTransaction removes only an optional script-level BEGIN and
// COMMIT. PL/pgSQL blocks inside a migration are left untouched. The runner
// supplies the transaction, so nested transaction commands are not sent to
// PostgreSQL.
func stripOuterTransaction(script []byte) ([]byte, error) {
	text := string(script)
	start := skipSQLPrefix(text, 0)
	keywordEnd := scanWord(text, start)
	if !strings.EqualFold(text[start:keywordEnd], "BEGIN") {
		return script, nil
	}
	semicolon := skipSQLPrefix(text, keywordEnd)
	if semicolon >= len(text) || text[semicolon] != ';' {
		return nil, errors.New("outer BEGIN is not terminated")
	}
	text = text[:start] + text[semicolon+1:]

	end := skipSQLSuffix(text, len(text))
	if end == 0 || text[end-1] != ';' {
		return nil, errors.New("outer COMMIT is not terminated")
	}
	commitEnd := end - 1
	commitStart := commitEnd
	for commitStart > 0 && isSQLSpace(text[commitStart-1]) {
		commitStart--
	}
	if commitStart < len("COMMIT") || !strings.EqualFold(text[commitStart-len("COMMIT"):commitStart], "COMMIT") {
		return nil, errors.New("migration has BEGIN but no final COMMIT")
	}
	return []byte(text[:commitStart-len("COMMIT")] + text[end:]), nil
}

func skipSQLPrefix(text string, offset int) int {
	for offset < len(text) {
		if isSQLSpace(text[offset]) {
			offset++
			continue
		}
		if strings.HasPrefix(text[offset:], "--") {
			newline := strings.IndexByte(text[offset+2:], '\n')
			if newline < 0 {
				return len(text)
			}
			offset += newline + 2
			continue
		}
		if strings.HasPrefix(text[offset:], "/*") {
			end := strings.Index(text[offset+2:], "*/")
			if end < 0 {
				return len(text)
			}
			offset += end + 4
			continue
		}
		break
	}
	return offset
}

func skipSQLSuffix(text string, end int) int {
	for end > 0 {
		for end > 0 && isSQLSpace(text[end-1]) {
			end--
		}
		if end >= 2 && text[end-2:end] == "*/" {
			start := strings.LastIndex(text[:end-2], "/*")
			if start < 0 {
				break
			}
			end = start
			continue
		}
		lineStart := strings.LastIndexByte(text[:end], '\n') + 1
		line := text[lineStart:end]
		if strings.HasPrefix(strings.TrimSpace(line), "--") {
			end = lineStart
			continue
		}
		break
	}
	return end
}

func scanWord(text string, start int) int {
	end := start
	for end < len(text) && ((text[end] >= 'a' && text[end] <= 'z') || (text[end] >= 'A' && text[end] <= 'Z') || text[end] == '_') {
		end++
	}
	return end
}

func isSQLSpace(value byte) bool {
	return value == ' ' || value == '\t' || value == '\r' || value == '\n' || value == '\f'
}

func bytesEqual(left, right []byte) bool {
	if len(left) != len(right) {
		return false
	}
	for i := range left {
		if left[i] != right[i] {
			return false
		}
	}
	return true
}
