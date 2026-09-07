package safety

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestReviewedFallbackFitsSpeechLimit(t *testing.T) {
	now := time.Now()
	pack := testReviewedContent(now)
	pack.GeneralText = strings.Repeat("é", 600)
	if err := pack.valid(now); err != nil {
		t.Fatal("600 Unicode characters must fit", err)
	}
	pack.GeneralText += "x"
	if err := pack.valid(now); !errors.Is(err, ErrNoReviewedContent) {
		t.Fatal("oversized fallback must fail before a session starts")
	}
}

func testReviewedContent(now time.Time) ReviewedContent {
	return ReviewedContent{
		Version:       "review-1",
		Locale:        "id",
		Approved:      true,
		ReviewExpires: now.Add(time.Hour),
		GeneralText:   "Mari berhenti sejenak dan tarik napas.",
		SeriousText:   "Kamu tidak sendirian. Hubungi bantuan tepercaya sekarang.",
	}
}

type fakeModel struct {
	assessment Assessment
	assessErr  error
	reply      Reply
	replyErr   error
	check      ReplyCheck
	checkErr   error
	draft      Draft
	draftErr   error
	calls      []string
	block      bool
}

func (f *fakeModel) Enabled() bool { return true }

func (f *fakeModel) Assess(ctx context.Context, _ AssessmentRequest) (Assessment, error) {
	f.calls = append(f.calls, "assess")
	if f.block {
		<-ctx.Done()
		return Assessment{}, ctx.Err()
	}
	return f.assessment, f.assessErr
}

func (f *fakeModel) Reply(context.Context, ReplyRequest) (Reply, error) {
	f.calls = append(f.calls, "reply")
	return f.reply, f.replyErr
}

func (f *fakeModel) Check(context.Context, ReplyCheckRequest) (ReplyCheck, error) {
	f.calls = append(f.calls, "check")
	return f.check, f.checkErr
}

func (f *fakeModel) Draft(context.Context, DraftRequest) (Draft, error) {
	f.calls = append(f.calls, "draft")
	return f.draft, f.draftErr
}

func newTestPipeline(model Model, now time.Time) *Pipeline {
	return NewPipeline(PipelineConfig{Model: model, Reviewed: testReviewedContent(now), Now: func() time.Time { return now }})
}

func TestPipelineSeriousAssessmentBypassesReplyAndCheck(t *testing.T) {
	now := time.Date(2026, 9, 7, 0, 0, 0, 0, time.UTC)
	model := &fakeModel{assessment: Assessment{Signal: SignalSerious, ReasonCode: ReasonSeriousSignal, Style: StyleCalm, SuggestActivity: ActivityNone}}
	pipeline := newTestPipeline(model, now)
	result, err := pipeline.Respond(context.Background(), ConversationRequest{Locale: "id", Transcript: "Aku merasa tidak aman"})
	if err != nil {
		t.Fatalf("Respond() error = %v", err)
	}
	if result.Route != RouteSafetyFallback || result.Text != pipeline.content.SeriousText || !result.ApprovedForSpeech {
		t.Fatalf("result = %+v", result)
	}
	if len(model.calls) != 1 || model.calls[0] != "assess" {
		t.Fatalf("calls = %v, want assessment only", model.calls)
	}
}

func TestPipelineAssessmentFailureUsesSeriousReviewedFallback(t *testing.T) {
	now := time.Now()
	model := &fakeModel{assessErr: errors.New("provider unavailable")}
	result, err := newTestPipeline(model, now).Respond(context.Background(), ConversationRequest{Locale: "id", Transcript: "tolong"})
	if err != nil {
		t.Fatalf("Respond() error = %v", err)
	}
	if result.Route != RouteSafetyFallback || result.Reason != "assessment_unavailable" || result.Text != testReviewedContent(now).SeriousText {
		t.Fatalf("result = %+v", result)
	}
	if len(model.calls) != 1 {
		t.Fatalf("calls = %v, want assessment only", model.calls)
	}
}

func TestPipelineReplyCheckRejectsGeneratedTextBeforeSpeech(t *testing.T) {
	now := time.Now()
	model := &fakeModel{
		assessment: Assessment{Signal: SignalNone, ReasonCode: ReasonNone, Style: StyleNeutral, SuggestActivity: ActivityNone},
		reply:      Reply{Text: "Aku bisa membantu."},
		check:      ReplyCheck{Allowed: false, Reason: CheckUnsafeContent},
	}
	result, err := newTestPipeline(model, now).Respond(context.Background(), ConversationRequest{Locale: "id", Transcript: "Aku sedang cemas"})
	if err != nil {
		t.Fatalf("Respond() error = %v", err)
	}
	if result.Route != RouteReviewedFallback || result.Text != testReviewedContent(now).GeneralText || !result.ApprovedForSpeech {
		t.Fatalf("result = %+v", result)
	}
	if got, want := len(model.calls), 3; got != want {
		t.Fatalf("calls = %v, want assess/reply/check", model.calls)
	}
}

func TestPipelineCancellationStopsWithoutFallbackSpeech(t *testing.T) {
	now := time.Now()
	model := &fakeModel{block: true}
	pipeline := newTestPipeline(model, now)
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	result, err := pipeline.Respond(ctx, ConversationRequest{Locale: "id", Transcript: "halo"})
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("Respond() error = %v, want deadline", err)
	}
	if result.ApprovedForSpeech || result.Text != "" {
		t.Fatalf("cancelled result = %+v", result)
	}
}

func TestPipelineRequiresReviewedContentAndLocale(t *testing.T) {
	model := &fakeModel{assessment: Assessment{Signal: SignalNone, ReasonCode: ReasonNone, Style: StyleNeutral, SuggestActivity: ActivityNone}}
	pipeline := NewPipeline(PipelineConfig{Model: model})
	if pipeline.Enabled() {
		t.Fatal("pipeline enabled without reviewed content")
	}
	if _, err := pipeline.Respond(context.Background(), ConversationRequest{Locale: "id", Transcript: "halo"}); !errors.Is(err, ErrDisabled) {
		t.Fatalf("disabled Respond() error = %v", err)
	}
	result, err := newTestPipeline(model, time.Now()).Respond(context.Background(), ConversationRequest{Locale: "en", Transcript: "hello"})
	if !errors.Is(err, ErrNoReviewedContent) || result.Text != "" {
		t.Fatalf("wrong locale result=%+v err=%v", result, err)
	}
}

func TestPipelineDraftIsStructuredAndNeverGuessedOnProviderError(t *testing.T) {
	now := time.Now()
	model := &fakeModel{draft: Draft{Mood: MoodNeutral, Topic: "work", Reflection: "A short reflection.", Insights: []string{"Rest may help."}, MemoryCandidates: []MemoryCandidate{{Text: "Likes tea", Category: "preference"}}}}
	pipeline := newTestPipeline(model, now)
	draft, err := pipeline.Draft(context.Background(), DraftRequest{Locale: "id", Transcript: "hari kerja"})
	if err != nil || draft.Topic != "work" {
		t.Fatalf("Draft() = %+v, err=%v", draft, err)
	}
	model.draftErr = errors.New("provider failure")
	if _, err := pipeline.Draft(context.Background(), DraftRequest{Locale: "id", Transcript: "hari kerja"}); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("failed Draft() error = %v", err)
	}
}
