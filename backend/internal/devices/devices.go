package devices

import (
	"context"
	"crypto/hmac"
	"encoding/json"
	"strings"
	"time"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	Pool        *pgxpool.Pool
	Config      platform.Config
	Guards      *platform.Guards
	CancelOwner func(string)
}

func (s *Service) Handlers() map[string]platform.Handler {
	return map[string]platform.Handler{"createDeviceClaim": s.create, "getDeviceClaim": s.claim, "confirmDeviceClaim": s.confirm, "listDevices": s.list, "renameDevice": s.rename, "unpairDevice": s.unpair, "deviceHeartbeat": s.heartbeat}
}

const deviceJSON = `jsonb_build_object('id',id,'created_at',created_at,'updated_at',updated_at,'version',version,'name',name,'status',CASE WHEN state='paired' THEN CASE WHEN last_seen_at>now()-interval '90 seconds' THEN 'online' ELSE 'offline' END ELSE state END,'last_seen_at',last_seen_at,'battery_percent',battery_percent,'battery_reported_at',battery_reported_at,'firmware_version',firmware_version,'applied_preferences_version',applied_preferences_version)`

func (s *Service) create(ctx context.Context, r *platform.Request) (platform.Result, error) {
	var allowed bool
	if e := r.Tx.QueryRow(ctx, `SELECT eligibility='allowed' FROM profiles WHERE id=$1`, r.Owner()).Scan(&allowed); e != nil {
		return platform.Result{}, e
	}
	if !allowed {
		return platform.Result{}, platform.Fail(403, "policy_blocked", "Enrollment is not complete.")
	}
	var count int
	if e := r.Tx.QueryRow(ctx, `SELECT count(*) FROM device_claims WHERE owner_id=$1 AND consumed_at IS NULL AND expires_at>now()`, r.Owner()).Scan(&count); e != nil {
		return platform.Result{}, e
	}
	if count >= 3 {
		return platform.Result{}, platform.Fail(429, "rate_limited", "Too many pending claims.")
	}
	var owner *string
	var state string
	if e := r.Tx.QueryRow(ctx, `SELECT owner_id,state FROM devices WHERE id=$1 FOR UPDATE`, r.String("device_id")).Scan(&owner, &state); e != nil {
		if e == pgx.ErrNoRows {
			return platform.Result{}, platform.NotFound()
		}
		return platform.Result{}, e
	}
	if owner != nil || state != "unpaired" {
		return platform.Result{}, platform.Fail(409, "device_owned", "Device is not available for pairing.")
	}
	token := platform.Token()
	encrypted, e := platform.Encrypt(s.Config.DataKey, []byte(token))
	if e != nil {
		return platform.Result{}, e
	}
	id := platform.ID()
	expiry := time.Now().UTC().Add(5 * time.Minute)
	_, e = r.Tx.Exec(ctx, `INSERT INTO device_claims(id,owner_id,device_id,challenge_hash,replay_ciphertext,key_version,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, id, r.Owner(), r.String("device_id"), platform.Hash(token), encrypted, s.Config.KeyVersion, expiry)
	return platform.Created(map[string]any{"id": id, "device_id": r.String("device_id"), "challenge": token, "expires_at": expiry, "status": "pending"}), e
}
func (s *Service) claim(ctx context.Context, r *platform.Request) (platform.Result, error) {
	var device, key string
	var ciphertext []byte
	var expiry time.Time
	var consumed *time.Time
	e := s.Pool.QueryRow(ctx, `SELECT device_id,key_version,replay_ciphertext,expires_at,consumed_at FROM device_claims WHERE id=$1 AND owner_id=$2`, r.ID(), r.Owner()).Scan(&device, &key, &ciphertext, &expiry, &consumed)
	if e == pgx.ErrNoRows {
		return platform.Result{}, platform.NotFound()
	}
	if e != nil {
		return platform.Result{}, e
	}
	status := "pending"
	var challenge any
	if consumed != nil {
		status = "confirmed"
	} else if time.Now().After(expiry) {
		status = "expired"
	} else {
		if key != s.Config.KeyVersion {
			return platform.Result{}, platform.Unavailable()
		}
		plain, e := platform.Decrypt(s.Config.DataKey, ciphertext)
		if e != nil {
			return platform.Result{}, e
		}
		challenge = string(plain)
	}
	return platform.OK(map[string]any{"id": r.ID(), "device_id": device, "challenge": challenge, "expires_at": expiry, "status": status}), nil
}
func (s *Service) confirm(ctx context.Context, r *platform.Request) (platform.Result, error) {
	bearer := strings.TrimPrefix(r.HTTP.Header.Get("Authorization"), "Bearer ")
	if bearer == "" || bearer == r.HTTP.Header.Get("Authorization") {
		return platform.Result{}, platform.Fail(401, "unauthenticated", "Device authentication is required.")
	}
	// Discover owner only after the bootstrap credential matches; acquire owner before device locks.
	var owner, device string
	e := s.Pool.QueryRow(ctx, `SELECT c.owner_id,c.device_id FROM device_claims c JOIN devices d ON d.id=c.device_id WHERE c.id=$1 AND d.bootstrap_hash=$2`, r.ID(), platform.Hash(bearer)).Scan(&owner, &device)
	if e != nil {
		return platform.Result{}, platform.Fail(401, "unauthenticated", "Device authentication failed.")
	}
	unlock, e := s.Guards.Lock(ctx, owner)
	if e != nil {
		return platform.Result{}, e
	}
	defer unlock()
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return platform.Result{}, e
	}
	defer tx.Rollback(context.Background())
	var allowed bool
	e = tx.QueryRow(ctx, `SELECT eligibility='allowed' AND NOT deleting FROM profiles WHERE id=$1 FOR UPDATE`, owner).Scan(&allowed)
	if e != nil || !allowed {
		return platform.Result{}, platform.Fail(403, "policy_blocked", "Pairing is not allowed.")
	}
	var state string
	var currentOwner *string
	e = tx.QueryRow(ctx, `SELECT state,owner_id FROM devices WHERE id=$1 AND bootstrap_hash=$2 FOR UPDATE`, device, platform.Hash(bearer)).Scan(&state, &currentOwner)
	if e != nil {
		return platform.Result{}, platform.Fail(401, "unauthenticated", "Device authentication failed.")
	}
	var challenge []byte
	var expiry time.Time
	var consumed *time.Time
	e = tx.QueryRow(ctx, `SELECT challenge_hash,expires_at,consumed_at FROM device_claims WHERE id=$1 FOR UPDATE`, r.ID()).Scan(&challenge, &expiry, &consumed)
	if e != nil {
		return platform.Result{}, e
	}
	if time.Now().After(expiry) {
		return platform.Result{}, platform.Fail(410, "claim_expired", "The pairing claim expired.")
	}
	if !hmac.Equal(challenge, platform.Hash(r.String("challenge"))) {
		return platform.Result{}, platform.Invalid("The pairing challenge is invalid.")
	}
	actor := platform.Hash("bootstrap:" + device)
	route := "POST " + r.HTTP.URL.Path
	key := r.HTTP.Header.Get("Idempotency-Key")
	hash := platform.Hash(r.String("challenge"))
	var cipher, oldHash []byte
	var version string
	e = tx.QueryRow(ctx, `SELECT response_ciphertext,request_hash,key_version FROM idempotency_records WHERE actor_key=$1 AND route=$2 AND key=$3 AND expires_at>now()`, actor, route, key).Scan(&cipher, &oldHash, &version)
	if e == nil {
		if !hmac.Equal(hash, oldHash) {
			return platform.Result{}, platform.Fail(409, "idempotency_conflict", "This key was used for another request.")
		}
		if version != s.Config.KeyVersion {
			return platform.Result{}, platform.Unavailable()
		}
		plain, e := platform.Decrypt(s.Config.DataKey, cipher)
		if e != nil {
			return platform.Result{}, e
		}
		var v map[string]any
		e = json.Unmarshal(plain, &v)
		return platform.OK(v), e
	}
	if e != pgx.ErrNoRows {
		return platform.Result{}, e
	}
	if consumed != nil || currentOwner != nil || state != "unpaired" {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This claim was already used.")
	}
	credential := platform.Token()
	result := map[string]any{"device_id": device, "credential": credential}
	plain, _ := json.Marshal(result)
	cipher, e = platform.Encrypt(s.Config.DataKey, plain)
	if e != nil {
		return platform.Result{}, e
	}
	if _, e = tx.Exec(ctx, `UPDATE devices SET owner_id=$2,credential_hash=$3,state='paired' WHERE id=$1`, device, owner, platform.Hash(credential)); e != nil {
		return platform.Result{}, e
	}
	if _, e = tx.Exec(ctx, `UPDATE device_claims SET consumed_at=now(),replay_ciphertext=NULL WHERE id=$1`, r.ID()); e != nil {
		return platform.Result{}, e
	}
	if _, e = tx.Exec(ctx, `INSERT INTO idempotency_records(actor_key,route,key,request_hash,response_ciphertext,key_version,response_status,expires_at) VALUES($1,$2,$3,$4,$5,$6,200,$7)`, actor, route, key, hash, cipher, s.Config.KeyVersion, expiry); e != nil {
		return platform.Result{}, e
	}
	e = tx.Commit(ctx)
	return platform.OK(result), e
}
func (s *Service) list(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, c, e := platform.Page(r, s.Config.CursorKey, "devices")
	if e != nil {
		return platform.Result{}, e
	}
	t := time.Now().Add(time.Hour)
	id := "ffffffff-ffff-ffff-ffff-ffffffffffff"
	if c != nil {
		t = c.Time
		id = c.ID
	}
	items, e := platform.Rows(ctx, s.Pool, `SELECT `+deviceJSON+` FROM devices WHERE owner_id=$1 AND (created_at,id)<($2,$3::uuid) ORDER BY created_at DESC,id DESC LIMIT $4`, r.Owner(), t, id, n+1)
	if e != nil {
		return platform.Result{}, e
	}
	var next any
	if len(items) > n {
		items = items[:n]
		last := items[n-1]
		stamp, _ := time.Parse(time.RFC3339Nano, last["created_at"].(string))
		next = platform.NextCursor(s.Config.CursorKey, r.Owner(), "devices", last["id"].(string), stamp)
	}
	return platform.OK(map[string]any{"items": items, "next_cursor": next}), nil
}
func (s *Service) rename(ctx context.Context, r *platform.Request) (platform.Result, error) {
	name := strings.TrimSpace(r.String("name"))
	if name == "" {
		return platform.Result{}, platform.Invalid("Device name is required.")
	}
	v, e := platform.Row(ctx, r.Tx, `UPDATE devices SET name=$3 WHERE id=$1 AND owner_id=$2 AND version=$4 RETURNING `+deviceJSON, r.ID(), r.Owner(), name, r.Int("version"))
	if e != nil {
		var exists bool
		if err := r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM devices WHERE id=$1 AND owner_id=$2)`, r.ID(), r.Owner()).Scan(&exists); err == nil && exists {
			return platform.Result{}, platform.Conflict()
		}
	}
	return platform.OK(v), e
}
func (s *Service) unpair(ctx context.Context, r *platform.Request) (platform.Result, error) {
	tag, e := r.Tx.Exec(ctx, `UPDATE devices SET state='revoked',owner_id=NULL,credential_hash=NULL,bootstrap_hash=NULL WHERE id=$1 AND owner_id=$2`, r.ID(), r.Owner())
	if e != nil {
		return platform.Result{}, e
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, platform.NotFound()
	}
	_, e = r.Tx.Exec(ctx, `UPDATE conversation_sessions SET state='interrupted',ended_at=now() WHERE owner_id=$1 AND device_id=$2 AND state='active'`, r.Owner(), r.ID())
	if s.CancelOwner != nil {
		r.AfterCommit = append(r.AfterCommit, func() { s.CancelOwner(r.Owner()) })
	}
	return platform.NoContent(), e
}
func (s *Service) AuthenticateDevice(ctx context.Context, token string) (string, string, error) {
	var id, owner string
	e := s.Pool.QueryRow(ctx, `SELECT d.id,d.owner_id FROM devices d JOIN profiles p ON p.id=d.owner_id WHERE credential_hash=$1 AND d.state='paired' AND NOT p.deleting`, platform.Hash(token)).Scan(&id, &owner)
	if e != nil {
		return "", "", platform.Fail(401, "unauthenticated", "Device authentication failed.")
	}
	return id, owner, nil
}
func (s *Service) heartbeat(ctx context.Context, r *platform.Request) (platform.Result, error) {
	h := r.HTTP.Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return platform.Result{}, platform.Fail(401, "unauthenticated", "Device authentication required.")
	}
	id, owner, e := s.AuthenticateDevice(ctx, strings.TrimPrefix(h, "Bearer "))
	if e != nil {
		return platform.Result{}, e
	}
	unlock, e := s.Guards.Lock(ctx, owner)
	if e != nil {
		return platform.Result{}, e
	}
	defer unlock()
	tx, e := s.Pool.Begin(ctx)
	if e != nil {
		return platform.Result{}, e
	}
	defer tx.Rollback(context.Background())
	tag, e := tx.Exec(ctx, `UPDATE devices SET last_seen_at=now(),battery_percent=$2,battery_reported_at=now(),firmware_version=$3,applied_preferences_version=$4 WHERE id=$1 AND state='paired' AND owner_id=$5`, id, r.Int("battery_percent"), r.String("firmware_version"), r.Int("applied_preferences_version"), owner)
	if e != nil {
		return platform.Result{}, e
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, platform.NotFound()
	}
	pref, e := platform.Row(ctx, tx, `SELECT jsonb_build_object('personality',personality,'voice',voice,'listen_first',listen_first,'memory_enabled',memory_enabled,'version',version) FROM preferences WHERE owner_id=$1`, owner)
	if e != nil {
		return platform.Result{}, e
	}
	var allowed bool
	e = tx.QueryRow(ctx, `SELECT eligibility='allowed' AND NOT deleting AND processing_granted_at IS NOT NULL AND processing_revoked_at IS NULL AND processing_policy_version=$2 FROM profiles WHERE id=$1`, owner, s.Config.PolicyVersion).Scan(&allowed)
	if e != nil {
		return platform.Result{}, e
	}
	e = tx.Commit(ctx)
	return platform.OK(map[string]any{"server_time": time.Now().UTC(), "preferences": pref, "voice_enabled": allowed && s.Config.VoiceEnabled, "firmware_manifest_url": nil}), e
}
