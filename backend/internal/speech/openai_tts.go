package speech

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptrace"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	// ErrUnapprovedSpeech prevents a caller from sending unchecked generated
	// text to the speech provider.
	ErrUnapprovedSpeech = errors.New("speech text is not approved")
	ErrAudioLimit       = errors.New("speech audio exceeds configured limit")
)

// TTSRequest is intentionally small. Approved must be set by the safety
// pipeline after the complete reply passes its checks.
type TTSRequest struct {
	Text     string
	Voice    string
	Locale   string
	Style    string
	Approved bool
}

// Synthesizer streams raw mono PCM at 24 kHz into dst. It never writes audio
// to disk or keeps a generated reply after the call returns.
type Synthesizer interface {
	Synthesize(ctx context.Context, request TTSRequest, dst io.Writer) error
}

// OpenAITTSConfig configures the OpenAI speech endpoint.
type OpenAITTSConfig struct {
	APIKey           string
	Endpoint         string
	Model            string
	Voice            string
	HTTPClient       *http.Client
	FirstByteTimeout time.Duration
	WholeTimeout     time.Duration
	MaxBytes         int64
}

// OpenAITTS is the OpenAI /v1/audio/speech adapter. Empty credentials keep it
// disabled by default.
type OpenAITTS struct {
	config OpenAITTSConfig
}

func NewOpenAITTS(config OpenAITTSConfig) *OpenAITTS {
	if config.Endpoint == "" {
		config.Endpoint = "https://api.openai.com/v1/audio/speech"
	}
	if config.Model == "" {
		config.Model = "gpt-4o-mini-tts"
	}
	if config.Voice == "" {
		config.Voice = "marin"
	}
	if config.HTTPClient == nil {
		config.HTTPClient = http.DefaultClient
	}
	if config.FirstByteTimeout == 0 {
		config.FirstByteTimeout = 3 * time.Second
	}
	if config.WholeTimeout == 0 {
		config.WholeTimeout = 15 * time.Second
	}
	if config.MaxBytes == 0 {
		config.MaxBytes = 1 << 20
	}
	return &OpenAITTS{config: config}
}

func (t *OpenAITTS) Enabled() bool {
	return t != nil && strings.TrimSpace(t.config.APIKey) != ""
}

func (t *OpenAITTS) Synthesize(ctx context.Context, request TTSRequest, dst io.Writer) error {
	if t == nil || !t.Enabled() {
		return ErrDisabled
	}
	if !request.Approved {
		return ErrUnapprovedSpeech
	}
	if dst == nil || !utf8.ValidString(request.Text) || strings.TrimSpace(request.Text) == "" || utf8.RuneCountInString(request.Text) > 600 {
		return ErrInvalidAudio
	}
	voice := request.Voice
	if voice == "" {
		voice = t.config.Voice
	}
	style := request.Style
	if style == "" {
		style = "calm, neutral, and encouraging delivery"
	}
	payload := struct {
		Model          string `json:"model"`
		Input          string `json:"input"`
		Voice          string `json:"voice"`
		Instructions   string `json:"instructions"`
		ResponseFormat string `json:"response_format"`
	}{
		Model:          t.config.Model,
		Input:          request.Text,
		Voice:          voice,
		Instructions:   style,
		ResponseFormat: "pcm",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("%w: encode request", ErrProvider)
	}
	if ctx == nil {
		ctx = context.Background()
	}
	wholeCtx, cancel := context.WithTimeout(ctx, t.config.WholeTimeout)
	defer cancel()
	firstByteTimer := time.AfterFunc(t.config.FirstByteTimeout, cancel)
	trace := &httptrace.ClientTrace{
		GotFirstResponseByte: func() {
			firstByteTimer.Stop()
		},
	}
	requestCtx := httptrace.WithClientTrace(wholeCtx, trace)
	httpRequest, err := http.NewRequestWithContext(requestCtx, http.MethodPost, t.config.Endpoint, strings.NewReader(string(body)))
	if err != nil {
		return fmt.Errorf("%w: create request", ErrProvider)
	}
	httpRequest.Header.Set("Authorization", "Bearer "+t.config.APIKey)
	httpRequest.Header.Set("Content-Type", "application/json")
	firstByteTimer.Reset(t.config.FirstByteTimeout)
	defer firstByteTimer.Stop()
	response, err := t.config.HTTPClient.Do(httpRequest)
	if err != nil {
		if errors.Is(requestCtx.Err(), context.Canceled) || errors.Is(requestCtx.Err(), context.DeadlineExceeded) {
			return requestCtx.Err()
		}
		return fmt.Errorf("%w: speech request", ErrProvider)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: speech status %d", ErrProvider, response.StatusCode)
	}
	writer := &boundedWriter{dst: dst, max: t.config.MaxBytes}
	if _, err := io.Copy(writer, response.Body); err != nil {
		if errors.Is(requestCtx.Err(), context.Canceled) || errors.Is(requestCtx.Err(), context.DeadlineExceeded) {
			return requestCtx.Err()
		}
		return fmt.Errorf("%w: read speech audio", ErrProvider)
	}
	if writer.n == 0 || writer.n%PCMBytes != 0 {
		return ErrMalformedProvider
	}
	return nil
}

type boundedWriter struct {
	dst io.Writer
	max int64
	n   int64
}

func (w *boundedWriter) Write(p []byte) (int, error) {
	if int64(len(p)) > w.max-w.n {
		return 0, ErrAudioLimit
	}
	n, err := w.dst.Write(p)
	w.n += int64(n)
	return n, err
}
