package conversation

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/safety"
	"github.com/StyNW7/Soba/backend/internal/speech"
	"github.com/StyNW7/Soba/backend/internal/testutil"
	"github.com/coder/websocket"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"
)

type fakeSTT struct{}

func (fakeSTT) NewStream(context.Context) (speech.TranscriptStream, error) {
	return &fakeStream{events: make(chan speech.TranscriptEvent, 1)}, nil
}

type fakeStream struct {
	events chan speech.TranscriptEvent
	once   sync.Once
}

func (f *fakeStream) Send(context.Context, []byte) error {
	f.once.Do(func() { f.events <- speech.TranscriptEvent{Text: "Hari ini baik", IsFinal: true, SpeechFinal: true} })
	return nil
}
func (f *fakeStream) Receive(ctx context.Context) (speech.TranscriptEvent, error) {
	select {
	case e := <-f.events:
		return e, nil
	case <-ctx.Done():
		return speech.TranscriptEvent{}, ctx.Err()
	}
}
func (f *fakeStream) RequestFinalize(context.Context) error    { return nil }
func (f *fakeStream) FinalText() string                        { return "Hari ini baik" }
func (f *fakeStream) Finalize(context.Context) (string, error) { return f.FinalText(), nil }
func (f *fakeStream) Close() error                             { return nil }

type fakeTTS struct{}

func (fakeTTS) Synthesize(ctx context.Context, r speech.TTSRequest, w io.Writer) error {
	if !r.Approved {
		panic("unapproved")
	}
	_, e := w.Write(make([]byte, 9600))
	return e
}

type fakeAI struct{ activityID string }

func (f fakeAI) Respond(context.Context, safety.ConversationRequest) (safety.ConversationResult, error) {
	return safety.ConversationResult{Text: "Baik, aku mendengarkan.", ApprovedForSpeech: true, Route: safety.RouteNormal, Reply: safety.Reply{ActivityID: f.activityID}}, nil
}
func (fakeAI) Draft(context.Context, safety.DraftRequest) (safety.Draft, error) {
	return safety.Draft{Mood: safety.MoodGood, Topic: "Hari ini", Reflection: "Hari yang baik", Insights: []string{}}, nil
}
func TestVoiceFlowKeepsUnsavedContentTransient(t *testing.T) {
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	cfg := testutil.Config()
	cfg.VoiceEnabled = true
	s := &Service{Pool: p, Config: cfg, Guards: &platform.Guards{}}
	s.init()
	token := platform.Token()
	s.tickets[string(platform.Hash(token))] = ticket{Owner: owner, Mode: "private", Expires: time.Now().Add(time.Minute)}
	activityID := platform.ID()
	if _, err := p.Exec(context.Background(), `INSERT INTO content_items(id,kind,title,locale,steps,review_status,reviewer_id,reviewed_at,review_expires_at) VALUES($1,'breathing','Test activity','id-ID','[{"text":"Test step","duration_seconds":60,"audio_url":null}]','approved','test',now(),now()+interval '1 hour')`, activityID); err != nil {
		t.Fatal(err)
	}
	v, e := NewVoiceEngine(s, fakeSTT{}, fakeTTS{}, fakeAI{activityID: activityID})
	if e != nil {
		t.Fatal(e)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = v.Serve(r.Context(), &platform.Request{Writer: w, HTTP: r})
	}))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	conn, _, e := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http"), &websocket.DialOptions{HTTPHeader: http.Header{"Origin": {"https://app.soba.test"}}})
	if e != nil {
		t.Fatal(e)
	}
	defer conn.CloseNow()
	send := func(typ string, m map[string]any) {
		t.Helper()
		m["type"] = typ
		m["version"] = 1
		m["event_id"] = platform.ID()
		b, _ := json.Marshal(m)
		if e := conn.Write(ctx, websocket.MessageText, b); e != nil {
			t.Fatal(e)
		}
	}
	read := func() map[string]any {
		t.Helper()
		for {
			k, b, e := conn.Read(ctx)
			if e != nil {
				t.Fatal(e)
			}
			if k == websocket.MessageBinary {
				if len(b) != 9608 || binary.BigEndian.Uint32(b) < 1 || binary.BigEndian.Uint32(b) > 2 {
					t.Fatal("invalid PCM framing")
				}
				continue
			}
			var m map[string]any
			if e = json.Unmarshal(b, &m); e != nil {
				t.Fatal(e)
			}
			if m["type"] == "error" {
				t.Fatalf("server error: %v", m)
			}
			return m
		}
	}
	send("session.start", map[string]any{"ticket": token, "sample_rate": 16000, "channels": 1, "encoding": "pcm_s16le", "mode": "private"})
	ready := read()
	if ready["type"] != "session.ready" {
		t.Fatal(ready)
	}
	id := ready["session_id"].(string)
	send("input.start", map[string]any{"session_id": id, "client_turn_id": platform.ID()})
	inputReady := read()
	if inputReady["type"] != "input.ready" {
		t.Fatal(inputReady)
	}
	send("response.cancel", map[string]any{"session_id": id, "response_id": inputReady["response_id"]})
	_, rejected, err := conn.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var rejection map[string]any
	if json.Unmarshal(rejected, &rejection) != nil || rejection["type"] != "error" || rejection["code"] != "invalid_state" {
		t.Fatal("cancel during capture must not end the input turn", string(rejected))
	}
	if e = conn.Write(ctx, websocket.MessageBinary, make([]byte, 644)); e != nil {
		t.Fatal(e)
	}
	var responseID string
	for {
		m := read()
		if m["type"] == "response.end" {
			responseID = m["response_id"].(string)
			if m["status"] != "complete" {
				t.Fatal(m)
			}
			break
		}
	}
	send("response.cancel", map[string]any{"session_id": id, "response_id": responseID})
	if m := read(); m["type"] != "response.end" || m["status"] != "complete" || m["response_id"] != responseID {
		t.Fatal("late cancellation changed terminal status", m)
	}
	send("activity.control", map[string]any{"session_id": id, "action": "resume"})
	if m := read(); m["type"] != "activity.state" || m["state"] != "playing" {
		t.Fatal(m)
	}
	playing := read()
	if playing["type"] != "response.start" {
		t.Fatal(playing)
	}
	activityResponse := playing["response_id"].(string)
	send("response.cancel", map[string]any{"session_id": id, "response_id": activityResponse})
	if m := read(); m["type"] != "activity.state" || m["state"] != "stopped" {
		t.Fatal("device stop did not stop activity", m)
	}
	if m := read(); m["type"] != "response.end" || m["status"] != "cancelled" {
		t.Fatal(m)
	}
	send("response.cancel", map[string]any{"session_id": id, "response_id": activityResponse})
	if m := read(); m["type"] != "response.end" || m["status"] != "cancelled" {
		t.Fatal("activity terminal state changed", m)
	}
	send("session.end", map[string]any{"session_id": id})
	if m := read(); m["type"] != "session.summary_ready" {
		t.Fatal(m)
	}
	var count int
	if e = p.QueryRow(ctx, `SELECT (SELECT count(*) FROM journals)+(SELECT count(*) FROM mood_entries)+(SELECT count(*) FROM memories)`).Scan(&count); e != nil || count != 0 {
		t.Fatalf("hidden persisted content: %d %v", count, e)
	}
	s.mu.Lock()
	_, ok := s.drafts[id]
	s.mu.Unlock()
	if !ok {
		t.Fatal("draft missing")
	}
}

