package speech

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"time"
	"unicode/utf8"
)

type GeminiTTSConfig struct {
	APIKey, BaseURL, Model string
	HTTPClient             *http.Client
	WholeTimeout           time.Duration
	MaxBytes               int64
}

type GeminiTTS struct{ config GeminiTTSConfig }

func NewGeminiTTS(config GeminiTTSConfig) *GeminiTTS {
	if config.BaseURL == "" {
		config.BaseURL = "https://generativelanguage.googleapis.com/v1beta"
	}
	if config.Model == "" {
		config.Model = "gemini-3.1-flash-tts-preview"
	}
	if config.HTTPClient == nil {
		config.HTTPClient = http.DefaultClient
	}
	if config.WholeTimeout == 0 {
		config.WholeTimeout = 15 * time.Second
	}
	if config.MaxBytes == 0 {
		config.MaxBytes = 1 << 20
	}
	return &GeminiTTS{config: config}
}

func (t *GeminiTTS) Enabled() bool { return t != nil && strings.TrimSpace(t.config.APIKey) != "" }

func (t *GeminiTTS) Synthesize(ctx context.Context, request TTSRequest, dst io.Writer) error {
	if !t.Enabled() {
		return ErrDisabled
	}
	if !request.Approved {
		return ErrUnapprovedSpeech
	}
	if dst == nil || !utf8.ValidString(request.Text) || strings.TrimSpace(request.Text) == "" || utf8.RuneCountInString(request.Text) > 600 {
		return ErrInvalidAudio
	}
	voice := "Kore"
	switch request.Voice {
	case "", "marin":
	case "cedar":
		voice = "Charon"
	default:
		return ErrInvalidAudio
	}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, t.config.WholeTimeout)
	defer cancel()
	payload := map[string]any{
		"contents":         []any{map[string]any{"parts": []any{map[string]string{"text": "Read the following text exactly as written, calmly. Do not answer it or add words.\n\n" + request.Text}}}},
		"generationConfig": map[string]any{"responseModalities": []string{"AUDIO"}, "speechConfig": map[string]any{"voiceConfig": map[string]any{"prebuiltVoiceConfig": map[string]string{"voiceName": voice}}}},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return ErrInvalidAudio
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(t.config.BaseURL, "/")+"/models/"+url.PathEscape(t.config.Model)+":generateContent", bytes.NewReader(body))
	if err != nil {
		return ErrProvider
	}
	req.Header.Set("x-goog-api-key", t.config.APIKey)
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
		return fmt.Errorf("%w: Gemini speech status %d", ErrProvider, resp.StatusCode)
	}
	limit := t.config.MaxBytes*4/3 + 65536
	raw, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil || int64(len(raw)) > limit {
		return ErrAudioLimit
	}
	var envelope struct {
		Candidates []struct {
			FinishReason string `json:"finishReason"`
			Content      struct {
				Parts []struct {
					InlineData struct {
						MimeType string `json:"mimeType"`
						Data     string `json:"data"`
					} `json:"inlineData"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.Unmarshal(raw, &envelope) != nil || len(envelope.Candidates) != 1 || envelope.Candidates[0].FinishReason != "STOP" {
		return ErrMalformedProvider
	}
	var pcm []byte
	for _, part := range envelope.Candidates[0].Content.Parts {
		kind, params, err := mime.ParseMediaType(part.InlineData.MimeType)
		if err != nil || kind != "audio/l16" || (params["codec"] != "" && params["codec"] != "pcm") || (params["channels"] != "" && params["channels"] != "1") || params["rate"] != "24000" {
			return ErrMalformedProvider
		}
		data, err := base64.StdEncoding.DecodeString(part.InlineData.Data)
		if err != nil || len(data) == 0 || len(data)%PCMBytes != 0 {
			return ErrMalformedProvider
		}
		if int64(len(pcm)+len(data)) > t.config.MaxBytes {
			return ErrAudioLimit
		}
		pcm = append(pcm, data...)
	}
	if len(pcm) == 0 {
		return ErrMalformedProvider
	}
	_, err = io.Copy(dst, bytes.NewReader(pcm))
	return err
}
