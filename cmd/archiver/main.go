package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/warjiang/eventide/internal/config"
	"github.com/warjiang/eventide/internal/id"
	"github.com/warjiang/eventide/internal/logx"
	"github.com/warjiang/eventide/internal/pgstore"
	"github.com/warjiang/eventide/internal/s3store"
)

func main() {
	logx.Setup()
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	threadID := strings.TrimSpace(os.Getenv("ARCHIVE_THREAD_ID"))
	if threadID == "" {
		log.Fatalf("ARCHIVE_THREAD_ID is required")
	}
	fromSeq := getenvInt64Default("ARCHIVE_FROM_SEQ", 1)
	toSeq := getenvInt64Default("ARCHIVE_TO_SEQ", 0)
	if toSeq == 0 {
		toSeq = fromSeq + 999
	}
	if toSeq < fromSeq {
		log.Fatalf("invalid archive range")
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

	s3c, err := s3store.New(ctx, s3store.Config{
		Endpoint:        cfg.S3.Endpoint,
		Region:          cfg.S3.Region,
		Bucket:          cfg.S3.Bucket,
		AccessKeyID:     cfg.S3.AccessKeyID,
		SecretAccessKey: cfg.S3.SecretAccessKey,
		Prefix:          cfg.S3.Prefix,
		UsePathStyle:    cfg.S3.UsePathStyle,
	})
	if err != nil {
		log.Fatalf("s3: %v", err)
	}
	if err := s3c.EnsureBucket(ctx); err != nil {
		log.Fatalf("s3 bucket: %v", err)
	}

	events, err := store.ListEventsForArchive(ctx, threadID, fromSeq, toSeq, 20000)
	if err != nil {
		log.Fatalf("list events: %v", err)
	}
	if len(events) == 0 {
		log.Printf("no events in range")
		return
	}

	archiveID, err := id.NewULID()
	if err != nil {
		log.Fatalf("id: %v", err)
	}
	objectKey := s3c.Key("threads/" + threadID + "/archives/" + archiveID + ".jsonl.gz")

	buf, err := encodeJSONLGzip(events)
	if err != nil {
		log.Fatalf("encode: %v", err)
	}

	if err := s3c.PutObject(ctx, objectKey, buf, "application/x-ndjson", "gzip"); err != nil {
		log.Fatalf("put object: %v", err)
	}

	if err := store.InsertArchive(ctx, pgstore.EventArchive{
		ArchiveID:       archiveID,
		ThreadID:        threadID,
		FromSeq:         fromSeq,
		ToSeq:           toSeq,
		ObjectKey:       objectKey,
		ContentEncoding: "gzip",
		ContentType:     "application/x-ndjson",
		EventCount:      int64(len(events)),
		CreatedAt:       time.Now().UTC(),
	}); err != nil {
		log.Fatalf("insert archive: %v", err)
	}

	log.Printf("archived %d events to s3://%s/%s", len(events), cfg.S3.Bucket, objectKey)
}

func encodeJSONLGzip(events []json.RawMessage) ([]byte, error) {
	var b bytes.Buffer
	gz := gzip.NewWriter(&b)
	for _, e := range events {
		if _, err := gz.Write(e); err != nil {
			_ = gz.Close()
			return nil, err
		}
		if _, err := gz.Write([]byte("\n")); err != nil {
			_ = gz.Close()
			return nil, err
		}
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return b.Bytes(), nil
}

func getenvInt64Default(key string, def int64) int64 {
	v := strings.TrimSpace(os.Getenv(key))
	if v == "" {
		return def
	}
	parsed, err := strconv.ParseInt(v, 10, 64)
	if err != nil {
		return def
	}
	return parsed
}
