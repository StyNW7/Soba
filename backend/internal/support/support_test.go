package support

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/StyNW7/Soba/backend/internal/httpapi"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/push"
	"github.com/StyNW7/Soba/backend/internal/testutil"
)

type testSender struct {
	mu    sync.Mutex
	calls int
}

func (s *testSender) Send(context.Context, string, string, time.Time) (push.Outcome, error) {
	s.mu.Lock()
	s.calls++
	s.mu.Unlock()
	return push.Outcome{Accepted: true, MessageID: "projects/test/messages/1", Code: "accepted"}, nil
}

func TestContactsLinksGrantsAndNotifications(t *testing.T) {
	pool := testutil.Database(t)
	ctx := context.Background()
	subject := testutil.Owner(t, pool)
	recipient := testutil.Owner(t, pool)
	if _, err := pool.Exec(ctx, `UPDATE profiles SET shared_phone='+628123456789' WHERE id=$1`, subject); err != nil {
		t.Fatal(err)
	}
	sender := &testSender{}
	s := &Service{Pool: pool, Config: testutil.Config(), Guards: &platform.Guards{}, Sender: sender}

	r := testutil.Request(t, pool, subject)
	r.HTTP = httptest.NewRequest("POST", "/v1/trusted-contacts", nil)
	r.Body = map[string]any{"display_name": "Guardian", "phone": "+628123456789", "relationship": "guardian"}
	created, err := s.createContact(ctx, r)
	if err != nil {
		t.Fatal(err)
	}
	contactID := created.Body.(map[string]any)["id"].(string)
	if err = r.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	codeReq := testutil.Request(t, pool, subject)
	codeReq.HTTP = httptest.NewRequest("POST", "/v1/invites", nil)
	codeReq.Body = map[string]any{"contact_id": contactID, "kind": "guardian"}
	invite, err := s.createInvite(ctx, codeReq)
	if err != nil {
		t.Fatal(err)
	}
	if err = codeReq.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	code := invite.Body.(map[string]any)["code"].(string)

	accept := testutil.Request(t, pool, recipient)
	accept.HTTP = httptest.NewRequest("POST", "/v1/invites/accept", nil)
	accept.Body = map[string]any{"code": code}
	linkBody, err := s.acceptInvite(ctx, accept)
	if err != nil {
		t.Fatal(err)
	}
	linkID := linkBody.Body.(map[string]any)["id"].(string)
	if err = accept.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	approve := testutil.Request(t, pool, subject)
	approve.HTTP = httptest.NewRequest("POST", "/v1/links/"+linkID+"/approve", nil)
	approve.HTTP.SetPathValue("id", linkID)
	approve.Body = map[string]any{"version": int64(1)}
	if _, err = s.approveLink(ctx, approve); err != nil {
		t.Fatal(err)
	}
	if err = approve.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	grantReq := testutil.Request(t, pool, subject)
	grantReq.HTTP = httptest.NewRequest("POST", "/v1/grants", nil)
	grantReq.Body = map[string]any{"link_id": linkID, "scope": "safety_alerts", "policy_version": "test-v1"}
	grant, err := s.createGrant(ctx, grantReq)
	if err != nil {
		t.Fatal(err)
	}
	grantID := grant.Body.(map[string]any)["id"].(string)
	if err = grantReq.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	installationID := platform.ID()
	install := testutil.Request(t, pool, recipient)
	install.HTTP = httptest.NewRequest("PUT", "/v1/push-installations", nil)
	install.Body = map[string]any{"installation_id": installationID, "platform": "android", "token": "recipient-token"}
	if _, err = s.registerPush(ctx, install); err != nil {
		t.Fatal(err)
	}
	if err = install.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	request := testutil.Request(t, pool, subject)
	request.HTTP = httptest.NewRequest("POST", "/v1/support-requests", nil)
	request.Body = map[string]any{"contact_id": contactID, "reason": "user_request"}
	support, err := s.createSupportRequest(ctx, request)
	if err != nil {
		t.Fatal(err)
	}
	supportID := support.Body.(map[string]any)["id"].(string)
	if support.Body.(map[string]any)["state"] != "awaiting_permission" {
		t.Fatalf("unexpected support request: %#v", support.Body)
	}
	version := int64(support.Body.(map[string]any)["version"].(float64))
	if err = request.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	confirm := testutil.Request(t, pool, subject)
	confirm.HTTP = httptest.NewRequest("POST", "/v1/support-requests/"+supportID+"/confirm", nil)
	confirm.HTTP.SetPathValue("id", supportID)
	confirm.Body = map[string]any{"confirmed": "yes", "version": version}
	confirmed, err := s.confirmSupportRequest(ctx, confirm)
	if err != nil {
		t.Fatal(err)
	}
	if confirmed.Body.(map[string]any)["state"] != "queued" {
		t.Fatalf("unexpected confirmed request: %#v", confirmed.Body)
	}
	if err = confirm.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	s.Tick(ctx)
	alerts := testutil.Request(t, pool, recipient)
	alerts.HTTP = httptest.NewRequest("GET", "/v1/alerts", nil)
	result, err := s.listRecipientAlerts(ctx, alerts)
	if err != nil {
		t.Fatal(err)
	}
	items := result.Body.(map[string]any)["items"].([]map[string]any)
	if len(items) != 1 || items[0]["id"] != supportID || items[0]["state"] != "provider_accepted" {
		t.Fatalf("unexpected alerts: %#v", result.Body)
	}
	if err = alerts.Tx.Rollback(ctx); err != nil {
		t.Fatal(err)
	}

	reach := testutil.Request(t, pool, recipient)
	reach.HTTP = httptest.NewRequest("GET", "/v1/alerts/"+supportID+"/reach-out", nil)
	reach.HTTP.SetPathValue("id", supportID)
	out, err := s.getReachOut(ctx, reach)
	if err != nil {
		t.Fatal(err)
	}
	if out.Body.(map[string]any)["phone"] != "+628123456789" {
		t.Fatalf("unexpected reach-out response: %#v", out.Body)
	}
	_ = reach.Tx.Rollback(ctx)

	// A stale lease must never reach the provider. This is the race that can
	// happen when a worker claims a job and the lease expires before dispatch.
	expiredRequestID := platform.ID()
	if _, err = pool.Exec(ctx, `INSERT INTO support_requests(id,owner_id,contact_id,link_id,grant_id,state,reason,confirmed_at,expires_at)
		VALUES($1,$2,$3,$4,$5,'queued','user_request',now(),now()+interval '15 minutes')`, expiredRequestID, subject, contactID, linkID, grantID); err != nil {
		t.Fatal(err)
	}
	expiredJobID := platform.ID()
	lease := platform.ID()
	if _, err = pool.Exec(ctx, `INSERT INTO notification_jobs(id,request_id,installation_id,state,next_attempt_at,lease_token,lease_expires_at)
		VALUES($1,$2,$3,'leased',now(),$4,now()-interval '1 second')`, expiredJobID, expiredRequestID, installationID, lease); err != nil {
		t.Fatal(err)
	}
	sender.mu.Lock()
	sendsBefore := sender.calls
	sender.mu.Unlock()
	if err = s.dispatchJob(ctx, notificationJob{id: expiredJobID, requestID: expiredRequestID, installationID: installationID, subjectID: subject, recipientID: recipient, linkID: linkID, keyVersion: s.Config.KeyVersion, lease: lease}); err != nil {
		t.Fatal(err)
	}
	sender.mu.Lock()
	sendsAfter := sender.calls
	sender.mu.Unlock()
	if sendsAfter != sendsBefore {
		t.Fatalf("stale lease called sender: before=%d after=%d", sendsBefore, sendsAfter)
	}
	var jobState string
	if err = pool.QueryRow(ctx, `SELECT state FROM notification_jobs WHERE id=$1`, expiredJobID).Scan(&jobState); err != nil {
		t.Fatal(err)
	}
	if jobState != "cancelled" {
		t.Fatalf("stale lease state = %q, want cancelled", jobState)
	}

	remove := testutil.Request(t, pool, subject)
	remove.HTTP = httptest.NewRequest("DELETE", "/v1/trusted-contacts/"+contactID, nil)
	remove.HTTP.SetPathValue("id", contactID)
	if _, err = s.deleteContact(ctx, remove); err != nil {
		t.Fatal(err)
	}
	if err = remove.Tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

}

