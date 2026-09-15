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

const maxKokoroAudioBytes = 90 * 24000 * 2

type KokoroTTSConfig struct {
	Endpoint   string
	HTTPClient *http.Client
}

type KokoroTTS struct{ config KokoroTTSConfig }

func NewKokoroTTS(c KokoroTTSConfig) *KokoroTTS {
	if c.HTTPClient == nil {
		c.HTTPClient = http.DefaultClient
	}
	return &KokoroTTS{config: c}
}

func (t *KokoroTTS) Enabled() bool {
	return t != nil && t.config.Endpoint != ""
}

func (t *KokoroTTS) Synthesize(ctx context.Context, r TTSRequest, dst io.Writer) error {
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
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	body, _ := json.Marshal(map[string]string{"text": r.Text})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, t.config.Endpoint, bytes.NewReader(body))
	if err != nil {
		return ErrProvider
	}
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
		return fmt.Errorf("%w: Kokoro speech status %d", ErrProvider, resp.StatusCode)
	}
	total := 0
	for {
		var size uint32
		if err := binary.Read(resp.Body, binary.BigEndian, &size); err != nil {
			return ErrMalformedProvider
		}
		if size == 0 {
			if total == 0 {
				return ErrMalformedProvider
			}
			return ctx.Err()
		}
		if uint64(size)+uint64(total) > maxKokoroAudioBytes {
			return ErrAudioLimit
		}
		if size%2 != 0 {
			return ErrMalformedProvider
		}
		audio := make([]byte, int(size))
		if _, err := io.ReadFull(resp.Body, audio); err != nil {
			return ErrMalformedProvider
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		if _, err := dst.Write(audio); err != nil {
			return err
		}
		total += len(audio)
	}
}
