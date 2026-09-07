// Package speech contains the provider adapters used by the conversation
// service. The package does not retain audio, transcripts, or provider
// responses.
package speech

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/coder/websocket"
)

var (
	// ErrDisabled means that the adapter is not configured for runtime use.
	ErrDisabled = errors.New("speech provider disabled")
	// ErrInvalidAudio means that the caller supplied audio that cannot be sent
	// as the configured PCM stream.
	ErrInvalidAudio = errors.New("invalid PCM audio")
	// ErrMalformedProvider means that a provider response did not match the
	// small part of the provider protocol that this adapter uses.
	ErrMalformedProvider = errors.New("malformed speech provider response")
	// ErrProvider means that the provider returned an error or closed the
	// stream before the requested operation completed.
	ErrProvider = errors.New("speech provider error")
)

const (
	InputSampleRate         = 16000
	InputChannels           = 1
	PCMBytes                = 2
	OutputSampleRate        = 24000
	maxProviderMessageBytes = 128 << 10
	maxTranscriptRunes      = 8000
)

// TranscriptEvent is one usable Deepgram result. Interim results have
// IsFinal=false. SpeechFinal marks the end of the current utterance.
// StartSeconds and DurationSeconds are provider timing metadata and are not
// required by the conversation layer.
type TranscriptEvent struct {
	Text            string
	IsFinal         bool
	SpeechFinal     bool
	FromFinalize    bool
	StartSeconds    float64
	DurationSeconds float64
}

// TranscriptStream is a single, non-resumable STT stream. Callers may send
// audio and receive results while the stream is open. A stream is single-use;
// Close it on cancellation, provider error, or turn completion.
type TranscriptStream interface {
	Send(ctx context.Context, pcm []byte) error
	Receive(ctx context.Context) (TranscriptEvent, error)
	RequestFinalize(ctx context.Context) error
	FinalText() string
	Finalize(ctx context.Context) (string, error)
	Close() error
}

// Stream is a short alias used by conversation integrations.
type Stream = TranscriptStream

// Transcriber opens a new stream for each input turn. Implementations must
// not retry or replay old audio after a provider disconnect.
type Transcriber interface {
	NewStream(ctx context.Context) (TranscriptStream, error)
}

// DeepgramConfig configures the Deepgram Nova streaming adapter.
type DeepgramConfig struct {
	APIKey         string
	Endpoint       string
	Model          string
	Language       string
	Endpointing    time.Duration
	ConnectTimeout time.Duration
	HTTPClient     *http.Client
}

// Deepgram is a real WebSocket adapter for Deepgram's live STT endpoint.
// With an empty API key it remains disabled and never attempts a network call.
type Deepgram struct {
	config DeepgramConfig
}

// NewDeepgram returns a configured adapter. Missing credentials intentionally
// produce a disabled adapter so local development cannot accidentally call a
// paid provider.
func NewDeepgram(config DeepgramConfig) *Deepgram {
	if config.Endpoint == "" {
		config.Endpoint = "wss://api.deepgram.com/v1/listen"
	}
	if config.Model == "" {
		config.Model = "nova-3"
	}
	if config.Language == "" {
		config.Language = "id"
	}
	if config.Endpointing == 0 {
		config.Endpointing = 500 * time.Millisecond
	}
	if config.ConnectTimeout == 0 {
		config.ConnectTimeout = 3 * time.Second
	}
	if config.HTTPClient == nil {
		config.HTTPClient = http.DefaultClient
	}
	return &Deepgram{config: config}
}

// Enabled reports whether the adapter has enough configuration to make a
// provider call.
func (d *Deepgram) Enabled() bool {
	return d != nil && strings.TrimSpace(d.config.APIKey) != ""
}

// NewStream opens Deepgram Nova-3 with the fixed Soba PCM contract.
func (d *Deepgram) NewStream(ctx context.Context) (TranscriptStream, error) {
	if d == nil || !d.Enabled() {
		return nil, ErrDisabled
	}
	if ctx == nil {
		ctx = context.Background()
	}
	endpoint, err := url.Parse(d.config.Endpoint)
	if err != nil || (endpoint.Scheme != "ws" && endpoint.Scheme != "wss") || endpoint.Host == "" {
		return nil, fmt.Errorf("%w: invalid endpoint", ErrProvider)
	}
	if d.config.Endpointing <= 0 {
		return nil, fmt.Errorf("%w: invalid endpointing", ErrProvider)
	}
	query := endpoint.Query()
	query.Set("model", d.config.Model)
	query.Set("language", d.config.Language)
	query.Set("encoding", "linear16")
	query.Set("sample_rate", strconv.Itoa(InputSampleRate))
	query.Set("channels", strconv.Itoa(InputChannels))
	query.Set("interim_results", "true")
	query.Set("endpointing", strconv.FormatInt(d.config.Endpointing.Milliseconds(), 10))
	endpoint.RawQuery = query.Encode()

	connectCtx, cancel := context.WithTimeout(ctx, d.config.ConnectTimeout)
	defer cancel()
	conn, _, err := websocket.Dial(connectCtx, endpoint.String(), &websocket.DialOptions{
		HTTPClient: d.config.HTTPClient,
		HTTPHeader: http.Header{"Authorization": []string{"Token " + d.config.APIKey}},
	})
	if err != nil {
		if errors.Is(connectCtx.Err(), context.Canceled) || errors.Is(connectCtx.Err(), context.DeadlineExceeded) {
			return nil, connectCtx.Err()
		}
		return nil, fmt.Errorf("%w: connect", ErrProvider)
	}
	return &deepgramStream{conn: conn, finalSegments: make([]string, 0, 4), seenSegments: make(map[string]struct{})}, nil
}

