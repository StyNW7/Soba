package wellbeing

import (
	"context"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/testutil"
)

func TestOwnerRecordsVersionTrendsAndContent(t *testing.T) {
	ctx := context.Background()
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	cancelled := 0
	s := &Service{Pool: p, Config: testutil.Config(), CancelOwner: func(string) { cancelled++ }}

	when := time.Now().UTC().Add(-time.Hour).Format(time.RFC3339Nano)
	r := testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("POST", "/v1/mood-entries", nil)
	r.Body = map[string]any{"label": "good", "occurred_at": when, "timezone": "Asia/Jakarta"}
	created, err := s.createMood(ctx, r)
	if err != nil {
		t.Fatal(err)
	}
	if created.Status != 201 || created.Body.(map[string]any)["source"] != "check_in" {
		t.Fatalf("unexpected mood response: %#v", created)
	}
	if err = r.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	moodID := created.Body.(map[string]any)["id"].(string)
	r = testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("PATCH", "/v1/mood-entries/"+moodID, nil)
	r.HTTP.SetPathValue("id", moodID)
	r.Body = map[string]any{"label": "very_good", "version": int64(1)}
	updated, err := s.updateMood(ctx, r)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Body.(map[string]any)["label"] != "very_good" {
		t.Fatalf("unexpected updated mood: %#v", updated.Body)
	}
	if err = r.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	r = testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("POST", "/v1/memories", nil)
	r.Body = map[string]any{"text": "Likes quiet mornings", "category": "preference"}
	memory, err := s.createMemory(ctx, r)
	if err != nil {
		t.Fatal(err)
	}
	if err = r.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	memoryID := memory.Body.(map[string]any)["id"].(string)
	r = testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("PATCH", "/v1/memories/"+memoryID, nil)
	r.HTTP.SetPathValue("id", memoryID)
	r.Body = map[string]any{"text": "Likes slow mornings", "category": "preference", "version": int64(1)}
	if _, err = s.updateMemory(ctx, r); err != nil {
		t.Fatal(err)
	}
	if len(r.AfterCommit) != 1 {
		t.Fatalf("memory update scheduled %d callbacks, want 1", len(r.AfterCommit))
	}
	if err = r.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	for _, callback := range r.AfterCommit {
		callback()
	}
	if cancelled != 1 {
		t.Fatalf("cancel callback count=%d, want 1", cancelled)
	}

	journalID := platform.ID()
	if _, err = p.Exec(ctx, `INSERT INTO journals(id,owner_id,topic,reflection,insights) VALUES($1,$2,'Topic','Reflection',$3)`, journalID, owner, []string{""}); err != nil {
		t.Fatal(err)
	}
	r = testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("PATCH", "/v1/journals/"+journalID, nil)
	r.HTTP.SetPathValue("id", journalID)
	r.Body = map[string]any{"topic": "New topic", "reflection": "New reflection", "insights": []any{""}, "version": int64(1)}
	if _, err = s.updateJournal(ctx, r); err != nil {
		t.Fatal(err)
	}
	if err = r.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	r = testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("GET", "/v1/mood-trends?from=2024-01-01&to=2024-01-03", nil)
	trend, err := s.getMoodTrends(ctx, r)
	if err != nil {
		t.Fatal(err)
	}
	trendBody := trend.Body.(map[string]any)
	if trendBody["timezone"] != "Asia/Jakarta" || len(trendBody["buckets"].([]TrendBucket)) != 2 {
		t.Fatalf("unexpected trend response: %#v", trendBody)
	}
	_ = r.Tx.Rollback(ctx)

	contentID := platform.ID()
	if _, err = p.Exec(ctx, `INSERT INTO content_items(id,kind,title,locale,steps,review_status,reviewer_id,reviewed_at,review_expires_at)
		VALUES($1,'grounding','Grounding','id-ID',$2::jsonb,'approved','reviewer',now(),now()+interval '1 day')`, contentID, `[ {"text":"Breathe","duration_seconds":10,"audio_url":null} ]`); err != nil {
		t.Fatal(err)
	}
	r = testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("GET", "/v1/toolkit?locale=id-ID", nil)
	content, err := s.listToolkit(ctx, r)
	if err != nil {
		t.Fatal(err)
	}
	if len(content.Body.(map[string]any)["items"].([]map[string]any)) != 1 {
		t.Fatalf("unexpected toolkit response: %#v", content.Body)
	}
	_ = r.Tx.Rollback(ctx)

	r = testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("PUT", "/v1/safety-plan", nil)
	r.Body = map[string]any{"version": int64(1), "steps": []any{"Call someone"}}
	plan, err := s.setSafetyPlan(ctx, r)
	if err != nil {
		t.Fatal(err)
	}
	if plan.Body.(map[string]any)["version"].(float64) != 2 {
		t.Fatalf("unexpected safety plan version: %#v", plan.Body)
	}
	_ = r.Tx.Rollback(ctx)
}

func TestTrendBucketsKeepUnknownAndGaps(t *testing.T) {
	location, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		t.Fatal(err)
	}
	from, _ := time.Parse("2006-01-02", "2024-01-01")
	to, _ := time.Parse("2006-01-02", "2024-01-04")
	buckets := CalculateMoodBuckets(from, to, location, []TrendEntry{{Label: "unknown", OccurredAt: time.Date(2024, 1, 1, 1, 0, 0, 0, location)}})
	if len(buckets) != 3 || buckets[0].State != "available" || len(buckets[0].Counts) != 6 || buckets[0].Counts[5].Count != 1 {
		t.Fatalf("unexpected unknown bucket: %#v", buckets)
	}
	if buckets[1].State != "insufficient_data" || len(buckets[1].Counts) != 0 {
		t.Fatalf("unexpected empty bucket: %#v", buckets[1])
	}
}

func TestInvalidCheckinTime(t *testing.T) {
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	s := &Service{Pool: p, Config: testutil.Config()}
	r := testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("POST", "/v1/mood-entries", nil)
	r.Body = map[string]any{"label": "neutral", "occurred_at": time.Now().UTC().Add(-8 * 24 * time.Hour).Format(time.RFC3339Nano), "timezone": "Asia/Jakarta"}
	if _, err := s.createMood(context.Background(), r); err == nil || !strings.Contains(err.Error(), "invalid_request") {
		t.Fatalf("old check-in error=%v", err)
	}
}
