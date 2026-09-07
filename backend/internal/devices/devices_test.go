package devices

import (
	"context"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/testutil"
	"net/http/httptest"
	"testing"
)

func TestPairRecoverAndRevoke(t *testing.T) {
	ctx := context.Background()
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	s := &Service{Pool: p, Config: testutil.Config(), Guards: &platform.Guards{}}
	device, bootstrap := platform.ID(), platform.Token()
	_, e := p.Exec(ctx, `INSERT INTO devices(id,bootstrap_hash) VALUES($1,$2)`, device, platform.Hash(bootstrap))
	if e != nil {
		t.Fatal(e)
	}
	r := testutil.Request(t, p, owner)
	r.Body = map[string]any{"device_id": device}
	result, e := s.create(ctx, r)
	if e != nil {
		t.Fatal(e)
	}
	if e = r.Tx.Commit(ctx); e != nil {
		t.Fatal(e)
	}
	claim := result.Body.(map[string]any)
	confirm := &platform.Request{HTTP: httptest.NewRequest("POST", "/v1/device-claims/"+claim["id"].(string)+"/confirm", nil), Body: map[string]any{"challenge": claim["challenge"]}}
	confirm.HTTP.SetPathValue("id", claim["id"].(string))
	confirm.HTTP.Header.Set("Authorization", "Bearer "+bootstrap)
	confirm.HTTP.Header.Set("Idempotency-Key", platform.ID())
	a, e := s.confirm(ctx, confirm)
	if e != nil {
		t.Fatal(e)
	}
	b, e := s.confirm(ctx, confirm)
	if e != nil {
		t.Fatal(e)
	}
	token := a.Body.(map[string]any)["credential"].(string)
	if token != b.Body.(map[string]any)["credential"] {
		t.Fatal("recovery changed credential")
	}
	if _, got, e := s.AuthenticateDevice(ctx, token); e != nil || got != owner {
		t.Fatal("credential did not authenticate")
	}
	confirm.HTTP.Header.Set("Idempotency-Key", platform.ID())
	if _, e = s.confirm(ctx, confirm); e == nil {
		t.Fatal("second key claimed device again")
	}
	r = testutil.Request(t, p, owner)
	r.HTTP = httptest.NewRequest("DELETE", "/v1/devices/"+device, nil)
	r.HTTP.SetPathValue("id", device)
	if _, e = s.unpair(ctx, r); e != nil {
		t.Fatal(e)
	}
	if e = r.Tx.Commit(ctx); e != nil {
		t.Fatal(e)
	}
	if _, _, e = s.AuthenticateDevice(ctx, token); e == nil {
		t.Fatal("revoked token accepted")
	}
	if _, e = s.confirm(ctx, confirm); e == nil {
		t.Fatal("bootstrap recovered revoked device")
	}
}
