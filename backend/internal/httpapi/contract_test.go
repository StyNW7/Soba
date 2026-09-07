package httpapi

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestContractCompiles(t *testing.T) {
	ops, e := contracts()
	if e != nil {
		t.Fatal(e)
	}
	if len(ops) != 87 {
		t.Fatalf("operations=%d", len(ops))
	}
}
func TestStrictJSON(t *testing.T) {
	for _, v := range []string{`{"a":1,"a":2}`, `{"a":{"b":1,"b":2}}`, `{} {}`, `[1,]`} {
		if uniqueJSON([]byte(v)) == nil {
			t.Errorf("accepted %s", v)
		}
	}
	if e := uniqueJSON([]byte(`{"a":[{"b":2}]}`)); e != nil {
		t.Fatal(e)
	}
}
func TestProfileRequest(t *testing.T) {
	ops, e := contracts()
	if e != nil {
		t.Fatal(e)
	}
	for _, o := range ops {
		if o.ID != "updateProfile" {
			continue
		}
		for _, body := range []string{`{"version":1,"admin":true}`, `{"version":1,"version":2}`, `null`} {
			r := httptest.NewRequest("PATCH", "/v1/me", strings.NewReader(body))
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("Idempotency-Key", "10000000-0000-4000-8000-000000000001")
			if _, e = o.validate(r); e == nil {
				t.Errorf("accepted %s", body)
			}
		}
	}
}

func TestOIDCCallbackRedirectIsPartOfContract(t *testing.T) {
	ops, e := contracts()
	if e != nil {
		t.Fatal(e)
	}
	for _, o := range ops {
		if o.ID == "oidcCallback" {
			if _, ok := o.Responses["302"]; !ok {
				t.Fatal("callback redirect absent from generated contract")
			}
			return
		}
	}
	t.Fatal("callback absent")
}
