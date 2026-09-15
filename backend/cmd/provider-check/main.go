package main

import (
	"bytes"
	"context"
	"encoding/binary"
	"flag"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/StyNW7/Soba/backend/internal/safety"
	"github.com/StyNW7/Soba/backend/internal/speech"
)

func main() {
	live := flag.Bool("live", false, "call paid providers with a fixed English test phrase")
	flag.Parse()
	if !*live {
		fmt.Fprintln(os.Stderr, "Pass -live to run provider checks. No user recordings are used.")
		os.Exit(2)
	}
	if err := check(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func check() error {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()
	key := os.Getenv("GEMINI_API_KEY")
	var model safety.Model = safety.NewGemini(safety.GeminiConfig{APIKey: key, Model: os.Getenv("TEXT_MODEL")})
	provider := "Gemini"
	if os.Getenv("TEXT_PROVIDER") == "groq" {
		model = safety.NewGroq(safety.GroqConfig{APIKey: os.Getenv("GROQ_API_KEY"), Model: os.Getenv("TEXT_MODEL")})
		provider = "Groq"
	}
	if os.Getenv("TEXT_PROVIDER") == "openrouter" {
		model = safety.NewOpenRouter(safety.OpenRouterConfig{APIKey: os.Getenv("OPENROUTER_API_KEY"), Model: os.Getenv("TEXT_MODEL")})
		provider = "OpenRouter"
	}
	assessment, err := model.Assess(ctx, safety.AssessmentRequest{Locale: "en-US", Transcript: "Hello. This is a voice connection test."})
	if err != nil {
		return fmt.Errorf("%s assessment: %w", provider, err)
	}
	reply, err := model.Reply(ctx, safety.ReplyRequest{Locale: "en-US", Transcript: "Hello. This is a voice connection test.", Assessment: assessment, ListenFirst: true})
	if err != nil {
		return fmt.Errorf("%s reply: %w", provider, err)
	}
	checked, err := model.Check(ctx, safety.ReplyCheckRequest{Locale: "en-US", Transcript: "Hello. This is a voice connection test.", Candidate: reply})
	if err != nil || !checked.Allowed {
		return fmt.Errorf("%s reply check did not approve the test reply: %v", provider, err)
	}
	if _, err = model.Draft(ctx, safety.DraftRequest{Locale: "en-US", Recent: []safety.Message{{Role: "user", Text: "Hello. This is a voice connection test."}, {Role: "assistant", Text: reply.Text}}}); err != nil {
		return fmt.Errorf("%s draft: %w", provider, err)
	}
	fmt.Printf("%s assessment, reply, reply check and draft: PASS\n", provider)
	if os.Getenv("TTS_PROVIDER") == "browser" {
		fmt.Println("Browser speech: verify in browser; no server TTS request. STT not exercised by this check.")
		return nil
	}
	var audio bytes.Buffer
	var tts speech.Synthesizer = speech.NewGeminiTTS(speech.GeminiTTSConfig{APIKey: key, Model: os.Getenv("TTS_MODEL")})
	if os.Getenv("TTS_PROVIDER") == "groq" {
		tts = speech.NewGroqTTS(speech.GroqTTSConfig{APIKey: os.Getenv("GROQ_API_KEY"), Model: os.Getenv("TTS_MODEL")})
	}
	if os.Getenv("TTS_PROVIDER") == "kokoro" {
		tts = speech.NewKokoroTTS(speech.KokoroTTSConfig{Endpoint: os.Getenv("KOKORO_TTS_URL")})
	}
	if err = tts.Synthesize(ctx, speech.TTSRequest{Text: "This is a voice connection test for Soba.", Approved: true, Locale: "en-US"}, &audio); err != nil {
		return fmt.Errorf("Speech output: %w", err)
	}
	fmt.Printf("Speech output: PASS (%d PCM bytes, memory only)\n", audio.Len())
	stream, err := speech.NewAssemblyAI(speech.AssemblyAIConfig{APIKey: os.Getenv("ASSEMBLYAI_API_KEY"), Model: os.Getenv("STT_MODEL")}).NewStream(ctx)
	if err != nil {
		return fmt.Errorf("AssemblyAI connection: %w", err)
	}
	defer stream.Close()
	result := make(chan error, 1)
	go func() {
		for {
			event, err := stream.Receive(ctx)
			if err != nil {
				result <- err
				return
			}
			if event.SpeechFinal {
				result <- nil
				return
			}
		}
	}()
	source := audio.Bytes()
	pcm := make([]byte, ((len(source)/2)*2/3)*2)
	for n := 0; n < len(pcm)/2; n++ {
		position := n * 3
		index := position / 2
		value := int32(int16(binary.LittleEndian.Uint16(source[index*2:])))
		if position%2 != 0 && (index+1)*2 < len(source) {
			value = (value + int32(int16(binary.LittleEndian.Uint16(source[(index+1)*2:])))) / 2
		}
		binary.LittleEndian.PutUint16(pcm[n*2:], uint16(int16(value)))
	}
	for offset := 0; offset < len(pcm); offset += 640 {
		end := min(offset+640, len(pcm))
		if err = stream.Send(ctx, pcm[offset:end]); err != nil {
			return fmt.Errorf("AssemblyAI audio: %w", err)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(20 * time.Millisecond):
		}
	}
	if err = stream.RequestFinalize(ctx); err != nil {
		return fmt.Errorf("AssemblyAI finalization: %w", err)
	}
	select {
	case err = <-result:
	case <-ctx.Done():
		err = ctx.Err()
	}
	if err != nil {
		return fmt.Errorf("AssemblyAI transcript: %w", err)
	}
	if !strings.Contains(strings.ToLower(stream.FinalText()), "connection test") {
		return fmt.Errorf("AssemblyAI returned an unexpected transcript; audio was not saved")
	}
	if err = stream.Close(); err != nil {
		return err
	}
	fmt.Println("AssemblyAI transcription and session termination: PASS")
	return nil
}
