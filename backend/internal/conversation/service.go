package conversation

import (
	"context"
	"sync"
	"time"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Memory struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	Category string `json:"category"`
}
type Draft struct {
	SessionID     string    `json:"session_id"`
	Version       int       `json:"version"`
	ExpiresAt     time.Time `json:"expires_at"`
	Mood          string    `json:"mood"`
	Topic         string    `json:"topic"`
	Reflection    string    `json:"reflection"`
	Insights      []string  `json:"insights"`
	SupportStatus string    `json:"support_status"`
	Memories      []Memory  `json:"memories"`
}
type ticket struct {
	Owner, Device, Mode string
	Expires             time.Time
}
type active struct {
	Restart func()
	Owner   string
	Cancel  context.CancelFunc
}
type storedDraft struct {
	Owner      string
	Generation int64
	Draft      Draft
}
type SafetyEvent struct {
	ID, Owner, SessionID, ReasonCode string
	Expires                          time.Time
}
type Service struct {
	closing    bool
	slots      chan struct{}
	Pool       *pgxpool.Pool
	Config     platform.Config
	Guards     *platform.Guards
	DeviceAuth func(context.Context, string) (string, string, error)
	mu         sync.Mutex
	tickets    map[string]ticket
	drafts     map[string]storedDraft
	active     map[string]active
	events     map[string]SafetyEvent
	Voice      platform.Handler
}

func (s *Service) Handlers() map[string]platform.Handler {
	return map[string]platform.Handler{"createVoiceTicket": s.issueTicket, "upgradeVoiceSocket": s.upgrade, "listReviewSessions": s.list, "getSessionDraft": s.getDraft, "discardSessionDraft": s.discard, "saveSession": s.save}
}
func (s *Service) upgrade(ctx context.Context, r *platform.Request) (platform.Result, error) {
	if !s.Config.VoiceEnabled || s.Voice == nil {
		return platform.Result{}, platform.Unavailable()
	}
	return s.Voice(ctx, r)
}
func (s *Service) init() {
	if s.tickets == nil {
		s.tickets = map[string]ticket{}
		s.drafts = map[string]storedDraft{}
		s.active = map[string]active{}
		s.events = map[string]SafetyEvent{}
	}
}
func (s *Service) CancelOwner(owner string) { s.cancelOwner(owner, true) }

