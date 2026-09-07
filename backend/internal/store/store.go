// Package store contains the PostgreSQL connection and migration primitives
// used by the Soba backend.
package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	defaultMaxConnections int32         = 20
	defaultMinConnections int32         = 5
	defaultConnLifetime   time.Duration = 30 * time.Minute
	defaultStatementLimit time.Duration = 5 * time.Second
)

// Open parses databaseURL, creates a bounded PostgreSQL pool, and waits for a
// connection to pass a health check. The caller owns the returned pool and
// must call Close when the service stops.
func Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	if ctx == nil {
		return nil, errors.New("store: nil context")
	}
	if databaseURL == "" {
		return nil, errors.New("store: database URL is empty")
	}

	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, errors.New("store: invalid database connection configuration")
	}

	// These values are the pilot defaults from Operations-Spec.md. Keep the
	// pool conservative until service load measurements justify a change.
	config.MaxConns = defaultMaxConnections
	config.MinConns = defaultMinConnections
	config.MinIdleConns = defaultMinConnections
	config.MaxConnLifetime = defaultConnLifetime
	if config.ConnConfig.RuntimeParams == nil {
		config.ConnConfig.RuntimeParams = make(map[string]string)
	}
	config.ConnConfig.RuntimeParams["statement_timeout"] = fmt.Sprintf("%d", defaultStatementLimit/time.Millisecond)

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, errors.New("store: cannot create database pool")
	}
	if err := Healthy(ctx, pool); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

// Healthy checks that pool can reach PostgreSQL. It is suitable for a
// readiness endpoint and does not change database state.
func Healthy(ctx context.Context, pool *pgxpool.Pool) error {
	if ctx == nil {
		return errors.New("store: nil context")
	}
	if pool == nil {
		return errors.New("store: nil pool")
	}
	if err := pool.Ping(ctx); err != nil {
		return errors.New("store: database health check failed")
	}
	return nil
}

// WithTx runs fn in a database transaction. A callback error rolls the
// transaction back; a successful callback is committed. Rollback errors are
// intentionally ignored after the original callback error because the latter
// is the useful failure for the caller.
func WithTx(ctx context.Context, pool *pgxpool.Pool, fn func(pgx.Tx) error) error {
	if ctx == nil {
		return errors.New("store: nil context")
	}
	if pool == nil {
		return errors.New("store: nil pool")
	}
	if fn == nil {
		return errors.New("store: nil transaction callback")
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("store: begin transaction: %w", err)
	}

	if err := fn(tx); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("store: commit transaction: %w", err)
	}
	return nil
}
