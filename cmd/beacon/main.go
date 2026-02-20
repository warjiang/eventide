package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	_ "github.com/joho/godotenv/autoload"
	"github.com/warjiang/eventide/internal/config"
	"github.com/warjiang/eventide/internal/httpx"
	"github.com/warjiang/eventide/internal/logx"
	"github.com/warjiang/eventide/internal/pgstore"
	"github.com/warjiang/eventide/internal/redisstreams"
	"github.com/warjiang/eventide/internal/s3store"
	"github.com/warjiang/eventide/sdk/go/eventide"
)

// ── response types (read-api) ──────────────────────────────────────────

type threadResponse struct {
	ThreadID           string `json:"thread_id"`
	TenantID           string `json:"tenant_id"`
	Status             string `json:"status"`
	IdleTimeoutSeconds int    `json:"idle_timeout_seconds"`
	LastSeq            int64  `json:"last_seq"`
}

type eventsResponse struct {
	Events []json.RawMessage `json:"events"`
}

type archiveResponse struct {
	ArchiveID       string `json:"archive_id"`
	ThreadID        string `json:"thread_id"`
	FromSeq         int64  `json:"from_seq"`
	ToSeq           int64  `json:"to_seq"`
	ObjectKey       string `json:"object_key"`
	ContentType     string `json:"content_type"`
	ContentEncoding string `json:"content_encoding"`
	EventCount      int64  `json:"event_count"`
}

type archivesResponse struct {
	Archives []archiveResponse `json:"archives"`
}

