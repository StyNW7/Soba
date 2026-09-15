package speech

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"
)

const maxAzureAudioBytes = 90 * 24000 * 2

type AzureTTSConfig struct {
	APIKey, Region, Endpoint string
	HTTPClient               *http.Client
}

type AzureTTS struct{ config AzureTTSConfig }

func NewAzureTTS(c AzureTTSConfig) *AzureTTS {
	if c.Endpoint == "" && regexp.MustCompile(`^[a-z0-9]+$`).MatchString(c.Region) {
		c.Endpoint = "https://" + c.Region + ".tts.speech.microsoft.com/cognitiveservices/v1"
	}
	if c.HTTPClient == nil {
		c.HTTPClient = http.DefaultClient
	}
	return &AzureTTS{config: c}
}

func (t *AzureTTS) Enabled() bool {
	return t != nil && strings.TrimSpace(t.config.APIKey) != "" && t.config.Endpoint != ""
}

func (t *AzureTTS) Synthesize(ctx context.Context, r TTSRequest, dst io.Writer) error {
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
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	var body bytes.Buffer
	body.WriteString(`<speak version="1.0" xml:lang="en-US"><voice name="en-US-AndrewNeural">`)
	if err := xml.EscapeText(&body, []byte(r.Text)); err != nil {
		return ErrInvalidAudio
	}
	body.WriteString(`</voice></speak>`)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.config.Endpoint, &body)
	if err != nil {
		return ErrProvider
	}
	req.Header.Set("Ocp-Apim-Subscription-Key", t.config.APIKey)
	req.Header.Set("Content-Type", "application/ssml+xml")
	req.Header.Set("X-Microsoft-OutputFormat", "raw-24khz-16bit-mono-pcm")
	req.Header.Set("User-Agent", "SOBA")
	resp, err := t.config.HTTPClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return ErrProvider
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: Azure speech status %d", ErrProvider, resp.StatusCode)
	}
	audio, err := io.ReadAll(io.LimitReader(resp.Body, maxAzureAudioBytes+1))
	if err != nil {
		return ErrProvider
	}
	if len(audio) > maxAzureAudioBytes {
		return ErrAudioLimit
	}
	if len(audio) == 0 || len(audio)%2 != 0 {
		return ErrMalformedProvider
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	_, err = dst.Write(audio)
	return err
}
