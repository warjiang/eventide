package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
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
	"github.com/warjiang/eventide/internal/id"
	"github.com/warjiang/eventide/internal/logx"
	"github.com/warjiang/eventide/internal/redisstreams"
)

type appendRequest struct {
	Event eventproto.Event `json:"event"`
}

type appendResponse struct {
	EventID string `json:"event_id"`
	Seq     int64  `json:"seq"`
}

type gatewayClient struct {
	baseURL string
	hc      *http.Client
}

func (g gatewayClient) Ingest(ctx context.Context, e eventproto.Event) error {
	body, err := json.Marshal(map[string]any{"event": e})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.baseURL+"/ingest", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	resp, err := g.hc.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
		return errors.New(string(b))
	}
	return nil
}

func main() {
	logx.Setup()
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	addr := cfg.HTTP.Addr
	if env := os.Getenv("EVENT_SIDECAR_ADDR"); env != "" {
		addr = env
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	rdb := redisstreams.New(cfg.Redis.Addr, cfg.Redis.Username, cfg.Redis.Password, cfg.Redis.DB)
	defer func() { _ = rdb.Close() }()
	if err := rdb.Ping(ctx); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	gateway := gatewayClient{baseURL: cfg.EventGatewayURL, hc: &http.Client{Timeout: 10 * time.Second}}

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

		if err := ingestWithRetry(req.Context(), gateway, e); err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}

		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(appendResponse{EventID: e.EventID, Seq: e.Seq})
	})

	srv := httpx.New(addr, r)
	go func() {
		<-ctx.Done()
		_ = srv.Shutdown(context.Background())
	}()
	log.Printf("event-sidecar listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func ingestWithRetry(ctx context.Context, g gatewayClient, e eventproto.Event) error {
	delays := []time.Duration{10 * time.Millisecond, 100 * time.Millisecond, 500 * time.Millisecond, time.Second, 2 * time.Second}
	for i := 0; i < len(delays)+1; i++ {
		err := g.Ingest(ctx, e)
		if err == nil {
			return nil
		}
		if i == len(delays) {
			return err
		}
		t := time.NewTimer(delays[i])
		select {
		case <-ctx.Done():
			t.Stop()
			return ctx.Err()
		case <-t.C:
		}
	}
	return nil
}
