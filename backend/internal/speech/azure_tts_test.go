package speech

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAzureAndrewRequest(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		if r.Header.Get("Ocp-Apim-Subscription-Key") != "test" || r.Header.Get("X-Microsoft-OutputFormat") != "raw-24khz-16bit-mono-pcm" {
			t.Error("wrong Azure headers")
		}
		if !strings.Contains(string(b), `name="en-US-AndrewNeural"`) || !strings.Contains(string(b), `Hi &lt;friend&gt; &amp; welcome`) {
			t.Error("voice or SSML escaping incorrect")
		}
		w.Write([]byte{1, 2, 3, 4})
	}))
	defer s.Close()
	a := NewAzureTTS(AzureTTSConfig{APIKey: "test", Endpoint: s.URL})
	var out bytes.Buffer
	if err := a.Synthesize(context.Background(), TTSRequest{Text: "Hi <friend> & welcome", Approved: true}, &out); err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(out.Bytes(), []byte{1, 2, 3, 4}) {
		t.Fatal("PCM changed")
	}
}

func TestAzureFailureDoesNotWriteAudio(t *testing.T) {
	for _, tt := range []struct {
		name   string
		status int
		body   []byte
		want   error
	}{
		{"quota", 429, []byte("private provider detail"), ErrProvider},
		{"empty", 200, nil, ErrMalformedProvider},
		{"odd", 200, []byte{1}, ErrMalformedProvider},
		{"oversize", 200, make([]byte, maxAzureAudioBytes+2), ErrAudioLimit},
	} {
		t.Run(tt.name, func(t *testing.T) {
			s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(tt.status); w.Write(tt.body) }))
			defer s.Close()
			var out bytes.Buffer
			err := NewAzureTTS(AzureTTSConfig{APIKey: "test", Endpoint: s.URL}).Synthesize(context.Background(), TTSRequest{Text: "Hello", Approved: true}, &out)
			if !errors.Is(err, tt.want) || out.Len() != 0 {
				t.Fatalf("unexpected output/error: %v", err)
			}
			if strings.Contains(err.Error(), "private provider detail") {
				t.Fatal("provider detail leaked")
			}
		})
	}
}

func TestAzureInputGates(t *testing.T) {
	a := NewAzureTTS(AzureTTSConfig{APIKey: "test", Region: "eastus"})
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
	if NewAzureTTS(AzureTTSConfig{APIKey: "test", Region: "evil.example/path"}).Enabled() {
		t.Fatal("invalid region accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := a.Synthesize(ctx, TTSRequest{Text: "Hello", Approved: true}, &out); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
}