type deepgramStream struct {
	conn              *websocket.Conn
	closeOnce         sync.Once
	stateMu           sync.Mutex
	finalSegments     []string
	transcriptRunes   int
	seenSegments      map[string]struct{}
	finalized         bool
	finalizeRequested bool
}

type deepgramResult struct {
	Type         string  `json:"type"`
	IsFinal      bool    `json:"is_final"`
	SpeechFinal  bool    `json:"speech_final"`
	FromFinalize bool    `json:"from_finalize"`
	Start        float64 `json:"start"`
	Duration     float64 `json:"duration"`
	Channel      struct {
		Alternatives []struct {
			Transcript string `json:"transcript"`
		} `json:"alternatives"`
	} `json:"channel"`
	ErrorCode string `json:"code"`
}

func (s *deepgramStream) Send(ctx context.Context, pcm []byte) error {
	if len(pcm) == 0 || len(pcm)%PCMBytes != 0 {
		return ErrInvalidAudio
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if err := s.conn.Write(ctx, websocket.MessageBinary, pcm); err != nil {
		if errors.Is(ctx.Err(), context.Canceled) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return ctx.Err()
		}
		return fmt.Errorf("%w: send audio", ErrProvider)
	}
	return nil
}

func (s *deepgramStream) Receive(ctx context.Context) (TranscriptEvent, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	for {
		messageType, payload, err := s.conn.Read(ctx)
		if err != nil {
			if errors.Is(ctx.Err(), context.Canceled) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return TranscriptEvent{}, ctx.Err()
			}
			return TranscriptEvent{}, fmt.Errorf("%w: read result", ErrProvider)
		}
		if messageType != websocket.MessageText {
			return TranscriptEvent{}, ErrMalformedProvider
		}
		if len(payload) > maxProviderMessageBytes {
			return TranscriptEvent{}, ErrMalformedProvider
		}
		var result deepgramResult
		if err := json.Unmarshal(payload, &result); err != nil {
			return TranscriptEvent{}, ErrMalformedProvider
		}
		switch result.Type {
		case "Metadata", "KeepAlive":
			continue
		case "Error":
			return TranscriptEvent{}, ErrProvider
		case "Results":
			if result.FromFinalize && len(result.Channel.Alternatives) == 0 {
				return TranscriptEvent{FromFinalize: true}, nil
			}
			if len(result.Channel.Alternatives) == 0 {
				return TranscriptEvent{}, ErrMalformedProvider
			}
			if len([]rune(result.Channel.Alternatives[0].Transcript)) > maxTranscriptRunes {
				return TranscriptEvent{}, ErrMalformedProvider
			}
			event := TranscriptEvent{
				Text:            result.Channel.Alternatives[0].Transcript,
				IsFinal:         result.IsFinal,
				SpeechFinal:     result.SpeechFinal,
				FromFinalize:    result.FromFinalize,
				StartSeconds:    result.Start,
				DurationSeconds: result.Duration,
			}
			if err := s.recordFinal(event); err != nil {
				return TranscriptEvent{}, err
			}
			if event.SpeechFinal || event.FromFinalize {
				s.stateMu.Lock()
				s.finalized = true
				s.stateMu.Unlock()
			}
			return event, nil
		default:
			return TranscriptEvent{}, ErrMalformedProvider
		}
	}
}

func (s *deepgramStream) recordFinal(event TranscriptEvent) error {
	if !event.IsFinal && !(event.SpeechFinal && event.Text != "") {
		return nil
	}
	text := strings.TrimSpace(event.Text)
	if text == "" {
		return nil
	}
	key := fmt.Sprintf("%.6f/%.6f/%s", event.StartSeconds, event.DurationSeconds, text)
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	if _, ok := s.seenSegments[key]; ok {
		return nil
	}
	extra := len([]rune(text))
	if len(s.finalSegments) > 0 {
		extra++
	}
	if s.transcriptRunes+extra > maxTranscriptRunes || len(s.seenSegments) >= 512 {
		return ErrMalformedProvider
	}
	s.transcriptRunes += extra
	s.seenSegments[key] = struct{}{}
	s.finalSegments = append(s.finalSegments, text)
	return nil
}

func (s *deepgramStream) Finalize(ctx context.Context) (string, error) {
	s.stateMu.Lock()
	if s.finalized {
		text := strings.Join(s.finalSegments, " ")
		s.stateMu.Unlock()
		return text, nil
	}
	s.stateMu.Unlock()
	if err := s.RequestFinalize(ctx); err != nil {
		return "", err
	}
	for {
		event, err := s.Receive(ctx)
		if err != nil {
			return "", err
		}
		if event.SpeechFinal || event.FromFinalize {
			return s.FinalText(), nil
		}
	}
}

func (s *deepgramStream) RequestFinalize(ctx context.Context) error {
	if ctx == nil {
		ctx = context.Background()
	}
	s.stateMu.Lock()
	if s.finalizeRequested || s.finalized {
		s.stateMu.Unlock()
		return nil
	}
	s.finalizeRequested = true
	s.stateMu.Unlock()
	if err := s.conn.Write(ctx, websocket.MessageText, []byte(`{"type":"Finalize"}`)); err != nil {
		if errors.Is(ctx.Err(), context.Canceled) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return ctx.Err()
		}
		return fmt.Errorf("%w: finalize", ErrProvider)
	}
	return nil
}

func (s *deepgramStream) FinalText() string {
	s.stateMu.Lock()
	defer s.stateMu.Unlock()
	return strings.Join(s.finalSegments, " ")
}

func (s *deepgramStream) Close() error {
	if s == nil || s.conn == nil {
		return nil
	}
	var err error
	s.closeOnce.Do(func() {
		err = s.conn.Close(websocket.StatusNormalClosure, "")
	})
	return err
}
