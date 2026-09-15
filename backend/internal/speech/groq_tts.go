package speech

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

const maxGroqAudioBytes = 90 * 24000 * 2

type GroqTTSConfig struct {
	APIKey, Endpoint, Model string
	HTTPClient              *http.Client
}

type GroqTTS struct{ config GroqTTSConfig }

func NewGroqTTS(c GroqTTSConfig) *GroqTTS {
	if c.Endpoint == "" {
		c.Endpoint = "https://api.groq.com/openai/v1/audio/speech"
	}
	if c.Model == "" {
		c.Model = "canopylabs/orpheus-v1-english"
	}
	if c.HTTPClient == nil {
		c.HTTPClient = http.DefaultClient
	}
	return &GroqTTS{config: c}
}
func (t *GroqTTS) Enabled() bool { return t != nil && strings.TrimSpace(t.config.APIKey) != "" }
func (t *GroqTTS) Synthesize(ctx context.Context, r TTSRequest, dst io.Writer) error {
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
	var audio []byte
	for _, part := range groqSpeechParts(r.Text) {
		body, _ := json.Marshal(map[string]string{"model": t.config.Model, "voice": "daniel", "input": "[warm] " + part, "response_format": "wav"})
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.config.Endpoint, bytes.NewReader(body))
		if err != nil {
			return ErrProvider
		}
		req.Header.Set("Authorization", "Bearer "+t.config.APIKey)
		req.Header.Set("Content-Type", "application/json")
		resp, err := t.config.HTTPClient.Do(req)
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return ErrProvider
		}
		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return fmt.Errorf("%w: Groq speech status %d", ErrProvider, resp.StatusCode)
		}
		raw, err := io.ReadAll(io.LimitReader(resp.Body, maxGroqAudioBytes+65537))
		resp.Body.Close()
		if err != nil {
			return ErrProvider
		}
		if len(raw) > maxGroqAudioBytes+65536 {
			return ErrAudioLimit
		}
		pcm, err := groqWAVPCM(raw)
		if err != nil {
			return err
		}
		if len(audio)+len(pcm) > maxGroqAudioBytes {
			return ErrAudioLimit
		}
		audio = append(audio, pcm...)
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	_, err := dst.Write(audio)
	return err
}

func groqSpeechParts(text string) []string {
	var parts []string
	chars := []rune(strings.TrimSpace(text))
	for len(chars) > 0 {
		end := min(193, len(chars))
		if end < len(chars) {
			for n := end - 1; n > 0; n-- {
				if chars[n] == ' ' || chars[n] == '\n' {
					end = n
					break
				}
			}
		}
		parts = append(parts, string(chars[:end]))
		chars = []rune(strings.TrimSpace(string(chars[end:])))
	}
	return parts
}

func groqWAVPCM(raw []byte) ([]byte, error) {
	if len(raw) < 12 || string(raw[:4]) != "RIFF" || string(raw[8:12]) != "WAVE" {
		return nil, ErrMalformedProvider
	}
	formatOK := false
	for offset := 12; offset+8 <= len(raw); {
		kind := string(raw[offset : offset+4])
		size := uint64(binary.LittleEndian.Uint32(raw[offset+4 : offset+8]))
		offset += 8
		// Groq can return streaming WAV headers with an unknown data length.
		if kind == "data" && size == 0xffffffff {
			size = uint64(len(raw) - offset)
		}
		if size > uint64(len(raw)-offset) {
			return nil, ErrMalformedProvider
		}
		chunk := raw[offset : offset+int(size)]
		if kind == "fmt " {
			if len(chunk) < 16 {
				return nil, ErrMalformedProvider
			}
			formatOK = binary.LittleEndian.Uint16(chunk) == 1 && binary.LittleEndian.Uint16(chunk[2:]) == 1 && binary.LittleEndian.Uint32(chunk[4:]) == 24000 && binary.LittleEndian.Uint16(chunk[14:]) == 16
		}
		if kind == "data" {
			if !formatOK || len(chunk) == 0 || len(chunk)%2 != 0 {
				return nil, ErrMalformedProvider
			}
			return chunk, nil
		}
		offset += int(size) + int(size%2)
	}
	return nil, ErrMalformedProvider
}
