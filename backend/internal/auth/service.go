// Package auth implements SOBA identity, session, profile, preference, and
// processing-consent operations.
package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
)

const (
	webSessionLifetime    = 7 * 24 * time.Hour
	webInactivityLifetime = 12 * time.Hour
	mobileAccessLifetime  = 15 * time.Minute
	mobileRefreshLifetime = 30 * 24 * time.Hour
	authFlowLifetime      = 5 * time.Minute
	mobileCodeLifetime    = time.Minute

	profileJSON = `jsonb_build_object('id',id,'display_name',display_name,'locale',locale,'timezone',timezone,'roles',roles,'eligibility',eligibility,'age_band',age_band,'deleting',deleting,'version',version,'shared_phone',shared_phone)`
	prefsJSON   = `jsonb_build_object('personality',p.personality,'voice',p.voice,'listen_first',p.listen_first,'memory_enabled',p.memory_enabled,'mood_history_enabled',p.mood_history_enabled,'version',p.version)`
)

var e164Pattern = regexp.MustCompile(`^\+[1-9][0-9]{6,14}$`)
var pkceVerifierPattern = regexp.MustCompile(`^[A-Za-z0-9\-\._~]+$`)

// Service owns the auth database and OIDC integration. HTTPClient is optional
// and exists so tests can use a local issuer without changing global clients.
type Service struct {
	Pool              *pgxpool.Pool
	Config            platform.Config
	CancelOwner       func(string)
	CancelActiveOwner func(string)
	HTTPClient        *http.Client

	providerMu sync.Mutex
	provider   *oidc.Provider
}

// NewService is a convenience constructor for the application assembly.
func NewService(pool *pgxpool.Pool, cfg platform.Config, cancelOwner func(string)) *Service {
	return &Service{Pool: pool, Config: cfg, CancelOwner: cancelOwner}
}

// Handlers returns the operation IDs owned by this package.
func (s *Service) Handlers() map[string]platform.Handler {
	return map[string]platform.Handler{
		"startLogin":           s.startLogin,
		"exchangeMobileCode":   s.exchangeMobileCode,
		"refreshMobileTokens":  s.refreshMobileTokens,
		"logout":               s.logout,
		"getCsrfToken":         s.getCsrfToken,
		"oidcCallback":         s.oidcCallback,
		"getPolicy":            s.getPolicy,
		"getProfile":           s.getProfile,
		"updateProfile":        s.updateProfile,
		"setProcessingConsent": s.setProcessingConsent,
		"getPreferences":       s.getPreferences,
		"setPreferences":       s.setPreferences,
	}
}

func authRequired() error {
	return platform.Fail(http.StatusUnauthorized, "unauthenticated", "Authentication is required.")
}

func policyBlocked() error {
	return platform.Fail(http.StatusForbidden, "policy_blocked", "Account data is not available.")
}

func (s *Service) begin(ctx context.Context) (pgx.Tx, error) {
	if s.Pool == nil {
		return nil, errors.New("auth service has no database pool")
	}
	return s.Pool.Begin(ctx)
}

func requestString(r *platform.Request, key string) (string, error) {
	v, ok := r.Body[key]
	if !ok {
		return "", platform.Invalid("A required field is missing.")
	}
	s, ok := v.(string)
	if !ok {
		return "", platform.Invalid("The request field has an invalid type.")
	}
	return s, nil
}

func requestBool(r *platform.Request, key string) (bool, error) {
	v, ok := r.Body[key]
	if !ok {
		return false, platform.Invalid("A required field is missing.")
	}
	b, ok := v.(bool)
	if !ok {
		return false, platform.Invalid("The request field has an invalid type.")
	}
	return b, nil
}

func requestVersion(r *platform.Request, key string) (int64, error) {
	v, ok := r.Body[key]
	if !ok {
		return 0, platform.Invalid("A required version is missing.")
	}
	var n int64
	switch x := v.(type) {
	case float64:
		if x != float64(int64(x)) {
			return 0, platform.Invalid("The version is invalid.")
		}
		n = int64(x)
	case int:
		n = int64(x)
	case int32:
		n = int64(x)
	case int64:
		n = x
	case json.Number:
		parsed, err := x.Int64()
		if err != nil {
			return 0, platform.Invalid("The version is invalid.")
		}
		n = parsed
	default:
		return 0, platform.Invalid("The version is invalid.")
	}
	if n < 1 {
		return 0, platform.Invalid("The version is invalid.")
	}
	return n, nil
}

func parseRoles(v any) ([]string, error) {
	var values []any
	switch x := v.(type) {
	case []any:
		values = x
	case []string:
		values = make([]any, len(x))
		for i := range x {
			values[i] = x[i]
		}
	default:
		return nil, platform.Invalid("Roles are invalid.")
	}
	if len(values) == 0 || len(values) > 2 {
		return nil, platform.Invalid("At least one role is required.")
	}
	seen := map[string]bool{}
	roles := make([]string, 0, len(values))
	for _, value := range values {
		role, ok := value.(string)
		if !ok || (role != "user" && role != "guardian") || seen[role] {
			return nil, platform.Invalid("Roles are invalid.")
		}
		seen[role] = true
		roles = append(roles, role)
	}
	return roles, nil
}

