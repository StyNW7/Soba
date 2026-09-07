package main

import (
	"encoding/json"
	"testing"
)

func TestContentStepMatchesAPIAndVoice(t *testing.T) {
	allowed := map[string]struct{}{"media.example.org": {}}
	for _, raw := range []string{
		`{"text":"Breathe slowly","duration_seconds":30,"audio_url":null}`,
		`{"text":"Breathe slowly","duration_seconds":0,"audio_url":"https://media.example.org/step.wav"}`,
	} {
		if err := validateStep(json.RawMessage(raw), allowed); err != nil {
			t.Fatal(err)
		}
	}
	for _, raw := range []string{
		`"Legacy text step"`,
		`{"text":"Step","duration_seconds":1}`,
		`{"text":"Step","duration_seconds":null,"audio_url":null}`,
		`{"text":"Step","duration_seconds":1.5,"audio_url":null}`,
		`{"text":"Step","duration_seconds":601,"audio_url":null}`,
		`{"text":"Step","duration_seconds":1,"audio_url":"https://untrusted.example/a"}`,
		`{"text":"Step","duration_seconds":1,"audio_url":"http://media.example.org/a"}`,
		`{"text":"Step","duration_seconds":1,"audio_url":null,"extra":true}`,
	} {
		if err := validateStep(json.RawMessage(raw), allowed); err == nil {
			t.Fatalf("accepted %s", raw)
		}
	}
}
