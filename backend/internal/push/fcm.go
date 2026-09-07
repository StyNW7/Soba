// Package push implements the fixed, content-free support notification.
package push

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

type Outcome struct {
	Accepted     bool
	Permanent    bool
	InvalidToken bool
	MessageID    string
	Code         string
}
type Sender interface {
	Send(context.Context, string, string, time.Time) (Outcome, error)
}
type FCM struct {
	Project  string
	Client   *http.Client
	Endpoint string
}

func NewFCM(ctx context.Context, project string) (*FCM, error) {
	source, e := google.DefaultTokenSource(ctx, "https://www.googleapis.com/auth/firebase.messaging")
	if e != nil {
		return nil, fmt.Errorf("FCM credentials are unavailable")
	}
	return &FCM{Project: project, Client: oauth2.NewClient(ctx, source)}, nil
}
func (f *FCM) Send(ctx context.Context, token, requestID string, expires time.Time) (Outcome, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if _, e := uuid.Parse(requestID); e != nil || token == "" || f.Project == "" {
		return Outcome{Permanent: true, Code: "invalid_request"}, fmt.Errorf("invalid push request")
	}
	ttl := int(time.Until(expires).Seconds())
	if ttl <= 0 {
		return Outcome{Permanent: true, Code: "expired"}, nil
	}
	if ttl > 900 {
		ttl = 900
	}
	payload := map[string]any{"message": map[string]any{"token": token, "notification": map[string]any{"title": "SOBA", "body": "You have a support request."}, "data": map[string]string{"request_id": requestID, "route": "/guardian/alerts"}, "android": map[string]any{"ttl": strconv.Itoa(ttl) + "s"}, "apns": map[string]any{"headers": map[string]string{"apns-expiration": strconv.FormatInt(time.Now().Add(time.Duration(ttl)*time.Second).Unix(), 10)}}}}
	b, e := json.Marshal(payload)
	if e != nil {
		return Outcome{}, e
	}
	base := f.Endpoint
	if base == "" {
		base = "https://fcm.googleapis.com"
	}
	r, e := http.NewRequestWithContext(ctx, "POST", base+"/v1/projects/"+url.PathEscape(f.Project)+"/messages:send", bytes.NewReader(b))
	if e != nil {
		return Outcome{}, e
	}
	r.Header.Set("Content-Type", "application/json")
	client := f.Client
	if client == nil {
		client = http.DefaultClient
	}
	res, e := client.Do(r)
	if e != nil {
		return Outcome{Code: "network_error"}, fmt.Errorf("push provider request failed")
	}
	defer res.Body.Close()
	body, e := io.ReadAll(io.LimitReader(res.Body, 65537))
	if e != nil || len(body) > 65536 {
		return Outcome{Code: "invalid_response"}, fmt.Errorf("push provider response is invalid")
	}
	if res.StatusCode >= 200 && res.StatusCode < 300 {
		var v struct {
			Name string `json:"name"`
		}
		if json.Unmarshal(body, &v) != nil || v.Name == "" || len(v.Name) > 500 {
			return Outcome{Code: "invalid_response"}, fmt.Errorf("push provider response is invalid")
		}
		return Outcome{Accepted: true, MessageID: v.Name, Code: "accepted"}, nil
	}
	var v struct {
		Error struct {
			Details []struct {
				ErrorCode string `json:"errorCode"`
			} `json:"details"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &v)
	for _, d := range v.Error.Details {
		if d.ErrorCode == "UNREGISTERED" {
			return Outcome{Permanent: true, InvalidToken: true, Code: "invalid_token"}, nil
		}
	}
	if res.StatusCode == 429 || res.StatusCode >= 500 {
		return Outcome{Code: "provider_unavailable"}, nil
	}
	return Outcome{Permanent: true, Code: "provider_rejected"}, nil
}
