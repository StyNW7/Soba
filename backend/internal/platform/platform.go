// Package platform contains the small HTTP and transaction contracts shared by modules.
package platform

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Config struct {
	Env, Addr, PublicURL, DatabaseURL, PolicyVersion                             string
	Origins                                                                      []string
	OIDCIssuer, OIDCClientID, OIDCClientSecret, OIDCRedirectURI, MobileReturnURI string
	DataKey, CursorKey, AuditKey                                                 []byte
	PolicyPublishedAt                                                            time.Time
	KeyVersion                                                                   string
	VoiceEnabled, AlertsEnabled                                                  bool
	DeepgramKey, OpenAIKey, STTModel, STTLanguage, TextModel, TTSModel           string
	FCMProject, ContentPackPath, ObjectDirectory                                 string
	MaxSessions                                                                  int
	ProviderDeletionRequired                                                     bool
}

type Principal struct {
	OwnerID, SessionID string
	Client             string
	AuthenticatedAt    time.Time
}
type Request struct {
	AfterCommit []func()
	HTTP        *http.Request
	Writer      http.ResponseWriter // For upgrade/download only; ordinary handlers return Result.
	Principal   Principal
	Body        map[string]any
	Tx          pgx.Tx // Non-nil for authenticated writes; handlers MUST use it for atomic mutations.
	Operation   string
}

func (r *Request) ID() string             { return r.HTTP.PathValue("id") }
func (r *Request) Owner() string          { return r.Principal.OwnerID }
func (r *Request) String(k string) string { v, _ := r.Body[k].(string); return v }
func (r *Request) Bool(k string) bool     { v, _ := r.Body[k].(bool); return v }
func (r *Request) Int(k string) int64 {
	switch v := r.Body[k].(type) {
	case float64:
		return int64(v)
	case json.Number:
		n, _ := v.Int64()
		return n
	}
	return 0
}

type Result struct {
	Status  int
	Body    any
	Headers http.Header
	Handled bool
}

func OK(v any) Result      { return Result{Status: 200, Body: v} }
func Created(v any) Result { return Result{Status: 201, Body: v} }
func NoContent() Result    { return Result{Status: 204} }

type Handler func(context.Context, *Request) (Result, error)
type Error struct {
	Status        int
	Code, Message string
}

func (e *Error) Error() string                    { return e.Code }
func Fail(status int, code, message string) error { return &Error{status, code, message} }
func NotFound() error                             { return Fail(404, "not_found", "Item not found.") }
func Conflict() error {
	return Fail(409, "version_conflict", "This item changed. Reload it and try again.")
}
func Invalid(message string) error { return Fail(400, "invalid_request", message) }
func Unavailable() error {
	return Fail(503, "dependency_unavailable", "This service is not available. Try again later.")
}

// Queryer is implemented by both a pool and a transaction.
type Queryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
	QueryRow(context.Context, string, ...any) pgx.Row
}

// Pool queries are read-only by convention; write handlers use Request.Tx.
func (r *Request) Q(pool *pgxpool.Pool) Queryer {
	if r.Tx != nil {
		return r.Tx
	}
	return pool
}
func Row(ctx context.Context, q Queryer, sql string, args ...any) (map[string]any, error) {
	var raw []byte
	if err := q.QueryRow(ctx, sql, args...).Scan(&raw); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, NotFound()
		}
		return nil, err
	}
	var v map[string]any
	err := json.Unmarshal(raw, &v)
	return v, err
}
func Rows(ctx context.Context, q Queryer, sql string, args ...any) ([]map[string]any, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]map[string]any, 0)
	for rows.Next() {
		var raw []byte
		if err = rows.Scan(&raw); err != nil {
			return nil, err
		}
		var v map[string]any
		if err = json.Unmarshal(raw, &v); err != nil {
			return nil, err
		}
		result = append(result, v)
	}
	return result, rows.Err()
}
func ID() string { return uuid.NewString() }
func Token() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func Hash(v string) []byte { h := sha256.Sum256([]byte(v)); return h[:] }
func Encrypt(key, plain []byte) ([]byte, error) {
	b, e := aes.NewCipher(key)
	if e != nil {
		return nil, e
	}
	a, e := cipher.NewGCM(b)
	if e != nil {
		return nil, e
	}
	n := make([]byte, a.NonceSize())
	if _, e = rand.Read(n); e != nil {
		return nil, e
	}
	return a.Seal(n, n, plain, nil), nil
}
func Decrypt(key, data []byte) ([]byte, error) {
	b, e := aes.NewCipher(key)
	if e != nil {
		return nil, e
	}
	a, e := cipher.NewGCM(b)
	if e != nil {
		return nil, e
	}
	if len(data) < a.NonceSize() {
		return nil, errors.New("invalid encrypted data")
	}
	return a.Open(nil, data[:a.NonceSize()], data[a.NonceSize():], nil)
}
