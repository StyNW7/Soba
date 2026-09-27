package platform

import (
	"encoding/base64"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

func LoadConfig() (Config, error) {
	policyPublishedAt := time.Date(2026, time.September, 7, 0, 0, 0, 0, time.UTC)
	if raw := os.Getenv("POLICY_PUBLISHED_AT"); raw != "" {
		parsed, err := time.Parse(time.RFC3339, raw)
		if err != nil {
			return Config{}, fmt.Errorf("POLICY_PUBLISHED_AT must be RFC3339")
		}
		policyPublishedAt = parsed.UTC()
	}
	voiceEnabled, err := boolEnv("VOICE_ENABLED", false)
	if err != nil {
		return Config{}, err
	}
	alertsEnabled, err := boolEnv("ALERTS_ENABLED", false)
	if err != nil {
		return Config{}, err
	}
	providerDeletionRequired, err := boolEnv("PROVIDER_DELETION_REQUIRED", false)
	if err != nil {
		return Config{}, err
	}
	c := Config{KokoroURL: os.Getenv("KOKORO_TTS_URL"), ElevenLabsKey: os.Getenv("ELEVENLABS_API_KEY"), ElevenLabsVoiceID: os.Getenv("ELEVENLABS_VOICE_ID"), TTSFallbackProvider: os.Getenv("TTS_FALLBACK_PROVIDER"), AzureSpeechKey: os.Getenv("AZURE_SPEECH_KEY"), AzureSpeechRegion: os.Getenv("AZURE_SPEECH_REGION"), STTProvider: env("STT_PROVIDER", "deepgram"), TextProvider: env("TEXT_PROVIDER", "openai"), TTSProvider: env("TTS_PROVIDER", "openai"), AssemblyAIKey: os.Getenv("ASSEMBLYAI_API_KEY"), GeminiKey: os.Getenv("GEMINI_API_KEY"), OpenRouterKey: os.Getenv("OPENROUTER_API_KEY"), GroqKey: os.Getenv("GROQ_API_KEY"), Env: env("APP_ENV", "development"), Addr: env("HTTP_ADDR", "127.0.0.1:8080"), PublicURL: env("PUBLIC_BASE_URL", "http://localhost:8080"), DatabaseURL: os.Getenv("DATABASE_URL"), PolicyVersion: env("POLICY_VERSION", "pilot-v1"), PolicyPublishedAt: policyPublishedAt, KeyVersion: env("DATA_KEY_VERSION", "1"), Origins: strings.Split(env("ALLOWED_WEB_ORIGINS", "http://localhost:5173"), ","), OIDCIssuer: os.Getenv("OIDC_ISSUER"), OIDCClientID: os.Getenv("OIDC_CLIENT_ID"), OIDCClientSecret: os.Getenv("OIDC_CLIENT_SECRET"), OIDCRedirectURI: os.Getenv("OIDC_REDIRECT_URI"), MobileReturnURI: os.Getenv("MOBILE_RETURN_URI"), VoiceEnabled: voiceEnabled, AlertsEnabled: alertsEnabled, DeepgramKey: os.Getenv("DEEPGRAM_API_KEY"), OpenAIKey: os.Getenv("OPENAI_API_KEY"), STTModel: os.Getenv("STT_MODEL"), STTLanguage: os.Getenv("STT_LANGUAGE"), TextModel: os.Getenv("TEXT_MODEL"), TTSModel: os.Getenv("TTS_MODEL"), FCMProject: os.Getenv("FCM_PROJECT_ID"), ContentPackPath: os.Getenv("CONTENT_PACK_PATH"), ObjectDirectory: env("OBJECT_DIRECTORY", "./private-data"), MaxSessions: 10, ProviderDeletionRequired: providerDeletionRequired}
	c = c.WithVoiceDefaults()
	for _, v := range []struct {
		name string
		dst  *[]byte
	}{{"DATA_ENCRYPTION_KEY", &c.DataKey}, {"CURSOR_HMAC_KEY", &c.CursorKey}, {"AUDIT_HMAC_KEY", &c.AuditKey}} {
		b, e := base64.StdEncoding.DecodeString(os.Getenv(v.name))
		if e != nil || len(b) != 32 {
			return c, fmt.Errorf("%s must contain 32 base64-encoded bytes", v.name)
		}
		*v.dst = b
	}
	if c.DatabaseURL == "" {
		return c, fmt.Errorf("DATABASE_URL is required")
	}
	if s := os.Getenv("MAX_ACTIVE_SESSIONS"); s != "" {
		n, e := strconv.Atoi(s)
		if e != nil || n < 1 || n > 100 {
			return c, fmt.Errorf("MAX_ACTIVE_SESSIONS must be 1 to 100")
		}
		c.MaxSessions = n
	}
	if os.Getenv("MINOR_ENROLLMENT_ENABLED") == "true" {
		return c, fmt.Errorf("minor enrollment requires a reviewed policy and is not enabled in this pilot")
	}
	for i, o := range c.Origins {
		c.Origins[i] = strings.TrimSpace(o)
		u, e := url.Parse(c.Origins[i])
		if e != nil || u.Host == "" || u.Path != "" || (u.Scheme != "https" && !(c.Env == "development" && u.Scheme == "http")) {
			return c, fmt.Errorf("invalid allowed origin")
		}
	}
	if c.Env != "development" {
		u, e := url.Parse(c.PublicURL)
		if e != nil || u.Scheme != "https" || u.Host == "" {
			return c, fmt.Errorf("production PUBLIC_BASE_URL requires HTTPS")
		}
		if c.OIDCIssuer == "" {
			return c, fmt.Errorf("OIDC is required outside development")
		}
		for _, endpoint := range []string{c.OIDCIssuer, c.OIDCRedirectURI} {
			u, err := url.Parse(endpoint)
			if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.Fragment != "" {
				return c, fmt.Errorf("production OIDC endpoints require HTTPS")
			}
		}
		if c.OIDCClientID == "" {
			return c, fmt.Errorf("OIDC_CLIENT_ID is required outside development")
		}
	}
	if err := c.ValidateVoice(); err != nil {
		return c, err
	}
	if c.AlertsEnabled && c.FCMProject == "" {
		return c, fmt.Errorf("alerts require FCM_PROJECT_ID")
	}
	return c, nil
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func boolEnv(name string, fallback bool) (bool, error) {
	raw, ok := os.LookupEnv(name)
	if !ok || strings.TrimSpace(raw) == "" {
		return fallback, nil
	}
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "true":
		return true, nil
	case "false":
		return false, nil
	default:
		return false, fmt.Errorf("%s must be true or false", name)
	}
}
