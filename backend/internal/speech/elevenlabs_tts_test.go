package speech

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestElevenLabsSpeechRequestAndFailureWithoutPartialAudio(t *testing.T) {
	for _, status := range []int{200, 402} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var p map[string]string
			if r.URL.Path != "/v1/text-to-speech/voice123/stream" || r.URL.Query().Get("output_format") != "pcm_24000" || r.Header.Get("xi-api-key") != "test" || json.NewDecoder(r.Body).Decode(&p) != nil || p["model_id"] != "eleven_flash_v2_5" || p["text"] != "Hello there." {
				t.Error("incorrect speech request")
			}
			w.WriteHeader(status)
			if status != 200 {
				_, _ = w.Write([]byte("secret provider message"))
				return
			}
			_, _ = w.Write(make([]byte, 96))
		}))
		var out bytes.Buffer
		err := NewElevenLabsTTS(ElevenLabsTTSConfig{APIKey: "test", VoiceID: "voice123", BaseURL: server.URL}).Synthesize(context.Background(), TTSRequest{Text: "Hello there.", Approved: true, Locale: "en-US"}, &out)
		server.Close()
		if status == 200 && (err != nil || out.Len() != 96) {
			t.Fatalf("speech failed: %v", err)
		}
		if status != 200 && (!errors.Is(err, ErrProvider) || out.Len() != 0 || strings.Contains(err.Error(), "secret")) {
			t.Fatalf("unsafe failure handling: %v", err)
		}
	}
}

func TestElevenLabsRejectsUnapprovedAndMalformedAudio(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write(make([]byte, 3)) }))
	defer server.Close()
	tts := NewElevenLabsTTS(ElevenLabsTTSConfig{APIKey: "test", VoiceID: "v", BaseURL: server.URL})
	if err := tts.Synthesize(context.Background(), TTSRequest{Text: "Hi", Approved: false}, io.Discard); !errors.Is(err, ErrUnapprovedSpeech) {
		t.Fatal(err)
	}
	if err := tts.Synthesize(context.Background(), TTSRequest{Text: "Hi", Approved: true}, io.Discard); !errors.Is(err, ErrMalformedProvider) {
		t.Fatal(err)
	}
}

type stubTTS struct {
	err   error
	audio []byte
	calls int
}

func (s *stubTTS) Enabled() bool { return true }
func (s *stubTTS) Synthesize(_ context.Context, _ TTSRequest, dst io.Writer) error {
	s.calls++
	if len(s.audio) > 0 {
		_, _ = dst.Write(s.audio)
	}
	return s.err
}

func TestFallbackSpeechOnlyWhenPrimaryWroteNothing(t *testing.T) {
	req := TTSRequest{Text: "Hi", Approved: true}
	cases := []struct {
		name          string
		primary       *stubTTS
		ctxCancelled  bool
		wantSecondary int
		wantErr       error
	}{
		{"primary ok", &stubTTS{audio: []byte{1, 2}}, false, 0, nil},
		{"primary quota", &stubTTS{err: ErrProvider}, false, 1, nil},
		{"partial audio", &stubTTS{err: ErrProvider, audio: []byte{1, 2}}, false, 0, ErrProvider},
		{"unapproved", &stubTTS{err: ErrUnapprovedSpeech}, false, 0, ErrUnapprovedSpeech},
		{"cancelled", &stubTTS{err: context.Canceled}, true, 0, context.Canceled},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			secondary := &stubTTS{audio: []byte{9, 9}}
			ctx, cancel := context.WithCancel(context.Background())
			if c.ctxCancelled {
				cancel()
			}
			defer cancel()
			err := (FallbackTTS{Primary: c.primary, Secondary: secondary}).Synthesize(ctx, req, io.Discard)
			if secondary.calls != c.wantSecondary || !errors.Is(err, c.wantErr) {
				t.Fatalf("secondary calls=%d err=%v", secondary.calls, err)
			}
		})
	}
}
