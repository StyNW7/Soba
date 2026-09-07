// Command api runs the Soba HTTP API and its background workers.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/StyNW7/Soba/backend/internal/app"
	"github.com/StyNW7/Soba/backend/internal/platform"
	"github.com/StyNW7/Soba/backend/internal/store"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := platform.LoadConfig()
	if err != nil {
		log.Fatalf("load configuration: %v", err)
	}
	pool, err := store.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer pool.Close()
	if err := store.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrate database: %v", err)
	}
	service, err := app.New(ctx, pool, cfg)
	if err != nil {
		log.Fatalf("assemble application: %v", err)
	}

	server := &http.Server{
		Addr:              cfg.Addr,
		Handler:           service.Handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       15 * time.Second,
		IdleTimeout:       45 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	service.Run(ctx)
	serveErr := make(chan error, 1)
	go func() {
		serveErr <- server.ListenAndServe()
	}()

	var serveFailure error
	select {
	case <-ctx.Done():
	case err := <-serveErr:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("HTTP server stopped: %v", err)
			serveFailure = err
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := service.Close(shutdownCtx); err != nil {
		log.Printf("close application: %v", err)
	}
	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("shutdown HTTP server: %v", err)
		if serveFailure == nil {
			serveFailure = err
		}
	}
	if serveFailure != nil {
		os.Exit(1)
	}
}
