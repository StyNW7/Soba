package store

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

func TestPostgresMigrationsAndInvariants(t *testing.T) {
	databaseURL := os.Getenv("SOBA_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set SOBA_TEST_DATABASE_URL to run PostgreSQL integration tests")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := Open(ctx, databaseURL)
	if err != nil {
		t.Fatalf("Open returned error: %v", err)
	}
	defer pool.Close()

	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("Migrate returned error: %v", err)
	}
	if err := Healthy(ctx, pool); err != nil {
		t.Fatalf("Healthy returned error after migration: %v", err)
	}

	var tableCount int
	if err := pool.QueryRow(ctx, `
		SELECT count(*)
		FROM information_schema.tables
		WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`).Scan(&tableCount); err != nil {
		t.Fatalf("count tables: %v", err)
	}
	if tableCount != 28 { // 27 domain tables plus schema_migrations.
		t.Fatalf("got %d public tables, want 28", tableCount)
	}

	var nullable string
	if err := pool.QueryRow(ctx, `
		SELECT is_nullable
		FROM information_schema.columns
		WHERE table_schema='public' AND table_name='mobile_login_codes' AND column_name='auth_time'`).Scan(&nullable); err != nil {
		t.Fatalf("read mobile auth_time column: %v", err)
	}
	if nullable != "NO" {
		t.Fatalf("mobile_login_codes.auth_time is %s nullable, want NOT NULL", nullable)
	}

	var migrationCount int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations`).Scan(&migrationCount); err != nil {
		t.Fatalf("count applied migrations: %v", err)
	}
	if migrationCount != 5 {
		t.Fatalf("got %d applied migrations, want 4", migrationCount)
	}
	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("second Migrate returned error: %v", err)
	}

	fixture, err := os.ReadFile("testdata/002_invariant_tests.sql")
	if err != nil {
		t.Fatalf("read invariant fixture: %v", err)
	}
	if _, err := pool.Exec(ctx, string(fixture)); err != nil {
		t.Fatalf("invariant fixture failed: %v", err)
	}

	const committedID = "a0000000-0000-4000-8000-000000000001"
	const rolledBackID = "a0000000-0000-4000-8000-000000000002"
	_, _ = pool.Exec(ctx, `DELETE FROM profiles WHERE id IN ($1::uuid, $2::uuid)`, committedID, rolledBackID)
	if err := WithTx(ctx, pool, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `INSERT INTO profiles(id,issuer,identity_subject,display_name) VALUES ($1::uuid,'test','tx-commit','Committed')`, committedID)
		return err
	}); err != nil {
		t.Fatalf("committing transaction: %v", err)
	}
	var exists bool
	if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM profiles WHERE id=$1::uuid)`, committedID).Scan(&exists); err != nil {
		t.Fatalf("check committed transaction: %v", err)
	}
	if !exists {
		t.Fatal("committed transaction did not persist")
	}

	wantRollback := errors.New("intentional rollback")
	if err := WithTx(ctx, pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `INSERT INTO profiles(id,issuer,identity_subject,display_name) VALUES ($1::uuid,'test','tx-rollback','Rolled back')`, rolledBackID); err != nil {
			return err
		}
		return wantRollback
	}); !errors.Is(err, wantRollback) {
		t.Fatalf("rollback transaction error = %v, want %v", err, wantRollback)
	}
	if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM profiles WHERE id=$1::uuid)`, rolledBackID).Scan(&exists); err != nil {
		t.Fatalf("check rolled-back transaction: %v", err)
	}
	if exists {
		t.Fatal("rolled-back transaction persisted a row")
	}
	if _, err := pool.Exec(ctx, `DELETE FROM profiles WHERE id=$1::uuid`, committedID); err != nil {
		t.Fatalf("cleanup transaction fixture: %v", err)
	}
}
