package push

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestFixedPushPayloadAndDeliverySemantics(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var p map[string]any
		if e := json.NewDecoder(r.Body).Decode(&p); e != nil {
			t.Error(e)
		}
		m := p["message"].(map[string]any)
		data := m["data"].(map[string]any)
		if len(data) != 2 || data["route"] != "/guardian/alerts" {
			t.Error("unexpected private data or route")
		}
		if m["notification"].(map[string]any)["body"] != "You have a support request." {
			t.Error("notification body changed")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"name":"projects/test/messages/accepted"}`))
	}))
	defer server.Close()
	f := FCM{Project: "test", Client: server.Client(), Endpoint: server.URL}
	got, e := f.Send(context.Background(), "test-token", "10000000-0000-4000-8000-000000000001", time.Now().Add(10*time.Minute))
	if e != nil || !got.Accepted || got.Permanent {
		t.Fatalf("%+v %v", got, e)
	}
}
func TestInvalidTokenRevokedAndTransientRetry(t *testing.T) {
	for _, tc := range []struct {
		status             int
		body               string
		permanent, invalid bool
	}{{404, `{"error":{"details":[{"errorCode":"UNREGISTERED"}]}}`, true, true}, {503, `{"error":{"message":"private provider detail"}}`, false, false}} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(tc.status)
			_, _ = w.Write([]byte(tc.body))
		}))
		f := FCM{Project: "test", Client: server.Client(), Endpoint: server.URL}
		got, e := f.Send(context.Background(), "test-token", "10000000-0000-4000-8000-000000000001", time.Now().Add(time.Minute))
		server.Close()
		if e != nil || got.Permanent != tc.permanent || got.InvalidToken != tc.invalid {
			t.Fatalf("%+v %v", got, e)
		}
	}
}