func main() {
	logx.Setup()
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	addr := cfg.HTTP.Addr

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	// ── Postgres (for REST queries) ─────────────────────────────────────
	store, err := pgstore.New(ctx, cfg.Postgres.ConnString)
	if err != nil {
		log.Fatalf("pg: %v", err)
	}
	defer store.Close()
	if err := store.Ping(ctx); err != nil {
		log.Fatalf("pg ping: %v", err)
	}

	// ── Redis (for SSE streaming) ───────────────────────────────────────
	rdb := redisstreams.New(cfg.Redis.Addr, cfg.Redis.Username, cfg.Redis.Password, cfg.Redis.DB)
	defer func() { _ = rdb.Close() }()
	if err := rdb.Ping(ctx); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	// ── Router ──────────────────────────────────────────────────────────
	r := chi.NewRouter()

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	// ── REST: read-api routes ───────────────────────────────────────────

	r.Get("/threads/{threadID}", func(w http.ResponseWriter, req *http.Request) {
		threadID := chi.URLParam(req, "threadID")
		th, ok, err := store.GetThread(req.Context(), threadID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if !ok {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(threadResponse{
			ThreadID:           th.ThreadID,
			TenantID:           th.TenantID,
			Status:             th.Status,
			IdleTimeoutSeconds: th.IdleTimeoutSeconds,
			LastSeq:            th.LastSeq,
		})
	})

	r.Get("/threads/{threadID}/events", func(w http.ResponseWriter, req *http.Request) {
		threadID := chi.URLParam(req, "threadID")
		fromSeq := int64(0)
		if v := req.URL.Query().Get("from_seq"); v != "" {
			parsed, err := strconv.ParseInt(v, 10, 64)
			if err != nil {
				http.Error(w, "invalid from_seq", http.StatusBadRequest)
				return
			}
			fromSeq = parsed
		}
		limit := 500
		if v := req.URL.Query().Get("limit"); v != "" {
			parsed, err := strconv.Atoi(v)
			if err != nil || parsed <= 0 || parsed > 5000 {
				http.Error(w, "invalid limit", http.StatusBadRequest)
				return
			}
			limit = parsed
		}

		events, err := store.ListEvents(req.Context(), threadID, fromSeq, int64(limit))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(eventsResponse{Events: events})
	})

	r.Get("/threads/{threadID}/archives", func(w http.ResponseWriter, req *http.Request) {
		threadID := chi.URLParam(req, "threadID")
		limit := 100
		if v := req.URL.Query().Get("limit"); v != "" {
			parsed, err := strconv.Atoi(v)
			if err != nil || parsed <= 0 || parsed > 1000 {
				http.Error(w, "invalid limit", http.StatusBadRequest)
				return
			}
			limit = parsed
		}
		items, err := store.ListArchives(req.Context(), threadID, int64(limit))
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		resp := archivesResponse{Archives: make([]archiveResponse, 0, len(items))}
		for _, a := range items {
			resp.Archives = append(resp.Archives, archiveResponse{
				ArchiveID:       a.ArchiveID,
				ThreadID:        a.ThreadID,
				FromSeq:         a.FromSeq,
				ToSeq:           a.ToSeq,
				ObjectKey:       a.ObjectKey,
				ContentType:     a.ContentType,
				ContentEncoding: a.ContentEncoding,
				EventCount:      a.EventCount,
			})
		}
		w.Header().Set("content-type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	})

	r.Get("/threads/{threadID}/archives/{archiveID}", func(w http.ResponseWriter, req *http.Request) {
		threadID := chi.URLParam(req, "threadID")
		archiveID := chi.URLParam(req, "archiveID")
		arch, ok, err := store.GetArchive(req.Context(), archiveID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if !ok || arch.ThreadID != threadID {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}

		s3c, err := s3store.New(req.Context(), s3store.Config{
			Endpoint:        cfg.S3.Endpoint,
			Region:          cfg.S3.Region,
			Bucket:          cfg.S3.Bucket,
			AccessKeyID:     cfg.S3.AccessKeyID,
			SecretAccessKey: cfg.S3.SecretAccessKey,
			Prefix:          cfg.S3.Prefix,
			UsePathStyle:    cfg.S3.UsePathStyle,
		})
		if err != nil {
			http.Error(w, "s3 not configured", http.StatusInternalServerError)
			return
		}

		body, ct, ce, err := s3c.GetObject(req.Context(), arch.ObjectKey)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		defer func() {
			_ = body.Close()
		}()

		contentType := arch.ContentType
		if contentType == "" {
			contentType = ct
		}
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		w.Header().Set("content-type", contentType)

		contentEncoding := arch.ContentEncoding
		if contentEncoding == "" {
			contentEncoding = ce
		}
		if contentEncoding != "" {
			w.Header().Set("content-encoding", contentEncoding)
		}
		w.Header().Set("cache-control", "no-store")

		_, _ = io.Copy(w, body)
	})

	// ── SSE: realtime route ─────────────────────────────────────────────

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

	// ── Start server ────────────────────────────────────────────────────
	srv := httpx.New(addr, r)
	go func() {
		<-ctx.Done()
		_ = srv.Shutdown(context.Background())
	}()
	log.Printf("beacon listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

// ── SSE helpers (from realtime) ─────────────────────────────────────────

func eventFromStream(threadID string, values map[string]any) (eventide.Event, bool) {
	seqAny, ok := values["seq"]
	if !ok {
		return eventide.Event{}, false
	}
	seq, ok := toInt64(seqAny)
	if !ok {
		return eventide.Event{}, false
	}
	eventID, _ := values["event_id"].(string)
	turnID, _ := values["turn_id"].(string)
	tsStr, _ := values["ts"].(string)
	typeStr, _ := values["type"].(string)
	levelStr, _ := values["level"].(string)
	payloadStr, _ := values["payload"].(string)
	if eventID == "" || turnID == "" || tsStr == "" || typeStr == "" || levelStr == "" || payloadStr == "" {
		return eventide.Event{}, false
	}
	ts, err := time.Parse(time.RFC3339Nano, tsStr)
	if err != nil {
		return eventide.Event{}, false
	}
	return eventide.Event{
		SpecVersion: eventide.SpecVersion,
		EventID:     eventID,
		ThreadID:    threadID,
		TurnID:      turnID,
		Seq:         seq,
		TS:          ts,
		Type:        typeStr,
		Level:       eventide.Level(levelStr),
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
