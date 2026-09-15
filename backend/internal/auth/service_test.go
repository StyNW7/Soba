package auth

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/testutil"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/coreos/go-oidc/v3/oidc/oidctest"
)

func TestProfilePreferencesAndConsentUseOwnerTransaction(t *testing.T) {
	pool := testutil.Database(t)
	owner := testutil.Owner(t, pool)
	cfg := testutil.Config()
	cancelled := 0
	service := &Service{Pool: pool, Config: cfg, CancelOwner: func(string) { cancelled++ }}

	r := testutil.Request(t, pool, owner)
	r.Body = map[string]any{
		"display_name": "  Updated Person  ",
		"locale":       "en-US",
		"timezone":     "Asia/Jakarta",
		"roles":        []any{"user"},
		"age_band":     "18_plus",
		"version":      float64(1),
		"shared_phone": nil,
	}
	result, err := service.Handlers()["updateProfile"](context.Background(), r)
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != http.StatusOK {
		t.Fatalf("unexpected profile status: %d", result.Status)
	}
	if err = r.Tx.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}

	value, err := service.Handlers()["getProfile"](context.Background(), &platform.Request{Principal: platform.Principal{OwnerID: owner}})
	if err != nil {
		t.Fatal(err)
	}
	profile, ok := value.Body.(map[string]any)
	if !ok || profile["display_name"] != "Updated Person" || profile["eligibility"] != "allowed" {
		t.Fatalf("unexpected profile: %#v", value.Body)
	}

	r = testutil.Request(t, pool, owner)
	r.Body = map[string]any{
		"personality":          "friendly",
		"voice":                "cedar",
		"listen_first":         false,
		"memory_enabled":       true,
		"mood_history_enabled": true,
		"version":              float64(1),
	}
	if _, err = service.Handlers()["setPreferences"](context.Background(), r); err != nil {
		t.Fatal(err)
	}
	if err = r.Tx.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	for _, callback := range r.AfterCommit {
		callback()
	}
	var moodEnabled bool
	if err := pool.QueryRow(context.Background(), `SELECT mood_history_enabled FROM preferences WHERE owner_id=$1`, owner).Scan(&moodEnabled); err != nil || !moodEnabled {
		t.Fatalf("mood preference did not persist: %v", err)
	}
	if cancelled != 1 {
		t.Fatalf("preference update did not cancel active owner context: %d", cancelled)
	}

	r = testutil.Request(t, pool, owner)
	r.Body = map[string]any{"accepted": false, "policy_version": cfg.PolicyVersion}
	if _, err = service.Handlers()["setProcessingConsent"](context.Background(), r); err != nil {
		t.Fatal(err)
	}
	if err = r.Tx.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	for _, callback := range r.AfterCommit {
		callback()
	}
	if cancelled != 2 {
		t.Fatalf("consent withdrawal did not cancel active owner context: %d", cancelled)
	}
	var revoked time.Time
	if err = pool.QueryRow(context.Background(), `SELECT processing_revoked_at FROM profiles WHERE id=$1`, owner).Scan(&revoked); err != nil {
		t.Fatal(err)
	}
	if revoked.IsZero() {
		t.Fatal("consent withdrawal was not stored")
	}
}