func validateDisplayName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 80 {
		return "", platform.Invalid("Display name must contain 1 to 80 characters.")
	}
	return name, nil
}

func validatePhone(v any) (*string, error) {
	if v == nil {
		return nil, nil
	}
	phone, ok := v.(string)
	if !ok || !e164Pattern.MatchString(phone) {
		return nil, platform.Invalid("The shared phone number is invalid.")
	}
	return &phone, nil
}

func validateLocale(locale string) error {
	if locale != "en-US" {
		return platform.Invalid("Locale is invalid.")
	}
	return nil
}

func validateTimezone(name string) error {
	if !utf8.ValidString(name) || utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 64 {
		return platform.Invalid("Timezone is invalid.")
	}
	if _, err := time.LoadLocation(name); err != nil {
		return platform.Invalid("Timezone is invalid.")
	}
	return nil
}

func validateAgeBand(age string) error {
	if age != "under_18" && age != "18_plus" && age != "unknown" {
		return platform.Invalid("Age band is invalid.")
	}
	return nil
}

func eligibilityFor(age string) string {
	switch age {
	case "18_plus":
		return "allowed"
	case "under_18":
		return "blocked"
	default:
		return "pending"
	}
}

func hashPKCEVerifier(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func validPKCEVerifier(verifier string) bool {
	if len(verifier) < 43 || len(verifier) > 128 || !pkceVerifierPattern.MatchString(verifier) {
		return false
	}
	return true
}

func validPKCEChallenge(challenge string) bool {
	if len(challenge) < 43 || len(challenge) > 128 {
		return false
	}
	decoded, err := base64.RawURLEncoding.DecodeString(challenge)
	return err == nil && len(decoded) == sha256.Size
}

func (s *Service) providerFor(ctx context.Context) (*oidc.Provider, error) {
	if strings.TrimSpace(s.Config.OIDCIssuer) == "" || strings.TrimSpace(s.Config.OIDCClientID) == "" {
		return nil, platform.Unavailable()
	}
	s.providerMu.Lock()
	defer s.providerMu.Unlock()
	if s.provider != nil {
		return s.provider, nil
	}
	issuer, err := url.Parse(s.Config.OIDCIssuer)
	if err != nil || issuer.Scheme != "https" && !((s.Config.Env == "" || s.Config.Env == "development") && issuer.Scheme == "http") || issuer.Host == "" || issuer.RawQuery != "" || issuer.Fragment != "" {
		return nil, platform.Unavailable()
	}
	providerCtx := ctx
	if s.HTTPClient != nil {
		providerCtx = oidc.ClientContext(ctx, s.HTTPClient)
	}
	provider, err := oidc.NewProvider(providerCtx, s.Config.OIDCIssuer)
	if err != nil {
		return nil, platform.Unavailable()
	}
	s.provider = provider
	return provider, nil
}

func (s *Service) oauthConfig(provider *oidc.Provider) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     s.Config.OIDCClientID,
		ClientSecret: s.Config.OIDCClientSecret,
		Endpoint:     provider.Endpoint(),
		RedirectURL:  s.Config.OIDCRedirectURI,
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}
}

func (s *Service) safeWebURL(returnPath, status string) string {
	base := strings.TrimRight(s.Config.PublicURL, "/")
	if status != "" {
		return base + "/auth/complete?status=" + url.QueryEscape(status)
	}
	if returnPath != "/app" && returnPath != "/guardian" {
		return base + "/auth/complete?status=failed"
	}
	return base + returnPath
}

func (s *Service) safeMobileURL(code, status string) (string, error) {
	if strings.TrimSpace(s.Config.MobileReturnURI) == "" {
		return "", platform.Unavailable()
	}
	u, err := url.Parse(s.Config.MobileReturnURI)
	if err != nil || u.Scheme == "" || u.Host == "" || u.RawQuery != "" || u.Fragment != "" {
		return "", platform.Unavailable()
	}
	q := u.Query()
	if code != "" {
		q.Set("code", code)
	}
	if status != "" {
		q.Set("status", status)
	}
	u.RawQuery = q.Encode()
	return u.String(), nil
}

func writeRedirect(_ *platform.Request, location string) (platform.Result, error) {
	return platform.Result{Status: http.StatusFound, Headers: http.Header{"Location": []string{location}}}, nil
}

