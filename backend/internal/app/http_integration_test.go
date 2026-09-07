package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/testutil"
)

func TestAssembledWebSessionCSRFAndLogout(t *testing.T) {
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	cfg := testutil.Config()
	cfg.ObjectDirectory = t.TempDir()
	a, err := New(context.Background(), p, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer a.Close(context.Background())
	token := platform.Token()
	_, err = p.Exec(context.Background(), `INSERT INTO auth_sessions(id,owner_id,access_hash,client,authenticated_at,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,'web',now(),now()+interval '1 hour',now()+interval '1 day')`, platform.ID(), owner, platform.Hash(token))
	if err != nil {
		t.Fatal(err)
	}
	send := func(method, path, body, csrf, origin string, cookie bool, want int) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Idempotency-Key", platform.ID())
		if csrf != "" {
			r.Header.Set("X-CSRF-Token", csrf)
		}
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		if cookie {
			r.AddCookie(&http.Cookie{Name: "soba_session", Value: token})
		}
		w := httptest.NewRecorder()
		a.Handler.ServeHTTP(w, r)
		if w.Code != want {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, w.Code, want, w.Body.String())
		}
		return w
	}
	send("GET", "/v1/me", "", "", "", false, 401)
	send("GET", "/v1/me", "", "", "", true, 200)
	w := send("GET", "/v1/auth/csrf", "", "", "", true, 200)
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	csrf := body["token"]
	if csrf == "" {
		t.Fatal("CSRF token missing")
	}
	send("POST", "/v1/memories", `{"text":"Approved","category":"goal"}`, "", "https://app.soba.test", true, 403)
	send("POST", "/v1/memories", `{"text":"Approved","category":"goal"}`, csrf, "https://attacker.test", true, 403)
	send("POST", "/v1/memories", `{"text":"Approved","category":"goal"}`, csrf, "https://app.soba.test", true, 201)
	send("POST", "/v1/auth/logout", "", csrf, "https://app.soba.test", true, 204)
	send("GET", "/v1/me", "", "", "", true, 401)
}
