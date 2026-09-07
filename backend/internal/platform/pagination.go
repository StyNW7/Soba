package platform

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"strconv"
	"strings"
	"time"
)

type Cursor struct {
	Time    time.Time `json:"time"`
	ID      string    `json:"id"`
	Owner   string    `json:"owner"`
	Filter  string    `json:"filter"`
	Expires int64     `json:"expires"`
}

func Page(r *Request, key []byte, filter string) (int, *Cursor, error) {
	n := 20
	if s := r.HTTP.URL.Query().Get("limit"); s != "" {
		v, e := strconv.Atoi(s)
		if e != nil || v < 1 || v > 100 {
			return 0, nil, Invalid("Invalid page size.")
		}
		n = v
	}
	s := r.HTTP.URL.Query().Get("cursor")
	if s == "" {
		return n, nil, nil
	}
	p := strings.Split(s, ".")
	if len(p) != 2 {
		return 0, nil, Invalid("Invalid cursor.")
	}
	b, e := base64.RawURLEncoding.DecodeString(p[0])
	if e != nil {
		return 0, nil, Invalid("Invalid cursor.")
	}
	sig, e := base64.RawURLEncoding.DecodeString(p[1])
	h := hmac.New(sha256.New, key)
	h.Write(b)
	if e != nil || !hmac.Equal(sig, h.Sum(nil)) {
		return 0, nil, Invalid("Invalid cursor.")
	}
	var c Cursor
	if json.Unmarshal(b, &c) != nil || c.Owner != r.Owner() || c.Filter != filter || c.Expires < time.Now().Unix() {
		return 0, nil, Invalid("Invalid cursor.")
	}
	return n, &c, nil
}
func NextCursor(key []byte, owner, filter, id string, t time.Time) string {
	b, _ := json.Marshal(Cursor{t, id, owner, filter, time.Now().Add(24 * time.Hour).Unix()})
	h := hmac.New(sha256.New, key)
	h.Write(b)
	return base64.RawURLEncoding.EncodeToString(b) + "." + base64.RawURLEncoding.EncodeToString(h.Sum(nil))
}
