package speech

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestKokoroAndrewRequest(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var payload map[string]string
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if r.Method != "POST" || r.Header.Get("Content-Type") != "application/json" || payload["text"] != "Hi <friend> & welcome" {
			t.Error("incorrect request")
		}
		binary.Write(w, binary.BigEndian, uint32(4))
		w.Write([]byte{1, 2, 3, 4})
		binary.Write(w, binary.BigEndian, uint32(0))
	}))
	defer s.Close()
	a := NewKokoroTTS(KokoroTTSConfig{Endpoint: s.URL})
	var out bytes.Buffer
	if err := a.Synthesize(context.Background(), TTSRequest{Text: "Hi <friend> & welcome", Approved: true}, &out); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(out.Bytes(), []byte{1, 2, 3, 4}) {
		t.Fatal("PCM changed")
	}
}

func TestKokoroFailureDoesNotWriteAudio(t *testing.T) {
	for _, tt := range []struct {
		name   string
		status int
		body   []byte
		want   error
	}{
		{"quota", 429, []byte("private provider detail"), ErrProvider},
		{"empty", 200, nil, ErrMalformedProvider},
		{"odd", 200, []byte{0, 0, 0, 1, 1}, ErrMalformedProvider},
		{"oversize", 200, []byte{0xff, 0xff, 0xff, 0xff}, ErrAudioLimit},
		{"truncated", 200, []byte{0, 0, 0, 4, 1, 2}, ErrMalformedProvider},
	} {
		t.Run(tt.name, func(t *testing.T) {
			s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(tt.status); w.Write(tt.body) }))
			defer s.Close()
			var out bytes.Buffer
			err := NewKokoroTTS(KokoroTTSConfig{Endpoint: s.URL}).Synthesize(context.Background(), TTSRequest{Text: "Hello", Approved: true}, &out)
			if !errors.Is(err, tt.want) || out.Len() != 0 {
				t.Fatalf("unexpected output/error: %v", err)
			}
			if strings.Contains(err.Error(), "private provider detail") {
				t.Fatal("provider detail leaked")
			}
		})
	}
}

func TestKokoroInputGates(t *testing.T) {
	a := NewKokoroTTS(KokoroTTSConfig{Endpoint: "http://127.0.0.1:1"})
	var out bytes.Buffer
	for _, tt := range []struct {
		r    TTSRequest
		want error
	}{
		{TTSRequest{Text: "Hello"}, ErrUnapprovedSpeech},
		{TTSRequest{Text: strings.Repeat("x", 601), Approved: true}, ErrInvalidAudio},
		{TTSRequest{Text: "Hello", Locale: "id-ID", Approved: true}, ErrInvalidAudio},
	} {
		if err := a.Synthesize(context.Background(), tt.r, &out); !errors.Is(err, tt.want) {
			t.Fatal(err)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := a.Synthesize(ctx, TTSRequest{Text: "Hello", Approved: true}, &out); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}

type signalWriter struct{ wrote chan struct{} }

func (w signalWriter) Write(p []byte) (int, error) { close(w.wrote); return len(p), nil }

func TestKokoroStreamsBeforeCompletion(t *testing.T) {
	wrote := make(chan struct{})
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		binary.Write(w, binary.BigEndian, uint32(4))
		w.Write([]byte{1, 2, 3, 4})
		w.(http.Flusher).Flush()
		select {
		case <-wrote:
		case <-r.Context().Done():
			return
		}
		binary.Write(w, binary.BigEndian, uint32(0))
	}))
	defer s.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	err := NewKokoroTTS(KokoroTTSConfig{Endpoint: s.URL}).Synthesize(ctx, TTSRequest{Text: "Hello", Approved: true}, signalWriter{wrote})
	if err != nil {
		t.Fatal(err)
	}
}
