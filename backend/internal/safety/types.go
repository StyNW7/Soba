// Package safety owns the structured AI contracts and the fail-closed gate
// between model output and spoken audio. It keeps all context in memory for
// the duration of a request and has no persistence or logging hooks.
package safety

import (
	"context"
	"errors"
	"strings"
	"time"
)

var (
	ErrDisabled          = errors.New("safety pipeline disabled")
	ErrNoReviewedContent = errors.New("reviewed safety content is unavailable")
	ErrMalformedOutput   = errors.New("malformed safety output")
	ErrUnavailable       = errors.New("safety provider unavailable")
	ErrInvalidRequest    = errors.New("invalid safety request")
)

type Signal string

const (
	SignalNone               Signal = "none"
	SignalNeedsClarification Signal = "needs_clarification"
	SignalSerious            Signal = "serious"
)

type ReasonCode string

const (
	ReasonNone          ReasonCode = "none"
	ReasonUnclear       ReasonCode = "unclear"
	ReasonHelpRequested ReasonCode = "help_requested"
	ReasonSeriousSignal ReasonCode = "serious_signal"
)

type Style string

const (
	StyleCalm        Style = "calm"
	StyleNeutral     Style = "neutral"
	StyleEncouraging Style = "encouraging"
)

type ActivitySuggestion string

const (
	ActivityNone       ActivitySuggestion = "none"
	ActivityGrounding  ActivitySuggestion = "grounding"
	ActivityBreathing  ActivitySuggestion = "breathing"
	ActivityReflection ActivitySuggestion = "reflection"
)

type Assessment struct {
	Signal          Signal             `json:"signal"`
	ReasonCode      ReasonCode         `json:"reason_code"`
	Style           Style              `json:"style"`
	SuggestActivity ActivitySuggestion `json:"suggest_activity"`
}

type Reply struct {
	Text       string `json:"text"`
	ActivityID string `json:"activity_id"`
}

type ReplyCheckReason string

const (
	CheckAllowed         ReplyCheckReason = "allowed"
	CheckMedicalAdvice   ReplyCheckReason = "medical_advice"
	CheckIdentityClaim   ReplyCheckReason = "identity_claim"
	CheckUnsafeContent   ReplyCheckReason = "unsafe_content"
	CheckPrivacyLeak     ReplyCheckReason = "privacy_leak"
	CheckInvalidResponse ReplyCheckReason = "invalid_response"
)

type ReplyCheck struct {
	Allowed bool             `json:"allowed"`
	Reason  ReplyCheckReason `json:"reason"`
}

type Mood string

const (
	MoodVeryLow  Mood = "very_low"
	MoodLow      Mood = "low"
	MoodNeutral  Mood = "neutral"
	MoodGood     Mood = "good"
	MoodVeryGood Mood = "very_good"
	MoodUnknown  Mood = "unknown"
)

type MemoryCandidate struct {
	Text     string `json:"text"`
	Category string `json:"category"`
}

type Draft struct {
	Mood             Mood              `json:"mood"`
	Topic            string            `json:"topic"`
	Reflection       string            `json:"reflection"`
	Insights         []string          `json:"insights"`
	MemoryCandidates []MemoryCandidate `json:"memory_candidates"`
}

type Message struct {
	Role string
	Text string
}

type MoodCheckIn struct {
	Label      string `json:"label"`
	OccurredAt string `json:"occurred_at"`
}

type Memory struct {
	Text string
}

// ConversationRequest contains the transient input needed to produce one
// spoken reply. Recent is bounded by the pipeline before it reaches a model.
type ConversationRequest struct {
	Locale       string
	Transcript   string
	Recent       []Message
	Personality  string
	ListenFirst  bool
	Policy       string
	MoodCheckIns []MoodCheckIn
	Memories     []Memory
}

type DraftRequest struct {
	Locale     string
	Transcript string
	Recent     []Message
}

type AssessmentRequest struct {
	Locale     string
	Transcript string
	Recent     []Message
}

type ReplyRequest struct {
	Locale       string
	Transcript   string
	Recent       []Message
	Personality  string
	ListenFirst  bool
	Policy       string
	MoodCheckIns []MoodCheckIn
	Memories     []Memory
	Assessment   Assessment
}

