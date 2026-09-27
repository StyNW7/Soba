// Package app assembles the Soba backend services and owns their lifecycle.
package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/StyNW7/Soba/backend/internal/auth"
	"github.com/StyNW7/Soba/backend/internal/conversation"
	"github.com/StyNW7/Soba/backend/internal/devices"
	"github.com/StyNW7/Soba/backend/internal/httpapi"
	"github.com/StyNW7/Soba/backend/internal/jobs"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/push"
	"github.com/StyNW7/Soba/backend/internal/safety"
	"github.com/StyNW7/Soba/backend/internal/speech"
	"github.com/StyNW7/Soba/backend/internal/store"
	"github.com/StyNW7/Soba/backend/internal/support"
	"github.com/StyNW7/Soba/backend/internal/wellbeing"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// App is the assembled Soba service. The database pool belongs to the caller;
// Close releases only the application resources and singleton lease.
type App struct {
	Handler http.Handler

	Pool      *pgxpool.Pool
	Config    platform.Config
	Logger    *slog.Logger
	Guards    *platform.Guards
	Auth      *auth.Service
	Devices   *devices.Service
	Voice     *conversation.Service
	Wellbeing *wellbeing.Service
	Support   *support.Service
	Jobs      *jobs.Service

	lock       *singletonLock
	closeOnce  sync.Once
	closeErr   error
	workerMu   sync.Mutex
	workerStop context.CancelFunc
	closed     bool
	workers    sync.WaitGroup
}

type singletonLock struct {
	conn *pgxpool.Conn
	key  int64
}