func TestAuthenticateAndRefreshRotateAndRevokeReuse(t *testing.T) {
	pool := testutil.Database(t)
	owner := testutil.Owner(t, pool)
	cancelled := 0
	service := &Service{Pool: pool, Config: testutil.Config(), CancelOwner: func(string) { cancelled++ }}
	access := platform.Token()
	refresh := platform.Token()
	session := platform.ID()
	now := time.Now().UTC()
	_, err := pool.Exec(context.Background(), `INSERT INTO auth_sessions(id,owner_id,access_hash,refresh_hash,client,authenticated_at,last_used_at,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,$4,'mobile',$5,$5,$6,$7)`, session, owner, platform.Hash(access), platform.Hash(refresh), now, now.Add(15*time.Minute), now.Add(30*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}

	principal, err := service.Authenticate(context.Background(), httptest.NewRequest(http.MethodGet, "https://app.soba.test/v1/me", strings.NewReader("")))
	if err == nil || principal.OwnerID != "" {
		t.Fatal("unauthenticated request unexpectedly succeeded")
	}
	request := httptest.NewRequest(http.MethodGet, "https://app.soba.test/v1/me", strings.NewReader(""))
	request.Header.Set("Authorization", "Bearer "+access)
	principal, err = service.Authenticate(context.Background(), request)
	if err != nil || principal.OwnerID != owner || principal.SessionID != session {
		t.Fatalf("authenticate failed: owner=%q session=%q err=%v", principal.OwnerID, principal.SessionID, err)
	}

	result, err := service.Handlers()["refreshMobileTokens"](context.Background(), &platform.Request{Body: map[string]any{"refresh_token": refresh}})
	if err != nil {
		t.Fatal(err)
	}
	tokens, ok := result.Body.(map[string]any)
	if !ok || tokens["access_token"] == access || tokens["refresh_token"] == refresh {
		t.Fatalf("refresh did not rotate tokens: %#v", result.Body)
	}

	_, err = service.Handlers()["refreshMobileTokens"](context.Background(), &platform.Request{Body: map[string]any{"refresh_token": refresh}})
	if err == nil {
		t.Fatal("refresh-token reuse was accepted")
	}
	var revoked *time.Time
	if err = pool.QueryRow(context.Background(), `SELECT revoked_at FROM auth_sessions WHERE id=$1`, session).Scan(&revoked); err != nil {
		t.Fatal(err)
	}
	if revoked == nil || revoked.IsZero() {
		t.Fatal("refresh-token reuse did not revoke the session family")
	}
}

func TestWebCookieCsrfAndLogout(t *testing.T) {
	pool := testutil.Database(t)
	owner := testutil.Owner(t, pool)
	cancelled := 0
	service := &Service{Pool: pool, Config: testutil.Config(), CancelOwner: func(string) { cancelled++ }}
	sessionToken := platform.Token()
	sessionID := platform.ID()
	now := time.Now().UTC()
	_, err := pool.Exec(context.Background(), `INSERT INTO auth_sessions(id,owner_id,access_hash,client,authenticated_at,last_used_at,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,'web',$4,$4,$5,$5)`, sessionID, owner, platform.Hash(sessionToken), now, now.Add(7*24*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	cookieRequest := httptest.NewRequest(http.MethodGet, "https://app.soba.test/v1/me", nil)
	cookieRequest.AddCookie(&http.Cookie{Name: "soba_session", Value: sessionToken})
	principal, err := service.Authenticate(context.Background(), cookieRequest)
	if err != nil || principal.Client != "web" {
		t.Fatalf("cookie authentication failed: %#v %v", principal, err)
	}

	csrf, err := service.Handlers()["getCsrfToken"](context.Background(), &platform.Request{Principal: principal})
	if err != nil {
		t.Fatal(err)
	}
	csrfBody := csrf.Body.(map[string]any)
	if len(csrfBody["token"].(string)) < 43 {
		t.Fatal("csrf token is too short")
	}

	tx, err := pool.Begin(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	logoutRequest := &platform.Request{Principal: principal, Tx: tx}
	logout, err := service.Handlers()["logout"](context.Background(), logoutRequest)
	if err != nil {
		_ = tx.Rollback(context.Background())
		t.Fatal(err)
	}
	if err = tx.Commit(context.Background()); err != nil {
		t.Fatal(err)
	}
	for _, callback := range logoutRequest.AfterCommit {
		callback()
	}
	if cancelled != 1 {
		t.Fatalf("logout did not cancel owner context: %d", cancelled)
	}
	if logout.Status != http.StatusNoContent || logout.Headers.Get("Set-Cookie") == "" {
		t.Fatalf("logout did not clear cookie: %#v", logout)
	}
	if _, err = service.Authenticate(context.Background(), cookieRequest); err == nil {
		t.Fatal("revoked web cookie was accepted")
	}
}

func TestOIDCMobilePKCECallbackAndExchange(t *testing.T) {
	pool := testutil.Database(t)
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	issuerHandler := &oidctest.Server{PublicKeys: []oidctest.PublicKey{{PublicKey: key.Public(), KeyID: "soba-test", Algorithm: oidc.RS256}}}
	var expectedVerifier, expectedNonce, issuerURL string
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil || r.Form.Get("code_verifier") == "" {
			http.Error(w, "invalid verifier", http.StatusBadRequest)
			return
		}
		now := time.Now().UTC()
		claims := map[string]any{
			"iss":            issuerURL,
			"aud":            "soba-test-client",
			"sub":            "issuer-subject-1",
			"exp":            now.Add(time.Hour).Unix(),
			"iat":            now.Unix(),
			"auth_time":      now.Unix(),
			"nonce":          expectedNonce,
			"name":           "OIDC Person",
			"email":          "oidc@example.test",
			"email_verified": true,
		}
		payload, _ := json.Marshal(claims)
		idToken := oidctest.SignIDToken(key, "soba-test", oidc.RS256, string(payload))
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "provider-access", "token_type": "Bearer", "id_token": idToken})
	})
	mux.HandleFunc("/", issuerHandler.ServeHTTP)
	issuer := httptest.NewServer(mux)
	defer issuer.Close()
	issuerURL = issuer.URL
	issuerHandler.SetIssuer(issuer.URL)

	cfg := testutil.Config()
	cfg.OIDCIssuer = issuer.URL
	cfg.OIDCClientID = "soba-test-client"
	cfg.OIDCRedirectURI = issuer.URL + "/callback"
	cfg.MobileReturnURI = "soba://auth"
	service := &Service{Pool: pool, Config: cfg}
	expectedVerifier = platform.Token()
	challenge := hashPKCEVerifier(expectedVerifier)
	start, err := service.startLogin(context.Background(), &platform.Request{Body: map[string]any{"client": "mobile", "return_path": "/app", "mobile_challenge": challenge}})
	if err != nil {
		t.Fatal(err)
	}
	redirectURL, err := url.Parse(start.Body.(map[string]any)["authorization_url"].(string))
	if err != nil {
		t.Fatal(err)
	}
	expectedNonce = redirectURL.Query().Get("nonce")
	if expectedNonce == "" || redirectURL.Query().Get("code_challenge") == "" || redirectURL.Query().Get("prompt") != "login" || redirectURL.Query().Get("max_age") != "0" {
		t.Fatalf("authorization URL did not include required parameters: %s", redirectURL.String())
	}
	callbackRequest := httptest.NewRequest(http.MethodGet, cfg.OIDCRedirectURI+"?code=one-time-code&state="+url.QueryEscape(redirectURL.Query().Get("state")), nil)
	callback, err := service.oidcCallback(context.Background(), &platform.Request{HTTP: callbackRequest})
	if err != nil {
		t.Fatal(err)
	}
	if callback.Status != http.StatusFound || callback.Headers.Get("Location") == "" {
		t.Fatalf("callback did not return a redirect result: %#v", callback)
	}
	location, err := url.Parse(callback.Headers.Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	loginCode := location.Query().Get("code")
	if loginCode == "" || location.Scheme != "soba" {
		t.Fatalf("callback leaked an invalid mobile redirect: %s", location.String())
	}
	exchange, err := service.exchangeMobileCode(context.Background(), &platform.Request{Body: map[string]any{"code": loginCode, "verifier": expectedVerifier}})
	if err != nil {
		t.Fatal(err)
	}
	tokens := exchange.Body.(map[string]any)
	access := tokens["access_token"].(string)
	request := httptest.NewRequest(http.MethodGet, "https://app.soba.test/v1/me", nil)
	request.Header.Set("Authorization", "Bearer "+access)
	principal, err := service.Authenticate(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if principal.Client != "mobile" {
		t.Fatalf("unexpected mobile principal: %#v", principal)
	}
	var storedAuthTime time.Time
	if err = pool.QueryRow(context.Background(), `SELECT authenticated_at FROM auth_sessions WHERE owner_id=$1`, principal.OwnerID).Scan(&storedAuthTime); err != nil {
		t.Fatal(err)
	}
	if storedAuthTime.IsZero() || storedAuthTime.After(time.Now().UTC()) {
		t.Fatalf("issuer auth_time was not stored: %s", storedAuthTime)
	}
}

func TestIDTokenCannotSubstituteIssueTimeForAuthenticationTime(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	handler := &oidctest.Server{PublicKeys: []oidctest.PublicKey{{PublicKey: key.Public(), KeyID: "freshness", Algorithm: oidc.RS256}}}
	issuer := httptest.NewServer(handler)
	defer issuer.Close()
	handler.SetIssuer(issuer.URL)
	provider, err := oidc.NewProvider(context.Background(), issuer.URL)
	if err != nil {
		t.Fatal(err)
	}
	service := &Service{Config: platform.Config{OIDCClientID: "client"}}
	now := time.Now().UTC()
	claims := map[string]any{"iss": issuer.URL, "aud": "client", "sub": "subject", "exp": now.Add(time.Hour).Unix(), "iat": now.Unix(), "nonce": "expected", "email": "user@example.test", "email_verified": true}
	sign := func() string {
		body, _ := json.Marshal(claims)
		return oidctest.SignIDToken(key, "freshness", oidc.RS256, string(body))
	}
	if _, _, _, err = service.verifyIDToken(context.Background(), provider, sign(), platform.Hash("expected")); err == nil {
		t.Fatal("token issue time accepted as fresh authentication")
	}
	old := now.Add(-time.Hour).Truncate(time.Second)
	claims["auth_time"] = old.Unix()
	_, _, actual, err := service.verifyIDToken(context.Background(), provider, sign(), platform.Hash("expected"))
	if err != nil || !actual.Equal(old) {
		t.Fatal("original authentication time was not preserved")
	}
	delete(claims, "email_verified")
	if _, _, _, err = service.verifyIDToken(context.Background(), provider, sign(), platform.Hash("expected")); err == nil {
		t.Fatal("unverified email identity accepted")
	}
}
