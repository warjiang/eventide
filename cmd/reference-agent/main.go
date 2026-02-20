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

	"github.com/warjiang/eventide/internal/httpx"
	"github.com/warjiang/eventide/internal/logx"
	"github.com/warjiang/eventide/sdk/go/eventide"
)

type turnRequest struct {
	ThreadID string         `json:"thread_id"`
	TurnID   string         `json:"turn_id"`
	Input    map[string]any `json:"input"`
}

func main() {
	logx.Setup()
	addr := getenvDefault("REFERENCE_AGENT_ADDR", "127.0.0.1:18080")
	gatewayURL := getenvDefault("EVENT_GATEWAY_URL", "http://127.0.0.1:18081")

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	client := eventide.NewClient(gatewayURL)

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

		go runTurn(context.Background(), client, in.ThreadID, in.TurnID, in.Input)

		w.WriteHeader(http.StatusAccepted)
		_, _ = w.Write([]byte("accepted"))
	})

	srv := httpx.New(addr, r)
	go func() {
		<-ctx.Done()
		_ = srv.Shutdown(context.Background())
	}()
	log.Printf("reference-agent listening on %s (gateway=%s)", addr, gatewayURL)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func runTurn(ctx context.Context, client *eventide.Client, threadID, turnID string, input map[string]any) {
	_, _ = client.Append(ctx, eventide.Event{
		SpecVersion: eventide.SpecVersion,
		ThreadID:    threadID,
		TurnID:      turnID,
		Type:        eventide.TypeTurnStarted,
		Level:       eventide.LevelInfo,
		Payload:     mustJSON(map[string]any{"input": input}),
	})

	msgID := "m1"
	chunks := []string{"hello ", "from ", "reference ", "agent ", "using ", "go sdk"}
	for _, c := range chunks {
		_, _ = client.Append(ctx, eventide.Event{
			SpecVersion: eventide.SpecVersion,
			ThreadID:    threadID,
			TurnID:      turnID,
			Type:        eventide.TypeMessageDelta,
			Level:       eventide.LevelInfo,
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

	_, _ = client.Append(ctx, eventide.Event{
		SpecVersion: eventide.SpecVersion,
		ThreadID:    threadID,
		TurnID:      turnID,
		Type:        eventide.TypeMessageCompleted,
		Level:       eventide.LevelInfo,
		Payload:     mustJSON(map[string]any{"message_id": msgID}),
	})

	_, _ = client.Append(ctx, eventide.Event{
		SpecVersion: eventide.SpecVersion,
		ThreadID:    threadID,
		TurnID:      turnID,
		Type:        eventide.TypeTurnCompleted,
		Level:       eventide.LevelInfo,
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
