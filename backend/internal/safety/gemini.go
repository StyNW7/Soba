package safety

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type GeminiConfig struct {
	APIKey, BaseURL, Model string
	HTTPClient             *http.Client
}

type Gemini struct {
	*structuredModel
	config GeminiConfig
}

func NewGemini(config GeminiConfig) *Gemini {
	if config.BaseURL == "" {
		config.BaseURL = "https://generativelanguage.googleapis.com/v1beta"
	}
	if config.Model == "" {
		config.Model = "gemini-2.5-flash-lite"
	}
	if config.HTTPClient == nil {
		config.HTTPClient = http.DefaultClient
	}
	g := &Gemini{config: config}
	g.structuredModel = &structuredModel{apiKey: config.APIKey, assessmentTimeout: 2 * time.Second, replyTimeout: 4 * time.Second, checkTimeout: 2 * time.Second, draftTimeout: 4 * time.Second, call: g.callStructured}
	return g
}

func (g *Gemini) callStructured(ctx context.Context, name, instructions string, input any, maxTokens int, schema json.RawMessage, out any) error {
	raw, err := json.Marshal(input)
	if err != nil {
		return ErrInvalidRequest
	}
	raw, err = boundedInput(raw, 8000-1024-len(instructions)-len(schema))
	if err != nil {
		return err
	}
	payload := map[string]any{
		"systemInstruction": map[string]any{"parts": []any{map[string]string{"text": instructions}}},
		"contents":          []any{map[string]any{"role": "user", "parts": []any{map[string]string{"text": string(raw)}}}},
		"generationConfig":  map[string]any{"responseMimeType": "application/json", "responseJsonSchema": schema, "maxOutputTokens": maxTokens, "thinkingConfig": map[string]int{"thinkingBudget": 0}},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return ErrInvalidRequest
	}
	endpoint := strings.TrimRight(g.config.BaseURL, "/") + "/models/" + url.PathEscape(g.config.Model) + ":generateContent"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return ErrUnavailable
	}
	req.Header.Set("x-goog-api-key", g.config.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := g.config.HTTPClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return ErrUnavailable
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: Gemini status %d", ErrUnavailable, resp.StatusCode)
	}
	raw, err = io.ReadAll(io.LimitReader(resp.Body, (2<<20)+1))
	if err != nil || len(raw) > 2<<20 {
		return ErrMalformedOutput
	}
	var envelope struct {
		Candidates []struct {
			FinishReason string `json:"finishReason"`
			Content      struct {
				Parts []struct {
					Text    string `json:"text"`
					Thought bool   `json:"thought"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if json.Unmarshal(raw, &envelope) != nil || len(envelope.Candidates) != 1 || envelope.Candidates[0].FinishReason != "STOP" {
		return ErrMalformedOutput
	}
	var result strings.Builder
	for _, part := range envelope.Candidates[0].Content.Parts {
		if !part.Thought {
			result.WriteString(part.Text)
		}
	}
	if decodeStrictJSON(result.String(), out) != nil {
		return ErrMalformedOutput
	}
	return nil
}