// New acquires the production singleton lease, repairs restart metadata, and
// assembles every operation in the generated API contract.
func New(ctx context.Context, pool *pgxpool.Pool, cfg platform.Config) (*App, error) {
	if ctx == nil {
		return nil, errors.New("app: nil context")
	}
	cfg = cfg.WithVoiceDefaults()
	if err := validateConfig(cfg); err != nil {
		return nil, err
	}
	if pool == nil {
		return nil, errors.New("app: nil database pool")
	}
	lease, err := acquireSingleton(ctx, pool)
	if err != nil {
		return nil, err
	}
	release := func() { _ = releaseSingleton(context.Background(), lease) }
	if err := recoverRestartMetadata(ctx, pool); err != nil {
		release()
		return nil, err
	}

	guards := &platform.Guards{}
	voiceService := &conversation.Service{Pool: pool, Config: cfg, Guards: guards}
	deviceService := &devices.Service{Pool: pool, Config: cfg, Guards: guards, CancelOwner: voiceService.CancelActiveOwner}
	voiceService.DeviceAuth = deviceService.AuthenticateDevice
	authService := auth.NewService(pool, cfg, voiceService.CancelOwner)
	authService.CancelActiveOwner = voiceService.CancelActiveOwner
	wellbeingService := &wellbeing.Service{Pool: pool, Config: cfg, CancelOwner: voiceService.CancelActiveOwner}
	objectDirectory := cfg.ObjectDirectory
	if objectDirectory == "" {
		objectDirectory = "./private-data"
	}
	if err := os.MkdirAll(objectDirectory, 0o700); err != nil {
		release()
		return nil, fmt.Errorf("app: create private object directory: %w", err)
	}
	if err := os.Chmod(objectDirectory, 0o700); err != nil {
		release()
		return nil, fmt.Errorf("app: protect private object directory: %w", err)
	}
	jobService := &jobs.Service{
		Pool:                     pool,
		Config:                   cfg,
		Guards:                   guards,
		Objects:                  jobs.FilesystemObjects{Directory: objectDirectory},
		CancelOwner:              voiceService.CancelOwner,
		ExpireDrafts:             voiceService.Expire,
		ProviderDeletionRequired: cfg.ProviderDeletionRequired,
	}

	var sender push.Sender
	if cfg.AlertsEnabled {
		sender, err = push.NewFCM(ctx, cfg.FCMProject)
		if err != nil {
			release()
			return nil, fmt.Errorf("app: initialise FCM: %w", err)
		}
	}
	supportService := &support.Service{
		Pool:        pool,
		Config:      cfg,
		Guards:      guards,
		Sender:      sender,
		SafetyEvent: voiceService.SafetyEvent,
	}

	var reviewed safety.ReviewedContent
	if cfg.VoiceEnabled {
		reviewed, err = loadReviewedContent(cfg.ContentPackPath, time.Now().UTC())
		if err != nil {
			release()
			return nil, err
		}
	}
	if cfg.VoiceEnabled && !cfg.SupportsVoiceLocale(reviewed.Locale) {
		release()
		return nil, errors.New("app: content pack locale is unsupported by the speech provider")
	}
	var model safety.Model = safety.NewOpenAIResponses(safety.OpenAIConfig{APIKey: cfg.OpenAIKey, Model: cfg.TextModel})
	if cfg.TextProvider == "gemini" {
		model = safety.NewGemini(safety.GeminiConfig{APIKey: cfg.GeminiKey, Model: cfg.TextModel})
	}
	if cfg.TextProvider == "groq" {
		model = safety.NewGroq(safety.GroqConfig{APIKey: cfg.GroqKey, Model: cfg.TextModel})
	}
	if cfg.TextProvider == "openrouter" {
		model = safety.NewOpenRouter(safety.OpenRouterConfig{APIKey: cfg.OpenRouterKey, Model: cfg.TextModel})
	}
	pipeline := safety.NewPipeline(safety.PipelineConfig{Model: model, Reviewed: reviewed})
	var stt interface {
		speech.Transcriber
		Enabled() bool
	} = speech.NewDeepgram(speech.DeepgramConfig{APIKey: cfg.DeepgramKey, Model: cfg.STTModel, Language: cfg.STTLanguage})
	var tts interface {
		speech.Synthesizer
		Enabled() bool
	} = speech.NewOpenAITTS(speech.OpenAITTSConfig{APIKey: cfg.OpenAIKey, Model: cfg.TTSModel})
	if cfg.STTProvider == "assemblyai" {
		stt = speech.NewAssemblyAI(speech.AssemblyAIConfig{APIKey: cfg.AssemblyAIKey, Model: cfg.STTModel})
	}
	if cfg.TTSProvider == "kokoro" {
		tts = speech.NewKokoroTTS(speech.KokoroTTSConfig{Endpoint: cfg.KokoroURL})
	}
	if cfg.TTSProvider == "azure" {
		tts = speech.NewAzureTTS(speech.AzureTTSConfig{APIKey: cfg.AzureSpeechKey, Region: cfg.AzureSpeechRegion})
	}
	if cfg.TTSProvider == "groq" {
		tts = speech.NewGroqTTS(speech.GroqTTSConfig{APIKey: cfg.GroqKey, Model: cfg.TTSModel})
	}
	if cfg.TTSProvider == "browser" {
		tts = speech.BrowserSpeech{}
	}
	if cfg.TTSProvider == "gemini" {
		tts = speech.NewGeminiTTS(speech.GeminiTTSConfig{APIKey: cfg.GeminiKey, Model: cfg.TTSModel})
	}
	if cfg.TTSProvider == "elevenlabs" {
		tts = speech.NewElevenLabsTTS(speech.ElevenLabsTTSConfig{APIKey: cfg.ElevenLabsKey, Model: cfg.TTSModel, VoiceID: cfg.ElevenLabsVoiceID})
	}
	if cfg.TTSFallbackProvider == "groq" {
		tts = speech.FallbackTTS{Primary: tts, Secondary: speech.NewGroqTTS(speech.GroqTTSConfig{APIKey: cfg.GroqKey})}
	}
	voiceEngine, err := conversation.NewVoiceEngine(voiceService, stt, tts, pipeline)
	if err != nil {
		release()
		return nil, fmt.Errorf("app: initialise voice engine: %w", err)
	}
	if cfg.VoiceEnabled {
		if !pipeline.Enabled() || !stt.Enabled() || !tts.Enabled() {
			release()
			return nil, errors.New("app: voice is enabled but the speech and safety pipeline is disabled")
		}
		voiceService.Voice = voiceEngine.Serve
	}

	logger := slog.Default()
	server := &httpapi.Server{
		Logger:       logger,
		Pool:         pool,
		Config:       cfg,
		Authenticate: authService.Authenticate,
		Guards:       guards,
	}
	handlers, err := handlerRegistry(pool, cfg, authService, deviceService, voiceService, wellbeingService, supportService, jobService)
	if err != nil {
		release()
		return nil, err
	}
	server.Handlers = handlers
	handler, err := server.Handler()
	if err != nil {
		release()
		return nil, fmt.Errorf("app: build HTTP handler: %w", err)
	}
	return &App{
		Handler:   handler,
		Pool:      pool,
		Config:    cfg,
		Logger:    logger,
		Guards:    guards,
		Auth:      authService,
		Devices:   deviceService,
		Voice:     voiceService,
		Wellbeing: wellbeingService,
		Support:   supportService,
		Jobs:      jobService,
		lock:      lease,
	}, nil
}

