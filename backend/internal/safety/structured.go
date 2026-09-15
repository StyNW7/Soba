package safety

import (
	"context"
	"encoding/json"
	"strings"
	"time"
)

type structuredModel struct {
	apiKey                                                      string
	assessmentTimeout, replyTimeout, checkTimeout, draftTimeout time.Duration
	call                                                        func(context.Context, string, string, any, int, json.RawMessage, any) error
}

func (o *structuredModel) Enabled() bool {
	return o != nil && strings.TrimSpace(o.apiKey) != ""
}

func (o *structuredModel) Assess(ctx context.Context, request AssessmentRequest) (Assessment, error) {
	if o == nil || !o.Enabled() {
		return Assessment{}, ErrDisabled
	}
	if err := validateAssessmentRequest(request); err != nil {
		return Assessment{}, err
	}
	ctx, cancel := boundedContext(ctx, o.assessmentTimeout)
	defer cancel()
	input := struct {
		Locale     string    `json:"locale"`
		Transcript string    `json:"transcript"`
		Recent     []Message `json:"recent_turns"`
	}{request.Locale, request.Transcript, boundMessages(request.Recent, 12)}
	var assessment Assessment
	if err := o.call(ctx, "assessment", assessmentInstructions, input, 800, assessmentSchema, &assessment); err != nil {
		return Assessment{}, err
	}
	if err := validateAssessment(assessment); err != nil {
		return Assessment{}, err
	}
	return assessment, nil
}

func (o *structuredModel) Reply(ctx context.Context, request ReplyRequest) (Reply, error) {
	if o == nil || !o.Enabled() {
		return Reply{}, ErrDisabled
	}
	if err := validateReplyRequest(request); err != nil {
		return Reply{}, err
	}
	ctx, cancel := boundedContext(ctx, o.replyTimeout)
	defer cancel()
	input := struct {
		Locale       string        `json:"locale"`
		Transcript   string        `json:"transcript"`
		Recent       []Message     `json:"recent_turns"`
		Personality  string        `json:"personality"`
		ListenFirst  bool          `json:"listen_first"`
		Policy       string        `json:"policy"`
		Memories     []Memory      `json:"approved_memories"`
		MoodCheckIns []MoodCheckIn `json:"recent_self_reported_moods,omitempty"`
		Assessment   Assessment    `json:"assessment"`
	}{request.Locale, request.Transcript, boundMessages(request.Recent, 12), request.Personality, request.ListenFirst, request.Policy, boundMemories(request.Memories, 10), request.MoodCheckIns, request.Assessment}
	var reply Reply
	if err := o.call(ctx, "reply", replyInstructions, input, 800, replySchema, &reply); err != nil {
		return Reply{}, err
	}
	if err := validateReply(reply); err != nil {
		return Reply{}, err
	}
	return reply, nil
}

func (o *structuredModel) Check(ctx context.Context, request ReplyCheckRequest) (ReplyCheck, error) {
	if o == nil || !o.Enabled() {
		return ReplyCheck{}, ErrDisabled
	}
	if err := validateReplyCheckRequest(request); err != nil {
		return ReplyCheck{}, err
	}
	ctx, cancel := boundedContext(ctx, o.checkTimeout)
	defer cancel()
	input := struct {
		Locale      string    `json:"locale"`
		Transcript  string    `json:"transcript"`
		Recent      []Message `json:"recent_turns"`
		Candidate   Reply     `json:"candidate"`
		Personality string    `json:"personality"`
		Policy      string    `json:"policy"`
	}{request.Locale, request.Transcript, boundMessages(request.Recent, 12), request.Candidate, request.Personality, request.Policy}
	var check ReplyCheck
	if err := o.call(ctx, "reply_check", checkInstructions, input, 800, replyCheckSchema, &check); err != nil {
		return ReplyCheck{}, err
	}
	if err := validateReplyCheck(check); err != nil {
		return ReplyCheck{}, err
	}
	return check, nil
}

func (o *structuredModel) Draft(ctx context.Context, request DraftRequest) (Draft, error) {
	if o == nil || !o.Enabled() {
		return Draft{}, ErrDisabled
	}
	if err := validateDraftRequest(request); err != nil {
		return Draft{}, err
	}
	ctx, cancel := boundedContext(ctx, o.draftTimeout)
	defer cancel()
	input := struct {
		Locale     string    `json:"locale"`
		Transcript string    `json:"transcript"`
		Recent     []Message `json:"recent_turns"`
	}{request.Locale, request.Transcript, boundMessages(request.Recent, 12)}
	var draft Draft
	if err := o.call(ctx, "draft", draftInstructions, input, 2000, draftSchema, &draft); err != nil {
		return Draft{}, err
	}
	if err := validateDraft(draft); err != nil {
		return Draft{}, err
	}
	return draft, nil
}
