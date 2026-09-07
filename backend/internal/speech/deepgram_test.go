package speech

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestDeepgramStreamUsesNova3PCMContractAndFinalizesWithoutConcurrentRead(t *testing.T) {
	queries := make(chan url.Values, 1)
	binaryAudio := make(chan []byte, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		queries <- r.URL.Query()
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close(websocket.StatusNormalClosure, "")
		for {
			messageType, payload, err := conn.Read(r.Context())
			if err != nil {
				return
			}
			switch messageType {
			case websocket.MessageBinary:
				binaryAudio <- append([]byte(nil), payload...)
				_ = conn.Write(r.Context(), websocket.MessageText, []byte(`{"type":"Results","is_final":false,"speech_final":false,"channel":{"alternatives":[{"transcript":"halo"}]}}`))
			case websocket.MessageText:
				if string(payload) != `{"type":"Finalize"}` {
					return
				}
				_ = conn.Write(r.Context(), websocket.MessageText, []byte(`{"type":"Results","is_final":true,"speech_final":true,"channel":{"alternatives":[{"transcript":"dunia"}]}}`))
			}
		}
	}))
	defer server.Close()

	endpoint := "ws" + strings.TrimPrefix(server.URL, "http") + "/v1/listen"
	adapter := NewDeepgram(DeepgramConfig{APIKey: "test-key", Endpoint: endpoint})
	stream, err := adapter.NewStream(context.Background())
	if err != nil {
		t.Fatalf("NewStream() error = %v", err)
	}
	defer stream.Close()

	pcm := []byte{0, 1, 2, 3}
	if err := stream.Send(context.Background(), pcm); err != nil {
		t.Fatalf("Send() error = %v", err)
	}
	select {
	case got := <-binaryAudio:
		if string(got) != string(pcm) {
			t.Fatalf("audio = %v, want %v", got, pcm)
		}
	case <-time.After(time.Second):
		t.Fatal("server did not receive audio")
	}
	interim, err := stream.Receive(context.Background())
	if err != nil {
		t.Fatalf("Receive(interim) error = %v", err)
	}
	if interim.Text != "halo" || interim.IsFinal || interim.SpeechFinal {
		t.Fatalf("interim = %+v", interim)
	}
	if err := stream.RequestFinalize(context.Background()); err != nil {
		t.Fatalf("RequestFinalize() error = %v", err)
	}
	final, err := stream.Receive(context.Background())
	if err != nil {
		t.Fatalf("Receive(final) error = %v", err)
	}
	if !final.IsFinal || !final.SpeechFinal || final.Text != "dunia" {
		t.Fatalf("final = %+v", final)
	}
	if got := stream.FinalText(); got != "dunia" {
		t.Fatalf("FinalText() = %q, want %q", got, "dunia")
	}
	select {
	case got := <-queries:
		for key, want := range map[string]string{"model": "nova-3", "language": "id", "encoding": "linear16", "sample_rate": "16000", "channels": "1", "interim_results": "true", "endpointing": "500"} {
			if got.Get(key) != want {
				t.Errorf("query %s = %q, want %q", key, got.Get(key), want)
			}
		}
	case <-time.After(time.Second):
		t.Fatal("server did not observe handshake")
	}
}

func TestDeepgramMalformedAndProviderErrorsDoNotExposeProviderPayload(t *testing.T) {
	tests := []struct {
		name    string
		payload []byte
		want    error
	}{
		{name: "malformed text", payload: []byte(`not-json`), want: ErrMalformedProvider},
		{name: "binary result", payload: []byte(`binary`), want: ErrMalformedProvider},
		{name: "provider error", payload: []byte(`{"type":"Error","code":"secret-code","description":"private transcript"}`), want: ErrProvider},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				conn, err := websocket.Accept(w, r, nil)
				if err != nil {
					return
				}
				defer conn.Close(websocket.StatusNormalClosure, "")
				messageType := websocket.MessageText
				if test.name == "binary result" {
					messageType = websocket.MessageBinary
				}
				_ = conn.Write(r.Context(), messageType, test.payload)
			}))
			defer server.Close()
			endpoint := "ws" + strings.TrimPrefix(server.URL, "http")
			stream, err := NewDeepgram(DeepgramConfig{APIKey: "test-key", Endpoint: endpoint}).NewStream(context.Background())
			if err != nil {
				t.Fatalf("NewStream() error = %v", err)
			}
			defer stream.Close()
			_, err = stream.Receive(context.Background())
			if !errors.Is(err, test.want) {
				t.Fatalf("Receive() error = %v, want errors.Is(..., %v)", err, test.want)
			}
			if strings.Contains(err.Error(), "private transcript") || strings.Contains(err.Error(), "secret-code") {
				t.Fatalf("provider payload leaked in error: %v", err)
			}
		})
	}
}

func TestDeepgramCancellationAndDisabledDefault(t *testing.T) {
	if _, err := NewDeepgram(DeepgramConfig{}).NewStream(context.Background()); !errors.Is(err, ErrDisabled) {
		t.Fatalf("disabled NewStream() error = %v", err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer conn.Close(websocket.StatusNormalClosure, "")
		<-r.Context().Done()
	}))
	defer server.Close()
	endpoint := "ws" + strings.TrimPrefix(server.URL, "http")
	stream, err := NewDeepgram(DeepgramConfig{APIKey: "test-key", Endpoint: endpoint}).NewStream(context.Background())
	if err != nil {
		t.Fatalf("NewStream() error = %v", err)
	}
	defer stream.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Millisecond)
	defer cancel()
	_, err = stream.Receive(ctx)
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Receive() error = %v, want deadline", err)
	}
}

func TestDeepgramRejectsInvalidAudio(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, nil)
		if err == nil {
			defer conn.Close(websocket.StatusNormalClosure, "")
		}
	}))
	defer server.Close()
	endpoint := "ws" + strings.TrimPrefix(server.URL, "http")
	stream, err := NewDeepgram(DeepgramConfig{APIKey: "test-key", Endpoint: endpoint}).NewStream(context.Background())
	if err != nil {
		t.Fatalf("NewStream() error = %v", err)
	}
	defer stream.Close()
	if err := stream.Send(context.Background(), []byte{1}); !errors.Is(err, ErrInvalidAudio) {
		t.Fatalf("Send() error = %v, want invalid audio", err)
	}
}

func TestFinalTranscriptAggregateIsBounded(t *testing.T) {
	s := &deepgramStream{seenSegments: map[string]struct{}{}}
	event := TranscriptEvent{IsFinal: true, Text: strings.Repeat("a", 4000)}
	if e := s.recordFinal(event); e != nil {
		t.Fatal(e)
	}
	if e := s.recordFinal(event); e != nil {
		t.Fatal(e)
	}
	if len(s.finalSegments) != 1 {
		t.Fatal("duplicate final segment")
	}
	event.StartSeconds = 1
	if e := s.recordFinal(event); e == nil {
		t.Fatal("aggregate exceeded final event size")
	}
	if s.transcriptRunes != 4000 {
		t.Fatal("rejected segment entered transcript")
	}
}