// Run starts the database workers and returns. The HTTP listener is owned by
// cmd/api so tests and other embedders can use App.Handler directly.
func (a *App) Run(ctx context.Context) {
	if a == nil || ctx == nil {
		return
	}
	a.workerMu.Lock()
	if a.closed || a.workerStop != nil {
		a.workerMu.Unlock()
		return
	}
	workerCtx, stop := context.WithCancel(ctx)
	a.workerStop = stop
	a.workers.Add(2)
	a.workerMu.Unlock()
	go func() {
		defer a.workers.Done()
		a.Jobs.Run(workerCtx)
	}()
	go func() {
		defer a.workers.Done()
		a.Support.Run(workerCtx)
	}()
}

// Close stops workers, asks active voice peers to reconnect, and releases the
// dedicated advisory-lock connection. It does not close the caller's pool.
func (a *App) Close(ctx context.Context) error {
	if a == nil {
		return nil
	}
	a.closeOnce.Do(func() {
		closeCtx, cancel := closeContext(ctx)
		defer cancel()
		a.workerMu.Lock()
		a.closed = true
		if a.workerStop != nil {
			a.workerStop()
		}
		a.workerMu.Unlock()
		if a.Voice != nil {
			a.Voice.Shutdown(closeCtx)
		}
		wait := make(chan struct{})
		go func() { a.workers.Wait(); close(wait) }()
		select {
		case <-wait:
		case <-closeCtx.Done():
			if a.closeErr == nil {
				a.closeErr = closeCtx.Err()
			}
		}
		unlockCtx, unlockCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer unlockCancel()
		if err := releaseSingleton(unlockCtx, a.lock); err != nil && a.closeErr == nil {
			a.closeErr = err
		}
	})
	return a.closeErr
}

func closeContext(ctx context.Context) (context.Context, context.CancelFunc) {
	if ctx == nil || ctx.Err() != nil {
		return context.WithTimeout(context.Background(), 10*time.Second)
	}
	return context.WithTimeout(ctx, 10*time.Second)
}

func acquireSingleton(ctx context.Context, pool *pgxpool.Pool) (*singletonLock, error) {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return nil, fmt.Errorf("app: acquire singleton connection: %w", err)
	}
	var key int64
	if err = conn.QueryRow(ctx, `SELECT hashtextextended(current_database() || ':' || current_schema(), 0)`).Scan(&key); err != nil {
		conn.Release()
		return nil, fmt.Errorf("app: derive singleton scope: %w", err)
	}
	var locked bool
	if err = conn.QueryRow(ctx, `SELECT pg_try_advisory_lock($1)`, key).Scan(&locked); err != nil {
		conn.Release()
		return nil, fmt.Errorf("app: acquire singleton lock: %w", err)
	}
	if !locked {
		conn.Release()
		return nil, errors.New("app: another Soba instance already owns this database and schema")
	}
	return &singletonLock{conn: conn, key: key}, nil
}

