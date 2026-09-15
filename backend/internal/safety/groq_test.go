package safety

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGroqStructuredOperations(t *testing.T) {
	outputs := []string{
		`{"signal":"none","reason_code":"none","style":"calm","suggest_activity":"none"}`,
		`{"text":"Hello. How is your day?","activity_id":null}`,
		`{"allowed":true,"reason":"allowed"}`,
		`{"mood":"unknown","topic":"Connection test","reflection":"You tested the connection.","insights":[],"memory_candidates":[]}`,
	}
	index := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/chat/completions" || r.URL.RawQuery != "" || r.Header.Get("Authorization") != "Bearer test-key" {
			t.Error("incorrect request authentication or endpoint")
		}
		var body struct {
			Model          string                           `json:"model"`
			Messages       []struct{ Role, Content string } `json:"messages"`
			ResponseFormat struct {
				Type       string
				JSONSchema struct {
					Name   string
					Strict bool
					Schema json.RawMessage
				} `json:"json_schema"`
			} `json:"response_format"`
			ReasoningEffort string `json:"reasoning_effort"`
		}
		if json.NewDecoder(r.Body).Decode(&body) != nil || body.Model != "openai/gpt-oss-120b" || len(body.Messages) != 2 || body.ResponseFormat.Type != "json_schema" {
			t.Error("model or structured response request is incorrect")
		}
		if !body.ResponseFormat.JSONSchema.Strict || len(body.ResponseFormat.JSONSchema.Schema) == 0 || body.ResponseFormat.JSONSchema.Name == "" || body.ReasoningEffort != "low" {
			t.Error("strict schema or reasoning effort is missing")
		}
		if len(body.Messages) == 2 && (!strings.Contains(body.Messages[0].Content, `"required"`) || body.Messages[1].Role != "user") {
			t.Error("schema missing or user data promoted to instructions")
		}
		if index == 1 && !strings.Contains(body.Messages[1].Content, `"recent_self_reported_moods":[{"label":"low","occurred_at":"2026-09-12T10:00:00Z"}]`) {
			t.Error("dated mood context missing from reply request")
		}
		if index >= len(outputs) {
			t.Error("unexpected retry")
			w.WriteHeader(500)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"finish_reason": "stop", "message": map[string]string{"content": outputs[index]}}}})
		index++
	}))
	defer server.Close()
	model := NewGroq(GroqConfig{APIKey: "test-key", BaseURL: server.URL})
	ctx := context.Background()
	a, err := model.Assess(ctx, AssessmentRequest{Locale: "en-US", Transcript: "Connection test."})
	if err != nil {
		t.Fatal(err)
	}
	r, err := model.Reply(ctx, ReplyRequest{Locale: "en-US", Transcript: "Connection test.", Assessment: a, MoodCheckIns: []MoodCheckIn{{Label: "low", OccurredAt: "2026-09-12T10:00:00Z"}}})
	if err != nil {
		t.Fatal(err)
	}
	c, err := model.Check(ctx, ReplyCheckRequest{Locale: "en-US", Transcript: "Connection test.", Candidate: r})
	if err != nil || !c.Allowed {
		t.Fatalf("reply check: %v", err)
	}
	_, err = model.Draft(ctx, DraftRequest{Locale: "en-US", Recent: []Message{{Role: "user", Text: "Connection test."}, {Role: "assistant", Text: r.Text}}})
	if err != nil {
		t.Fatal(err)
	}
}

func TestGroqRejectsMalformedAndTruncatedOutput(t *testing.T) {
	for _, content := range []string{
		`{}`, `{"signal":"none","reason_code":"none","style":"calm"}`,
		`{"signal":"none","reason_code":"none","style":"calm","suggest_activity":"none","extra":1}`,
		`{"signal":"none","signal":"serious","reason_code":"none","style":"calm","suggest_activity":"none"}`,
		`{"signal":"other","reason_code":"none","style":"calm","suggest_activity":"none"}`, `{}` + `{}`,
	} {
		t.Run(content, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_ = json.NewEncoder(w).Encode(map[string]any{"choices": []any{map[string]any{"finish_reason": "stop", "message": map[string]string{"content": content}}}})
			}))
			defer server.Close()
			_, err := NewGroq(GroqConfig{APIKey: "test", BaseURL: server.URL}).Assess(context.Background(), AssessmentRequest{Transcript: "test"})
			if !errors.Is(err, ErrMalformedOutput) {
				t.Fatalf("invalid output accepted: %v", err)
			}
		})
	}
	for _, body := range []string{
		`{"choices":[]}`, `{"error":{"message":"sensitive"},"choices":[]}`,
		`{"choices":[{"finish_reason":"length","message":{"content":"{}"}}]}`,
		`{"choices":[{"finish_reason":"stop","message":{"content":"{}","refusal":"refused"}}]}`,
	} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(body)) }))
		_, err := NewGroq(GroqConfig{APIKey: "test", BaseURL: server.URL}).Assess(context.Background(), AssessmentRequest{Transcript: "test"})
		server.Close()
		if !errors.Is(err, ErrMalformedOutput) {
			t.Fatalf("invalid envelope accepted: %v", err)
		}
	}
}

func TestGroqRateLimitAndCancellation(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.WriteHeader(429)
		_, _ = w.Write([]byte("sensitive provider detail"))
	}))
	defer server.Close()
	model := NewGroq(GroqConfig{APIKey: "test", BaseURL: server.URL})
	_, err := model.Assess(context.Background(), AssessmentRequest{Transcript: "test"})
	if !errors.Is(err, ErrUnavailable) || calls != 1 || strings.Contains(err.Error(), "sensitive") {
		t.Fatalf("unsafe rate-limit handling: %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = model.Assess(ctx, AssessmentRequest{Transcript: "test"})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation lost: %v", err)
	}
	_, err = NewGroq(GroqConfig{}).Assess(context.Background(), AssessmentRequest{Transcript: "test"})
	if !errors.Is(err, ErrDisabled) {
		t.Fatal("missing key must disable provider")
	}
}
