package platform

import (
	"strings"
	"testing"
)

func TestOpenRouterFreeModelsAndCredentials(t *testing.T) {
	c := Config{VoiceEnabled: true, STTProvider: "assemblyai", TextProvider: "openrouter", TTSProvider: "gemini", AssemblyAIKey: "test", GeminiKey: "test", ContentPackPath: "authorized.json"}.WithVoiceDefaults()
	if c.TextModel != "google/gemma-4-31b-it:free" || c.ValidateVoice() == nil {
		t.Fatal("default model or missing-key gate is incorrect")
	}
	c.OpenRouterKey = "test"
	for _, model := range []string{"google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free"} {
		c.TextModel = model
		if err := c.ValidateVoice(); err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(c.VoiceProviders()[1], "OpenRouter / Google AI Studio") {
			t.Fatal("policy omits provider")
		}
	}
	c.TextModel = "google/gemma-4-31b-it"
	if c.ValidateVoice() == nil {
		t.Fatal("paid model accepted in free-only integration")
	}
}

func TestVoiceProviderSelectionAndGates(t *testing.T) {
	c := Config{STTProvider: "assemblyai", TextProvider: "gemini", TTSProvider: "gemini", AssemblyAIKey: "test", GeminiKey: "test"}.WithVoiceDefaults()
	if c.STTLanguage != "en" || c.TextModel != "gemini-2.5-flash-lite" || c.TTSModel != "gemini-3.1-flash-tts-preview" {
		t.Fatal("wrong provider defaults")
	}
	if err := c.ValidateVoice(); err != nil {
		t.Fatal(err)
	}
	if c.SupportsVoiceLocale("id-ID") || !c.SupportsVoiceLocale("en-US") {
		t.Fatal("unsupported language enabled")
	}
	c.VoiceEnabled = true
	if c.ValidateVoice() == nil {
		t.Fatal("missing reviewed pack accepted")
	}
	c.ContentPackPath = "reviewed.json"
	if err := c.ValidateVoice(); err != nil {
		t.Fatal(err)
	}
	c.GeminiKey = ""
	if c.ValidateVoice() == nil {
		t.Fatal("missing provider key accepted")
	}
	c.VoiceEnabled = false
	c.STTLanguage = "id"
	if c.ValidateVoice() == nil {
		t.Fatal("unsupported streaming language accepted")
	}
	c.STTLanguage = "en"
	c.STTProvider = "unknown"
	if c.ValidateVoice() == nil {
		t.Fatal("unknown provider accepted")
	}
	legacy := Config{VoiceEnabled: true, DeepgramKey: "test", OpenAIKey: "test", ContentPackPath: "reviewed.json"}
	if err := legacy.ValidateVoice(); err != nil {
		t.Fatalf("legacy setup broke: %v", err)
	}
}

func TestGroqCredentialsAndPolicy(t *testing.T) {
	c := Config{VoiceEnabled: true, STTProvider: "assemblyai", TextProvider: "groq", TTSProvider: "gemini", AssemblyAIKey: "test", GeminiKey: "test", ContentPackPath: "authorized.json"}.WithVoiceDefaults()
	if c.TextModel != "openai/gpt-oss-120b" || c.ValidateVoice() == nil {
		t.Fatal("wrong model or missing key accepted")
	}
	c.GroqKey = "test"
	if err := c.ValidateVoice(); err != nil {
		t.Fatal(err)
	}
	if c.VoiceProviders()[1] != "Groq openai/gpt-oss-120b" {
		t.Fatal("policy omits Groq")
	}
	c.GeminiKey = ""
	if c.ValidateVoice() == nil {
		t.Fatal("Groq key incorrectly enables Gemini speech")
	}
}

func TestAzureAndrewConfiguration(t *testing.T) {
	c := Config{VoiceEnabled: true, STTProvider: "assemblyai", TextProvider: "groq", TTSProvider: "azure", AssemblyAIKey: "test", GroqKey: "test", ContentPackPath: "pack", AzureSpeechKey: "test", AzureSpeechRegion: "eastus"}.WithVoiceDefaults()
	if c.TTSModel != "en-US-AndrewNeural" {
		t.Fatal("wrong Azure voice")
	}
	if err := c.ValidateVoice(); err != nil {
		t.Fatal(err)
	}
	c.AzureSpeechKey = ""
	if c.ValidateVoice() == nil {
		t.Fatal("missing key accepted")
	}
	c.AzureSpeechKey = "test"
	c.AzureSpeechRegion = "evil.example/path"
	if c.ValidateVoice() == nil {
		t.Fatal("invalid region accepted")
	}
	c.AzureSpeechRegion = "eastus"
	c.TTSModel = "other"
	if c.ValidateVoice() == nil {
		t.Fatal("wrong voice accepted")
	}
}

func TestKokoroConfiguration(t *testing.T) {
	c := Config{TTSProvider: "kokoro", KokoroURL: "http://kokoro:8000/synthesize", VoiceEnabled: true, DeepgramKey: "test", OpenAIKey: "test", ContentPackPath: "test"}.WithVoiceDefaults()
	if c.TTSModel != "am_puck" || c.ValidateVoice() != nil {
		t.Fatal("valid Puck config rejected")
	}
	for _, endpoint := range []string{"", "file:///tmp/audio", "http://"} {
		invalid := c
		invalid.KokoroURL = endpoint
		if invalid.ValidateVoice() == nil {
			t.Fatal("invalid endpoint accepted")
		}
	}
	c.TTSModel = "am_michael"
	if c.ValidateVoice() == nil {
		t.Fatal("wrong voice accepted")
	}
}

func TestElevenLabsWithGroqFallbackConfiguration(t *testing.T) {
	c := Config{VoiceEnabled: true, STTProvider: "assemblyai", TextProvider: "groq", TTSProvider: "elevenlabs", TTSFallbackProvider: "groq", AssemblyAIKey: "test", GroqKey: "test", ContentPackPath: "pack", ElevenLabsKey: "test", ElevenLabsVoiceID: "bIHbv24MWmeRgasZH58o"}.WithVoiceDefaults()
	if c.TTSModel != "eleven_flash_v2_5" {
		t.Fatal("wrong ElevenLabs model")
	}
	if err := c.ValidateVoice(); err != nil {
		t.Fatal(err)
	}
	if c.VoiceProviders()[2] != "ElevenLabs eleven_flash_v2_5 with Groq canopylabs/orpheus-v1-english fallback" {
		t.Fatal("policy omits a speech provider", c.VoiceProviders()[2])
	}
	for name, broken := range map[string]func(Config) Config{
		"missing voice":      func(c Config) Config { c.ElevenLabsVoiceID = ""; return c },
		"bad voice":          func(c Config) Config { c.ElevenLabsVoiceID = "../v1/user"; return c },
		"missing key":        func(c Config) Config { c.ElevenLabsKey = ""; return c },
		"unknown model":      func(c Config) Config { c.TTSModel = "eleven_v3"; return c },
		"fallback no key":    func(c Config) Config { c.GroqKey = ""; c.TextProvider = "gemini"; c.GeminiKey = "test"; return c },
		"unknown fallback":   func(c Config) Config { c.TTSFallbackProvider = "kokoro"; return c },
		"fallback to itself": func(c Config) Config { c.TTSProvider = "groq"; c.TTSModel = "canopylabs/orpheus-v1-english"; return c },
	} {
		if broken(c).ValidateVoice() == nil {
			t.Fatalf("%s accepted", name)
		}
	}
}
