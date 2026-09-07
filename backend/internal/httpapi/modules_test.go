package httpapi

import (
	"context"
	"encoding/json"
	"github.com/StyNW7/Soba/backend/internal/auth"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/testutil"
	"github.com/StyNW7/Soba/backend/internal/wellbeing"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestWellbeingHTTPContractAndIsolation(t *testing.T) {
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	other := testutil.Owner(t, p)
	cfg := testutil.Config()
	a := auth.NewService(p, cfg, nil)
	well := &wellbeing.Service{Pool: p, Config: cfg}
	handlers := map[string]platform.Handler{}
	ops, e := RegisteredOperations()
	if e != nil {
		t.Fatal(e)
	}
	for _, id := range ops {
		handlers[id] = func(context.Context, *platform.Request) (platform.Result, error) {
			return platform.Result{}, platform.Unavailable()
		}
	}
	for id, h := range a.Handlers() {
		handlers[id] = h
	}
	for id, h := range well.Handlers() {
		handlers[id] = h
	}
	s := &Server{Pool: p, Config: cfg, Guards: &platform.Guards{}, Handlers: handlers, Authenticate: func(ctx context.Context, r *http.Request) (platform.Principal, error) {
		who := owner
		if r.Header.Get("X-Test-Actor") == "other" {
			who = other
		}
		return platform.Principal{OwnerID: who, Client: "mobile", AuthenticatedAt: time.Now()}, nil
	}}
	h, e := s.Handler()
	if e != nil {
		t.Fatal(e)
	}
	nextKey, lastKey := "", ""
	send := func(method, path, body, actor string, want int) map[string]any {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if nextKey == "" {
			nextKey = platform.ID()
		}
		lastKey = nextKey
		r.Header.Set("Idempotency-Key", nextKey)
		nextKey = ""
		r.Header.Set("X-Test-Actor", actor)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != want {
			t.Errorf("%s %s: want %d got %d %s", method, path, want, w.Code, w.Body.String())
			if method == "POST" {
				t.FailNow()
			}
		}
		var result map[string]any
		if w.Code != 204 {
			if e := json.Unmarshal(w.Body.Bytes(), &result); e != nil {
				t.Fatal(e)
			}
		}
		return result
	}
	send("GET", "/v1/me", "", "", 200)
	send("GET", "/v1/me/preferences", "", "", 200)
	send("PUT", "/v1/me/preferences", `{"personality":"friendly","voice":"cedar","listen_first":true,"memory_enabled":false,"version":1}`, "", 200)
	mood := send("POST", "/v1/mood-entries", `{"label":"good","occurred_at":"`+time.Now().UTC().Format(time.RFC3339)+`","timezone":"Asia/Jakarta"}`, "", 201)
	mid := mood["id"].(string)
	send("GET", "/v1/mood-entries/"+mid, "", "other", 404)
	send("GET", "/v1/mood-entries/"+mid, "", "", 200)
	send("GET", "/v1/mood-entries", "", "", 200)
	send("PATCH", "/v1/mood-entries/"+mid, `{"label":"neutral","version":1}`, "", 200)
	send("PATCH", "/v1/mood-entries/"+mid, `{"label":"low","version":1}`, "", 409)
	memory := send("POST", "/v1/memories", `{"text":"A goal","category":"goal"}`, "", 201)
	memid := memory["id"].(string)
	memoryKey := lastKey
	send("PATCH", "/v1/memories/"+memid, `{"text":"Updated goal","category":"goal","version":1}`, "", 200)
	send("GET", "/v1/memories?limit=1", "", "", 200)
	send("GET", "/v1/memories/"+memid, "", "", 200)
	send("GET", "/v1/journals", "", "", 200)
	send("GET", "/v1/mood-trends?from=2026-09-01&to=2026-09-08", "", "", 200)
	contentID := platform.ID()
	if _, err := p.Exec(context.Background(), `INSERT INTO content_items(id,kind,title,locale,steps,review_status,reviewer_id,reviewed_at,review_expires_at) VALUES($1,'breathing','Test activity','id-ID','[{"text":"Test step","duration_seconds":1,"audio_url":null}]','approved','test-reviewer',now(),now()+interval '1 hour')`, contentID); err != nil {
		t.Fatal(err)
	}
	content := send("GET", "/v1/toolkit?locale=id-ID", "", "", 200)
	if len(content["items"].([]any)) != 1 {
		t.Fatal("reviewed content missing")
	}
	send("GET", "/v1/toolkit/"+contentID, "", "", 200)
	send("GET", "/v1/parent-coach?locale=id-ID", "", "", 200)
	send("GET", "/v1/support-resources", "", "", 200)
	send("GET", "/v1/referrals", "", "", 200)
	send("GET", "/v1/safety-plan", "", "", 200)
	send("PUT", "/v1/safety-plan", `{"version":1,"steps":["Call my friend"]}`, "", 200)
	send("DELETE", "/v1/memories/"+memid, "", "", 204)
	send("DELETE", "/v1/mood-entries/"+mid, "", "", 204)
	nextKey = memoryKey
	send("POST", "/v1/memories", `{"text":"A goal","category":"goal"}`, "", 410)
	var retained int
	if e := p.QueryRow(context.Background(), `SELECT count(*) FROM idempotency_records WHERE resource_id=$1 AND response_ciphertext IS NOT NULL AND response_status<>204`, memid).Scan(&retained); e != nil || retained != 0 {
		t.Fatal("deleted content retained in retry response")
	}

}
