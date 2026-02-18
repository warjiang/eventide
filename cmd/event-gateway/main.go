package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/warjiang/eventide/internal/config"
	"github.com/warjiang/eventide/internal/eventproto"
	"github.com/warjiang/eventide/internal/httpx"
	"github.com/warjiang/eventide/internal/logx"
	"github.com/warjiang/eventide/internal/redisstreams"
)

type ingestRequest struct {
	Event eventproto.Event `json:"event"`
}

type ingestResponse struct {
	StreamID string `json:"stream_id"`
}

func main() {
	logx.Setup()
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	rdb := redisstreams.New(cfg.Redis.Addr, cfg.Redis.Username, cfg.Redis.Password, cfg.Redis.DB)
	defer func() { _ = rdb.Close() }()
	if err := rdb.Ping(ctx); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	r := chi.NewRouter()
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Post("/ingest", func(w http.ResponseWriter, req *http.Request) {
		var in ingestRequest
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&in); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		e := in.Event
		if err := e.Validate(); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		payloadStr := string(e.Payload)
		encoded, err := e.Encode()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		dedupeTTL := 7 * 24 * time.Hour
		streamID, _, err := rdb.IdempotentXAddEvent(
			req.Context(),
			e.ThreadID,
			e.EventID,
			e.Seq,
			e.TurnID,
			e.TS.Format(time.RFC3339Nano),
			e.Type,
			string(e.Level),
			payloadStr,
			string(encoded),
			cfg.Streams.TrimMaxLen,
			dedupeTTL,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(ingestResponse{StreamID: streamID})
	})

	addr := cfg.HTTP.Addr
	if env := os.Getenv("EVENT_GATEWAY_ADDR"); env != "" {
		addr = env
	}
	srv := httpx.New(addr, r)
	go func() {
		<-ctx.Done()
		_ = srv.Shutdown(context.Background())
	}()
	log.Printf("event-gateway listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("serve: %v", err)
	}
}