func (s *Service) verifyIDToken(ctx context.Context, provider *oidc.Provider, raw string, expectedNonceHash []byte) (string, string, time.Time, error) {
	verifier := provider.VerifierContext(ctx, &oidc.Config{
		ClientID: s.Config.OIDCClientID,
		SupportedSigningAlgs: []string{
			oidc.RS256, oidc.RS384, oidc.RS512,
			oidc.ES256, oidc.ES384, oidc.ES512,
			oidc.PS256, oidc.PS384, oidc.PS512,
			oidc.EdDSA,
		},
	})
	token, err := verifier.Verify(ctx, raw)
	if err != nil || token.Subject == "" || token.Nonce == "" || !secureEqual(platform.Hash(token.Nonce), expectedNonceHash) {
		return "", "", time.Time{}, authRequired()
	}
	var claims struct {
		Name          string `json:"name"`
		Email         string `json:"email"`
		EmailVerified *bool  `json:"email_verified"`
		AuthTime      int64  `json:"auth_time"`
	}
	if err = token.Claims(&claims); err != nil {
		return "", "", time.Time{}, authRequired()
	}
	if claims.Email != "" && (claims.EmailVerified == nil || !*claims.EmailVerified) {
		return "", "", time.Time{}, authRequired()
	}
	// Every authorization request uses max_age=0. Require the issuer's
	// authentication time; a newly issued token is not proof of a fresh login.
	if claims.AuthTime <= 0 {
		return "", "", time.Time{}, authRequired()
	}
	authTime := time.Unix(claims.AuthTime, 0).UTC()
	if authTime.IsZero() || authTime.After(time.Now().UTC().Add(2*time.Minute)) {
		return "", "", time.Time{}, authRequired()
	}
	return token.Subject, claims.Name, authTime, nil
}

type authFlow struct {
	ID             string
	NonceHash      []byte
	VerifierCipher []byte
	Challenge      *string
	Client         string
	ReturnPath     string
	ExpiresAt      time.Time
}

func (s *Service) consumeFlow(ctx context.Context, state string) (authFlow, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return authFlow{}, err
	}
	defer tx.Rollback(context.Background())
	var flow authFlow
	var consumed *time.Time
	err = tx.QueryRow(ctx, `SELECT id,nonce_hash,pkce_verifier_ciphertext,mobile_challenge,client,return_path,expires_at,consumed_at FROM auth_flows WHERE state_hash=$1 FOR UPDATE`, platform.Hash(state)).Scan(&flow.ID, &flow.NonceHash, &flow.VerifierCipher, &flow.Challenge, &flow.Client, &flow.ReturnPath, &flow.ExpiresAt, &consumed)
	if errors.Is(err, pgx.ErrNoRows) {
		return authFlow{}, platform.Fail(http.StatusGone, "invalid_state", "This login attempt is no longer valid.")
	}
	if err != nil {
		return authFlow{}, err
	}
	if consumed != nil || !time.Now().UTC().Before(flow.ExpiresAt) {
		return authFlow{}, platform.Fail(http.StatusGone, "invalid_state", "This login attempt is no longer valid.")
	}
	if _, err = tx.Exec(ctx, `UPDATE auth_flows SET consumed_at=now() WHERE id=$1 AND consumed_at IS NULL`, flow.ID); err != nil {
		return authFlow{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return authFlow{}, err
	}
	return flow, nil
}

func displayName(name, email, subject string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		name = strings.TrimSpace(email)
	}
	if at := strings.IndexByte(name, '@'); at > 0 {
		name = name[:at]
	}
	if name == "" {
		name = "Soba user"
	}
	if utf8.RuneCountInString(name) > 80 {
		runes := []rune(name)
		name = string(runes[:80])
	}
	if name == "" {
		name = subject
	}
	return name
}

