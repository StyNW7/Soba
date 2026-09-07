package httpapi

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/google/uuid"
	schema "github.com/santhosh-tekuri/jsonschema/v6"
)

//go:embed contract.json
var contractJSON []byte

type parameter struct {
	Name, In string
	Required bool
	Schema   map[string]any
}
type operation struct {
	Path, Method, ID string
	Security         []map[string]any
	Parameters       []parameter
	Request          map[string]any
	Responses        map[string]map[string]any
	bodySchema       *schema.Schema
	paramSchemas     []*schema.Schema
	responseSchemas  map[int]*schema.Schema
}

func contracts() ([]operation, error) {
	var doc map[string]any
	if err := json.Unmarshal(contractJSON, &doc); err != nil {
		return nil, err
	}
	var parsed struct{ Operations []operation }
	if err := json.Unmarshal(contractJSON, &parsed); err != nil {
		return nil, err
	}
	c := schema.NewCompiler()
	c.AssertFormat()
	if err := c.AddResource("https://soba.invalid/contract", doc); err != nil {
		return nil, err
	}
	for i := range parsed.Operations {
		o := &parsed.Operations[i]
		var err error
		if o.Request != nil {
			o.bodySchema, err = c.Compile(fmt.Sprintf("https://soba.invalid/contract#/operations/%d/request", i))
			if err != nil {
				return nil, err
			}
		}
		for j := range o.Parameters {
			s, e := c.Compile(fmt.Sprintf("https://soba.invalid/contract#/operations/%d/parameters/%d/schema", i, j))
			if e != nil {
				return nil, e
			}
			o.paramSchemas = append(o.paramSchemas, s)
		}
		o.responseSchemas = map[int]*schema.Schema{}
		for code, s := range o.Responses {
			if s == nil {
				continue
			}
			n, _ := strconv.Atoi(code)
			v, e := c.Compile(fmt.Sprintf("https://soba.invalid/contract#/operations/%d/responses/%s", i, code))
			if e != nil {
				return nil, e
			}
			o.responseSchemas[n] = v
		}
	}
	return parsed.Operations, nil
}
func (o operation) validate(r *http.Request) (map[string]any, error) {
	known := map[string]bool{}
	for i, p := range o.Parameters {
		var v string
		switch p.In {
		case "query":
			known[p.Name] = true
			vs := r.URL.Query()[p.Name]
			if len(vs) > 1 {
				return nil, platform.Invalid("Duplicate query parameter.")
			}
			v = r.URL.Query().Get(p.Name)
		case "header":
			if len(r.Header.Values(p.Name)) > 1 {
				return nil, platform.Invalid("Duplicate header.")
			}
			v = r.Header.Get(p.Name)
		case "path":
			v = r.PathValue(p.Name)
		}
		if v == "" {
			if p.Required {
				return nil, platform.Invalid("A required parameter is missing.")
			}
			continue
		}
		var value any = v
		if p.Schema["type"] == "integer" {
			n, e := strconv.Atoi(v)
			if e != nil {
				return nil, platform.Invalid("Invalid numeric parameter.")
			}
			value = n
		}
		if o.paramSchemas[i].Validate(value) != nil {
			return nil, platform.Invalid("Invalid request parameter.")
		}
		if p.Schema["format"] == "uuid" {
			u, e := uuid.Parse(v)
			if e != nil || u.String() != v {
				return nil, platform.Invalid("Invalid UUID.")
			}
		}
	}
	for k := range r.URL.Query() {
		if !known[k] {
			return nil, platform.Invalid("Unknown query parameter.")
		}
	}
	if o.bodySchema == nil {
		if r.Body != nil && r.ContentLength != 0 {
			b, e := io.ReadAll(io.LimitReader(r.Body, 2))
			if e != nil || len(b) > 0 {
				return nil, platform.Invalid("This request has no body.")
			}
		}
		return map[string]any{}, nil
	}
	if strings.Split(r.Header.Get("Content-Type"), ";")[0] != "application/json" {
		return nil, platform.Invalid("Use application/json.")
	}
	b, e := io.ReadAll(io.LimitReader(r.Body, 65537))
	if e != nil || len(b) > 65536 || !utf8.Valid(b) {
		return nil, platform.Invalid("Invalid request body.")
	}
	if e = uniqueJSON(b); e != nil {
		return nil, platform.Invalid("Invalid JSON or duplicate field.")
	}
	var v map[string]any
	if json.Unmarshal(b, &v) != nil || o.bodySchema.Validate(v) != nil || !canonicalIDs(v) {
		return nil, platform.Invalid("The request does not match the API contract.")
	}
	return v, nil
}
func uniqueJSON(b []byte) error { return platform.CheckJSON(b) }

func canonicalIDs(m map[string]any) bool {
	for k, v := range m {
		if k == "id" || strings.HasSuffix(k, "_id") {
			if text, ok := v.(string); ok {
				u, e := uuid.Parse(text)
				if e != nil || u.String() != text {
					return false
				}
			}
		}
		if strings.HasSuffix(k, "_ids") {
			if values, ok := v.([]any); ok {
				for _, value := range values {
					text, ok := value.(string)
					if !ok {
						return false
					}
					u, e := uuid.Parse(text)
					if e != nil || u.String() != text {
						return false
					}
				}
			}
		}
	}
	return true
}