func TestVoiceRequiresOriginBeforeTicketRedemption(t *testing.T) {
	s := &Service{Config: testutil.Config()}
	v, err := NewVoiceEngine(s, fakeSTT{}, fakeTTS{}, fakeAI{})
	if err != nil {
		t.Fatal(err)
	}
	_, err = v.Serve(context.Background(), &platform.Request{HTTP: httptest.NewRequest("GET", "/v1/voice", nil), Writer: httptest.NewRecorder()})
	var denied *platform.Error
	if !errors.As(err, &denied) || denied.Status != 403 {
		t.Fatal("missing Origin accepted", err)
	}
}

func TestShutdownCannotMissRegisteringVoiceSession(t *testing.T) {
	p := testutil.Database(t)
	owner := testutil.Owner(t, p)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	block, err := p.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer block.Rollback(context.Background())
	if _, err = block.Exec(ctx, `SELECT id FROM profiles WHERE id=$1 FOR UPDATE`, owner); err != nil {
		t.Fatal(err)
	}
	s := &Service{Pool: p, Config: testutil.Config(), Guards: &platform.Guards{}}
	s.init()
	token := platform.Token()
	key := string(platform.Hash(token))
	s.tickets[key] = ticket{Owner: owner, Mode: "private", Expires: time.Now().Add(time.Minute)}
	v, err := NewVoiceEngine(s, fakeSTT{}, fakeTTS{}, fakeAI{})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = v.Serve(r.Context(), &platform.Request{Writer: w, HTTP: r})
	}))
	defer server.Close()
	conn, _, err := websocket.Dial(ctx, "ws"+strings.TrimPrefix(server.URL, "http"), &websocket.DialOptions{HTTPHeader: http.Header{"Origin": {"https://app.soba.test"}}})
	if err != nil {
		t.Fatal(err)
	}
	defer conn.CloseNow()
	b, _ := json.Marshal(map[string]any{"type": "session.start", "version": 1, "event_id": platform.ID(), "ticket": token, "sample_rate": 16000, "channels": 1, "encoding": "pcm_s16le", "mode": "private"})
	if err = conn.Write(ctx, websocket.MessageText, b); err != nil {
		t.Fatal(err)
	}
	for {
		s.mu.Lock()
		_, pending := s.tickets[key]
		s.mu.Unlock()
		if !pending {
			break
		}
		select {
		case <-ctx.Done():
			t.Fatal("ticket not redeemed")
		case <-time.After(time.Millisecond):
		}
	}
	s.Shutdown(ctx)
	if err = block.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	_, _, err = conn.Read(ctx)
	if websocket.CloseStatus(err) != websocket.StatusServiceRestart {
		t.Fatal("expected restart close", err)
	}
	var count int
	if err = p.QueryRow(ctx, `SELECT count(*) FROM conversation_sessions WHERE state='active'`).Scan(&count); err != nil || count != 0 {
		t.Fatal("active session survived shutdown", count, err)
	}
}
