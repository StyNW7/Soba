package safety

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGeminiStructuredAssessment(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/models/gemini-2.5-flash-lite:generateContent" || r.Header.Get("x-goog-api-key") != "test-key" || r.URL.RawQuery != "" {
			t.Error("incorrect endpoint or authentication")
		}
		var body map[string]any
		if json.NewDecoder(r.Body).Decode(&body) != nil {
			t.Fatal("request is not JSON")
		}
		config := body["generationConfig"].(map[string]any)
		if config["responseMimeType"] != "application/json" || config["responseJsonSchema"] == nil || body["systemInstruction"] == nil {
			t.Error("structured output contract missing")
		}
		output := `{"signal":"none","reason_code":"none","style":"calm","suggest_activity":"none"}`
		_ = json.NewEncoder(w).Encode(map[string]any{"candidates": []any{map[string]any{"finishReason": "STOP", "content": map[string]any{"parts": []any{map[string]string{"text": output}}}}}})
	}))
	defer server.Close()
	model := NewGemini(GeminiConfig{APIKey: "test-key", BaseURL: server.URL})
	got, err := model.Assess(context.Background(), AssessmentRequest{Locale: "en-US", Transcript: "A connection test."})
	if err != nil || got.Signal != SignalNone {
		t.Fatalf("assessment failed: %v", err)
	}
}

func TestGeminiRejectsInvalidAndUnavailableOutput(t *testing.T) {
	for _, body := range []string{
		`{"candidates":[]}`,
		`{"candidates":[{"finishReason":"MAX_TOKENS","content":{"parts":[{"text":"{}"}]}}]}`,
		`{"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":"{\"signal\":\"invalid\"}"}]}}]}`,
		`{"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":"{} {}"}]}}]}`,
	} {
		t.Run(body, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(body)) }))
			defer server.Close()
			_, err := NewGemini(GeminiConfig{APIKey: "test", BaseURL: server.URL}).Assess(context.Background(), AssessmentRequest{Transcript: "test"})
			if !errors.Is(err, ErrMalformedOutput) {
				t.Fatalf("wanted malformed output, got %v", err)
			}
		})
	}
	model := NewGemini(GeminiConfig{})
	if _, err := model.Assess(context.Background(), AssessmentRequest{Transcript: "test"}); !errors.Is(err, ErrDisabled) {
		t.Fatal("missing key must disable model")
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(429)
		_, _ = w.Write([]byte("sensitive provider detail"))
	}))
	defer server.Close()
	model = NewGemini(GeminiConfig{APIKey: "test", BaseURL: server.URL})
	if _, err := model.Assess(context.Background(), AssessmentRequest{Transcript: "test"}); !errors.Is(err, ErrUnavailable) {
		t.Fatal("rate limit must fail closed")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := model.Assess(ctx, AssessmentRequest{Transcript: "test"}); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation lost: %v", err)
	}
}
