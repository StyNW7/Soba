package jobs

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Objects holds encrypted export bytes. FilesystemObjects uses a private volume;
// callers never expose its paths or serve the directory through HTTP.
type Objects interface {
	Put(context.Context, string, []byte) error
	Get(context.Context, string) ([]byte, error)
	Delete(context.Context, string) error
}
type FilesystemObjects struct{ Directory string }

func (o FilesystemObjects) path(key string) (string, error) {
	u, e := uuid.Parse(key)
	if e != nil || u.String() != key {
		return "", errors.New("invalid object key")
	}
	return filepath.Join(o.Directory, key+".enc"), nil
}
func (o FilesystemObjects) Put(ctx context.Context, key string, b []byte) error {
	if e := ctx.Err(); e != nil {
		return e
	}
	path, e := o.path(key)
	if e != nil {
		return e
	}
	if e = os.MkdirAll(o.Directory, 0700); e != nil {
		return e
	}
	f, e := os.CreateTemp(o.Directory, ".export-")
	if e != nil {
		return e
	}
	defer os.Remove(f.Name())
	if e = f.Chmod(0600); e == nil {
		_, e = f.Write(b)
	}
	if e == nil {
		e = f.Sync()
	}
	closeErr := f.Close()
	if e != nil {
		return e
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(f.Name(), path)
}
func (o FilesystemObjects) Get(ctx context.Context, key string) ([]byte, error) {
	if e := ctx.Err(); e != nil {
		return nil, e
	}
	p, e := o.path(key)
	if e != nil {
		return nil, e
	}
	f, e := os.Open(p)
	if e != nil {
		return nil, e
	}
	defer f.Close()
	// Export JSON is capped at 32 MiB. Allow space for the encryption envelope.
	const limit = 32<<20 + 1024
	b, e := io.ReadAll(io.LimitReader(f, limit+1))
	if e != nil {
		return nil, e
	}
	if len(b) > limit {
		return nil, errors.New("export object is too large")
	}
	return b, nil
}
func (o FilesystemObjects) Delete(ctx context.Context, key string) error {
	if e := ctx.Err(); e != nil {
		return e
	}
	p, e := o.path(key)
	if e != nil {
		return e
	}
	e = os.Remove(p)
	if errors.Is(e, os.ErrNotExist) {
		return nil
	}
	return e
}

// Reconcile removes abandoned temp files and old objects that have no database
// reference. The grace period is longer than the maximum export job lease.
func (o FilesystemObjects) Reconcile(ctx context.Context, keep func(context.Context, string) (bool, error)) error {
	dir, err := os.Open(o.Directory)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer dir.Close()
	for {
		entries, err := dir.ReadDir(100)
		if err != nil && !errors.Is(err, io.EOF) {
			return err
		}
		for _, entry := range entries {
			if err := ctx.Err(); err != nil {
				return err
			}
			info, statErr := entry.Info()
			if statErr != nil || !info.Mode().IsRegular() || time.Since(info.ModTime()) < time.Hour {
				continue
			}
			name := entry.Name()
			if strings.HasPrefix(name, ".export-") {
				if err := os.Remove(filepath.Join(o.Directory, name)); err != nil && !errors.Is(err, os.ErrNotExist) {
					return err
				}
				continue
			}
			if !strings.HasSuffix(name, ".enc") {
				continue
			}
			key := strings.TrimSuffix(name, ".enc")
			if _, err := o.path(key); err != nil {
				continue
			}
			referenced, err := keep(ctx, key)
			if err != nil {
				return err
			}
			if !referenced {
				if err := o.Delete(ctx, key); err != nil {
					return err
				}
			}
		}
		if errors.Is(err, io.EOF) {
			return nil
		}
	}
}

type Service struct {
	Pool                     *pgxpool.Pool
	Config                   platform.Config
	Guards                   *platform.Guards
	Objects                  Objects
	CancelOwner              func(string)
	ExpireDrafts             func()
	ProviderDeletionRequired bool
}

func (s *Service) Handlers() map[string]platform.Handler {
	return map[string]platform.Handler{"createExport": s.createExport, "createDeletion": s.createDeletion, "getDataJob": s.get, "downloadExport": s.download, "getDeletionStatus": s.receipt}
}

const jobJSON = `jsonb_build_object('id',id,'kind',kind,'state',state,'created_at',created_at,'expires_at',expires_at,'download_path',CASE WHEN kind='export' AND state='ready' AND expires_at>now() THEN '/v1/data-jobs/'||id||'/download' ELSE NULL END,'receipt',NULL)`

func fresh(r *platform.Request) bool {
	return !r.Principal.AuthenticatedAt.IsZero() && time.Since(r.Principal.AuthenticatedAt) >= 0 && time.Since(r.Principal.AuthenticatedAt) <= 5*time.Minute
}
func (s *Service) createExport(ctx context.Context, r *platform.Request) (platform.Result, error) {
	if !fresh(r) {
		return platform.Result{}, platform.Fail(403, "forbidden", "Sign in again before exporting data.")
	}
	var count int
	e := r.Tx.QueryRow(ctx, `SELECT count(*) FROM data_jobs WHERE owner_id=$1 AND kind='export' AND state IN ('queued','running','ready')`, r.Owner()).Scan(&count)
	if e != nil {
		return platform.Result{}, e
	}
	if count >= 3 {
		return platform.Result{}, platform.Fail(409, "invalid_state", "An export is already available or in progress.")
	}
	v, e := platform.Row(ctx, r.Tx, `INSERT INTO data_jobs(id,owner_id,kind,state,generation) SELECT $1,id,'export','queued',history_generation FROM profiles WHERE id=$2 RETURNING `+jobJSON, platform.ID(), r.Owner())
	return platform.Result{Status: 202, Body: v}, e
}
func (s *Service) createDeletion(ctx context.Context, r *platform.Request) (platform.Result, error) {
	account := r.String("scope") == "account"
	if account && !fresh(r) {
		return platform.Result{}, platform.Fail(403, "forbidden", "Sign in again before deleting the account.")
	}
	kind := "delete_history"
	var receiptHash any
	receipt := ""
	if account {
		kind = "delete_account"
		receipt = platform.Token()
		receiptHash = platform.Hash(receipt)
	}
	var generation int64
	e := r.Tx.QueryRow(ctx, `UPDATE profiles SET history_generation=history_generation+1,deleting=$2 WHERE id=$1 RETURNING history_generation`, r.Owner(), account).Scan(&generation)
	if e != nil {
		return platform.Result{}, e
	}
	if _, e = r.Tx.Exec(ctx, `UPDATE notification_jobs j SET state='cancelled',lease_token=NULL,lease_expires_at=NULL FROM support_requests q WHERE j.request_id=q.id AND q.owner_id=$1 AND j.state IN ('queued','leased')`, r.Owner()); e != nil {
		return platform.Result{}, e
	}
	if _, e = r.Tx.Exec(ctx, `UPDATE conversation_sessions SET state='interrupted',ended_at=now() WHERE owner_id=$1 AND state='active'`, r.Owner()); e != nil {
		return platform.Result{}, e
	}
	if account {
		if _, e = r.Tx.Exec(ctx, `UPDATE devices SET state='revoked',owner_id=NULL,credential_hash=NULL,bootstrap_hash=NULL WHERE owner_id=$1`, r.Owner()); e != nil {
			return platform.Result{}, e
		}
		if _, e = r.Tx.Exec(ctx, `UPDATE auth_sessions SET revoked_at=now() WHERE owner_id=$1`, r.Owner()); e != nil {
			return platform.Result{}, e
		}
	}
	h := hmac.New(sha256.New, s.Config.AuditKey)
	h.Write([]byte(r.Owner()))
	if _, e = r.Tx.Exec(ctx, `INSERT INTO deletion_ledger(id,subject_hash,scope,cutoff_at,expires_at) VALUES($1,$2,$3,now(),now()+interval '31 days')`, platform.ID(), h.Sum(nil), r.String("scope")); e != nil {
		return platform.Result{}, e
	}
	v, e := platform.Row(ctx, r.Tx, `INSERT INTO data_jobs(id,owner_id,receipt_hash,kind,state,generation,expires_at) VALUES($1,$2,$3,$4,'queued',$5,CASE WHEN $4='delete_account' THEN now()+interval '30 days' ELSE NULL END) RETURNING `+jobJSON, platform.ID(), r.Owner(), receiptHash, kind, generation)
	if e != nil {
		return platform.Result{}, e
	}
	if account {
		v["receipt"] = receipt
	}
	if s.CancelOwner != nil {
		r.AfterCommit = append(r.AfterCommit, func() { s.CancelOwner(r.Owner()) })
	}
	headers := http.Header{}
	if account {
		headers.Add("Set-Cookie", "soba_session=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax")
	}
	return platform.Result{Status: 202, Body: v, Headers: headers}, nil
}
func (s *Service) get(ctx context.Context, r *platform.Request) (platform.Result, error) {
	v, e := platform.Row(ctx, s.Pool, `SELECT `+jobJSON+` FROM data_jobs WHERE id=$1 AND owner_id=$2`, r.ID(), r.Owner())
	return platform.OK(v), e
}
func (s *Service) receipt(ctx context.Context, r *platform.Request) (platform.Result, error) {
	token := r.HTTP.Header.Get("X-Deletion-Receipt")
	if len(token) < 32 || len(token) > 512 {
		return platform.Result{}, platform.Fail(401, "unauthenticated", "A deletion receipt is required.")
	}
	v, e := platform.Row(ctx, s.Pool, `SELECT `+jobJSON+` FROM data_jobs WHERE id=$1 AND receipt_hash=$2 AND kind='delete_account' AND expires_at>now()`, r.ID(), platform.Hash(token))
	return platform.OK(v), e
}
func (s *Service) download(ctx context.Context, r *platform.Request) (platform.Result, error) {
	var key string
	e := s.Pool.QueryRow(ctx, `SELECT j.object_key FROM data_jobs j JOIN profiles p ON p.id=j.owner_id WHERE j.id=$1::uuid AND j.owner_id=$2 AND j.kind='export' AND j.state='ready' AND j.expires_at>now() AND j.generation=p.history_generation AND NOT p.deleting`, r.ID(), r.Owner()).Scan(&key)
	if e != nil {
		return platform.Result{}, platform.NotFound()
	}
	b, e := s.Objects.Get(ctx, key)
	if e != nil {
		return platform.Result{}, platform.Unavailable()
	}
	plain, e := platform.Decrypt(s.Config.DataKey, b)
	if e != nil {
		return platform.Result{}, platform.Unavailable()
	}
	r.Writer.Header().Set("Content-Type", "application/json")
	r.Writer.Header().Set("Content-Disposition", `attachment; filename="soba-export.json"`)
	r.Writer.Header().Set("Cache-Control", "no-store")
	_, e = r.Writer.Write(plain)
	return platform.Result{Handled: true}, e
}

func (s *Service) Run(ctx context.Context) {
	fast := time.NewTicker(5 * time.Second)
	defer fast.Stop()
	retention := time.NewTicker(time.Hour)
	defer retention.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-fast.C:
			if s.ExpireDrafts != nil {
				s.ExpireDrafts()
			}
			s.Tick(ctx)
		case <-retention.C:
			s.Retention(ctx)
		}
	}
}