func releaseSingleton(ctx context.Context, lease *singletonLock) error {
	if lease == nil || lease.conn == nil {
		return nil
	}
	defer lease.conn.Release()
	var unlocked bool
	if err := lease.conn.QueryRow(ctx, `SELECT pg_advisory_unlock($1)`, lease.key).Scan(&unlocked); err != nil {
		return fmt.Errorf("app: release singleton lock: %w", err)
	}
	if !unlocked {
		return errors.New("app: singleton lock was not held")
	}
	return nil
}

func recoverRestartMetadata(ctx context.Context, pool *pgxpool.Pool) error {
	return store.WithTx(ctx, pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `UPDATE conversation_sessions SET state='interrupted',ended_at=COALESCE(ended_at,now()),draft_expires_at=NULL WHERE state='active'`); err != nil {
			return fmt.Errorf("app: interrupt active sessions: %w", err)
		}
		if _, err := tx.Exec(ctx, `UPDATE conversation_sessions SET state='expired',ended_at=COALESCE(ended_at,now()),draft_expires_at=NULL WHERE state='review'`); err != nil {
			return fmt.Errorf("app: expire review sessions: %w", err)
		}
		return nil
	})
}

func handlerRegistry(pool *pgxpool.Pool, cfg platform.Config, authService *auth.Service, deviceService *devices.Service, voiceService *conversation.Service, wellbeingService *wellbeing.Service, supportService *support.Service, jobService *jobs.Service) (map[string]platform.Handler, error) {
	registry := map[string]platform.Handler{}
	add := func(module string, handlers map[string]platform.Handler) error {
		for id, handler := range handlers {
			if handler == nil {
				return fmt.Errorf("app: nil handler %s from %s", id, module)
			}
			if _, exists := registry[id]; exists {
				return fmt.Errorf("app: duplicate handler %s from %s", id, module)
			}
			registry[id] = handler
		}
		return nil
	}
	if err := add("health", map[string]platform.Handler{
		"getLiveness": func(context.Context, *platform.Request) (platform.Result, error) {
			return platform.OK(map[string]any{"status": "ok"}), nil
		},
		"getReadiness": func(ctx context.Context, _ *platform.Request) (platform.Result, error) {
			if err := store.Healthy(ctx, pool); err != nil {
				return platform.Result{}, platform.Unavailable()
			}
			return platform.OK(map[string]any{"status": "ok"}), nil
		},
	}); err != nil {
		return nil, err
	}
	for _, module := range []struct {
		name string
		m    map[string]platform.Handler
	}{
		{"auth", authService.Handlers()},
		{"devices", deviceService.Handlers()},
		{"conversation", voiceService.Handlers()},
		{"wellbeing", wellbeingService.Handlers()},
		{"support", supportService.Handlers()},
		{"jobs", jobService.Handlers()},
	} {
		if err := add(module.name, module.m); err != nil {
			return nil, err
		}
	}
	ids, err := httpapi.RegisteredOperations()
	if err != nil {
		return nil, fmt.Errorf("app: read operation contract: %w", err)
	}
	expected := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if _, exists := expected[id]; exists {
			return nil, fmt.Errorf("app: duplicate contract operation %s", id)
		}
		expected[id] = struct{}{}
		if registry[id] == nil {
			return nil, fmt.Errorf("app: missing handler %s", id)
		}
	}
	if len(registry) != len(expected) {
		for id := range registry {
			if _, exists := expected[id]; !exists {
				return nil, fmt.Errorf("app: handler %s is not in the API contract", id)
			}
		}
	}
	return registry, nil
}

