package platform

import (
	"context"
	"sync"
)

type guardEntry struct {
	ch   chan struct{}
	refs int
}

// Guards serializes owner operations and supports cancellation while waiting.
// Keep one shared instance per service process. Multiple replicas are prohibited.
type Guards struct {
	mu      sync.Mutex
	entries map[string]*guardEntry
}

func (g *Guards) Lock(ctx context.Context, key string) (func(), error) {
	g.mu.Lock()
	if g.entries == nil {
		g.entries = map[string]*guardEntry{}
	}
	e := g.entries[key]
	if e == nil {
		e = &guardEntry{ch: make(chan struct{}, 1)}
		e.ch <- struct{}{}
		g.entries[key] = e
	}
	e.refs++
	g.mu.Unlock()
	release := func() {
		g.mu.Lock()
		e.refs--
		if e.refs == 0 {
			delete(g.entries, key)
		}
		g.mu.Unlock()
	}
	select {
	case <-ctx.Done():
		release()
		return nil, ctx.Err()
	case <-e.ch:
		return func() { e.ch <- struct{}{}; release() }, nil
	}
}
