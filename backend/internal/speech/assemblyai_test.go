package speech

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestAssemblyAIFramesFinalizationAndTermination(t *testing.T) {
	frames := make(chan []byte, 4)
	terminated := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "test-key" || r.URL.Query().Get("min_turn_silence") != "1200" || r.URL.Query().Get("max_turn_silence") != "3600" || r.URL.Query().Get("sample_rate") != "16000" || r.URL.Query().Get("speech_model") != "universal-3-5-pro" {
			t.Error("invalid streaming setup")
		}
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			t.Error(err)
			return
		}
		defer conn.CloseNow()
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		_ = conn.Write(ctx, websocket.MessageText, []byte(`{"type":"Begin"}`))
		for {
			kind, body, err := conn.Read(ctx)
			if err != nil {
				return
			}
			if kind == websocket.MessageBinary {
				frames <- append([]byte(nil), body...)
				continue
			}
			var control struct {
				Type string `json:"type"`
			}
			_ = json.Unmarshal(body, &control)
			switch control.Type {
			case "ForceEndpoint":
				_ = conn.Write(ctx, websocket.MessageText, []byte(`{"type":"SpeechStarted"}`))
				_ = conn.Write(ctx, websocket.MessageText, []byte(`{"type":"Turn","transcript":"Hello there","end_of_turn":true}`))
			case "Terminate":
				close(terminated)
				return
			}
		}
	}))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	stream, err := NewAssemblyAI(AssemblyAIConfig{APIKey: "test-key", Endpoint: strings.Replace(server.URL, "http", "ws", 1)}).NewStream(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	frame := bytes.Repeat([]byte{1, 0}, 320)
	for range 4 {
		if err := stream.Send(ctx, frame); err != nil {
			t.Fatal(err)
		}
	}
	if got := <-frames; len(got) != 1920 || !bytes.Equal(got, bytes.Repeat(frame, 3)) {
		t.Fatal("20 ms frames not grouped into 60 ms")
	}
	text, err := stream.Finalize(ctx)
	if err != nil || text != "Hello there" {
		t.Fatalf("final transcript failed: %v", err)
	}
	if got := <-frames; len(got) != 1920 || !bytes.Equal(got[:640], frame) || !bytes.Equal(got[640:], make([]byte, 1280)) {
		t.Fatal("tail padding changed captured audio")
	}
	if err := stream.Close(); err != nil {
		t.Fatal(err)
	}
	select {
	case <-terminated:
	case <-ctx.Done():
		t.Fatal("provider session not terminated")
	}
}

func TestAssemblyAIRejectsMissingKeyAndMalformedTurn(t *testing.T) {
	if _, err := NewAssemblyAI(AssemblyAIConfig{}).NewStream(context.Background()); !errors.Is(err, ErrDisabled) {
		t.Fatal("missing key accepted")
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, nil)
		if err != nil {
			return
		}
		defer conn.CloseNow()
		_ = conn.Write(r.Context(), websocket.MessageText, []byte(`{"type":"Begin"}`))
		_ = conn.Write(r.Context(), websocket.MessageText, []byte(`{"type":"Turn","transcript":"missing final marker"}`))
		_, _, _ = conn.Read(r.Context())
	}))
	defer server.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	stream, err := NewAssemblyAI(AssemblyAIConfig{APIKey: "test", Endpoint: strings.Replace(server.URL, "http", "ws", 1)}).NewStream(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer stream.Close()
	if err := stream.Send(ctx, []byte{1}); !errors.Is(err, ErrInvalidAudio) {
		t.Fatal("odd PCM accepted")
	}
	if _, err := stream.Receive(ctx); !errors.Is(err, ErrMalformedProvider) {
		t.Fatalf("malformed turn accepted: %v", err)
	}
}
