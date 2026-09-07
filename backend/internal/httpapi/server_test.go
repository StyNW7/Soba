package httpapi

import (
	"context"
	"encoding/json"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/testutil"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestMutationReplayAndContractRollback(t *testing.T) {
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
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
	calls := 0
	malformed := false
	handlers["updateProfile"] = func(ctx context.Context, r *platform.Request) (platform.Result, error) {
		calls++
		_, e := r.Tx.Exec(ctx, `UPDATE profiles SET display_name=$2 WHERE id=$1`, owner, r.String("display_name"))
		if e != nil {
			return platform.Result{}, e
		}
		if malformed {
			return platform.OK(map[string]any{"private_extra": "must rollback"}), nil
		}
		v, e := platform.Row(ctx, r.Tx, `SELECT jsonb_build_object('id',id,'display_name',display_name,'locale',locale,'timezone',timezone,'roles',roles,'eligibility',eligibility,'age_band',age_band,'deleting',deleting,'version',version,'shared_phone',shared_phone) FROM profiles WHERE id=$1`, owner)
		return platform.OK(v), e
	}
	s := &Server{Pool: p, Config: testutil.Config(), Guards: &platform.Guards{}, Handlers: handlers, Authenticate: func(context.Context, *http.Request) (platform.Principal, error) {
		return platform.Principal{OwnerID: owner, Client: "mobile", AuthenticatedAt: time.Now()}, nil
	}}
	h, e := s.Handler()
	if e != nil {
		t.Fatal(e)
	}
	key := platform.ID()
	send := func(body, key string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("PATCH", "/v1/me", strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Idempotency-Key", key)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w
	}
	body := `{"display_name":"Updated","locale":"id-ID","timezone":"Asia/Jakarta","roles":["user"],"age_band":"18_plus","shared_phone":null,"version":1}`
	a := send(body, key)
	if a.Code != 200 {
		t.Fatalf("status=%d %s", a.Code, a.Body.String())
	}
	b := send(body, key)
	if b.Code != 200 || a.Body.String() != b.Body.String() || calls != 1 {
		t.Fatalf("bad replay: %d calls %d", b.Code, calls)
	}
	if w := send(strings.Replace(body, "Updated", "Another", 1), key); w.Code != 409 {
		t.Fatal("changed payload accepted")
	}
	malformed = true
	w := send(strings.Replace(body, "Updated", "Rollback", 1), platform.ID())
	if w.Code != 503 {
		t.Fatalf("malformed response status %d", w.Code)
	}
	var name string
	if e = p.QueryRow(context.Background(), `SELECT display_name FROM profiles WHERE id=$1`, owner).Scan(&name); e != nil || name != "Updated" {
		t.Fatal("contract violation committed")
	}
	var errorBody map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &errorBody)
	if strings.Contains(w.Body.String(), "private_extra") || errorBody["request_id"] == nil {
		t.Fatal("unsafe error response")
	}
}
