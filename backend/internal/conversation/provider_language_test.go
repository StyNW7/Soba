package conversation

import (
	"context"
	"testing"

	"github.com/StyNW7/Soba/backend/internal/testutil"
)

func TestAssemblyAITicketsRejectUnsupportedLocaleBeforeCapture(t *testing.T) {
	pool := testutil.Database(t)
	owner := testutil.Owner(t, pool)
	if _, err := pool.Exec(context.Background(), `UPDATE profiles SET processing_granted_at=NULL, processing_policy_version=NULL, processing_revoked_at=NULL WHERE id=$1`, owner); err != nil {
		t.Fatal(err)
	}
	cfg := testutil.Config()
	cfg.VoiceEnabled = true
	cfg.STTProvider = "assemblyai"
	s := &Service{Pool: pool, Config: cfg}
	for _, locale := range []string{"id-ID", "en-US"} {
		if _, err := pool.Exec(context.Background(), `UPDATE profiles SET locale=$2 WHERE id=$1`, owner, locale); err != nil {
			t.Fatal(err)
		}
		r := testutil.Request(t, pool, owner)
		r.Body["mode"] = "private"
		_, err := s.issueTicket(context.Background(), r)
		if locale == "id-ID" && (err == nil || len(r.AfterCommit) != 0) {
			t.Fatal("unsupported locale received a ticket")
		}
		if locale == "en-US" && err != nil {
			t.Fatalf("English ticket rejected: %v", err)
		}
		_ = r.Tx.Rollback(context.Background())
	}
}
