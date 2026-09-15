package conversation

import (
	"context"
	"testing"
	"time"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/testutil"
)

func TestMoodContextIsolationAndPreference(t *testing.T) {
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	other := testutil.Owner(t, p)
	ctx := context.Background()
	s := &Service{Pool: p}
	add := func(who, label string, age time.Duration) string {
		t.Helper()
		id := platform.ID()
		_, err := p.Exec(ctx, `INSERT INTO mood_entries(id,owner_id,label,source,occurred_at,timezone) VALUES($1,$2,$3,'check_in',$4,'UTC')`, id, who, label, time.Now().Add(-age))
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	id := add(owner, "low", time.Hour)
	add(owner, "very_low", 8*24*time.Hour)
	add(other, "very_good", time.Hour)
	if got := s.recentMoodCheckIns(ctx, owner, "personal"); len(got) != 0 {
		t.Fatal("default preference exposed moods")
	}
	if _, err := p.Exec(ctx, `UPDATE preferences SET mood_history_enabled=true WHERE owner_id=$1`, owner); err != nil {
		t.Fatal(err)
	}
	if got := s.recentMoodCheckIns(ctx, owner, "private"); len(got) != 0 {
		t.Fatal("private mode exposed moods")
	}
	got := s.recentMoodCheckIns(ctx, owner, "personal")
	if len(got) != 1 || got[0].Label != "low" || got[0].OccurredAt == "" {
		t.Fatalf("unexpected context: %#v", got)
	}
	if _, err := p.Exec(ctx, `DELETE FROM mood_entries WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if got := s.recentMoodCheckIns(ctx, owner, "personal"); len(got) != 0 {
		t.Fatal("deleted or stale moods exposed")
	}
	for i := 0; i < 10; i++ {
		add(owner, "good", time.Duration(i)*time.Hour)
	}
	if got := s.recentMoodCheckIns(ctx, owner, "personal"); len(got) != 7 {
		t.Fatalf("expected seven, got %d", len(got))
	}
	if _, err := p.Exec(ctx, `UPDATE preferences SET mood_history_enabled=false WHERE owner_id=$1`, owner); err != nil {
		t.Fatal(err)
	}
	if got := s.recentMoodCheckIns(ctx, owner, "personal"); len(got) != 0 {
		t.Fatal("revoked preference exposed moods")
	}
}
