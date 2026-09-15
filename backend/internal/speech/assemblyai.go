package speech

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/coder/websocket"
)

type AssemblyAIConfig struct {
	APIKey, Endpoint, Model string
	ConnectTimeout          time.Duration
	HTTPClient              *http.Client
}

type AssemblyAI struct{ config AssemblyAIConfig }

func NewAssemblyAI(config AssemblyAIConfig) *AssemblyAI {
	if config.Endpoint == "" {
		config.Endpoint = "wss://streaming.assemblyai.com/v3/ws"
	}
	if config.Model == "" {
		config.Model = "universal-3-5-pro"
	}
	if config.ConnectTimeout == 0 {
		config.ConnectTimeout = 3 * time.Second
	}
	return &AssemblyAI{config: config}
}

func (a *AssemblyAI) Enabled() bool { return a != nil && strings.TrimSpace(a.config.APIKey) != "" }

func (a *AssemblyAI) NewStream(ctx context.Context) (TranscriptStream, error) {
	if a == nil || strings.TrimSpace(a.config.APIKey) == "" {
		return nil, ErrDisabled
	}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, a.config.ConnectTimeout)
	defer cancel()
	u, err := url.Parse(a.config.Endpoint)
	if err != nil || u.Host == "" || (u.Scheme != "ws" && u.Scheme != "wss") {
		return nil, ErrProvider
	}
	q := u.Query()
	q.Set("sample_rate", "16000")
	q.Set("encoding", "pcm_s16le")
	q.Set("speech_model", a.config.Model)
	q.Set("min_turn_silence", "1200")
	q.Set("max_turn_silence", "3600")
	q.Set("language_codes", `["en"]`)
	u.RawQuery = q.Encode()
	conn, _, err := websocket.Dial(ctx, u.String(), &websocket.DialOptions{HTTPClient: a.config.HTTPClient, HTTPHeader: http.Header{"Authorization": []string{a.config.APIKey}}})
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, ErrProvider
	}
	conn.SetReadLimit(maxProviderMessageBytes)
	s := &assemblyStream{conn: conn}
	typ, body, err := conn.Read(ctx)
	var begin struct {
		Type string `json:"type"`
	}
	if err != nil || typ != websocket.MessageText || json.Unmarshal(body, &begin) != nil || begin.Type != "Begin" {
		_ = s.Close()
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		return nil, ErrProvider
	}
	return s, nil
}

type assemblyStream struct {
	conn                     *websocket.Conn
	mu                       sync.Mutex
	closeOnce                sync.Once
	buffer                   []byte
	text                     string
	final, requested, closed bool
}

// AssemblyAI requires at least 50 ms per message; SOBA captures 20 ms frames.
const assemblyFrameBytes = InputSampleRate * PCMBytes * 60 / 1000

func (s *assemblyStream) Send(ctx context.Context, pcm []byte) error {
	if len(pcm) == 0 || len(pcm)%PCMBytes != 0 || len(pcm) > InputSampleRate*PCMBytes {
		return ErrInvalidAudio
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed || s.requested {
		return ErrProvider
	}
	if s.final {
		return nil
	}
	s.buffer = append(s.buffer, pcm...)
	for len(s.buffer) >= assemblyFrameBytes {
		if err := s.write(ctx, websocket.MessageBinary, s.buffer[:assemblyFrameBytes]); err != nil {
			return err
		}
		s.buffer = s.buffer[assemblyFrameBytes:]
	}
	return nil
}

func (s *assemblyStream) write(ctx context.Context, kind websocket.MessageType, body []byte) error {
	if ctx == nil {
		ctx = context.Background()
	}
	if err := s.conn.Write(ctx, kind, body); err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return ErrProvider
	}
	return nil
}

func (s *assemblyStream) Receive(ctx context.Context) (TranscriptEvent, error) {
	if ctx == nil {
		ctx = context.Background()
	}
	for {
		typ, body, err := s.conn.Read(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return TranscriptEvent{}, ctx.Err()
			}
			return TranscriptEvent{}, ErrProvider
		}
		var event struct {
			Type       string `json:"type"`
			Transcript string `json:"transcript"`
			End        *bool  `json:"end_of_turn"`
		}
		if typ != websocket.MessageText || json.Unmarshal(body, &event) != nil {
			return TranscriptEvent{}, ErrMalformedProvider
		}
		switch event.Type {
		case "SpeechStarted":
			continue
		case "Turn":
			if event.End == nil || !utf8.ValidString(event.Transcript) || utf8.RuneCountInString(event.Transcript) > maxTranscriptRunes {
				return TranscriptEvent{}, ErrMalformedProvider
			}
			s.mu.Lock()
			if *event.End && !s.final {
				s.text = strings.TrimSpace(event.Transcript)
				s.final = true
			}
			s.mu.Unlock()
			return TranscriptEvent{Text: event.Transcript, IsFinal: *event.End, SpeechFinal: *event.End}, nil
		case "Error", "Termination":
			return TranscriptEvent{}, ErrProvider
		default:
			return TranscriptEvent{}, ErrMalformedProvider
		}
	}
}

func (s *assemblyStream) RequestFinalize(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.final || s.requested {
		return nil
	}
	if s.closed {
		return ErrProvider
	}
	if len(s.buffer) > 0 {
		frame := make([]byte, assemblyFrameBytes)
		copy(frame, s.buffer)
		if err := s.write(ctx, websocket.MessageBinary, frame); err != nil {
			return err
		}
		s.buffer = nil
	}
	if err := s.write(ctx, websocket.MessageText, []byte(`{"type":"ForceEndpoint"}`)); err != nil {
		return err
	}
	s.requested = true
	return nil
}

func (s *assemblyStream) FinalText() string { s.mu.Lock(); defer s.mu.Unlock(); return s.text }

func (s *assemblyStream) Finalize(ctx context.Context) (string, error) {
	s.mu.Lock()
	final := s.final
	s.mu.Unlock()
	if final {
		return s.FinalText(), nil
	}
	if err := s.RequestFinalize(ctx); err != nil {
		return "", err
	}
	for {
		event, err := s.Receive(ctx)
		if err != nil {
			return "", err
		}
		if event.SpeechFinal {
			return s.FinalText(), nil
		}
	}
}

func (s *assemblyStream) Close() error {
	var result error
	s.closeOnce.Do(func() {
		s.mu.Lock()
		defer s.mu.Unlock()
		s.closed = true
		s.buffer = nil
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := s.write(ctx, websocket.MessageText, []byte(`{"type":"Terminate"}`)); err != nil {
			result = fmt.Errorf("%w: terminate", ErrProvider)
		}
		_ = s.conn.CloseNow()
	})
	return result
}