func ensureProfile(ctx context.Context, tx pgx.Tx, issuer, subject, name string) (string, error) {
	var id string
	if _, err := tx.Exec(ctx, `INSERT INTO profiles(id,issuer,identity_subject,display_name) VALUES($1,$2,$3,$4) ON CONFLICT (issuer,identity_subject) DO NOTHING`, platform.ID(), issuer, subject, name); err != nil {
		return "", err
	}
	if err := tx.QueryRow(ctx, `SELECT id FROM profiles WHERE issuer=$1 AND identity_subject=$2 FOR UPDATE`, issuer, subject).Scan(&id); err != nil {
		return "", err
	}
	var deleting bool
	if err := tx.QueryRow(ctx, `SELECT deleting FROM profiles WHERE id=$1 FOR UPDATE`, id).Scan(&deleting); err != nil {
		return "", err
	}
	if deleting {
		return "", policyBlocked()
	}
	if _, err := tx.Exec(ctx, `INSERT INTO preferences(owner_id) VALUES($1) ON CONFLICT (owner_id) DO NOTHING`, id); err != nil {
		return "", err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO safety_plans(owner_id) VALUES($1) ON CONFLICT (owner_id) DO NOTHING`, id); err != nil {
		return "", err
	}
	return id, nil
}

func sessionCookie(token string, expiry time.Time, clear bool) string {
	cookie := &http.Cookie{Name: "soba_session", Path: "/", HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode}
	if clear {
		cookie.Value = ""
		cookie.MaxAge = -1
		cookie.Expires = time.Unix(0, 0).UTC()
	} else {
		cookie.Value = token
		cookie.Expires = expiry.UTC()
	}
	return cookie.String()
}

func secureEqual(a, b []byte) bool {
	return len(a) == len(b) && hmac.Equal(a, b)
}

func (s *Service) startLogin(ctx context.Context, r *platform.Request) (platform.Result, error) {
	client, err := requestString(r, "client")
	if err != nil {
		return platform.Result{}, err
	}
	returnPath, err := requestString(r, "return_path")
	if err != nil {
		return platform.Result{}, err
	}
	if client != "web" && client != "mobile" {
		return platform.Result{}, platform.Invalid("Login client is invalid.")
	}
	if returnPath != "/app" && returnPath != "/guardian" {
		return platform.Result{}, platform.Invalid("Return path is invalid.")
	}
	challenge, _ := r.Body["mobile_challenge"].(string)
	if client == "mobile" {
		if !validPKCEChallenge(challenge) {
			return platform.Result{}, platform.Invalid("A mobile PKCE challenge is required.")
		}
	} else if challenge != "" {
		return platform.Result{}, platform.Invalid("Mobile challenge is only valid for mobile login.")
	}
	provider, err := s.providerFor(ctx)
	if err != nil {
		return platform.Result{}, err
	}
	state := platform.Token()
	nonce := platform.Token()
	verifier := platform.Token()
	ciphertext, err := platform.Encrypt(s.Config.DataKey, []byte(verifier))
	if err != nil {
		return platform.Result{}, err
	}
	expires := time.Now().UTC().Add(authFlowLifetime)
	tx, err := s.begin(ctx)
	if err != nil {
		return platform.Result{}, err
	}
	defer tx.Rollback(context.Background())
	_, err = tx.Exec(ctx, `INSERT INTO auth_flows(id,state_hash,nonce_hash,pkce_verifier_ciphertext,mobile_challenge,client,return_path,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, platform.ID(), platform.Hash(state), platform.Hash(nonce), ciphertext, nullableString(challenge), client, returnPath, expires)
	if err != nil {
		return platform.Result{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return platform.Result{}, err
	}
	authURL := s.oauthConfig(provider).AuthCodeURL(state,
		oauth2.SetAuthURLParam("nonce", nonce),
		oauth2.SetAuthURLParam("code_challenge", hashPKCEVerifier(verifier)),
		oauth2.SetAuthURLParam("code_challenge_method", "S256"),
		oauth2.SetAuthURLParam("prompt", "login"),
		oauth2.SetAuthURLParam("max_age", "0"),
	)
	return platform.OK(map[string]any{"authorization_url": authURL, "expires_at": expires}), nil
}

func nullableString(value string) any {
	if value == "" {
		return nil
	}
	return value
}

func (s *Service) oidcCallback(ctx context.Context, r *platform.Request) (platform.Result, error) {
	query := r.HTTP.URL.Query()
	state := query.Get("state")
	if state == "" || len(query["state"]) != 1 {
		return platform.Result{}, platform.Invalid("A valid authorization state is required.")
	}
	code, hasCode := query["code"]
	providerError, hasError := query["error"]
	if hasCode == hasError || (hasCode && (len(code) != 1 || code[0] == "")) || (hasError && (len(providerError) != 1 || providerError[0] == "")) {
		return platform.Result{}, platform.Invalid("The authorization response is invalid.")
	}
	flow, err := s.consumeFlow(ctx, state)
	if err != nil {
		return platform.Result{}, err
	}
	if hasError {
		if flow.Client == "mobile" {
			location, e := s.safeMobileURL("", "cancelled")
			if e != nil {
				return platform.Result{}, e
			}
			return writeRedirect(r, location)
		}
		return writeRedirect(r, s.safeWebURL(flow.ReturnPath, "cancelled"))
	}
	verifierPlain, err := platform.Decrypt(s.Config.DataKey, flow.VerifierCipher)
	if err != nil {
		return s.loginFailureRedirect(r, flow)
	}
	provider, err := s.providerFor(ctx)
	if err != nil {
		return s.loginFailureRedirect(r, flow)
	}
	token, err := s.oauthConfig(provider).Exchange(ctx, code[0], oauth2.VerifierOption(string(verifierPlain)))
	if err != nil {
		return s.loginFailureRedirect(r, flow)
	}
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return s.loginFailureRedirect(r, flow)
	}
	subject, claimedName, authTime, err := s.verifyIDToken(ctx, provider, rawIDToken, flow.NonceHash)
	if err != nil {
		return s.loginFailureRedirect(r, flow)
	}
	return s.finishLogin(ctx, r, flow, subject, claimedName, authTime)
}

func (s *Service) loginFailureRedirect(r *platform.Request, flow authFlow) (platform.Result, error) {
	if flow.Client == "mobile" {
		location, err := s.safeMobileURL("", "failed")
		if err != nil {
			return platform.Result{}, err
		}
		return writeRedirect(r, location)
	}
	return writeRedirect(r, s.safeWebURL(flow.ReturnPath, "failed"))
}

func (s *Service) finishLogin(ctx context.Context, r *platform.Request, flow authFlow, subject, claimedName string, authTime time.Time) (platform.Result, error) {
	tx, err := s.begin(ctx)
	if err != nil {
		return platform.Result{}, err
	}
	defer tx.Rollback(context.Background())
	owner, err := ensureProfile(ctx, tx, s.Config.OIDCIssuer, subject, displayName(claimedName, "", subject))
	if err != nil {
		return platform.Result{}, err
	}
	now := time.Now().UTC()
	if flow.Client == "web" {
		session := platform.Token()
		expires := now.Add(webSessionLifetime)
		if _, err = tx.Exec(ctx, `INSERT INTO auth_sessions(id,owner_id,access_hash,client,authenticated_at,last_used_at,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,'web',$4,$5,$6,$6)`, platform.ID(), owner, platform.Hash(session), authTime, now, expires); err != nil {
			return platform.Result{}, err
		}
		if err = tx.Commit(ctx); err != nil {
			return platform.Result{}, err
		}
		result, err := writeRedirect(r, s.safeWebURL(flow.ReturnPath, ""))
		if err != nil {
			return platform.Result{}, err
		}
		result.Headers.Set("Set-Cookie", sessionCookie(session, expires, false))
		return result, nil
	}
	if flow.Challenge == nil || !validPKCEChallenge(*flow.Challenge) {
		return platform.Result{}, platform.Invalid("The mobile login challenge is invalid.")
	}
	code := platform.Token()
	expires := now.Add(mobileCodeLifetime)
	if _, err = tx.Exec(ctx, `INSERT INTO mobile_login_codes(code_hash,owner_id,challenge,expires_at,auth_time) VALUES($1,$2,$3,$4,$5)`, platform.Hash(code), owner, *flow.Challenge, expires, authTime); err != nil {
		return platform.Result{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return platform.Result{}, err
	}
	location, err := s.safeMobileURL(code, "")
	if err != nil {
		return platform.Result{}, err
	}
	return writeRedirect(r, location)
}

func (s *Service) exchangeMobileCode(ctx context.Context, r *platform.Request) (platform.Result, error) {
	code, err := requestString(r, "code")
	if err != nil {
		return platform.Result{}, err
	}
	verifier, err := requestString(r, "verifier")
	if err != nil || !validPKCEVerifier(verifier) {
		return platform.Result{}, authRequired()
	}
	tx, err := s.begin(ctx)
	if err != nil {
		return platform.Result{}, err
	}
	defer tx.Rollback(context.Background())
	var owner, challenge string
	var expires, authTime time.Time
	var consumed *time.Time
	err = tx.QueryRow(ctx, `SELECT owner_id,challenge,expires_at,consumed_at,auth_time FROM mobile_login_codes WHERE code_hash=$1 FOR UPDATE`, platform.Hash(code)).Scan(&owner, &challenge, &expires, &consumed, &authTime)
	if errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, authRequired()
	}
	if err != nil {
		return platform.Result{}, err
	}
	if consumed != nil || !time.Now().UTC().Before(expires) || subtle.ConstantTimeCompare([]byte(challenge), []byte(hashPKCEVerifier(verifier))) != 1 {
		return platform.Result{}, authRequired()
	}
	var deleting bool
	if err = tx.QueryRow(ctx, `SELECT deleting FROM profiles WHERE id=$1 FOR UPDATE`, owner).Scan(&deleting); err != nil {
		return platform.Result{}, err
	}
	if deleting {
		return platform.Result{}, authRequired()
	}
	access, refresh := platform.Token(), platform.Token()
	now := time.Now().UTC()
	if _, err = tx.Exec(ctx, `UPDATE mobile_login_codes SET consumed_at=now() WHERE code_hash=$1 AND consumed_at IS NULL`, platform.Hash(code)); err != nil {
		return platform.Result{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO auth_sessions(id,owner_id,access_hash,refresh_hash,client,authenticated_at,last_used_at,access_expires_at,refresh_expires_at) VALUES($1,$2,$3,$4,'mobile',$5,$6,$7,$8)`, platform.ID(), owner, platform.Hash(access), platform.Hash(refresh), authTime, now, now.Add(mobileAccessLifetime), now.Add(mobileRefreshLifetime)); err != nil {
		return platform.Result{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return platform.Result{}, err
	}
	return platform.OK(map[string]any{"access_token": access, "refresh_token": refresh, "expires_in": int(mobileAccessLifetime / time.Second)}), nil
}

func (s *Service) refreshMobileTokens(ctx context.Context, r *platform.Request) (platform.Result, error) {
	refresh, err := requestString(r, "refresh_token")
	if err != nil || refresh == "" {
		return platform.Result{}, authRequired()
	}
	hash := platform.Hash(refresh)
	tx, err := s.begin(ctx)
	if err != nil {
		return platform.Result{}, err
	}
	defer tx.Rollback(context.Background())
	var sessionID, owner, client string
	var currentHash, previousHash []byte
	var refreshExpiry time.Time
	var revoked *time.Time
	var deleting, previous bool
	err = tx.QueryRow(ctx, `SELECT s.id,s.owner_id,s.client,s.refresh_hash,s.previous_refresh_hash,s.refresh_expires_at,s.revoked_at,p.deleting,COALESCE(s.previous_refresh_hash=$1,false) FROM auth_sessions s JOIN profiles p ON p.id=s.owner_id WHERE s.refresh_hash=$1 OR s.previous_refresh_hash=$1 FOR UPDATE`, hash).Scan(&sessionID, &owner, &client, &currentHash, &previousHash, &refreshExpiry, &revoked, &deleting, &previous)
	if errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, authRequired()
	}
	if err != nil {
		return platform.Result{}, err
	}
	if previous {
		if _, err = tx.Exec(ctx, `UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND revoked_at IS NULL`, sessionID); err != nil {
			return platform.Result{}, err
		}
		if err = tx.Commit(ctx); err != nil {
			return platform.Result{}, err
		}
		return platform.Result{}, authRequired()
	}
	if client != "mobile" || revoked != nil || deleting || !time.Now().UTC().Before(refreshExpiry) || !secureEqual(currentHash, hash) {
		return platform.Result{}, authRequired()
	}
	access, nextRefresh := platform.Token(), platform.Token()
	now := time.Now().UTC()
	_, err = tx.Exec(ctx, `UPDATE auth_sessions SET access_hash=$2,previous_refresh_hash=refresh_hash,refresh_hash=$3,last_used_at=$4,access_expires_at=$5,refresh_expires_at=$6 WHERE id=$1 AND revoked_at IS NULL`, sessionID, platform.Hash(access), platform.Hash(nextRefresh), now, now.Add(mobileAccessLifetime), now.Add(mobileRefreshLifetime))
	if err != nil {
		return platform.Result{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return platform.Result{}, err
	}
	return platform.OK(map[string]any{"access_token": access, "refresh_token": nextRefresh, "expires_in": int(mobileAccessLifetime / time.Second)}), nil
}

func (s *Service) Authenticate(ctx context.Context, request *http.Request) (platform.Principal, error) {
	if s.Pool == nil || request == nil {
		return platform.Principal{}, authRequired()
	}
	var token, expectedClient string
	authorization := request.Header.Get("Authorization")
	if authorization != "" {
		if !strings.HasPrefix(authorization, "Bearer ") {
			return platform.Principal{}, authRequired()
		}
		token = strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer "))
		if token == "" || strings.ContainsAny(token, " \t\r\n") {
			return platform.Principal{}, authRequired()
		}
		expectedClient = "mobile"
	} else {
		cookie, err := request.Cookie("soba_session")
		if err != nil || cookie.Value == "" {
			return platform.Principal{}, authRequired()
		}
		token = cookie.Value
		expectedClient = "web"
	}
	var owner, sessionID, client string
	var authenticatedAt, lastUsed, accessExpiry time.Time
	var deleting bool
	err := s.Pool.QueryRow(ctx, `SELECT s.owner_id,s.id,s.client,s.authenticated_at,s.last_used_at,s.access_expires_at,p.deleting FROM auth_sessions s JOIN profiles p ON p.id=s.owner_id WHERE s.access_hash=$1 AND s.revoked_at IS NULL`, platform.Hash(token)).Scan(&owner, &sessionID, &client, &authenticatedAt, &lastUsed, &accessExpiry, &deleting)
	if errors.Is(err, pgx.ErrNoRows) {
		return platform.Principal{}, authRequired()
	}
	if err != nil {
		return platform.Principal{}, err
	}
	if client != expectedClient || deleting || !time.Now().UTC().Before(accessExpiry) || client == "web" && time.Since(lastUsed) > webInactivityLifetime {
		return platform.Principal{}, authRequired()
	}
	if _, err = s.Pool.Exec(ctx, `UPDATE auth_sessions SET last_used_at=now() WHERE id=$1 AND revoked_at IS NULL`, sessionID); err != nil {
		return platform.Principal{}, err
	}
	return platform.Principal{OwnerID: owner, SessionID: sessionID, Client: client, AuthenticatedAt: authenticatedAt}, nil
}

func (s *Service) logout(ctx context.Context, r *platform.Request) (platform.Result, error) {
	if r.Tx == nil {
		return platform.Result{}, errors.New("logout requires the request transaction")
	}
	if r.Principal.SessionID == "" {
		return platform.Result{}, authRequired()
	}
	tag, err := r.Tx.Exec(ctx, `UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND owner_id=$2 AND revoked_at IS NULL`, r.Principal.SessionID, r.Owner())
	if err != nil {
		return platform.Result{}, err
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, authRequired()
	}
	if s.CancelOwner != nil {
		r.AfterCommit = append(r.AfterCommit, func() { s.CancelOwner(r.Owner()) })
	}
	return platform.Result{Status: http.StatusNoContent, Headers: http.Header{"Set-Cookie": []string{sessionCookie("", time.Time{}, true)}}}, nil
}

func (s *Service) getCsrfToken(ctx context.Context, r *platform.Request) (platform.Result, error) {
	if r.Principal.SessionID == "" {
		return platform.Result{}, authRequired()
	}
	tx, err := s.begin(ctx)
	if err != nil {
		return platform.Result{}, err
	}
	defer tx.Rollback(context.Background())
	token := platform.Token()
	tag, err := tx.Exec(ctx, `UPDATE auth_sessions SET csrf_hash=$2,last_used_at=now() WHERE id=$1 AND owner_id=$3 AND revoked_at IS NULL AND access_expires_at>now()`, r.Principal.SessionID, platform.Hash(token), r.Owner())
	if err != nil {
		return platform.Result{}, err
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, authRequired()
	}
	if err = tx.Commit(ctx); err != nil {
		return platform.Result{}, err
	}
	return platform.OK(map[string]any{"token": token}), nil
}

func (s *Service) getPolicy(context.Context, *platform.Request) (platform.Result, error) {
	version := s.Config.PolicyVersion
	if version == "" {
		version = "pilot-v1"
	}
	publishedAt := s.Config.PolicyPublishedAt
	if publishedAt.IsZero() {
		publishedAt = time.Date(2026, time.September, 7, 0, 0, 0, 0, time.UTC)
	}
	return platform.OK(map[string]any{
		"version":                  version,
		"speech_processing_text":   "SOBA processes voice input to provide transcription, safety checks, and an empathetic response. Processing uses the providers listed below. SOBA is not a medical device or emergency service.",
		"providers":                s.Config.VoiceProviders(),
		"minimum_age":              18,
		"minor_enrollment_enabled": false,
		"retention_days":           30,
		"published_at":             publishedAt.UTC(),
	}), nil
}

func (s *Service) getProfile(ctx context.Context, r *platform.Request) (platform.Result, error) {
	q := r.Q(s.Pool)
	var deleting bool
	if err := q.QueryRow(ctx, `SELECT deleting FROM profiles WHERE id=$1`, r.Owner()).Scan(&deleting); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	if deleting {
		return platform.Result{}, policyBlocked()
	}
	value, err := platform.Row(ctx, q, `SELECT `+profileJSON+` FROM profiles WHERE id=$1`, r.Owner())
	return platform.OK(value), err
}

func (s *Service) updateProfile(ctx context.Context, r *platform.Request) (platform.Result, error) {
	if r.Tx == nil {
		return platform.Result{}, errors.New("profile update requires the request transaction")
	}
	if _, present := r.Body["eligibility"]; present {
		return platform.Result{}, platform.Invalid("Eligibility is computed by the service.")
	}
	name, err := requestString(r, "display_name")
	if err != nil {
		return platform.Result{}, err
	}
	name, err = validateDisplayName(name)
	if err != nil {
		return platform.Result{}, err
	}
	locale, err := requestString(r, "locale")
	if err != nil {
		return platform.Result{}, err
	}
	if err = validateLocale(locale); err != nil {
		return platform.Result{}, err
	}
	timezone, err := requestString(r, "timezone")
	if err != nil {
		return platform.Result{}, err
	}
	if err = validateTimezone(timezone); err != nil {
		return platform.Result{}, err
	}
	rolesValue, ok := r.Body["roles"]
	if !ok {
		return platform.Result{}, platform.Invalid("Roles are required.")
	}
	roles, err := parseRoles(rolesValue)
	if err != nil {
		return platform.Result{}, err
	}
	age, err := requestString(r, "age_band")
	if err != nil {
		return platform.Result{}, err
	}
	if err = validateAgeBand(age); err != nil {
		return platform.Result{}, err
	}
	version, err := requestVersion(r, "version")
	if err != nil {
		return platform.Result{}, err
	}
	if _, present := r.Body["shared_phone"]; !present {
		return platform.Result{}, platform.Invalid("Shared phone is required.")
	}
	phone, err := validatePhone(r.Body["shared_phone"])
	if err != nil {
		return platform.Result{}, err
	}
	var oldEligibility string
	var deleting bool
	if err = r.Tx.QueryRow(ctx, `SELECT eligibility,deleting FROM profiles WHERE id=$1 FOR UPDATE`, r.Owner()).Scan(&oldEligibility, &deleting); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	if deleting {
		return platform.Result{}, policyBlocked()
	}
	value, err := platform.Row(ctx, r.Tx, `UPDATE profiles SET display_name=$2,locale=$3,timezone=$4,roles=$5,age_band=$6,eligibility=$7,shared_phone=$8 WHERE id=$1 AND version=$9 RETURNING `+profileJSON, r.Owner(), name, locale, timezone, roles, age, eligibilityFor(age), nullableStringPtr(phone), version)
	if err != nil {
		var apiErr *platform.Error
		if errors.As(err, &apiErr) && apiErr.Status == http.StatusNotFound {
			return platform.Result{}, platform.Conflict()
		}
		var exists bool
		if checkErr := r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM profiles WHERE id=$1)`, r.Owner()).Scan(&exists); checkErr == nil && exists {
			return platform.Result{}, platform.Conflict()
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return platform.Result{}, platform.Conflict()
		}
		return platform.Result{}, err
	}
	if oldEligibility == "allowed" && eligibilityFor(age) != "allowed" && s.CancelOwner != nil {
		r.AfterCommit = append(r.AfterCommit, func() { s.CancelOwner(r.Owner()) })
	}
	return platform.OK(value), nil
}

func nullableStringPtr(v *string) any {
	if v == nil {
		return nil
	}
	return *v
}

func (s *Service) setProcessingConsent(ctx context.Context, r *platform.Request) (platform.Result, error) {
	if r.Tx == nil {
		return platform.Result{}, errors.New("processing consent requires the request transaction")
	}
	accepted, err := requestBool(r, "accepted")
	if err != nil {
		return platform.Result{}, err
	}
	policyVersion, err := requestString(r, "policy_version")
	if err != nil {
		return platform.Result{}, err
	}
	current := s.Config.PolicyVersion
	if current == "" {
		current = "pilot-v1"
	}
	if policyVersion != current {
		return platform.Result{}, platform.Fail(http.StatusConflict, "policy_blocked", "This policy is no longer current.")
	}
	var deleting bool
	if err = r.Tx.QueryRow(ctx, `SELECT deleting FROM profiles WHERE id=$1 FOR UPDATE`, r.Owner()).Scan(&deleting); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	if deleting {
		return platform.Result{}, policyBlocked()
	}
	var value map[string]any
	if accepted {
		value, err = platform.Row(ctx, r.Tx, `UPDATE profiles SET processing_policy_version=$2,processing_granted_at=now(),processing_revoked_at=NULL WHERE id=$1 RETURNING `+profileJSON, r.Owner(), policyVersion)
	} else {
		value, err = platform.Row(ctx, r.Tx, `UPDATE profiles SET processing_revoked_at=now() WHERE id=$1 RETURNING `+profileJSON, r.Owner())
	}
	if err != nil {
		return platform.Result{}, err
	}
	if !accepted && s.CancelOwner != nil {
		r.AfterCommit = append(r.AfterCommit, func() { s.CancelOwner(r.Owner()) })
	}
	return platform.OK(value), nil
}

func (s *Service) getPreferences(ctx context.Context, r *platform.Request) (platform.Result, error) {
	q := r.Q(s.Pool)
	value, err := platform.Row(ctx, q, `SELECT `+prefsJSON+` FROM preferences p JOIN profiles f ON f.id=p.owner_id WHERE p.owner_id=$1 AND NOT f.deleting`, r.Owner())
	return platform.OK(value), err
}

func (s *Service) setPreferences(ctx context.Context, r *platform.Request) (platform.Result, error) {
	if r.Tx == nil {
		return platform.Result{}, errors.New("preferences update requires the request transaction")
	}
	personality, err := requestString(r, "personality")
	if err != nil {
		return platform.Result{}, err
	}
	if personality != "calm" && personality != "friendly" && personality != "encouraging" {
		return platform.Result{}, platform.Invalid("Personality is invalid.")
	}
	voice, err := requestString(r, "voice")
	if err != nil {
		return platform.Result{}, err
	}
	if voice != "marin" && voice != "cedar" {
		return platform.Result{}, platform.Invalid("Voice is invalid.")
	}
	listenFirst, err := requestBool(r, "listen_first")
	if err != nil {
		return platform.Result{}, err
	}
	memoryEnabled, err := requestBool(r, "memory_enabled")
	if err != nil {
		return platform.Result{}, err
	}
	var moodHistory *bool
	if _, ok := r.Body["mood_history_enabled"]; ok {
		value, e := requestBool(r, "mood_history_enabled")
		if e != nil {
			return platform.Result{}, e
		}
		moodHistory = &value
	}
	version, err := requestVersion(r, "version")
	if err != nil {
		return platform.Result{}, err
	}
	var deleting bool
	if err = r.Tx.QueryRow(ctx, `SELECT deleting FROM profiles WHERE id=$1 FOR UPDATE`, r.Owner()).Scan(&deleting); errors.Is(err, pgx.ErrNoRows) {
		return platform.Result{}, platform.NotFound()
	} else if err != nil {
		return platform.Result{}, err
	}
	if deleting {
		return platform.Result{}, policyBlocked()
	}
	value, err := platform.Row(ctx, r.Tx, `UPDATE preferences AS p SET personality=$2,voice=$3,listen_first=$4,memory_enabled=$5,mood_history_enabled=COALESCE($7,p.mood_history_enabled) WHERE p.owner_id=$1 AND p.version=$6 RETURNING `+prefsJSON, r.Owner(), personality, voice, listenFirst, memoryEnabled, version, moodHistory)
	if err != nil {
		var exists bool
		if checkErr := r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM preferences WHERE owner_id=$1)`, r.Owner()).Scan(&exists); checkErr == nil && exists {
			return platform.Result{}, platform.Conflict()
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return platform.Result{}, platform.Conflict()
		}
		return platform.Result{}, err
	}
	cancel := s.CancelActiveOwner
	if cancel == nil {
		cancel = s.CancelOwner
	}
	if cancel != nil {
		r.AfterCommit = append(r.AfterCommit, func() { cancel(r.Owner()) })
	}
	return platform.OK(value), nil
}
