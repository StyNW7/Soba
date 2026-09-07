// Command migrate applies the embedded Soba PostgreSQL migrations.
package main

import (
	"context"
	"errors"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/StyNW7/Soba/backend/internal/store"
)

func main() {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := store.Open(ctx, databaseURL)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer pool.Close()

	if err := store.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate database: %v", err)
	}
	if err := store.Healthy(ctx, pool); err != nil {
		if errors.Is(err, context.Canceled) {
			log.Print("migration cancelled")
			return
		}
		log.Fatalf("check database health: %v", err)
	}
	log.Print("database migrations applied")
}