// Tick performs at most one leased data job. It is safe to call from tests.
func (s *Service) Tick(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, 55*time.Second)
	defer cancel()
	lease := platform.ID()
	var id, owner, kind string
	var generation int64
	e := s.Pool.QueryRow(ctx, `UPDATE data_jobs SET state='running',lease_token=$1,lease_expires_at=now()+interval '60 seconds',updated_at=now() WHERE id=(SELECT id FROM data_jobs WHERE (state='queued' OR (state='running' AND lease_expires_at<now())) AND owner_id IS NOT NULL ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,owner_id,kind,generation`, lease).Scan(&id, &owner, &kind, &generation)
	if e != nil {
		return
	}
	unlock, e := s.Guards.Lock(ctx, owner)
	if e != nil {
		return
	}
	defer unlock()
	if kind == "export" {
		e = s.export(ctx, id, owner, lease, generation)
	} else {
		e = s.delete(ctx, id, owner, kind, lease)
	}
	if e != nil {
		_, _ = s.Pool.Exec(ctx, `UPDATE data_jobs SET state='failed',error_code='job_failed',lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2`, id, lease)
	}
}
func (s *Service) export(ctx context.Context, id, owner, lease string, generation int64) error {
	tx, e := s.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	var current int64
	var deleting bool
	e = tx.QueryRow(ctx, `SELECT history_generation,deleting FROM profiles WHERE id=$1`, owner).Scan(&current, &deleting)
	if e != nil {
		return e
	}
	if current != generation || deleting {
		return errors.New("generation changed")
	}
	result := map[string]any{"format_version": 1, "exported_at": time.Now().UTC()}
	profile, e := platform.Row(ctx, tx, `SELECT jsonb_build_object('display_name',display_name,'locale',locale,'timezone',timezone,'roles',roles,'age_band',age_band,'shared_phone',shared_phone) FROM profiles WHERE id=$1`, owner)
	if e != nil {
		return e
	}
	result["profile"] = profile
	for name, fields := range map[string]string{"journals": "id,topic,reflection,insights,created_at,updated_at", "mood_entries": "id,label,source,occurred_at,timezone,created_at,updated_at", "memories": "id,text,category,created_at,updated_at"} {
		items, e := platform.Rows(ctx, tx, "SELECT to_jsonb(x) FROM (SELECT "+fields+" FROM "+name+" WHERE owner_id=$1 ORDER BY created_at,id LIMIT 50001) x", owner)
		if e != nil {
			return e
		}
		if len(items) > 50000 {
			return errors.New("export record limit exceeded")
		}
		result[name] = items
	}
	b, e := json.Marshal(result)
	if e != nil {
		return e
	}
	if len(b) > 32<<20 {
		return errors.New("export size limit exceeded")
	}
	if e = tx.Commit(ctx); e != nil {
		return e
	}
	cipher, e := platform.Encrypt(s.Config.DataKey, b)
	if e != nil {
		return e
	}
	// Record the future object key before writing, so a crash cannot hide it
	// from account deletion or retention.
	tag, e := s.Pool.Exec(ctx, `UPDATE data_jobs SET object_key=$1::text WHERE id=$1::uuid AND lease_token=$2 AND state='running'`, id, lease)
	if e != nil || tag.RowsAffected() != 1 {
		return errors.New("stale export lease")
	}
	if e = s.Objects.Put(ctx, id, cipher); e != nil {
		return e
	}
	tag, e = s.Pool.Exec(ctx, `UPDATE data_jobs j SET state='ready',object_key=$1::text,expires_at=now()+interval '24 hours',lease_token=NULL,lease_expires_at=NULL,updated_at=now() FROM profiles p WHERE j.id=$1::uuid AND j.lease_token=$2 AND p.id=j.owner_id AND p.history_generation=j.generation AND NOT p.deleting`, id, lease)
	if e != nil || tag.RowsAffected() != 1 {
		_ = s.Objects.Delete(ctx, id)
		if e != nil {
			return e
		}
		return errors.New("stale export lease")
	}
	return nil
}
func (s *Service) delete(ctx context.Context, id, owner, kind, lease string) error {
	if s.CancelOwner != nil {
		s.CancelOwner(owner)
	}
	rows, e := s.Pool.Query(ctx, `SELECT coalesce(object_key,id::text) FROM data_jobs WHERE owner_id=$1 AND kind='export'`, owner)
	if e != nil {
		return e
	}
	keys := []string{}
	for rows.Next() {
		var k string
		if e = rows.Scan(&k); e != nil {
			rows.Close()
			return e
		}
		keys = append(keys, k)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return e
	}
	for _, k := range keys {
		if e = s.Objects.Delete(ctx, k); e != nil {
			return e
		}
	}
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	var currentLease string
	if e = tx.QueryRow(ctx, `SELECT lease_token FROM data_jobs WHERE id=$1 FOR UPDATE`, id).Scan(&currentLease); e != nil || currentLease != lease {
		return errors.New("stale delete lease")
	}
	if _, e = tx.Exec(ctx, `SELECT id FROM profiles WHERE id=$1 FOR UPDATE`, owner); e != nil {
		return e
	}
	// Children precede sessions. Retained contacts/links never carry conversation text.
	for _, table := range []string{"support_requests", "safety_events", "journals", "mood_entries", "memories", "conversation_sessions"} {
		for {
			if e = ctx.Err(); e != nil {
				return e
			}
			tag, err := tx.Exec(ctx, "DELETE FROM "+table+" WHERE id IN (SELECT id FROM "+table+" WHERE owner_id=$1 ORDER BY id LIMIT 500)", owner)
			if err != nil {
				return err
			}
			if tag.RowsAffected() < 500 {
				break
			}
		}
	}
	if _, e = tx.Exec(ctx, `DELETE FROM idempotency_records WHERE actor_key=$1 AND route NOT LIKE 'POST /v1/deletions%'`, platform.Hash(owner)); e != nil {
		return e
	}
	if _, e = tx.Exec(ctx, `UPDATE data_jobs SET state='expired',object_key=NULL,lease_token=NULL,lease_expires_at=NULL WHERE owner_id=$1 AND kind='export'`, owner); e != nil {
		return e
	}
	if kind == "delete_account" {
		if _, e = tx.Exec(ctx, `DELETE FROM profiles WHERE id=$1`, owner); e != nil {
			return e
		}
	}
	state := "complete"
	if s.ProviderDeletionRequired {
		state = "waiting_provider"
	}
	if _, e = tx.Exec(ctx, `UPDATE data_jobs SET state=$3,lease_token=NULL,lease_expires_at=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2`, id, lease, state); e != nil {
		return e
	}
	return tx.Commit(ctx)
}
func (s *Service) Retention(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	if objects, ok := s.Objects.(interface {
		Reconcile(context.Context, func(context.Context, string) (bool, error)) error
	}); ok {
		_ = objects.Reconcile(ctx, func(ctx context.Context, key string) (bool, error) {
			var keep bool
			err := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM data_jobs WHERE kind='export' AND (object_key=$1 OR id=$1::uuid))`, key).Scan(&keep)
			return keep, err
		})
	}
	rows, e := s.Pool.Query(ctx, `SELECT id,object_key FROM data_jobs WHERE kind='export' AND object_key IS NOT NULL AND ((state='ready' AND expires_at<=now()) OR (state IN ('failed','expired') AND updated_at<now()-interval '1 hour'))`)
	if e == nil {
		type item struct{ id, key string }
		items := []item{}
		for rows.Next() {
			var v item
			if rows.Scan(&v.id, &v.key) == nil {
				items = append(items, v)
			}
		}
		rows.Close()
		for _, v := range items {
			if s.Objects.Delete(ctx, v.key) == nil {
				_, _ = s.Pool.Exec(ctx, `UPDATE data_jobs SET state=CASE WHEN state='ready' THEN 'expired' ELSE state END,object_key=NULL WHERE id=$1`, v.id)
			}
		}
	}
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return
	}
	defer tx.Rollback(context.Background())
	queries := []string{`DELETE FROM idempotency_records WHERE expires_at<=now()`, `DELETE FROM auth_flows WHERE expires_at<now()`, `DELETE FROM mobile_login_codes WHERE expires_at<now()`, `DELETE FROM auth_sessions WHERE refresh_expires_at<now()`, `DELETE FROM audit_events WHERE created_at<now()-interval '90 days'`, `DELETE FROM deletion_ledger WHERE expires_at<now()`, `DELETE FROM data_jobs WHERE kind='delete_account' AND expires_at<now()`, `DELETE FROM support_requests WHERE created_at<now()-interval '30 days'`, `DELETE FROM safety_events WHERE expires_at<now() AND NOT EXISTS(SELECT 1 FROM support_requests q WHERE q.safety_event_id=safety_events.id)`}
	for _, q := range queries {
		if _, e = tx.Exec(ctx, q); e != nil {
			return
		}
	}
	for _, table := range []string{"journals", "mood_entries", "memories", "safety_events"} {
		if _, e = tx.Exec(ctx, `UPDATE `+table+` SET session_id=NULL WHERE session_id IN (SELECT id FROM conversation_sessions WHERE (state='saved' AND ended_at<now()-interval '30 days') OR (state<>'active' AND state<>'saved' AND started_at<now()-interval '24 hours'))`); e != nil {
			return
		}
	}
	_, e = tx.Exec(ctx, `DELETE FROM conversation_sessions WHERE (state='saved' AND ended_at<now()-interval '30 days') OR (state<>'active' AND state<>'saved' AND started_at<now()-interval '24 hours')`)
	if e == nil {
		_ = tx.Commit(ctx)
	}
}
