// Package testutil provides isolated database fixtures. It is never used by the application.
package testutil

import (
	"context"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/store"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"os"
	"strings"
	"testing"
	"time"
)

func Database(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("SOBA_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("SOBA_TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	admin, e := pgx.Connect(ctx, dsn)
	if e != nil {
		t.Fatal(e)
	}
	schema := "test_" + strings.ReplaceAll(platform.ID(), "-", "")
	if _, e = admin.Exec(ctx, "CREATE SCHEMA "+schema); e != nil {
		t.Fatal(e)
	}
	cfg, e := pgxpool.ParseConfig(dsn)
	if e != nil {
		t.Fatal(e)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, e := pgxpool.NewWithConfig(ctx, cfg)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { pool.Close(); _, _ = admin.Exec(ctx, "DROP SCHEMA "+schema+" CASCADE"); _ = admin.Close(ctx) })
	if e = store.Migrate(ctx, pool); e != nil {
		t.Fatal(e)
	}
	return pool
}
func Config() platform.Config {
	return platform.Config{Env: "development", PolicyVersion: "test-v1", KeyVersion: "1", DataKey: []byte(strings.Repeat("d", 32)), CursorKey: []byte(strings.Repeat("c", 32)), AuditKey: []byte(strings.Repeat("a", 32)), Origins: []string{"https://app.soba.test"}, MaxSessions: 10}
}
func Owner(t *testing.T, p *pgxpool.Pool) string {
	t.Helper()
	id := platform.ID()
	_, e := p.Exec(context.Background(), `INSERT INTO profiles(id,issuer,identity_subject,display_name,eligibility,age_band,processing_policy_version,processing_granted_at) VALUES($1,'https://issuer.test',$2,'Test Person','allowed','18_plus','test-v1',now());`, id, id)
	if e != nil {
		t.Fatal(e)
	}
	_, e = p.Exec(context.Background(), `INSERT INTO preferences(owner_id) VALUES($1)`, id)
	if e != nil {
		t.Fatal(e)
	}
	_, e = p.Exec(context.Background(), `INSERT INTO safety_plans(owner_id) VALUES($1)`, id)
	if e != nil {
		t.Fatal(e)
	}
	return id
}
func Request(t *testing.T, p *pgxpool.Pool, owner string) *platform.Request {
	t.Helper()
	tx, e := p.Begin(context.Background())
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = tx.Rollback(context.Background()) })
	return &platform.Request{Principal: platform.Principal{OwnerID: owner, AuthenticatedAt: time.Now(), Client: "mobile"}, Tx: tx, Body: map[string]any{}}
}
