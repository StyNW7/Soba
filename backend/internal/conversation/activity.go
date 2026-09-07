package conversation

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/StyNW7/Soba/backend/internal/speech"
	"time"
)

type activityStep struct {
	Text     string `json:"text"`
	Duration int    `json:"duration_seconds"`
}
type activityResult struct {
	response string
	step     int
	last     bool
	err      error
}

// playActivityStep reloads review authority before each step. It never follows
// an audio URL supplied by content or the client.
func (v *VoiceEngine) playActivityStep(ctx context.Context, w *socketWriter, session, turn, item, locale, voice, response string, sequence uint32, index int) (bool, error) {
	var raw []byte
	e := v.Service.Pool.QueryRow(ctx, `SELECT steps FROM content_items WHERE id=$1 AND locale=$2 AND review_status='approved' AND review_expires_at>now() AND kind IN ('grounding','breathing','reflection','activity')`, item, locale).Scan(&raw)
	if e != nil {
		return false, e
	}
	var steps []activityStep
	if json.Unmarshal(raw, &steps) != nil || index < 0 || index >= len(steps) {
		return false, errors.New("invalid activity")
	}
	step := steps[index]
	if e = w.event(ctx, "activity.state", map[string]any{"session_id": session, "item_id": item, "step": index, "state": "playing"}); e != nil {
		return false, e
	}
	if e = w.event(ctx, "response.start", map[string]any{"session_id": session, "turn_id": turn, "response_id": response, "response_sequence": sequence, "sample_rate": 24000, "channels": 1, "encoding": "pcm_s16le"}); e != nil {
		return false, e
	}
	audio := &audioWriter{writer: w, ctx: ctx, response: sequence}
	runes := []rune(step.Text)
	for len(runes) > 0 {
		n := len(runes)
		if n > 600 {
			n = 600
		}
		if e = v.TTS.Synthesize(ctx, speech.TTSRequest{Text: string(runes[:n]), Voice: voice, Locale: locale, Style: "calm", Approved: true}, audio); e != nil {
			return false, e
		}
		runes = runes[n:]
	}
	if e = audio.flush(); e != nil {
		return false, e
	}
	if step.Duration > 0 {
		timer := time.NewTimer(time.Duration(step.Duration) * time.Second)
		defer timer.Stop()
		select {
		case <-ctx.Done():
			return false, ctx.Err()
		case <-timer.C:
		}
	}
	return index == len(steps)-1, nil
}
