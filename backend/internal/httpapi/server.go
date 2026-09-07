package httpapi

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Authenticate func(context.Context, *http.Request) (platform.Principal, error)
type Server struct {
	Logger       *slog.Logger
	Pool         *pgxpool.Pool
	Config       platform.Config
	Authenticate Authenticate
	Handlers     map[string]platform.Handler
	Guards       *platform.Guards
	mu           sync.Mutex
	limits       map[string]bucket
}
type bucket struct {
	start time.Time
	count int
}

// statusWriter preserves streaming and WebSocket access through Unwrap. Logs
// use the declared route template, never a URL, query, token, or request body.
type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
func (w *statusWriter) WriteHeader(status int) {
	if w.status == 0 {
		w.status = status
	}
	w.ResponseWriter.WriteHeader(status)
}
func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(b)
}

func (s *Server) Handler() (http.Handler, error) {
	ops, e := contracts()
	if e != nil {
		return nil, e
	}
	mux := http.NewServeMux()
	for _, op := range ops {
		if s.Handlers[op.ID] == nil {
			return nil, fmt.Errorf("missing handler: %s", op.ID)
		}
		o := op
		mux.HandleFunc(o.Method+" "+o.Path, func(w http.ResponseWriter, r *http.Request) { s.serve(o, w, r) })
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) { s.failure(w, platform.ID(), platform.NotFound()) })
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !s.allowed(origin) {
				s.failure(w, platform.ID(), platform.Fail(403, "forbidden", "Origin is not allowed."))
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Vary", "Origin")
		}
		if r.Method == "OPTIONS" {
			if origin == "" {
				s.failure(w, platform.ID(), platform.Invalid("Origin is required."))
				return
			}
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key, X-CSRF-Token, X-Deletion-Receipt")
			w.WriteHeader(204)
			return
		}
		mux.ServeHTTP(w, r)
	}), nil
}
func (s *Server) allowed(origin string) bool {
	for _, v := range s.Config.Origins {
		if origin == v {
			return true
		}
	}
	return false
}
func (s *Server) allow(key string, max int) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.limits == nil {
		s.limits = map[string]bucket{}
	}
	now := time.Now()
	if len(s.limits) > 10000 {
		for k, b := range s.limits {
			if now.Sub(b.start) > time.Minute {
				delete(s.limits, k)
			}
		}
	}
	b, exists := s.limits[key]
	if !exists && len(s.limits) >= 20000 {
		return false
	}
	if now.Sub(b.start) >= time.Minute {
		b = bucket{start: now}
	}
	b.count++
	s.limits[key] = b
	return b.count <= max
}
func (s *Server) serve(o operation, w http.ResponseWriter, r *http.Request) {
	requestID := platform.ID()
	if s.Logger != nil {
		start := time.Now()
		logged := &statusWriter{ResponseWriter: w}
		w = logged
		defer func() {
			s.Logger.Info("request complete", "request_id", requestID, "route", o.Method+" "+o.Path, "status", logged.status, "duration_ms", time.Since(start).Milliseconds())
		}()
	}
	w.Header().Set("X-Request-ID", requestID)
	defer func() {
		if recover() != nil {
			s.failure(w, requestID, platform.Unavailable())
		}
	}()
	ctx := r.Context()
	var cancel context.CancelFunc
	if o.ID != "upgradeVoiceSocket" {
		ctx, cancel = context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
	}
	body, e := o.validate(r)
	if e != nil {
		s.failure(w, requestID, e)
		return
	}
	req := &platform.Request{HTTP: r, Writer: w, Body: body, Operation: o.ID}
	if o.ID == "confirmDeviceClaim" && !s.allow("bootstrap:"+string(platform.Hash(r.Header.Get("Authorization"))), 5) {
		s.failure(w, requestID, platform.Fail(429, "rate_limited", "Too many pairing attempts."))
		return
	}
	user := false
	for _, sec := range o.Security {
		if _, ok := sec["userBearer"]; ok {
			user = true
		}
		if _, ok := sec["sessionCookie"]; ok {
			user = true
		}
	}
	write := r.Method != "GET" && r.Method != "HEAD"
	if user {
		if s.Authenticate == nil {
			s.failure(w, requestID, platform.Unavailable())
			return
		}
		req.Principal, e = s.Authenticate(ctx, r)
		if e != nil {
			s.failure(w, requestID, e)
			return
		}
		if !s.allow("normal:"+req.Owner(), 120) || (write && !s.allow("write:"+req.Owner(), 20)) {
			s.failure(w, requestID, platform.Fail(429, "rate_limited", "Too many requests."))
			return
		}
		if (o.ID == "createDeviceClaim" && !s.allow("claim:"+req.Owner()+":"+req.String("device_id"), 5)) || ((o.ID == "createInvite" || o.ID == "acceptInvite") && !s.allow("invite:"+req.Owner(), 5)) {
			s.failure(w, requestID, platform.Fail(429, "rate_limited", "Too many attempts."))
			return
		}
		if write && req.Principal.Client == "web" {
			if !s.allowed(r.Header.Get("Origin")) {
				s.failure(w, requestID, platform.Fail(403, "forbidden", "An allowed Origin is required."))
				return
			}
			var hash []byte
			e = s.Pool.QueryRow(ctx, "SELECT csrf_hash FROM auth_sessions WHERE id=$1 AND revoked_at IS NULL", req.Principal.SessionID).Scan(&hash)
			if e != nil || len(hash) == 0 || !hmac.Equal(hash, platform.Hash(r.Header.Get("X-CSRF-Token"))) {
				s.failure(w, requestID, platform.Fail(403, "forbidden", "A valid CSRF token is required."))
				return
			}
		}
	} else if o.ID == "startLogin" || o.ID == "exchangeMobileCode" || o.ID == "refreshMobileTokens" || o.ID == "upgradeVoiceSocket" {
		ip, _, _ := net.SplitHostPort(r.RemoteAddr)
		if !s.allow("auth:"+ip, 10) {
			s.failure(w, requestID, platform.Fail(429, "rate_limited", "Too many login attempts."))
			return
		}
	}
	if user {
		lockCtx, lockCancel := context.WithTimeout(ctx, 2*time.Second)
		unlock, err := s.Guards.Lock(lockCtx, req.Owner())
		lockCancel()
		if err != nil {
			s.failure(w, requestID, platform.Fail(409, "request_in_progress", "Another request is in progress."))
			return
		}
		defer unlock()
		current, authErr := s.Authenticate(ctx, r)
		if authErr != nil || current.OwnerID != req.Principal.OwnerID || current.SessionID != req.Principal.SessionID {
			if authErr == nil {
				authErr = platform.Fail(401, "unauthenticated", "Authentication is required.")
			}
			s.failure(w, requestID, authErr)
			return
		}
		req.Principal = current
	}
	var result platform.Result
	if user && write {
		tx, err := s.Pool.Begin(ctx)
		if err != nil {
			s.failure(w, requestID, err)
			return
		}
		defer tx.Rollback(context.Background())
		req.Tx = tx
		var deleting bool
		err = tx.QueryRow(ctx, "SELECT deleting FROM profiles WHERE id=$1 FOR UPDATE", req.Owner()).Scan(&deleting)
		if err != nil || deleting {
			s.failure(w, requestID, platform.Fail(403, "policy_blocked", "Account data is not available."))
			return
		}
		var deletingHistory bool
		err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM data_jobs WHERE owner_id=$1 AND kind='delete_history' AND state IN ('queued','running','waiting_provider'))`, req.Owner()).Scan(&deletingHistory)
		if err != nil {
			s.failure(w, requestID, err)
			return
		}
		if deletingHistory && o.ID != "logout" {
			s.failure(w, requestID, platform.Fail(403, "policy_blocked", "History deletion is in progress."))
			return
		}
		result, e = s.mutate(ctx, o, req)
		if e == nil {
			e = s.validateResponse(o, result)
		}
		if e == nil {
			actor := hmac.New(sha256.New, s.Config.AuditKey)
			actor.Write([]byte(req.Owner()))
			_, e = tx.Exec(ctx, `INSERT INTO audit_events(id,actor_hash,subject_hash,action,outcome,request_id) VALUES($1,$2,$2,$3,'allowed',$4)`, platform.ID(), actor.Sum(nil), o.ID, requestID)
		}
		if e == nil {
			e = tx.Commit(ctx)
		}
	} else {
		if user {
			var blocked bool
			e = s.Pool.QueryRow(ctx, `SELECT deleting OR EXISTS(SELECT 1 FROM data_jobs WHERE owner_id=$1 AND kind='delete_history' AND state IN ('queued','running','waiting_provider')) FROM profiles WHERE id=$1`, req.Owner()).Scan(&blocked)
			if e != nil || blocked {
				if o.ID != "getDataJob" {
					s.failure(w, requestID, platform.Fail(403, "policy_blocked", "Account data is not available."))
					return
				}
			}
		}
		result, e = s.Handlers[o.ID](ctx, req)
		if e == nil {
			e = s.validateResponse(o, result)
		}
	}
	if e != nil {
		s.failure(w, requestID, e)
		return
	}
	for _, fn := range req.AfterCommit {
		fn()
	}
	if result.Handled {
		return
	}
	for k, vs := range result.Headers {
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(result.Status)
	if result.Status != 204 && result.Body != nil {
		_ = json.NewEncoder(w).Encode(result.Body)
	}
}
func (s *Server) validateResponse(o operation, r platform.Result) error {
	if r.Handled {
		return nil
	}
	if _, ok := o.Responses[strconv.Itoa(r.Status)]; !ok {
		return fmt.Errorf("unexpected status for %s", o.ID)
	}
	if schema := o.responseSchemas[r.Status]; schema != nil {
		b, e := json.Marshal(r.Body)
		if e != nil {
			return e
		}
		var v any
		if e = json.Unmarshal(b, &v); e != nil {
			return e
		}
		if e = schema.Validate(v); e != nil {
			return fmt.Errorf("response contract failed for %s: %w", o.ID, e)
		}
	}
	return nil
}
func (s *Server) mutate(ctx context.Context, o operation, r *platform.Request) (platform.Result, error) {
	key := r.HTTP.Header.Get("Idempotency-Key")
	if key == "" {
		return s.Handlers[o.ID](ctx, r)
	}
	route := r.HTTP.Method + " " + r.HTTP.URL.Path
	canonical, _ := json.Marshal(struct {
		Body  map[string]any
		Query string
	}{r.Body, r.HTTP.URL.Query().Encode()})
	hash := sha256.Sum256(canonical)
	actor := platform.Hash(r.Owner())
	// The profile lock serializes same-owner writes, including idempotency reservation.
	var oldHash, encrypted []byte
	var status int
	var version string
	e := r.Tx.QueryRow(ctx, `SELECT request_hash,response_ciphertext,response_status,key_version FROM idempotency_records WHERE actor_key=$1 AND route=$2 AND key=$3 AND expires_at>now()`, actor, route, key).Scan(&oldHash, &encrypted, &status, &version)
	if e == nil {
		if !hmac.Equal(oldHash, hash[:]) {
			return platform.Result{}, platform.Fail(409, "idempotency_conflict", "This key was used for another request.")
		}
		if status == 410 && len(encrypted) == 0 {
			return platform.Result{}, platform.Fail(410, "not_found", "This item was deleted.")
		}
		if version != s.Config.KeyVersion {
			return platform.Result{}, platform.Unavailable()
		}
		plain, e := platform.Decrypt(s.Config.DataKey, encrypted)
		if e != nil {
			return platform.Result{}, e
		}
		var saved struct {
			Body    any
			Headers http.Header
		}
		if e = json.Unmarshal(plain, &saved); e != nil {
			return platform.Result{}, e
		}
		return platform.Result{Status: status, Body: saved.Body, Headers: saved.Headers}, nil
	}
	if !errors.Is(e, pgx.ErrNoRows) {
		return platform.Result{}, e
	}
	if _, e = r.Tx.Exec(ctx, `DELETE FROM idempotency_records WHERE actor_key=$1 AND route=$2 AND key=$3 AND expires_at<=now()`, actor, route, key); e != nil {
		return platform.Result{}, e
	}
	result, e := s.Handlers[o.ID](ctx, r)
	if e != nil {
		return result, e
	}
	if result.Handled {
		return result, errors.New("streaming mutations cannot be replayed")
	}
	var resource any
	if id := r.ID(); id != "" {
		resource = id
	} else if value, ok := result.Body.(map[string]any); ok {
		if id, ok := value["id"].(string); ok {
			resource = id
		}
	}
	if r.HTTP.Method == "DELETE" && resource != nil {
		switch o.ID {
		case "deleteMoodEntry", "deleteJournal", "deleteMemory", "deleteContact", "deleteReferral":
			if _, err := r.Tx.Exec(ctx, `UPDATE idempotency_records SET response_ciphertext=NULL,response_status=410 WHERE actor_key=$1 AND resource_id=$2 AND response_status<>204`, actor, resource); err != nil {
				return platform.Result{}, err
			}
		}
	}
	plain, e := json.Marshal(struct {
		Body    any
		Headers http.Header
	}{result.Body, result.Headers})
	if e != nil {
		return result, e
	}
	encrypted, e = platform.Encrypt(s.Config.DataKey, plain)
	if e != nil {
		return result, e
	}
	_, e = r.Tx.Exec(ctx, `INSERT INTO idempotency_records(actor_key,route,key,request_hash,response_ciphertext,key_version,response_status,expires_at,resource_id) VALUES($1,$2,$3,$4,$5,$6,$7,now()+interval '24 hours',$8)`, actor, route, key, hash[:], encrypted, s.Config.KeyVersion, result.Status, resource)
	return result, e
}
func (s *Server) failure(w http.ResponseWriter, id string, e error) {
	var api *platform.Error
	if !errors.As(e, &api) {
		var pg *pgconn.PgError
		if errors.As(e, &pg) && (pg.Code == "23505" || pg.Code == "40001") {
			api = &platform.Error{Status: 409, Code: "invalid_state", Message: "This operation conflicts with the current state."}
		} else {
			api = &platform.Error{Status: 503, Code: "dependency_unavailable", Message: "This service is not available. Try again later."}
		}
	}
	if s.Logger != nil {
		s.Logger.Warn("request failed", "request_id", id, "code", api.Code, "status", api.Status)
	}
	if api.Status == 429 {
		w.Header().Set("Retry-After", "60")
	}
	if api.Code == "request_in_progress" {
		w.Header().Set("Retry-After", "1")
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(api.Status)
	_ = json.NewEncoder(w).Encode(map[string]any{"code": api.Code, "message": api.Message, "request_id": id, "fields": []any{}})
}

// RegisteredOperations returns stable operation IDs for contract coverage tests.
func RegisteredOperations() ([]string, error) {
	ops, e := contracts()
	if e != nil {
		return nil, e
	}
	r := make([]string, 0, len(ops))
	for _, o := range ops {
		r = append(r, strings.TrimSpace(o.ID))
	}
	return r, nil
}
