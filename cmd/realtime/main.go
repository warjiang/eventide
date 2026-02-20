package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"

	_ "github.com/joho/godotenv/autoload"
	"github.com/warjiang/eventide/internal/config"
	"github.com/warjiang/eventide/internal/eventproto"
	"github.com/warjiang/eventide/internal/httpx"
	"github.com/warjiang/eventide/internal/logx"
	"github.com/warjiang/eventide/internal/redisstreams"
)

func main() {
	logx.Setup()
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	addr := cfg.HTTP.Addr
	if env := os.Getenv("EVENTIDE_REALTIME_ADDR"); env != "" {
		addr = env
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

	r.Get("/threads/{threadID}/events/stream", func(w http.ResponseWriter, req *http.Request) {
		threadID := chi.URLParam(req, "threadID")
		afterSeq, _, err := parseAfterSeq(req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("content-type", "text/event-stream")
		w.Header().Set("cache-control", "no-cache")
		w.Header().Set("connection", "keep-alive")
		w.Header().Set("x-accel-buffering", "no")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "streaming not supported", http.StatusInternalServerError)
			return
		}

		cursor := "0" // Always start from beginning to support produce-before-consume
		_, _ = w.Write([]byte("retry: 2000\n\n"))
		flusher.Flush()

		stream := redisstreams.StreamKey(threadID)
		ctx := req.Context()
		for {
			msgs, err := rdb.XRead(ctx, stream, cursor, 30*time.Second, 200)
			if err != nil {
				return
			}
			if len(msgs) == 0 {
				select {
				case <-ctx.Done():
					return
				default:
					_, _ = w.Write([]byte(": keepalive\n\n"))
					flusher.Flush()
					continue
				}
			}
			for _, m := range msgs {
				cursor = m.ID
				seqVal, ok := m.Values["seq"]
				if ok {
					seq, ok2 := toInt64(seqVal)
					if ok2 && seq <= afterSeq {
						continue
					}
				}
				evt, ok := eventFromStream(threadID, m.Values)
				if !ok {
					continue
				}
				b, err := json.Marshal(evt)
				if err != nil {
					continue
				}
				if err := writeSSE(w, evt.Seq, "agent_event", b); err != nil {
					return
				}
				flusher.Flush()
			}
		}
	})

	srv := httpx.New(addr, r)
	go func() {
		<-ctx.Done()
		_ = srv.Shutdown(context.Background())
	}()
	log.Printf("realtime listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func eventFromStream(threadID string, values map[string]any) (eventproto.Event, bool) {
	seqAny, ok := values["seq"]
	if !ok {
		return eventproto.Event{}, false
	}
	seq, ok := toInt64(seqAny)
	if !ok {
		return eventproto.Event{}, false
	}
	eventID, _ := values["event_id"].(string)
	turnID, _ := values["turn_id"].(string)
	tsStr, _ := values["ts"].(string)
	typeStr, _ := values["type"].(string)
	levelStr, _ := values["level"].(string)
	payloadStr, _ := values["payload"].(string)
	if eventID == "" || turnID == "" || tsStr == "" || typeStr == "" || levelStr == "" || payloadStr == "" {
		return eventproto.Event{}, false
	}
	ts, err := time.Parse(time.RFC3339Nano, tsStr)
	if err != nil {
		return eventproto.Event{}, false
	}
	return eventproto.Event{
		SpecVersion: eventproto.SpecVersion,
		EventID:     eventID,
		ThreadID:    threadID,
		TurnID:      turnID,
		Seq:         seq,
		TS:          ts,
		Type:        typeStr,
		Level:       eventproto.Level(levelStr),
		Payload:     []byte(payloadStr),
	}, true
}

func toInt64(v any) (int64, bool) {
	switch t := v.(type) {
	case int64:
		return t, true
	case int:
		return int64(t), true
	case string:
		parsed, err := strconv.ParseInt(t, 10, 64)
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func parseAfterSeq(req *http.Request) (afterSeq int64, resumeRequested bool, err error) {
	if v := req.URL.Query().Get("after_seq"); v != "" {
		parsed, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return 0, false, errInvalidAfterSeq
		}
		return parsed, true, nil
	}
	if v := req.Header.Get("Last-Event-ID"); v != "" {
		parsed, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			return 0, false, errInvalidLastEventID
		}
		return parsed, true, nil
	}
	return 0, false, nil
}

var (
	errInvalidAfterSeq    = &requestError{msg: "invalid after_seq"}
	errInvalidLastEventID = &requestError{msg: "invalid Last-Event-ID"}
)

type requestError struct {
	msg string
}

func (e *requestError) Error() string {
	return e.msg
}

func writeSSE(w http.ResponseWriter, id int64, event string, data []byte) error {
	if _, err := w.Write([]byte("id: ")); err != nil {
		return err
	}
	if _, err := w.Write([]byte(strconv.FormatInt(id, 10))); err != nil {
		return err
	}
	if _, err := w.Write([]byte("\n")); err != nil {
		return err
	}
	if _, err := w.Write([]byte("event: ")); err != nil {
		return err
	}
	if _, err := w.Write([]byte(event)); err != nil {
		return err
	}
	if _, err := w.Write([]byte("\n")); err != nil {
		return err
	}
	if _, err := w.Write([]byte("data: ")); err != nil {
		return err
	}
	if _, err := w.Write(data); err != nil {
		return err
	}
	_, err := w.Write([]byte("\n\n"))
	return err
}
