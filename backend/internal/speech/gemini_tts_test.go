package speech

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGeminiTTSSpeaksOnlyApprovedValidPCM(t *testing.T) {
	for _, tc := range []struct {
		name, mime string
		data       []byte
		want       error
	}{
		{"valid", "audio/L16;codec=pcm;rate=24000", []byte{1, 0, 2, 0}, nil},
		{"channels", "audio/l16;rate=24000;channels=1", []byte{1, 0, 2, 0}, nil},
		{"stereo", "audio/l16;rate=24000;channels=2", []byte{1, 0}, ErrMalformedProvider},
		{"rate", "audio/L16;codec=pcm;rate=16000", []byte{1, 0}, ErrMalformedProvider},
		{"odd", "audio/L16;codec=pcm;rate=24000", []byte{1}, ErrMalformedProvider},
		{"empty", "audio/L16;codec=pcm;rate=24000", nil, ErrMalformedProvider},
		{"limit", "audio/L16;codec=pcm;rate=24000", make([]byte, 10), ErrAudioLimit},
	} {
		t.Run(tc.name, func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				if r.Header.Get("x-goog-api-key") != "test" || r.URL.RawQuery != "" {
					t.Error("invalid authentication")
				}
				_ = json.NewEncoder(w).Encode(map[string]any{"candidates": []any{map[string]any{"finishReason": "STOP", "content": map[string]any{"parts": []any{map[string]any{"inlineData": map[string]string{"mimeType": tc.mime, "data": base64.StdEncoding.EncodeToString(tc.data)}}}}}}})
			}))
			defer server.Close()
			adapter := NewGeminiTTS(GeminiTTSConfig{APIKey: "test", BaseURL: server.URL, MaxBytes: 8})
			var audio bytes.Buffer
			if err := adapter.Synthesize(context.Background(), TTSRequest{Text: "Hello"}, &audio); !errors.Is(err, ErrUnapprovedSpeech) || calls != 0 {
				t.Fatal("unapproved text reached provider")
			}
			err := adapter.Synthesize(context.Background(), TTSRequest{Text: "Hello", Voice: "marin", Approved: true}, &audio)
			if !errors.Is(err, tc.want) {
				t.Fatalf("wanted %v, got %v", tc.want, err)
			}
			if tc.want != nil && audio.Len() != 0 {
				t.Fatal("malformed audio reached playback")
			}
			if tc.want == nil && !bytes.Equal(audio.Bytes(), tc.data) {
				t.Fatal("PCM changed")
			}
		})
	}
}
