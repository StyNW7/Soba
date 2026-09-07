// Command admin performs offline, operator-controlled imports and device
// enrollment. It does not call an identity, speech, or notification provider.
package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/store"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

func main() {
	if len(os.Args) < 2 {
		usage(os.Stderr)
		os.Exit(2)
	}
	ctx := context.Background()
	var err error
	switch os.Args[1] {
	case "device-enroll":
		err = enrollDevice(ctx, os.Args[2:])
	case "import", "import-content", "content-import", "import-resources", "resources-import":
		err = importReviewed(ctx, os.Args[2:])
	case "help", "-h", "--help":
		usage(os.Stdout)
		return
	default:
		usage(os.Stderr)
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintf(os.Stderr, "admin: %v\n", err)
		os.Exit(1)
	}
}

func usage(w io.Writer) {
	fmt.Fprintln(w, "Usage: admin device-enroll --device-id UUID --secret-file PATH [flags]")
	fmt.Fprintln(w, "       admin import --file PATH --allowed-host HOST [--allowed-host HOST ...] [flags]")
	fmt.Fprintln(w, "")
	fmt.Fprintln(w, "Commands use DATABASE_URL by default. Device secrets are written only to a new 0600 file.")
}

func enrollDevice(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("device-enroll", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	databaseURL := fs.String("database-url", os.Getenv("DATABASE_URL"), "PostgreSQL URL")
	deviceID := fs.String("device-id", "", "factory device UUID")
	name := fs.String("name", "My Soba", "device display name")
	secretFile := fs.String("secret-file", "", "new local bootstrap secret file")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *databaseURL == "" {
		return errors.New("DATABASE_URL or --database-url is required")
	}
	id, err := uuid.Parse(*deviceID)
	if err != nil || id.String() != *deviceID {
		return errors.New("--device-id must be a canonical UUID")
	}
	if strings.TrimSpace(*name) == "" || len([]rune(*name)) > 80 {
		return errors.New("--name must contain 1 to 80 characters")
	}
	if *secretFile == "" {
		return errors.New("--secret-file is required; a bootstrap secret is never printed or logged")
	}

	secret, err := randomSecret()
	if err != nil {
		return fmt.Errorf("generate bootstrap secret: %w", err)
	}
	if err := writeSecretFile(*secretFile, secret); err != nil {
		return err
	}
	keepFile := false
	defer func() {
		if !keepFile {
			_ = os.Remove(*secretFile)
		}
	}()

	pool, err := openAdminDatabase(ctx, *databaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()
	if _, err := pool.Exec(ctx, `INSERT INTO devices(id,name,state,bootstrap_hash) VALUES($1,$2,'unpaired',$3)`, id, strings.TrimSpace(*name), platform.Hash(secret)); err != nil {
		var pgxErr *pgconn.PgError
		if errors.As(err, &pgxErr) && pgxErr.Code == "23505" {
			return errors.New("device ID or bootstrap secret already exists")
		}
		return fmt.Errorf("enroll device: %w", err)
	}
	keepFile = true
	fmt.Fprintf(os.Stdout, "device %s enrolled; bootstrap secret written to %s\n", id, *secretFile)
	return nil
}

func randomSecret() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func writeSecretFile(path, secret string) error {
	if path == "" || filepath.Clean(path) != path {
		return errors.New("--secret-file must be a clean path")
	}
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return fmt.Errorf("create secret file: %w", err)
	}
	if err := file.Chmod(0o600); err != nil {
		_ = file.Close()
		return fmt.Errorf("protect secret file: %w", err)
	}
	if _, err := file.WriteString(secret + "\n"); err != nil {
		_ = file.Close()
		return fmt.Errorf("write secret file: %w", err)
	}
	if err := file.Sync(); err != nil {
		_ = file.Close()
		return fmt.Errorf("sync secret file: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close secret file: %w", err)
	}
	return nil
}

type importDocument struct {
	ContentItems     []contentItem     `json:"content_items"`
	SupportResources []supportResource `json:"support_resources"`
}

type contentItem struct {
	ID              string            `json:"id"`
	Kind            string            `json:"kind"`
	Title           string            `json:"title"`
	Locale          string            `json:"locale"`
	Steps           []json.RawMessage `json:"steps"`
	ReviewStatus    string            `json:"review_status"`
	ReviewerID      string            `json:"reviewer_id"`
	ReviewedAt      string            `json:"reviewed_at"`
	ReviewExpiresAt string            `json:"review_expires_at"`
}

type supportResource struct {
	ID               string  `json:"id"`
	Name             string  `json:"name"`
	Region           string  `json:"region"`
	Locale           string  `json:"locale"`
	Kind             string  `json:"kind"`
	AccessURL        string  `json:"access_url"`
	Phone            *string `json:"phone"`
	AvailabilityText string  `json:"availability_text"`
	ReviewedAt       string  `json:"reviewed_at"`
	ReviewExpiresAt  string  `json:"review_expires_at"`
}

func importReviewed(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("import", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	databaseURL := fs.String("database-url", os.Getenv("DATABASE_URL"), "PostgreSQL URL")
	filePath := fs.String("file", "", "reviewed JSON file")
	var hostFlags stringList
	fs.Var(&hostFlags, "allowed-host", "allowed HTTPS resource host; repeat for more hosts")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *databaseURL == "" {
		return errors.New("DATABASE_URL or --database-url is required")
	}
	if *filePath == "" {
		return errors.New("--file is required")
	}
	document, err := readImportDocument(*filePath)
	if err != nil {
		return err
	}
	if len(document.ContentItems) == 0 && len(document.SupportResources) == 0 {
		return errors.New("the reviewed import contains no content or resources")
	}
	now := time.Now().UTC()
	allowed := normalizeHosts(hostFlags)
	if err := validateContentItems(document.ContentItems, now, allowed); err != nil {
		return err
	}
	if err := validateSupportResources(document.SupportResources, now, allowed); err != nil {
		return err
	}
	p, err := openAdminDatabase(ctx, *databaseURL)
	if err != nil {
		return err
	}
	defer p.Close()
	tx, err := p.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin reviewed import: %w", err)
	}
	defer tx.Rollback(ctx)
	for _, item := range document.ContentItems {
		steps, _ := json.Marshal(item.Steps)
		if _, err := tx.Exec(ctx, `INSERT INTO content_items(id,kind,title,locale,steps,review_status,reviewer_id,reviewed_at,review_expires_at) VALUES($1,$2,$3,$4,$5::jsonb,'approved',$6,$7,$8) ON CONFLICT(id) DO UPDATE SET kind=EXCLUDED.kind,title=EXCLUDED.title,locale=EXCLUDED.locale,steps=EXCLUDED.steps,review_status=EXCLUDED.review_status,reviewer_id=EXCLUDED.reviewer_id,reviewed_at=EXCLUDED.reviewed_at,review_expires_at=EXCLUDED.review_expires_at`, item.ID, item.Kind, item.Title, item.Locale, steps, item.ReviewerID, item.ReviewedAt, item.ReviewExpiresAt); err != nil {
			return fmt.Errorf("import reviewed content: %w", err)
		}
	}
	for _, item := range document.SupportResources {
		if _, err := tx.Exec(ctx, `INSERT INTO support_resources(id,name,region,locale,kind,access_url,phone,availability_text,reviewed_at,review_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,region=EXCLUDED.region,locale=EXCLUDED.locale,kind=EXCLUDED.kind,access_url=EXCLUDED.access_url,phone=EXCLUDED.phone,availability_text=EXCLUDED.availability_text,reviewed_at=EXCLUDED.reviewed_at,review_expires_at=EXCLUDED.review_expires_at`, item.ID, item.Name, item.Region, item.Locale, item.Kind, item.AccessURL, item.Phone, item.AvailabilityText, item.ReviewedAt, item.ReviewExpiresAt); err != nil {
			return fmt.Errorf("import support resource: %w", err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit reviewed import: %w", err)
	}
	fmt.Fprintf(os.Stdout, "reviewed import applied: %d content items, %d support resources\n", len(document.ContentItems), len(document.SupportResources))
	return nil
}

func readImportDocument(path string) (importDocument, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return importDocument{}, fmt.Errorf("read reviewed import: %w", err)
	}
	if len(b) == 0 || len(b) > 8<<20 {
		return importDocument{}, errors.New("reviewed import must be between 1 byte and 8 MiB")
	}
	if err := platform.CheckJSON(b); err != nil {
		return importDocument{}, errors.New("reviewed import contains invalid JSON")
	}
	decoder := json.NewDecoder(strings.NewReader(string(b)))
	decoder.DisallowUnknownFields()
	var document importDocument
	if err := decoder.Decode(&document); err != nil {
		return importDocument{}, fmt.Errorf("invalid reviewed import JSON: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return importDocument{}, errors.New("reviewed import has trailing data")
	}
	return document, nil
}

func validateContentItems(items []contentItem, now time.Time, allowed map[string]struct{}) error {
	seen := map[string]struct{}{}
	kinds := map[string]bool{"grounding": true, "breathing": true, "reflection": true, "activity": true, "coach": true, "safety": true}
	for _, item := range items {
		if !canonicalUUID(item.ID) || strings.TrimSpace(item.Title) == "" || len([]rune(item.Title)) > 160 || !kinds[item.Kind] || (item.Locale != "id-ID" && item.Locale != "en-US") || item.ReviewStatus != "approved" || strings.TrimSpace(item.ReviewerID) == "" || len([]rune(item.ReviewerID)) > 160 {
			return errors.New("reviewed content item has invalid identity, type, locale, or approval fields")
		}
		if _, ok := seen[item.ID]; ok {
			return errors.New("reviewed content item IDs must be unique")
		}
		seen[item.ID] = struct{}{}
		if len(item.Steps) < 1 || len(item.Steps) > 30 {
			return errors.New("reviewed content item steps must contain 1 to 30 entries")
		}
		for _, raw := range item.Steps {
			if err := validateStep(raw, allowed); err != nil {
				return err
			}
		}
		if err := validateReviewWindow(item.ReviewedAt, item.ReviewExpiresAt, now); err != nil {
			return err
		}
	}
	return nil
}

func validateStep(raw json.RawMessage, allowed map[string]struct{}) error {
	var fields map[string]json.RawMessage
	if platform.CheckJSON(raw) != nil || json.Unmarshal(raw, &fields) != nil || len(fields) != 3 {
		return errors.New("content step requires text, duration_seconds, and audio_url")
	}
	var text string
	var duration int
	var audio *string
	if json.Unmarshal(fields["text"], &text) != nil || strings.TrimSpace(text) == "" || len([]rune(text)) > 1000 ||
		string(fields["duration_seconds"]) == "null" || json.Unmarshal(fields["duration_seconds"], &duration) != nil || duration < 0 || duration > 600 ||
		json.Unmarshal(fields["audio_url"], &audio) != nil {
		return errors.New("content step has invalid text, duration, or audio URL")
	}
	if audio != nil {
		u, err := url.Parse(*audio)
		if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Fragment != "" || len(*audio) > 2048 {
			return errors.New("content audio URL must use HTTPS")
		}
		if _, ok := allowed[strings.ToLower(strings.TrimSuffix(u.Hostname(), "."))]; !ok {
			return errors.New("content audio host is not allowed")
		}
	}
	return nil
}

func validateSupportResources(items []supportResource, now time.Time, allowed map[string]struct{}) error {
	seen := map[string]struct{}{}
	kinds := map[string]bool{"counselor": true, "professional": true, "crisis": true}
	for _, item := range items {
		if !canonicalUUID(item.ID) || strings.TrimSpace(item.Name) == "" || len([]rune(item.Name)) > 160 || strings.TrimSpace(item.Region) == "" || len([]rune(item.Region)) > 80 || (item.Locale != "id-ID" && item.Locale != "en-US") || !kinds[item.Kind] || strings.TrimSpace(item.AccessURL) == "" || len(item.AccessURL) > 2048 || !strings.HasPrefix(item.AccessURL, "https://") {
			return errors.New("reviewed support resource has invalid fields")
		}
		if _, ok := seen[item.ID]; ok {
			return errors.New("reviewed support resource IDs must be unique")
		}
		seen[item.ID] = struct{}{}
		u, err := url.Parse(item.AccessURL)
		if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Fragment != "" {
			return errors.New("reviewed support resource URL must be HTTPS without credentials or fragments")
		}
		if _, ok := allowed[strings.ToLower(strings.TrimSuffix(u.Hostname(), "."))]; !ok {
			return errors.New("reviewed support resource host is not in the HTTPS allowlist")
		}
		if item.Phone != nil && !phoneOK(*item.Phone) {
			return errors.New("reviewed support resource phone is invalid")
		}
		if len([]rune(item.AvailabilityText)) > 300 {
			return errors.New("reviewed support resource availability text is too long")
		}
		if err := validateReviewWindow(item.ReviewedAt, item.ReviewExpiresAt, now); err != nil {
			return err
		}
	}
	return nil
}

func validateReviewWindow(reviewedAt, expiresAt string, now time.Time) error {
	reviewed, err := time.Parse(time.RFC3339, reviewedAt)
	if err != nil {
		return errors.New("review timestamps must use RFC3339")
	}
	expires, err := time.Parse(time.RFC3339, expiresAt)
	if err != nil || reviewed.After(now) || !expires.After(reviewed) || !expires.After(now) {
		return errors.New("review expiry must be after review time and current time")
	}
	return nil
}

func canonicalUUID(value string) bool {
	u, err := uuid.Parse(value)
	return err == nil && u.String() == value
}

func phoneOK(value string) bool {
	if len(value) < 8 || len(value) > 16 || value[0] != '+' {
		return false
	}
	if value[1] < '1' || value[1] > '9' {
		return false
	}
	for _, r := range value[1:] {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

type stringList []string

func (s *stringList) String() string { return strings.Join(*s, ",") }
func (s *stringList) Set(value string) error {
	*s = append(*s, value)
	return nil
}

func normalizeHosts(values []string) map[string]struct{} {
	result := map[string]struct{}{}
	for _, value := range values {
		for _, host := range strings.Split(value, ",") {
			host = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(host), "."))
			if host != "" {
				result[host] = struct{}{}
			}
		}
	}
	return result
}

func openAdminDatabase(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	pool, err := store.Open(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := store.Migrate(ctx, pool); err != nil {
		pool.Close()
		return nil, fmt.Errorf("migrate database: %w", err)
	}
	return pool, nil
}
