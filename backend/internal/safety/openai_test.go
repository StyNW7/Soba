package safety

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestOpenAIResponsesUsesStrictStoredFalseContract(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/responses" {
			t.Errorf("path = %q", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("authorization = %q", r.Header.Get("Authorization"))
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("request decode: %v", err)
			return
		}
		if body["store"] != false {
			t.Errorf("store = %#v, want false", body["store"])
		}
		if body["model"] != "gpt-4.1-mini" {
			t.Errorf("model = %#v", body["model"])
		}
		if tools, ok := body["tools"].([]any); !ok || len(tools) != 0 {
			t.Errorf("tools = %#v, want empty", body["tools"])
		}
		textConfig, ok := body["text"].(map[string]any)
		if !ok {
			t.Errorf("text config = %#v", body["text"])
		} else if format, ok := textConfig["format"].(map[string]any); !ok || format["type"] != "json_schema" || format["strict"] != true {
			t.Errorf("format = %#v", textConfig["format"])
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"{\"signal\":\"none\",\"reason_code\":\"none\",\"style\":\"calm\",\"suggest_activity\":\"none\"}"}]}]}`))
	}))
	defer server.Close()
	provider := NewOpenAIResponses(OpenAIConfig{APIKey: "test-key", BaseURL: server.URL + "/v1"})
	assessment, err := provider.Assess(context.Background(), AssessmentRequest{Locale: "id", Transcript: "halo"})
	if err != nil {
		t.Fatalf("Assess() error = %v", err)
	}
	if assessment.Signal != SignalNone || assessment.Style != StyleCalm {
		t.Fatalf("assessment = %+v", assessment)
	}
}

func TestOpenAIResponsesRejectsMalformedStructuredOutputAndProviderBody(t *testing.T) {
	tests := []struct {
		name     string
		status   int
		response string
		want     error
	}{
		{name: "unknown field", response: `{"status":"completed","output_text":"{\"signal\":\"none\",\"reason_code\":\"none\",\"style\":\"calm\",\"suggest_activity\":\"none\",\"secret\":\"no\"}"}`, want: ErrMalformedOutput},
		{name: "trailing JSON", response: `{"status":"completed","output_text":"{\"signal\":\"none\",\"reason_code\":\"none\",\"style\":\"calm\",\"suggest_activity\":\"none\"}"} {}`, want: ErrMalformedOutput},
		{name: "provider status", status: http.StatusBadGateway, response: `{"error":"private transcript"}`, want: ErrUnavailable},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if test.status != 0 {
					w.WriteHeader(test.status)
				}
				_, _ = w.Write([]byte(test.response))
			}))
			defer server.Close()
			provider := NewOpenAIResponses(OpenAIConfig{APIKey: "test-key", BaseURL: server.URL})
			_, err := provider.Assess(context.Background(), AssessmentRequest{Locale: "id", Transcript: "halo"})
			if !errors.Is(err, test.want) {
				t.Fatalf("Assess() error = %v, want errors.Is(..., %v)", err, test.want)
			}
			if strings.Contains(err.Error(), "private transcript") {
				t.Fatalf("provider body leaked in error: %v", err)
			}
		})
	}
}

func TestOpenAIResponsesCancellationAndDraft(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/responses" {
			t.Errorf("path = %q", r.URL.Path)
		}
		time.Sleep(100 * time.Millisecond)
	}))
	defer server.Close()
	provider := NewOpenAIResponses(OpenAIConfig{APIKey: "test-key", BaseURL: server.URL, AssessmentTimeout: time.Second})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	if _, err := provider.Assess(ctx, AssessmentRequest{Locale: "id", Transcript: "halo"}); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("cancellation error = %v", err)
	}
	validDraftServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"status":"completed","output_text":"{\"mood\":\"neutral\",\"topic\":\"work\",\"reflection\":\"short\",\"insights\":[],\"memory_candidates\":[]}"}`))
	}))
	defer validDraftServer.Close()
	provider = NewOpenAIResponses(OpenAIConfig{APIKey: "test-key", BaseURL: validDraftServer.URL})
	draft, err := provider.Draft(context.Background(), DraftRequest{Locale: "id", Transcript: "work"})
	if err != nil || draft.Mood != MoodNeutral {
		t.Fatalf("Draft() = %+v, err=%v", draft, err)
	}
}

func TestOpenAIResponsesDisabledWithoutCredentials(t *testing.T) {
	provider := NewOpenAIResponses(OpenAIConfig{})
	if provider.Enabled() {
		t.Fatal("provider enabled without credentials")
	}
	if _, err := provider.Assess(context.Background(), AssessmentRequest{Locale: "id", Transcript: "hello"}); !errors.Is(err, ErrDisabled) {
		t.Fatalf("Assess() error = %v", err)
	}
}

func TestInputBudgetPreservesPolicyAndDropsOldContext(t *testing.T) {
	raw := []byte(`{"policy":"fixed policy","transcript":"current text","recent_turns":[{"role":"user","text":"old conversation old conversation old conversation"},{"role":"assistant","text":"old reply old reply old reply"}],"approved_memories":[{"text":"newer memory"},{"text":"older memory"}]}`)
	got, err := boundedInput(raw, 150)
	if err != nil {
		t.Fatal(err)
	}
	var value map[string]any
	if err = json.Unmarshal(got, &value); err != nil {
		t.Fatal(err)
	}
	if value["policy"] != "fixed policy" || value["transcript"] != "current text" || len(got) > 150 {
		t.Fatal("budget changed fixed input")
	}
	if _, err = boundedInput([]byte(`{"policy":"must not cut","transcript":"current"}`), 5); err == nil {
		t.Fatal("oversize fixed input accepted")
	}
}
