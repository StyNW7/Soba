package safety

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/StyNW7/Soba/backend/internal/platform"
	jsonschema "github.com/santhosh-tekuri/jsonschema/v6"
)

type GroqConfig struct {
	APIKey, BaseURL, Model string
	HTTPClient             *http.Client
}

type Groq struct {
	*structuredModel
	config GroqConfig
}

func NewGroq(config GroqConfig) *Groq {
	if config.BaseURL == "" {
		config.BaseURL = "https://api.groq.com/openai/v1"
	}
	if config.Model == "" {
		config.Model = "openai/gpt-oss-120b"
	}
	if config.HTTPClient == nil {
		config.HTTPClient = http.DefaultClient
	}
	o := &Groq{config: config}
	o.structuredModel = &structuredModel{apiKey: config.APIKey, assessmentTimeout: 2 * time.Second, replyTimeout: 4 * time.Second, checkTimeout: 2 * time.Second, draftTimeout: 4 * time.Second, call: o.callStructured}
	return o
}

func (o *Groq) callStructured(ctx context.Context, name, instructions string, input any, maxTokens int, schema json.RawMessage, out any) error {
	raw, err := json.Marshal(input)
	if err != nil {
		return ErrInvalidRequest
	}
	raw, err = boundedInput(raw, 8000-1024-len(instructions)-len(schema))
	if err != nil {
		return err
	}
	payload := map[string]any{
		"model": o.config.Model,
		"messages": []map[string]string{
			{"role": "system", "content": instructions + " Return only a JSON object conforming to this schema: " + string(schema)},
			{"role": "user", "content": string(raw)},
		},
		"response_format":       map[string]any{"type": "json_schema", "json_schema": map[string]any{"name": name, "strict": true, "schema": schema}},
		"reasoning_effort":      "low",
		"max_completion_tokens": maxTokens,
		"stream":                false,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return ErrInvalidRequest
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(o.config.BaseURL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return ErrUnavailable
	}
	req.Header.Set("Authorization", "Bearer "+o.config.APIKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := o.config.HTTPClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		return ErrUnavailable
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("%w: Groq status %d", ErrUnavailable, resp.StatusCode)
	}
	raw, err = io.ReadAll(io.LimitReader(resp.Body, (2<<20)+1))
	if err != nil || len(raw) > 2<<20 {
		return ErrMalformedOutput
	}
	var envelope struct {
		Error   json.RawMessage `json:"error"`
		Choices []struct {
			FinishReason string `json:"finish_reason"`
			Message      struct {
				Content string `json:"content"`
				Refusal string `json:"refusal"`
			} `json:"message"`
		} `json:"choices"`
	}
	if json.Unmarshal(raw, &envelope) != nil || (len(envelope.Error) > 0 && string(envelope.Error) != "null") || len(envelope.Choices) != 1 {
		return ErrMalformedOutput
	}
	choice := envelope.Choices[0]
	if choice.FinishReason != "stop" || choice.Message.Refusal != "" || platform.CheckJSON([]byte(choice.Message.Content)) != nil {
		return ErrMalformedOutput
	}
	var document, value any
	if json.Unmarshal(schema, &document) != nil || json.Unmarshal([]byte(choice.Message.Content), &value) != nil {
		return ErrMalformedOutput
	}
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	if compiler.AddResource("urn:soba:groq:"+name, document) != nil {
		return ErrInvalidRequest
	}
	validator, err := compiler.Compile("urn:soba:groq:" + name)
	if err != nil {
		return ErrInvalidRequest
	}
	if validator.Validate(value) != nil || decodeStrictJSON(choice.Message.Content, out) != nil {
		return ErrMalformedOutput
	}
	return nil
}