func validateConfig(cfg platform.Config) error {
	if cfg.Env == "" {
		return errors.New("app: APP_ENV is required")
	}
	if cfg.PolicyVersion == "" || cfg.KeyVersion == "" {
		return errors.New("app: policy and data key versions are required")
	}
	for name, key := range map[string][]byte{"DATA_ENCRYPTION_KEY": cfg.DataKey, "CURSOR_HMAC_KEY": cfg.CursorKey, "AUDIT_HMAC_KEY": cfg.AuditKey} {
		if len(key) != 32 {
			return fmt.Errorf("app: %s must contain 32 bytes", name)
		}
	}
	if len(cfg.Origins) == 0 {
		return errors.New("app: at least one allowed web origin is required")
	}
	for _, origin := range cfg.Origins {
		u, err := url.Parse(origin)
		if err != nil || u.Host == "" || u.Path != "" || (u.Scheme != "https" && !(cfg.Env == "development" && u.Scheme == "http")) {
			return fmt.Errorf("app: invalid allowed web origin")
		}
	}
	if cfg.Env != "development" {
		u, err := url.Parse(cfg.PublicURL)
		if err != nil || u.Scheme != "https" || u.Host == "" {
			return errors.New("app: non-development PUBLIC_BASE_URL must use HTTPS")
		}
		if cfg.OIDCIssuer == "" {
			return errors.New("app: OIDC issuer is required outside development")
		}
	}
	if cfg.MaxSessions < 1 || cfg.MaxSessions > 100 {
		return errors.New("app: MAX_ACTIVE_SESSIONS must be between 1 and 100")
	}
	if err := cfg.ValidateVoice(); err != nil {
		return err
	}
	if cfg.AlertsEnabled && cfg.FCMProject == "" {
		return errors.New("app: alerts require FCM_PROJECT_ID")
	}
	return nil
}

func loadReviewedContent(path string, now time.Time) (safety.ReviewedContent, error) {
	if path == "" {
		return safety.ReviewedContent{}, nil
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return safety.ReviewedContent{}, fmt.Errorf("app: read reviewed content pack: %w", err)
	}
	if len(b) == 0 || len(b) > 1<<20 {
		return safety.ReviewedContent{}, errors.New("app: reviewed content pack is empty or too large")
	}
	if err := platform.CheckJSON(b); err != nil {
		return safety.ReviewedContent{}, errors.New("app: reviewed content pack contains invalid JSON")
	}
	decoder := json.NewDecoder(strings.NewReader(string(b)))
	decoder.DisallowUnknownFields()
	var content safety.ReviewedContent
	if err := decoder.Decode(&content); err != nil {
		return safety.ReviewedContent{}, fmt.Errorf("app: invalid reviewed content pack: %w", err)
	}
	var trailing any
	if err := decoder.Decode(&trailing); !errors.Is(err, io.EOF) {
		return safety.ReviewedContent{}, errors.New("app: reviewed content pack has trailing data")
	}
	if err := validateReviewedContent(content, now); err != nil {
		return safety.ReviewedContent{}, err
	}
	return content, nil
}

func validateReviewedContent(content safety.ReviewedContent, now time.Time) error {
	if !content.Approved || strings.TrimSpace(content.Version) == "" || strings.TrimSpace(content.Locale) == "" || content.ReviewExpires.IsZero() || !now.Before(content.ReviewExpires) {
		return errors.New("app: reviewed content is not approved or has expired")
	}
	if content.Locale != "id-ID" && content.Locale != "en-US" {
		return errors.New("app: reviewed content locale is unsupported")
	}
	if strings.TrimSpace(content.GeneralText) == "" || strings.TrimSpace(content.SeriousText) == "" || len([]rune(content.GeneralText)) > 600 || len([]rune(content.SeriousText)) > 600 {
		return errors.New("app: reviewed content fallback text is invalid")
	}
	seen := map[string]struct{}{}
	for _, activity := range content.Activities {
		if strings.TrimSpace(activity.ID) == "" || activity.Locale != content.Locale || activity.Expires.IsZero() || !now.Before(activity.Expires) {
			return errors.New("app: reviewed activity is invalid or expired")
		}
		if _, exists := seen[activity.ID]; exists {
			return errors.New("app: reviewed activity IDs must be unique")
		}
		seen[activity.ID] = struct{}{}
	}
	return nil
}
