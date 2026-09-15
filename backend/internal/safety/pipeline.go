package safety

import (
	"context"
	"strings"
	"time"
	"unicode/utf8"
)

func (p *Pipeline) Respond(ctx context.Context, request ConversationRequest) (ConversationResult, error) {
	if !p.Enabled() {
		return ConversationResult{}, ErrDisabled
	}
	if err := validateConversationRequest(request); err != nil {
		return ConversationResult{}, err
	}
	if !localeMatches(request.Locale, p.content.Locale) {
		return ConversationResult{}, ErrNoReviewedContent
	}
	now := p.now()
	assessmentRequest := AssessmentRequest{
		Locale: request.Locale, Transcript: request.Transcript, Recent: boundMessages(request.Recent, 12),
	}
	assessmentCtx, cancel := boundedContext(ctx, p.assessmentTimeout)
	assessment, err := p.model.Assess(assessmentCtx, assessmentRequest)
	cancel()
	if err != nil || validateAssessment(assessment) != nil {
		if parentCanceled(ctx) {
			return ConversationResult{}, ctx.Err()
		}
		return p.reviewedResult(RouteSafetyFallback, "assessment_unavailable", now), nil
	}
	if assessment.Signal == SignalSerious {
		return p.reviewedResult(RouteSafetyFallback, "serious_signal", now), nil
	}

	replyRequest := ReplyRequest{
		Locale: request.Locale, Transcript: request.Transcript, Recent: boundMessages(request.Recent, 12), Personality: truncateRunes(request.Personality, 2000), ListenFirst: request.ListenFirst, Policy: request.Policy, MoodCheckIns: request.MoodCheckIns, Memories: boundMemories(request.Memories, 10), Assessment: assessment,
	}
	replyCtx, cancel := boundedContext(ctx, p.replyTimeout)
	candidate, err := p.model.Reply(replyCtx, replyRequest)
	cancel()
	if err != nil || validateReply(candidate) != nil || (candidate.ActivityID != "" && !p.content.activity(candidate.ActivityID, now)) {
		if parentCanceled(ctx) {
			return ConversationResult{}, ctx.Err()
		}
		return p.reviewedResultWithAssessment(RouteReviewedFallback, assessment, "reply_unavailable", now), nil
	}

	checkRequest := ReplyCheckRequest{Locale: request.Locale, Transcript: request.Transcript, Recent: boundMessages(request.Recent, 12), Candidate: candidate, Personality: truncateRunes(request.Personality, 2000), Policy: request.Policy}
	checkCtx, cancel := boundedContext(ctx, p.checkTimeout)
	check, err := p.model.Check(checkCtx, checkRequest)
	cancel()
	if err != nil || validateReplyCheck(check) != nil || !check.Allowed {
		if parentCanceled(ctx) {
			return ConversationResult{}, ctx.Err()
		}
		return p.reviewedResultWithAssessment(RouteReviewedFallback, assessment, "reply_rejected", now), nil
	}
	if p.content.valid(p.now()) != nil {
		return ConversationResult{}, ErrNoReviewedContent
	}
	return ConversationResult{Assessment: assessment, Reply: candidate, Text: candidate.Text, Route: RouteNormal, ApprovedForSpeech: true, ContentVersion: p.content.Version}, nil
}

func (p *Pipeline) Draft(ctx context.Context, request DraftRequest) (Draft, error) {
	if !p.Enabled() {
		return Draft{}, ErrDisabled
	}
	if err := validateDraftRequest(request); err != nil {
		return Draft{}, err
	}
	if !localeMatches(request.Locale, p.content.Locale) {
		return Draft{}, ErrNoReviewedContent
	}
	draftCtx, cancel := boundedContext(ctx, p.draftTimeout)
	draft, err := p.model.Draft(draftCtx, DraftRequest{Locale: request.Locale, Transcript: request.Transcript, Recent: boundMessages(request.Recent, 12)})
	cancel()
	if err != nil {
		if parentCanceled(ctx) {
			return Draft{}, ctx.Err()
		}
		return Draft{}, ErrUnavailable
	}
	if err := validateDraft(draft); err != nil {
		return Draft{}, ErrUnavailable
	}
	return draft, nil
}

func (p *Pipeline) reviewedResult(route Route, reason string, now time.Time) ConversationResult {
	assessment := Assessment{Signal: SignalSerious, ReasonCode: ReasonSeriousSignal, Style: StyleCalm, SuggestActivity: ActivityNone}
	if reason == "assessment_unavailable" {
		assessment.Signal = SignalNeedsClarification
		assessment.ReasonCode = ReasonUnclear
	}
	return p.reviewedResultWithAssessment(route, assessment, reason, now)
}

func (p *Pipeline) reviewedResultWithAssessment(route Route, assessment Assessment, reason string, now time.Time) ConversationResult {
	if p.content.valid(p.now()) != nil {
		return ConversationResult{Reason: "review_expired", ApprovedForSpeech: false}
	}
	text := p.content.GeneralText
	if route == RouteSafetyFallback {
		text = p.content.SeriousText
	}
	return ConversationResult{Assessment: assessment, Reply: Reply{Text: text}, Text: text, Route: route, Reason: reason, Degraded: route != RouteSafetyFallback || reason != "serious_signal", ApprovedForSpeech: true, ContentVersion: p.content.Version}
}

func validateConversationRequest(request ConversationRequest) error {
	if err := validateAssessmentRequest(AssessmentRequest{Locale: request.Locale, Transcript: request.Transcript, Recent: request.Recent}); err != nil {
		return err
	}
	if strings.TrimSpace(request.Locale) == "" || !utf8.ValidString(request.Locale) || len(request.Locale) > 32 {
		return ErrInvalidRequest
	}
	return nil
}

func parentCanceled(ctx context.Context) bool {
	return ctx != nil && ctx.Err() != nil
}

func localeMatches(requested, reviewed string) bool {
	requested = strings.ToLower(strings.TrimSpace(requested))
	reviewed = strings.ToLower(strings.TrimSpace(reviewed))
	if requested == "" || reviewed == "" {
		return false
	}
	requested = strings.Split(requested, "-")[0]
	reviewed = strings.Split(reviewed, "-")[0]
	return requested == reviewed
}
