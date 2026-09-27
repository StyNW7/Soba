package platform

import (
	"fmt"
	"net/url"
	"regexp"
	"strings"
)

func (c Config) WithVoiceDefaults() Config {
	if c.STTProvider == "" {
		c.STTProvider = "deepgram"
	}
	if c.TextProvider == "" {
		c.TextProvider = "openai"
	}
	if c.TTSProvider == "" {
		c.TTSProvider = "openai"
	}
	if c.STTModel == "" {
		c.STTModel = "nova-3"
		if c.STTProvider == "assemblyai" {
			c.STTModel = "universal-3-5-pro"
		}
	}
	if c.STTLanguage == "" {
		c.STTLanguage = "id"
		if c.STTProvider == "assemblyai" {
			c.STTLanguage = "en"
		}
	}
	if c.TextModel == "" {
		c.TextModel = "gpt-4.1-mini"
		if c.TextProvider == "gemini" {
			c.TextModel = "gemini-2.5-flash-lite"
		}
		if c.TextProvider == "groq" {
			c.TextModel = "openai/gpt-oss-120b"
		}
		if c.TextProvider == "openrouter" {
			c.TextModel = "google/gemma-4-31b-it:free"
		}
	}
	if c.TTSProvider == "kokoro" && c.TTSModel == "" {
		c.TTSModel = "am_puck"
	}
	if c.TTSProvider == "azure" && c.TTSModel == "" {
		c.TTSModel = "en-US-AndrewNeural"
	}
	if c.TTSProvider == "browser" {
		c.TTSModel = "en-US"
	}
	if c.TTSProvider == "elevenlabs" && c.TTSModel == "" {
		c.TTSModel = "eleven_flash_v2_5"
	}
	if c.TTSProvider == "groq" && c.TTSModel == "" {
		c.TTSModel = "canopylabs/orpheus-v1-english"
	}
	if c.TTSModel == "" {
		c.TTSModel = "gpt-4o-mini-tts"
		if c.TTSProvider == "gemini" {
			c.TTSModel = "gemini-3.1-flash-tts-preview"
		}
	}
	return c
}

func (c Config) ValidateVoice() error {
	c = c.WithVoiceDefaults()
	sttKey := c.DeepgramKey
	switch c.STTProvider {
	case "deepgram":
	case "assemblyai":
		sttKey = c.AssemblyAIKey
	default:
		return fmt.Errorf("unsupported STT_PROVIDER")
	}
	textKey := c.OpenAIKey
	switch c.TextProvider {
	case "openai":
	case "gemini":
		textKey = c.GeminiKey
	case "groq":
		textKey = c.GroqKey
	case "openrouter":
		textKey = c.OpenRouterKey
		if c.TextModel != "google/gemma-4-31b-it:free" && c.TextModel != "google/gemma-4-26b-a4b-it:free" {
			return fmt.Errorf("OpenRouter integration requires a supported free Gemma 4 model")
		}
	default:
		return fmt.Errorf("unsupported TEXT_PROVIDER")
	}
	ttsKey := c.OpenAIKey
	switch c.TTSProvider {
	case "kokoro":
		ttsKey = c.KokoroURL
		if c.TTSModel != "am_puck" {
			return fmt.Errorf("Kokoro speech requires am_puck")
		}
		u, err := url.Parse(c.KokoroURL)
		if c.VoiceEnabled && (err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil) {
			return fmt.Errorf("KOKORO_TTS_URL must be a valid HTTP endpoint")
		}
	case "azure":
		ttsKey = c.AzureSpeechKey
		if c.TTSModel != "en-US-AndrewNeural" {
			return fmt.Errorf("Azure speech requires en-US-AndrewNeural")
		}
		if c.VoiceEnabled && !regexp.MustCompile(`^[a-z0-9]+$`).MatchString(c.AzureSpeechRegion) {
			return fmt.Errorf("AZURE_SPEECH_REGION is required and must be a region name")
		}
	case "groq":
		ttsKey = c.GroqKey
		if c.TTSModel != "canopylabs/orpheus-v1-english" {
			return fmt.Errorf("Groq speech requires Orpheus English")
		}
	case "elevenlabs":
		ttsKey = c.ElevenLabsKey
		if c.TTSModel != "eleven_flash_v2_5" && c.TTSModel != "eleven_turbo_v2_5" && c.TTSModel != "eleven_multilingual_v2" {
			return fmt.Errorf("ElevenLabs speech requires a supported model")
		}
		if c.VoiceEnabled && !regexp.MustCompile(`^[A-Za-z0-9]{20}$`).MatchString(c.ElevenLabsVoiceID) {
			return fmt.Errorf("ELEVENLABS_VOICE_ID must be an ElevenLabs voice ID")
		}
	case "browser":
		ttsKey = "browser"
	case "openai":
	case "gemini":
		ttsKey = c.GeminiKey
	default:
		return fmt.Errorf("unsupported TTS_PROVIDER")
	}
	switch c.TTSFallbackProvider {
	case "":
	case "groq":
		if c.TTSProvider == "groq" {
			return fmt.Errorf("TTS_FALLBACK_PROVIDER must differ from TTS_PROVIDER")
		}
		if c.VoiceEnabled && strings.TrimSpace(c.GroqKey) == "" {
			return fmt.Errorf("Groq speech fallback requires GROQ_API_KEY")
		}
	default:
		return fmt.Errorf("unsupported TTS_FALLBACK_PROVIDER")
	}
	if c.STTProvider == "assemblyai" && (c.STTLanguage != "en" || c.STTModel != "universal-3-5-pro") {
		return fmt.Errorf("AssemblyAI integration requires STT_LANGUAGE=en and STT_MODEL=universal-3-5-pro")
	}
	if c.VoiceEnabled && (strings.TrimSpace(sttKey) == "" || strings.TrimSpace(textKey) == "" || strings.TrimSpace(ttsKey) == "" || strings.TrimSpace(c.ContentPackPath) == "") {
		return fmt.Errorf("voice requires selected provider credentials and a reviewed content pack")
	}
	return nil
}

func (c Config) SupportsVoiceLocale(locale string) bool {
	return locale == "en-US"
}

func (c Config) VoiceProviders() []string {
	c = c.WithVoiceDefaults()
	names := map[string]string{"kokoro": "Self-hosted Kokoro", "azure": "Microsoft Azure", "browser": "Browser speech", "groq": "Groq", "deepgram": "Deepgram", "assemblyai": "AssemblyAI", "openai": "OpenAI", "gemini": "Google Gemini", "openrouter": "OpenRouter / Google AI Studio", "elevenlabs": "ElevenLabs"}
	tts := names[c.TTSProvider] + " " + c.TTSModel
	if c.TTSFallbackProvider == "groq" {
		tts += " with Groq canopylabs/orpheus-v1-english fallback"
	}
	return []string{names[c.STTProvider] + " " + c.STTModel, names[c.TextProvider] + " " + c.TextModel, tts}
}
