package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/warjiang/eventide/internal/eventproto"
	"github.com/warjiang/eventide/internal/httpx"
	"github.com/warjiang/eventide/internal/logx"
)

type turnRequest struct {
	ThreadID string         `json:"thread_id"`
	TurnID   string         `json:"turn_id"`
	Input    map[string]any `json:"input"`
}

type sidecarClient struct {
	baseURL string
	hc      *http.Client
}

func (s sidecarClient) Append(ctx context.Context, e eventproto.Event) error {
	body, err := json.Marshal(map[string]any{"event": e})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.baseURL+"/events:append", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")
	resp, err := s.hc.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		_ = resp.Body.Close()
	}()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
		return &httpError{Status: resp.StatusCode, Body: string(b)}
	}
	return nil
}

type httpError struct {
	Status int
	Body   string
}

func (e *httpError) Error() string {
	return e.Body
}

func main() {
	logx.Setup()
	addr := getenvDefault("REFERENCE_AGENT_ADDR", "127.0.0.1:18080")
	sidecarURL := getenvDefault("EVENT_SIDECAR_URL", "http://127.0.0.1:18083")

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	sidecar := sidecarClient{baseURL: sidecarURL, hc: &http.Client{Timeout: 10 * time.Second}}

	r := chi.NewRouter()
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Post("/turns", func(w http.ResponseWriter, req *http.Request) {
		var in turnRequest
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&in); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if in.ThreadID == "" || in.TurnID == "" {
			http.Error(w, "thread_id and turn_id are required", http.StatusBadRequest)
			return
		}

		go runTurn(context.Background(), sidecar, in.ThreadID, in.TurnID, in.Input)

		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte("accepted"))
	})

	srv := httpx.New(addr, r)
	go func() {
		<-ctx.Done()
		_ = srv.Shutdown(context.Background())
	}()
	log.Printf("reference-agent listening on %s (sidecar=%s)", addr, sidecarURL)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func runTurn(ctx context.Context, sidecar sidecarClient, threadID, turnID string, input map[string]any) {
	_ = sidecar.Append(ctx, eventproto.Event{
		SpecVersion: eventproto.SpecVersion,
		ThreadID:    threadID,
		TurnID:      turnID,
		Type:        eventproto.TypeTurnStarted,
		Level:       eventproto.LevelInfo,
		Payload:     mustJSON(map[string]any{"input": input}),
	})

	_ = sidecar.Append(ctx, eventproto.Event{
		SpecVersion: eventproto.SpecVersion,
		ThreadID:    threadID,
		TurnID:      turnID,
		Type:        eventproto.TypeTurnInput,
		Level:       eventproto.LevelInfo,
		Payload:     mustJSON(map[string]any{"input": input}),
	})

	msgID := "m1"
	chunks := []string{"hello ", "from ", "reference ", "agent"}
	for _, c := range chunks {
		_ = sidecar.Append(ctx, eventproto.Event{
			SpecVersion: eventproto.SpecVersion,
			ThreadID:    threadID,
			TurnID:      turnID,
			Type:        eventproto.TypeAssistantDelta,
			Level:       eventproto.LevelInfo,
			Payload:     mustJSON(map[string]any{"message_id": msgID, "delta": c}),
		})
		t := time.NewTimer(200 * time.Millisecond)
		select {
		case <-ctx.Done():
			t.Stop()
			return
		case <-t.C:
		}
	}

	_ = sidecar.Append(ctx, eventproto.Event{
		SpecVersion: eventproto.SpecVersion,
		ThreadID:    threadID,
		TurnID:      turnID,
		Type:        eventproto.TypeAssistantCompleted,
		Level:       eventproto.LevelInfo,
		Payload:     mustJSON(map[string]any{"message_id": msgID}),
	})

	_ = sidecar.Append(ctx, eventproto.Event{
		SpecVersion: eventproto.SpecVersion,
		ThreadID:    threadID,
		TurnID:      turnID,
		Type:        eventproto.TypeTurnCompleted,
		Level:       eventproto.LevelInfo,
		Payload:     mustJSON(map[string]any{"ok": true}),
	})
}

func mustJSON(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

func getenvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
