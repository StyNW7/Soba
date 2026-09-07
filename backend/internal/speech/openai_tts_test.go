package speech

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestOpenAITTSStreamsApprovedPCMAndUsesRequiredRequest(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("authorization = %q", r.Header.Get("Authorization"))
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode request: %v", err)
			return
		}
		for key, want := range map[string]string{"model": "gpt-4o-mini-tts", "input": "halo", "voice": "cedar", "instructions": "calm", "response_format": "pcm"} {
			if got, _ := body[key].(string); got != want {
				t.Errorf("body[%s] = %q, want %q", key, got, want)
			}
		}
		w.Header().Set("Content-Type", "audio/pcm")
		_, _ = w.Write([]byte{0, 1, 2, 3})
	}))
	defer func() {
		server.CloseClientConnections()
		server.Close()
	}()

	adapter := NewOpenAITTS(OpenAITTSConfig{APIKey: "test-key", Endpoint: server.URL})
	var output []byte
	if err := adapter.Synthesize(context.Background(), TTSRequest{Text: "halo", Voice: "cedar", Style: "calm", Approved: true}, writerFunc(func(p []byte) (int, error) {
		output = append(output, p...)
		return len(p), nil
	})); err != nil {
		t.Fatalf("Synthesize() error = %v", err)
	}
	if string(output) != string([]byte{0, 1, 2, 3}) {
		t.Fatalf("audio = %v", output)
	}
	if requests.Load() != 1 {
		t.Fatalf("requests = %d, want 1", requests.Load())
	}
}

func TestOpenAITTSRequiresApprovalAndRejectsMalformedPCM(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		_, _ = w.Write([]byte{1})
	}))
	defer server.Close()
	adapter := NewOpenAITTS(OpenAITTSConfig{APIKey: "test-key", Endpoint: server.URL})
	if err := adapter.Synthesize(context.Background(), TTSRequest{Text: "unchecked", Approved: false}, io.Discard); !errors.Is(err, ErrUnapprovedSpeech) {
		t.Fatalf("unapproved error = %v", err)
	}
	if requests.Load() != 0 {
		t.Fatal("unapproved text reached provider")
	}
	if err := adapter.Synthesize(context.Background(), TTSRequest{Text: "checked", Approved: true}, io.Discard); !errors.Is(err, ErrMalformedProvider) {
		t.Fatalf("odd PCM error = %v", err)
	}
}

func TestOpenAITTSCancellationAndDisabledDefault(t *testing.T) {
	if err := NewOpenAITTS(OpenAITTSConfig{}).Synthesize(context.Background(), TTSRequest{Text: "hello", Approved: true}, io.Discard); !errors.Is(err, ErrDisabled) {
		t.Fatalf("disabled error = %v", err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
	}))
	defer func() {
		server.CloseClientConnections()
		server.Close()
	}()
	adapter := NewOpenAITTS(OpenAITTSConfig{APIKey: "test-key", Endpoint: server.URL, FirstByteTimeout: time.Second, WholeTimeout: time.Second})
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	err := adapter.Synthesize(ctx, TTSRequest{Text: "hello", Approved: true}, io.Discard)
	if !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, context.Canceled) {
		t.Fatalf("cancellation error = %v, want context cancellation", err)
	}
}

type writerFunc func([]byte) (int, error)

func (f writerFunc) Write(p []byte) (int, error) { return f(p) }