type ReplyCheckRequest struct {
	Locale      string
	Transcript  string
	Recent      []Message
	Candidate   Reply
	Personality string
	Policy      string
}

// Model is the only model dependency required by Pipeline. Implementations
// must return structured values that pass the local validators. The pipeline
// still validates them again before selecting a spoken response.
type Model interface {
	Assess(context.Context, AssessmentRequest) (Assessment, error)
	Reply(context.Context, ReplyRequest) (Reply, error)
	Check(context.Context, ReplyCheckRequest) (ReplyCheck, error)
	Draft(context.Context, DraftRequest) (Draft, error)
}

type ReviewedActivity struct {
	ID      string
	Locale  string
	Expires time.Time
}

// ReviewedContent is the only source allowed for generated-output fallbacks.
// The caller must load this from a reviewed content pack. No built-in crisis
// script is supplied by this package.
type ReviewedContent struct {
	Version       string
	Locale        string
	Approved      bool
	ReviewExpires time.Time
	GeneralText   string
	SeriousText   string
	Activities    []ReviewedActivity
}

func (c ReviewedContent) valid(now time.Time) error {
	if !c.Approved || strings.TrimSpace(c.Version) == "" || strings.TrimSpace(c.Locale) == "" || strings.TrimSpace(c.GeneralText) == "" || strings.TrimSpace(c.SeriousText) == "" {
		return ErrNoReviewedContent
	}
	if c.ReviewExpires.IsZero() || !now.Before(c.ReviewExpires) {
		return ErrNoReviewedContent
	}
	if len([]rune(c.GeneralText)) > 600 || len([]rune(c.SeriousText)) > 600 {
		return ErrNoReviewedContent
	}
	return nil
}

func (c ReviewedContent) activity(id string, now time.Time) bool {
	for _, activity := range c.Activities {
		if activity.ID == id && activity.Locale == c.Locale && !activity.Expires.IsZero() && now.Before(activity.Expires) {
			return true
		}
	}
	return false
}

type Route string

const (
	RouteNormal           Route = "normal"
	RouteReviewedFallback Route = "reviewed_fallback"
	RouteSafetyFallback   Route = "reviewed_safety_fallback"
)

type ConversationResult struct {
	Assessment        Assessment
	Reply             Reply
	Text              string
	Route             Route
	Reason            string
	Degraded          bool
	ApprovedForSpeech bool
	ContentVersion    string
}

type PipelineConfig struct {
	Model             Model
	Reviewed          ReviewedContent
	Now               func() time.Time
	AssessmentTimeout time.Duration
	ReplyTimeout      time.Duration
	CheckTimeout      time.Duration
	DraftTimeout      time.Duration
}

type Pipeline struct {
	model             Model
	content           ReviewedContent
	now               func() time.Time
	assessmentTimeout time.Duration
	replyTimeout      time.Duration
	checkTimeout      time.Duration
	draftTimeout      time.Duration
}

func NewPipeline(config PipelineConfig) *Pipeline {
	if config.Now == nil {
		config.Now = time.Now
	}
	if config.AssessmentTimeout == 0 {
		config.AssessmentTimeout = 2 * time.Second
	}
	if config.ReplyTimeout == 0 {
		config.ReplyTimeout = 4 * time.Second
	}
	if config.CheckTimeout == 0 {
		config.CheckTimeout = 2 * time.Second
	}
	if config.DraftTimeout == 0 {
		config.DraftTimeout = 4 * time.Second
	}
	return &Pipeline{
		model:             config.Model,
		content:           config.Reviewed,
		now:               config.Now,
		assessmentTimeout: config.AssessmentTimeout,
		replyTimeout:      config.ReplyTimeout,
		checkTimeout:      config.CheckTimeout,
		draftTimeout:      config.DraftTimeout,
	}
}

// Enabled is false when either credentials-backed model support or reviewed
// fallback content is absent. Optional provider implementations may expose an
// Enabled method; when present its false result also disables the pipeline.
func (p *Pipeline) Enabled() bool {
	if p == nil || p.model == nil || p.content.valid(p.now()) != nil {
		return false
	}
	if provider, ok := p.model.(interface{ Enabled() bool }); ok && !provider.Enabled() {
		return false
	}
	return true
}
