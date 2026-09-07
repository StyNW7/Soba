package conversation

import (
	"context"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/testutil"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSelectedSavePersistsOnlyChosenContent(t *testing.T) {
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	other := testutil.Owner(t, p)
	s := &Service{Pool: p, Config: testutil.Config(), Guards: &platform.Guards{}}
	s.init()
	id, candidate := platform.ID(), platform.ID()
	_, e := p.Exec(context.Background(), `INSERT INTO conversation_sessions(id,owner_id,state,mode,generation,preferences_version,draft_expires_at) VALUES($1,$2,'review','personal',1,1,now()+interval '10 minutes')`, id, owner)
	if e != nil {
		t.Fatal(e)
	}
	s.drafts[id] = storedDraft{owner, 1, Draft{SessionID: id, Version: 1, ExpiresAt: time.Now().Add(time.Minute), Mood: "good", Topic: "private topic", Reflection: "private reflection", Insights: []string{}, Memories: []Memory{{candidate, "approved memory", "goal"}}}}
	r := testutil.Request(t, p, other)
	r.HTTP = httptest.NewRequest("POST", "/v1/sessions/"+id+"/save", nil)
	r.HTTP.SetPathValue("id", id)
	r.Body = map[string]any{"version": float64(1), "save_journal": false, "save_mood": false, "mood": "good", "memory_candidate_ids": []any{candidate}}
	if _, e = s.save(context.Background(), r); e == nil {
		t.Fatal("foreign owner saved draft")
	}
	_ = r.Tx.Rollback(context.Background())
	r = testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("POST", "/", nil)
	r.HTTP.SetPathValue("id", id)
	r.Body = map[string]any{"version": float64(1), "save_journal": false, "save_mood": false, "mood": "good", "memory_candidate_ids": []any{candidate}}
	if _, e = s.save(context.Background(), r); e != nil {
		t.Fatal(e)
	}
	if e = r.Tx.Commit(context.Background()); e != nil {
		t.Fatal(e)
	}
	for _, fn := range r.AfterCommit {
		fn()
	}
	for table, want := range map[string]int{"journals": 0, "mood_entries": 0, "memories": 1} {
		var count int
		if e = p.QueryRow(context.Background(), "SELECT count(*) FROM "+table+" WHERE owner_id=$1", owner).Scan(&count); e != nil || count != want {
			t.Fatalf("%s count=%d err=%v", table, count, e)
		}
	}
	if _, ok := s.drafts[id]; ok {
		t.Fatal("draft not erased")
	}
}
func TestCancellationClearsAllTransientOwnerData(t *testing.T) {
	s := &Service{}
	s.init()
	called := false
	s.active["a"] = active{Owner: "owner", Cancel: func() { called = true }}
	s.drafts["a"] = storedDraft{Owner: "owner"}
	s.tickets["a"] = ticket{Owner: "owner"}
	s.events["a"] = SafetyEvent{Owner: "owner"}
	s.tickets["b"] = ticket{Owner: "other"}
	s.CancelOwner("owner")
	if !called || len(s.active) != 0 || len(s.drafts) != 0 || len(s.events) != 0 || len(s.tickets) != 1 {
		t.Fatal("incomplete cancellation")
	}
}
func TestVoiceControlContract(t *testing.T) {
	v, e := NewVoiceEngine(&Service{}, nil, nil, nil)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = v.parse([]byte(`{"type":"input.end","version":1,"event_id":"10000000-0000-4000-8000-000000000001","session_id":"10000000-0000-4000-8000-000000000002","turn_id":"10000000-0000-4000-8000-000000000003","last_sequence":0}`)); e != nil {
		t.Fatal(e)
	}
	if _, e = v.parse([]byte(`{"type":"session.start","ticket":"secret"}`)); e == nil {
		t.Fatal("accepted missing format")
	}
}

func TestPreferenceContextCancellationPreservesReviewDraft(t *testing.T) {
	s := &Service{}
	s.init()
	called := false
	s.active["active"] = active{Owner: "owner", Cancel: func() { called = true }}
	s.drafts["review"] = storedDraft{Owner: "owner", Draft: Draft{SessionID: "review"}}
	s.CancelActiveOwner("owner")
	if !called || len(s.active) != 0 || len(s.drafts) != 1 {
		t.Fatal("context cancellation removed a completed review draft")
	}
}
