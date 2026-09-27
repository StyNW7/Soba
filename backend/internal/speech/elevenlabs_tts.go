package speech

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

const maxElevenLabsAudioBytes = 90 * 24000 * 2

type ElevenLabsTTSConfig struct {
	APIKey, BaseURL, Model, VoiceID string
	HTTPClient                      *http.Client
}

type ElevenLabsTTS struct{ config ElevenLabsTTSConfig }

func NewElevenLabsTTS(c ElevenLabsTTSConfig) *ElevenLabsTTS {
	if c.BaseURL == "" {
		c.BaseURL = "https://api.elevenlabs.io"
	}
	if c.Model == "" {
		c.Model = "eleven_flash_v2_5"
	}
	if c.HTTPClient == nil {
		c.HTTPClient = http.DefaultClient
	}
	return &ElevenLabsTTS{config: c}
}

func (t *ElevenLabsTTS) Enabled() bool {
	return t != nil && strings.TrimSpace(t.config.APIKey) != "" && strings.TrimSpace(t.config.VoiceID) != ""
}

// Synthesize buffers the whole reply before writing so a failed request never
// leaves half a sentence played, which keeps a fallback provider usable.
func (t *ElevenLabsTTS) Synthesize(ctx context.Context, r TTSRequest, dst io.Writer) error {
	if !t.Enabled() {
		return ErrDisabled
	}
	if !r.Approved {
		return ErrUnapprovedSpeech
	}
	if dst == nil || !utf8.ValidString(r.Text) || strings.TrimSpace(r.Text) == "" || utf8.RuneCountInString(r.Text) > 600 || (r.Locale != "" && r.Locale != "en-US") {
		return ErrInvalidAudio
	}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	endpoint := strings.TrimRight(t.config.BaseURL, "/") + "/v1/text-to-speech/" + url.PathEscape(t.config.VoiceID) + "/stream?output_format=pcm_24000"
	body, _ := json.Marshal(map[string]string{"text": r.Text, "model_id": t.config.Model})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return ErrProvider
	}
	req.Header.Set("xi-api-key", t.config.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := t.config.HTTPClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return ErrProvider
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: ElevenLabs speech status %d", ErrProvider, resp.StatusCode)
	}
	audio, err := io.ReadAll(io.LimitReader(resp.Body, maxElevenLabsAudioBytes+1))
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return ErrProvider
	}
	if len(audio) > maxElevenLabsAudioBytes {
		return ErrAudioLimit
	}
	if len(audio) == 0 || len(audio)%2 != 0 {
		return ErrMalformedProvider
	}
	_, err = dst.Write(audio)
	return err
}

type FallbackTTS struct {
	Primary, Secondary interface {
		Synthesizer
		Enabled() bool
	}
}

func (f FallbackTTS) Enabled() bool {
	return f.Primary != nil && f.Primary.Enabled() && f.Secondary != nil && f.Secondary.Enabled()
}

// Synthesize falls back only when the primary wrote nothing, and never for a
// caller cancellation or a request the secondary would reject the same way.
func (f FallbackTTS) Synthesize(ctx context.Context, r TTSRequest, dst io.Writer) error {
	counted := &countingWriter{w: dst}
	err := f.Primary.Synthesize(ctx, r, counted)
	if err == nil || counted.n > 0 || (ctx != nil && ctx.Err() != nil) || errors.Is(err, ErrUnapprovedSpeech) || errors.Is(err, ErrInvalidAudio) {
		return err
	}
	return f.Secondary.Synthesize(ctx, r, dst)
}

type countingWriter struct {
	w io.Writer
	n int
}

func (c *countingWriter) Write(p []byte) (int, error) {
	n, err := c.w.Write(p)
	c.n += n
	return n, err
}