// CancelActiveOwner removes active context without deleting completed review drafts.
func (s *Service) CancelActiveOwner(owner string) { s.cancelOwner(owner, false) }
func (s *Service) cancelOwner(owner string, discardDrafts bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.init()
	for id, a := range s.active {
		if a.Owner == owner {
			a.Cancel()
			delete(s.active, id)
		}
	}
	for id, d := range s.drafts {
		if d.Owner == owner && discardDrafts {
			delete(s.drafts, id)
		}
	}
	for id, t := range s.tickets {
		if t.Owner == owner {
			delete(s.tickets, id)
		}
	}
	for id, e := range s.events {
		if e.Owner == owner {
			delete(s.events, id)
		}
	}
}
func (s *Service) SafetyEvent(owner, id string) (SafetyEvent, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	e, ok := s.events[id]
	return e, ok && e.Owner == owner && time.Now().Before(e.Expires)
}
func (s *Service) Expire() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.init()
	now := time.Now()
	for k, v := range s.tickets {
		if now.After(v.Expires) {
			delete(s.tickets, k)
		}
	}
	for k, v := range s.drafts {
		if now.After(v.Draft.ExpiresAt) {
			delete(s.drafts, k)
		}
	}
	for k, v := range s.events {
		if now.After(v.Expires) {
			delete(s.events, k)
		}
	}
}
func (s *Service) issueTicket(ctx context.Context, r *platform.Request) (platform.Result, error) {
	if !s.Config.VoiceEnabled {
		return platform.Result{}, platform.Unavailable()
	}
	var permitted bool
	var locale string
	e := r.Tx.QueryRow(ctx, `SELECT eligibility='allowed' AND NOT deleting,locale FROM profiles WHERE id=$1`, r.Owner()).Scan(&permitted, &locale)
	if e != nil {
		return platform.Result{}, e
	}
	if !permitted {
		return platform.Result{}, platform.Fail(403, "policy_blocked", "This account cannot start voice.")
	}
	if !s.Config.SupportsVoiceLocale(locale) {
		return platform.Result{}, platform.Fail(403, "policy_blocked", "This voice provider supports English only. Set your profile language to English before starting voice.")
	}
	device := r.String("device_id")
	if device != "" {
		var owns bool
		e = r.Tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM devices WHERE id=$1 AND owner_id=$2 AND state='paired')`, device, r.Owner()).Scan(&owns)
		if e != nil {
			return platform.Result{}, e
		}
		if !owns {
			return platform.Result{}, platform.NotFound()
		}
	}
	token := platform.Token()
	expiry := time.Now().UTC().Add(time.Minute)
	r.AfterCommit = append(r.AfterCommit, func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.init()
		s.tickets[string(platform.Hash(token))] = ticket{r.Owner(), device, r.String("mode"), expiry}
	})
	return platform.Created(map[string]any{"ticket": token, "expires_at": expiry, "websocket_path": "/v1/voice"}), nil
}
func (s *Service) list(ctx context.Context, r *platform.Request) (platform.Result, error) {
	n, c, e := platform.Page(r, s.Config.CursorKey, "reviews")
	if e != nil {
		return platform.Result{}, e
	}
	stamp := time.Now().Add(time.Hour)
	id := "ffffffff-ffff-ffff-ffff-ffffffffffff"
	if c != nil {
		stamp = c.Time
		id = c.ID
	}
	rows, e := platform.Rows(ctx, s.Pool, `SELECT jsonb_build_object('id',id,'started_at',started_at,'ended_at',ended_at,'draft_expires_at',draft_expires_at,'device_id',device_id,'state',state) FROM conversation_sessions WHERE owner_id=$1 AND state='review' AND draft_expires_at>now() AND (started_at,id)<($2,$3::uuid) ORDER BY started_at DESC,id DESC LIMIT $4`, r.Owner(), stamp, id, n+1)
	if e != nil {
		return platform.Result{}, e
	}
	s.mu.Lock()
	out := make([]map[string]any, 0)
	for _, v := range rows {
		if _, ok := s.drafts[v["id"].(string)]; ok {
			out = append(out, v)
		}
	}
	s.mu.Unlock()
	var next any
	if len(out) > n {
		out = out[:n]
		last := out[n-1]
		t, _ := time.Parse(time.RFC3339Nano, last["started_at"].(string))
		next = platform.NextCursor(s.Config.CursorKey, r.Owner(), "reviews", last["id"].(string), t)
	}
	return platform.OK(map[string]any{"items": out, "next_cursor": next}), nil
}
func (s *Service) getDraft(ctx context.Context, r *platform.Request) (platform.Result, error) {
	var exists bool
	e := s.Pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM conversation_sessions WHERE id=$1 AND owner_id=$2)`, r.ID(), r.Owner()).Scan(&exists)
	if e != nil {
		return platform.Result{}, e
	}
	if !exists {
		return platform.Result{}, platform.NotFound()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	d, ok := s.drafts[r.ID()]
	if !ok || d.Owner != r.Owner() || time.Now().After(d.Draft.ExpiresAt) {
		return platform.Result{}, platform.Fail(410, "draft_expired", "This unsaved draft is no longer available.")
	}
	return platform.OK(d.Draft), nil
}
func (s *Service) discard(ctx context.Context, r *platform.Request) (platform.Result, error) {
	tag, e := r.Tx.Exec(ctx, `UPDATE conversation_sessions SET state='discarded' WHERE id=$1 AND owner_id=$2 AND state='review'`, r.ID(), r.Owner())
	if e != nil {
		return platform.Result{}, e
	}
	if tag.RowsAffected() == 0 {
		return platform.Result{}, platform.NotFound()
	}
	r.AfterCommit = append(r.AfterCommit, func() { s.mu.Lock(); delete(s.drafts, r.ID()); s.mu.Unlock() })
	return platform.NoContent(), nil
}
func (s *Service) save(ctx context.Context, r *platform.Request) (platform.Result, error) {
	var state string
	var generation, current int64
	var timezone string
	var consent bool
	e := r.Tx.QueryRow(ctx, `SELECT history_generation,timezone,eligibility='allowed' AND NOT deleting FROM profiles WHERE id=$1`, r.Owner()).Scan(&current, &timezone, &consent)
	if e != nil {
		return platform.Result{}, e
	}
	e = r.Tx.QueryRow(ctx, `SELECT state,generation FROM conversation_sessions WHERE id=$1 AND owner_id=$2 FOR UPDATE`, r.ID(), r.Owner()).Scan(&state, &generation)
	if e != nil {
		return platform.Result{}, platform.NotFound()
	}
	if state != "review" {
		return platform.Result{}, platform.Fail(409, "invalid_state", "This session cannot be saved.")
	}
	if current != generation || !consent {
		return platform.Result{}, platform.Fail(403, "policy_blocked", "The session permission has changed.")
	}
	s.mu.Lock()
	entry, ok := s.drafts[r.ID()]
	s.mu.Unlock()
	if !ok || entry.Owner != r.Owner() || time.Now().After(entry.Draft.ExpiresAt) {
		return platform.Result{}, platform.Fail(410, "draft_expired", "This unsaved draft is no longer available.")
	}
	d := entry.Draft
	if int64(d.Version) != r.Int("version") {
		return platform.Result{}, platform.Conflict()
	}
	ids := r.Body["memory_candidate_ids"].([]any)
	selected := []Memory{}
	seen := map[string]bool{}
	for _, v := range ids {
		id := v.(string)
		found := false
		for _, m := range d.Memories {
			if m.ID == id && !seen[id] {
				selected = append(selected, m)
				found = true
				seen[id] = true
				break
			}
		}
		if !found {
			return platform.Result{}, platform.Invalid("A memory candidate is not part of this draft.")
		}
	}
	result := map[string]any{"session_id": r.ID(), "journal_id": nil, "mood_id": nil, "memory_ids": []string{}}
	if r.Bool("save_journal") {
		id := platform.ID()
		_, e = r.Tx.Exec(ctx, `INSERT INTO journals(id,owner_id,session_id,topic,reflection,insights) VALUES($1,$2,$3,$4,$5,$6)`, id, r.Owner(), r.ID(), d.Topic, d.Reflection, d.Insights)
		if e != nil {
			return platform.Result{}, e
		}
		result["journal_id"] = id
	}
	if r.Bool("save_mood") {
		id := platform.ID()
		_, e = r.Tx.Exec(ctx, `INSERT INTO mood_entries(id,owner_id,session_id,label,source,occurred_at,timezone) VALUES($1,$2,$3,$4,'conversation',now(),$5)`, id, r.Owner(), r.ID(), r.String("mood"), timezone)
		if e != nil {
			return platform.Result{}, e
		}
		result["mood_id"] = id
	}
	memoryIDs := []string{}
	for _, m := range selected {
		id := platform.ID()
		_, e = r.Tx.Exec(ctx, `INSERT INTO memories(id,owner_id,session_id,candidate_id,text,category) VALUES($1,$2,$3,$4,$5,$6)`, id, r.Owner(), r.ID(), m.ID, m.Text, m.Category)
		if e != nil {
			return platform.Result{}, e
		}
		memoryIDs = append(memoryIDs, id)
	}
	result["memory_ids"] = memoryIDs
	next := "saved"
	if !r.Bool("save_journal") && !r.Bool("save_mood") && len(selected) == 0 {
		next = "discarded"
	}
	if _, e = r.Tx.Exec(ctx, `UPDATE conversation_sessions SET state=$3 WHERE id=$1 AND owner_id=$2`, r.ID(), r.Owner(), next); e != nil {
		return platform.Result{}, e
	}
	r.AfterCommit = append(r.AfterCommit, func() { s.mu.Lock(); delete(s.drafts, r.ID()); s.mu.Unlock() })
	return platform.OK(result), nil
}

// Shutdown invalidates every transient ticket/draft and asks open peers to
// reconnect with a new session. No unsaved audio is recovered after restart.
func (s *Service) Shutdown(ctx context.Context) {
	s.mu.Lock()
	s.init()
	s.closing = true
	running := make([]active, 0, len(s.active))
	for _, a := range s.active {
		running = append(running, a)
	}
	s.tickets = map[string]ticket{}
	s.drafts = map[string]storedDraft{}
	s.events = map[string]SafetyEvent{}
	s.mu.Unlock()
	var wg sync.WaitGroup
	for _, a := range running {
		wg.Add(1)
		go func(a active) {
			defer wg.Done()
			if a.Restart != nil {
				a.Restart()
			}
			a.Cancel()
		}(a)
	}
	done := make(chan struct{})
	go func() { wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-ctx.Done():
		for _, a := range running {
			a.Cancel()
		}
	}
}
