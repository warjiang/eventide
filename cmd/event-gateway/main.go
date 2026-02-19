package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/warjiang/eventide/internal/config"
	"github.com/warjiang/eventide/internal/eventproto"
	"github.com/warjiang/eventide/internal/httpx"
	"github.com/warjiang/eventide/internal/id"
	"github.com/warjiang/eventide/internal/logx"
	"github.com/warjiang/eventide/internal/redisstreams"
)

type ingestRequest struct {
	Event eventproto.Event `json:"event"`
}

type ingestResponse struct {
	StreamID string `json:"stream_id"`
}

type appendRequest struct {
	Event eventproto.Event `json:"event"`
}

type appendResponse struct {
	EventID    string `json:"event_id"`
	Seq        int64  `json:"seq"`
	StreamID   string `json:"stream_id,omitempty"`
	Duplicated bool   `json:"duplicated,omitempty"`
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

	r.Post("/events:append", func(w http.ResponseWriter, req *http.Request) {
		var in appendRequest
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&in); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		e := in.Event
		if e.SpecVersion == "" {
			e.SpecVersion = eventproto.SpecVersion
		}
		if e.EventID == "" {
			idStr, err := id.NewULID()
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			e.EventID = idStr
		}
		if e.TS.IsZero() {
			e.TS = time.Now().UTC()
		}
		if e.Seq == 0 {
			if strings.TrimSpace(e.ThreadID) == "" {
				http.Error(w, "thread_id is required", http.StatusBadRequest)
				return
			}
			seq, err := rdb.NextSeq(req.Context(), e.ThreadID)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			e.Seq = seq
		}
		if err := e.Validate(); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		streamID, duplicated, err := ingestWithRetry(req.Context(), func() (string, bool, error) {
			return ingestEvent(req.Context(), rdb, cfg.Streams.TrimMaxLen, e)
		})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(appendResponse{EventID: e.EventID, Seq: e.Seq, StreamID: streamID, Duplicated: duplicated})
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
		streamID, _, err := ingestWithRetry(req.Context(), func() (string, bool, error) {
			return ingestEvent(req.Context(), rdb, cfg.Streams.TrimMaxLen, e)
		})
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

func ingestEvent(ctx context.Context, rdb *redisstreams.Client, trimMaxLen int64, e eventproto.Event) (string, bool, error) {
	payloadStr := string(e.Payload)
	encoded, err := e.Encode()
	if err != nil {
		return "", false, err
	}
	dedupeTTL := 7 * 24 * time.Hour
	return rdb.IdempotentXAddEvent(
		ctx,
		e.ThreadID,
		e.EventID,
		e.Seq,
		e.TurnID,
		e.TS.Format(time.RFC3339Nano),
		e.Type,
		string(e.Level),
		payloadStr,
		string(encoded),
		trimMaxLen,
		dedupeTTL,
	)
}

func ingestWithRetry(ctx context.Context, op func() (string, bool, error)) (string, bool, error) {
	delays := []time.Duration{10 * time.Millisecond, 100 * time.Millisecond, 500 * time.Millisecond, time.Second, 2 * time.Second}
	for i := 0; i < len(delays)+1; i++ {
		streamID, duplicated, err := op()
		if err == nil {
			return streamID, duplicated, nil
		}
		if i == len(delays) {
			return "", false, err
		}
		t := time.NewTimer(delays[i])
		select {
		case <-ctx.Done():
			t.Stop()
			return "", false, ctx.Err()
		case <-t.C:
		}
	}
	return "", false, nil
}
