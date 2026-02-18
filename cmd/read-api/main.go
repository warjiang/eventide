package main

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"

	"github.com/go-chi/chi/v5"

	"github.com/warjiang/eventide/internal/config"
	"github.com/warjiang/eventide/internal/httpx"
	"github.com/warjiang/eventide/internal/logx"
	"github.com/warjiang/eventide/internal/pgstore"
	"github.com/warjiang/eventide/internal/s3store"
)

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

	addr := getenvDefault("READ_API_ADDR", "127.0.0.1:18084")
	if env := os.Getenv("HTTP_ADDR"); env != "" {
		addr = env
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	store, err := pgstore.New(ctx, cfg.Postgres.ConnString)
	if err != nil {
		log.Fatalf("pg: %v", err)
	}
	defer store.Close()
	if err := store.Ping(ctx); err != nil {
		log.Fatalf("pg ping: %v", err)
	}

	r := chi.NewRouter()
	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

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

	srv := httpx.New(addr, r)
	go func() {
		<-ctx.Done()
		_ = srv.Shutdown(context.Background())
	}()
	log.Printf("read-api listening on %s", addr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("serve: %v", err)
	}
}

func getenvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
