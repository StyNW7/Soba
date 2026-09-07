package app

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/StyNW7/Soba/backend/internal/auth"
	"github.com/StyNW7/Soba/backend/internal/conversation"
	"github.com/StyNW7/Soba/backend/internal/devices"
	"github.com/StyNW7/Soba/backend/internal/httpapi"
	"github.com/StyNW7/Soba/backend/internal/jobs"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/support"
	"github.com/StyNW7/Soba/backend/internal/testutil"
	"github.com/StyNW7/Soba/backend/internal/wellbeing"
)

func testConfig() platform.Config {
	return platform.Config{
		Env: "development", PolicyVersion: "pilot-v1", KeyVersion: "1",
		Origins: []string{"http://localhost:5173"}, MaxSessions: 10,
		DataKey: []byte(strings.Repeat("d", 32)), CursorKey: []byte(strings.Repeat("c", 32)), AuditKey: []byte(strings.Repeat("a", 32)),
	}
}

func TestHandlerRegistryIsExactAndComplete(t *testing.T) {
	cfg := testConfig()
	guards := &platform.Guards{}
	voice := &conversation.Service{Config: cfg, Guards: guards}
	authService := auth.NewService(nil, cfg, nil)
	devicesService := &devices.Service{Config: cfg, Guards: guards}
	wellbeingService := &wellbeing.Service{Config: cfg}
	supportService := &support.Service{Config: cfg, Guards: guards}
	jobsService := &jobs.Service{Config: cfg, Guards: guards}
	registry, err := handlerRegistry(nil, cfg, authService, devicesService, voice, wellbeingService, supportService, jobsService)
	if err != nil {
		t.Fatal(err)
	}
	operations, err := httpapi.RegisteredOperations()
	if err != nil {
		t.Fatal(err)
	}
	if len(operations) != 87 || len(registry) != 87 {
		t.Fatalf("operations=%d handlers=%d", len(operations), len(registry))
	}
	for _, id := range operations {
		if registry[id] == nil {
			t.Fatalf("missing handler %s", id)
		}
	}
}

func TestDefaultProvidersAreDisabled(t *testing.T) {
	cfg := testConfig()
	if cfg.VoiceEnabled || cfg.AlertsEnabled || cfg.ProviderDeletionRequired {
		t.Fatal("development test configuration must disable external paths")
	}
	if err := validateConfig(cfg); err != nil {
		t.Fatal(err)
	}
}

func TestUnsafeVoiceConfigurationFailsStartupValidation(t *testing.T) {
	cfg := testConfig()
	cfg.VoiceEnabled = true
	if err := validateConfig(cfg); err == nil {
		t.Fatal("voice without provider credentials or reviewed content must fail")
	}
}

func TestReviewedContentMustBeApprovedAndCurrent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "content.json")
	expired := time.Now().UTC().Add(-time.Minute).Format(time.RFC3339)
	content := `{"Version":"pilot-v1","Locale":"id-ID","Approved":true,"ReviewExpires":"` + expired + `","GeneralText":"Reviewed","SeriousText":"Reviewed serious","Activities":[]}`
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := loadReviewedContent(path, time.Now().UTC()); err == nil {
		t.Fatal("expired reviewed content was accepted")
	}
	if _, err := loadReviewedContent(filepath.Join(t.TempDir(), "missing.json"), time.Now().UTC()); err == nil {
		t.Fatal("missing reviewed content was accepted")
	}
}

func TestNewUsesSingletonAndBuildsDisabledApplication(t *testing.T) {
	p := testutil.Database(t)
	cfg := testutil.Config()
	cfg.ObjectDirectory = t.TempDir()
	a, err := New(context.Background(), p, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if a.Handler == nil || a.Voice.Voice != nil {
		t.Fatal("voice must be disabled by the test configuration")
	}
	w := httptest.NewRecorder()
	a.Handler.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/health/live", nil))
	if w.Code != http.StatusOK || w.Body.String() != `{"status":"ok"}
` {
		t.Fatalf("liveness status=%d body=%q", w.Code, w.Body.String())
	}
	if _, err := New(context.Background(), p, cfg); err == nil {
		t.Fatal("second application accepted the singleton lock")
	}
	if err := a.Close(context.Background()); err != nil {
		t.Fatal(err)
	}
	second, err := New(context.Background(), p, cfg)
	if err != nil {
		t.Fatal("singleton lock was not released: ", err)
	}
	if err := second.Close(context.Background()); err != nil {
		t.Fatal(err)
	}
}
