package platform

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
)

// CheckJSON rejects duplicate keys, excessive depth, and trailing values.
func CheckJSON(b []byte) error {
	d := json.NewDecoder(bytes.NewReader(b))
	var walk func(int) error
	walk = func(depth int) error {
		if depth > 32 {
			return errors.New("too deep")
		}
		t, e := d.Token()
		if e != nil {
			return e
		}
		switch t {
		case json.Delim('{'):
			seen := map[string]bool{}
			for d.More() {
				k, e := d.Token()
				if e != nil {
					return e
				}
				s, ok := k.(string)
				if !ok || seen[s] {
					return errors.New("duplicate")
				}
				seen[s] = true
				if e = walk(depth + 1); e != nil {
					return e
				}
			}
			_, e = d.Token()
			return e
		case json.Delim('['):
			for d.More() {
				if e = walk(depth + 1); e != nil {
					return e
				}
			}
			_, e = d.Token()
			return e
		}
		return nil
	}
	if e := walk(0); e != nil {
		return e
	}
	if _, e := d.Token(); e != io.EOF {
		return errors.New("trailing value")
	}
	return nil
}
