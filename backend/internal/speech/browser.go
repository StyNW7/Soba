package speech

import (
	"context"
	"errors"
	"io"
)

var ErrBrowserSpeech = errors.New("speech is played by the browser")

type BrowserSpeech struct{}

func (BrowserSpeech) Enabled() bool { return true }
func (BrowserSpeech) Synthesize(_ context.Context, r TTSRequest, _ io.Writer) error {
	if !r.Approved {
		return ErrUnapprovedSpeech
	}
	return ErrBrowserSpeech
}
