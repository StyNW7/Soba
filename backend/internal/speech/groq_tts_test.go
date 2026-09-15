package speech

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"unicode/utf8"
)

func testGroqWAV() []byte {
	b := make([]byte, 48)
	copy(b, "RIFF")
	binary.LittleEndian.PutUint32(b[4:], 40)
	copy(b[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(b[16:], 16)
	binary.LittleEndian.PutUint16(b[20:], 1)
	binary.LittleEndian.PutUint16(b[22:], 1)
	binary.LittleEndian.PutUint32(b[24:], 24000)
	binary.LittleEndian.PutUint32(b[28:], 48000)
	binary.LittleEndian.PutUint16(b[32:], 2)
	binary.LittleEndian.PutUint16(b[34:], 16)
	copy(b[36:], "data")
	binary.LittleEndian.PutUint32(b[40:], 0xffffffff)
	return b
}
func TestGroqSpeechChunksDanielAndRejectsQuotaWithoutPartialAudio(t *testing.T) {
	for _, fail := range []bool{false, true} {
		t.Run(map[bool]string{false: "success", true: "quota"}[fail], func(t *testing.T) {
			calls := 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls++
				var p map[string]string
				if json.NewDecoder(r.Body).Decode(&p) != nil || p["voice"] != "daniel" || p["model"] != "canopylabs/orpheus-v1-english" || utf8.RuneCountInString(p["input"]) > 200 || !strings.HasPrefix(p["input"], "[warm] ") || r.Header.Get("Authorization") != "Bearer test" {
					t.Error("incorrect speech request")
				}
				if fail && calls == 2 {
					w.WriteHeader(429)
					_, _ = w.Write([]byte("secret provider message"))
					return
				}
				_, _ = w.Write(testGroqWAV())
			}))
			defer server.Close()
			model := NewGroqTTS(GroqTTSConfig{APIKey: "test", Endpoint: server.URL})
			var out bytes.Buffer
			err := model.Synthesize(context.Background(), TTSRequest{Text: strings.Repeat("Hello there. ", 30), Approved: true, Locale: "en-US"}, &out)
			if fail {
				if !errors.Is(err, ErrProvider) || out.Len() != 0 || strings.Contains(err.Error(), "secret") {
					t.Fatalf("unsafe quota handling: %v", err)
				}
			} else if err != nil || out.Len() != calls*4 {
				t.Fatalf("speech failed: %v", err)
			}
			before := calls
			if err := model.Synthesize(context.Background(), TTSRequest{Text: "test"}, &out); !errors.Is(err, ErrUnapprovedSpeech) || calls != before {
				t.Fatal("unapproved text sent")
			}
		})
	}
}
func TestGroqSpeechRejectsMalformedWAV(t *testing.T) {
	valid := testGroqWAV()
	badRate := bytes.Clone(valid)
	binary.LittleEndian.PutUint32(badRate[24:], 48000)
	for _, b := range [][]byte{nil, valid[:43], badRate, append(bytes.Clone(valid), 1)} {
		if _, err := groqWAVPCM(b); err == nil {
			t.Fatal("invalid WAV accepted")
		}
	}
	if p, err := groqWAVPCM(valid); err != nil || len(p) != 4 {
		t.Fatal("streaming WAV rejected", err)
	}
}
func TestGroqSpeechSplitPreservesWords(t *testing.T) {
	text := strings.Repeat("Hello café. ", 40)
	parts := groqSpeechParts(text)
	if strings.Join(parts, " ") != strings.TrimSpace(text) {
		t.Fatal("text changed")
	}
	for _, p := range parts {
		if utf8.RuneCountInString(p) > 193 {
			t.Fatal("chunk exceeds limit")
		}
	}
}

func TestGroqSpeechAudioDurationBound(t *testing.T) {
	for _, seconds := range []int{30, 90, 91} {
		t.Run(fmt.Sprint(seconds), func(t *testing.T) {
			wav := append(testGroqWAV()[:44], make([]byte, seconds*24000*2)...)
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write(wav) }))
			defer server.Close()
			var out bytes.Buffer
			err := NewGroqTTS(GroqTTSConfig{APIKey: "test", Endpoint: server.URL}).Synthesize(context.Background(), TTSRequest{Text: "A story.", Approved: true}, &out)
			if seconds <= 90 {
				if err != nil || out.Len() != seconds*48000 {
					t.Fatalf("audio rejected: %v", err)
				}
			} else if !errors.Is(err, ErrAudioLimit) || out.Len() != 0 {
				t.Fatalf("limit not enforced: %v", err)
			}
		})
	}
}