func TestHTTPContractFlow(t *testing.T) {
	pool := testutil.Database(t)
	subject := testutil.Owner(t, pool)
	recipient := testutil.Owner(t, pool)
	if _, err := pool.Exec(context.Background(), `UPDATE profiles SET shared_phone='+628123456789' WHERE id=$1`, subject); err != nil {
		t.Fatal(err)
	}
	cfg := testutil.Config()
	s := &Service{Pool: pool, Config: cfg, Guards: &platform.Guards{}, Sender: &testSender{}}
	handlers := map[string]platform.Handler{}
	ops, err := httpapi.RegisteredOperations()
	if err != nil {
		t.Fatal(err)
	}
	for _, operation := range ops {
		handlers[operation] = func(context.Context, *platform.Request) (platform.Result, error) {
			return platform.Result{}, platform.Unavailable()
		}
	}
	for operation, handler := range s.Handlers() {
		handlers[operation] = handler
	}
	server := &httpapi.Server{
		Pool:     pool,
		Config:   cfg,
		Guards:   s.Guards,
		Handlers: handlers,
		Authenticate: func(_ context.Context, request *http.Request) (platform.Principal, error) {
			owner := subject
			if request.Header.Get("X-Test-Actor") == "recipient" {
				owner = recipient
			}
			return platform.Principal{OwnerID: owner, Client: "mobile", AuthenticatedAt: time.Now()}, nil
		},
	}
	handler, err := server.Handler()
	if err != nil {
		t.Fatal(err)
	}
	send := func(actor, method, path, body string, want int) map[string]any {
		t.Helper()
		request := httptest.NewRequest(method, "https://app.soba.test"+path, strings.NewReader(body))
		if body != "" {
			request.Header.Set("Content-Type", "application/json")
		}
		if method != http.MethodGet {
			request.Header.Set("Idempotency-Key", platform.ID())
		}
		request.Header.Set("X-Test-Actor", actor)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != want {
			t.Fatalf("%s %s: want %d, got %d: %s", method, path, want, response.Code, response.Body.String())
		}
		if response.Code == http.StatusNoContent {
			return nil
		}
		var result map[string]any
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatalf("decode %s %s: %v", method, path, err)
		}
		return result
	}

	contact := send("subject", http.MethodPost, "/v1/trusted-contacts", `{"display_name":"Guardian","phone":"+628123456789","relationship":"guardian"}`, http.StatusCreated)
	contactID := contact["id"].(string)
	send("subject", http.MethodGet, "/v1/trusted-contacts", "", http.StatusOK)
	invite := send("subject", http.MethodPost, "/v1/invites", `{"contact_id":"`+contactID+`","kind":"guardian"}`, http.StatusCreated)
	link := send("recipient", http.MethodPost, "/v1/invites/accept", `{"code":"`+invite["code"].(string)+`"}`, http.StatusOK)
	linkID := link["id"].(string)
	send("subject", http.MethodPost, "/v1/links/"+linkID+"/approve", `{"version":1}`, http.StatusOK)
	send("subject", http.MethodPost, "/v1/grants", `{"link_id":"`+linkID+`","scope":"safety_alerts","policy_version":"test-v1"}`, http.StatusCreated)
	installationID := platform.ID()
	send("recipient", http.MethodPut, "/v1/push-installations", `{"installation_id":"`+installationID+`","platform":"android","token":"http-recipient-token"}`, http.StatusNoContent)
	request := send("subject", http.MethodPost, "/v1/support-requests", `{"contact_id":"`+contactID+`","reason":"user_request"}`, http.StatusCreated)
	requestID := request["id"].(string)
	version := int(request["version"].(float64))
	send("subject", http.MethodPost, "/v1/support-requests/"+requestID+"/confirm", `{"confirmed":"yes","version":`+strconv.Itoa(version)+`}`, http.StatusOK)
	s.Tick(context.Background())
	send("recipient", http.MethodGet, "/v1/alerts", "", http.StatusOK)
	send("recipient", http.MethodGet, "/v1/alerts/"+requestID+"/reach-out", "", http.StatusOK)
	send("recipient", http.MethodPost, "/v1/alerts/"+requestID+"/acknowledge", "", http.StatusOK)
	send("subject", http.MethodDelete, "/v1/trusted-contacts/"+contactID, "", http.StatusNoContent)
}
