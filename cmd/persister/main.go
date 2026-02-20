package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	_ "github.com/joho/godotenv/autoload"
	"github.com/warjiang/eventide/internal/config"
	"github.com/warjiang/eventide/internal/logx"
	"github.com/warjiang/eventide/internal/pgstore"
	"github.com/warjiang/eventide/internal/redisstreams"
	"github.com/warjiang/eventide/sdk/go/eventide"
)

func main() {
	logx.Setup()
	cfg, err := config.FromEnv()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	tenantID := getenvDefault("TENANT_ID", "default")
	idleTimeoutSeconds := getenvIntDefault("IDLE_TIMEOUT_SECONDS", 900)
	group := getenvDefault("PERSISTER_GROUP", "persist")
	consumer := getenvDefault("PERSISTER_CONSUMER", defaultConsumer())

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	rdb := redisstreams.New(cfg.Redis.Addr, cfg.Redis.Username, cfg.Redis.Password, cfg.Redis.DB)
	defer func() { _ = rdb.Close() }()
	if err := rdb.Ping(ctx); err != nil {
		log.Fatalf("redis ping: %v", err)
	}

	store, err := pgstore.New(ctx, cfg.Postgres.ConnString)
	if err != nil {
		log.Fatalf("pg: %v", err)
	}
	defer store.Close()
	if err := store.Ping(ctx); err != nil {
		log.Fatalf("pg ping: %v", err)
	}

	stream := redisstreams.GlobalStreamKey()
	if err := rdb.EnsureConsumerGroupOnStream(ctx, stream, group); err != nil {
		log.Fatalf("redis group: %v", err)
	}

	log.Printf("persister started (stream=%s group=%s consumer=%s)", stream, group, consumer)
	minIdle := 30 * time.Second
	start := "0-0"
	dlqStream := getenvDefault("PERSISTER_DLQ_STREAM", "stream:global:dlq")
	maxRetries := int64(getenvIntDefault("PERSISTER_MAX_RETRIES", 5))
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		pending, err := rdb.XPendingExt(ctx, stream, group, "-", "+", 200)
		if err != nil {
			log.Printf("xpendingext: %v", err)
		} else {
			for _, p := range pending {
				if p.RetryCount < maxRetries {
					continue
				}
				if err := moveToDLQ(ctx, rdb, stream, group, dlqStream, p.ID); err != nil {
					log.Printf("dlq move failed (id=%s): %v", p.ID, err)
					break
				}
			}
		}

		claimed, err := rdb.XAutoClaim(ctx, stream, group, consumer, start, minIdle, 200)
		if err != nil {
			log.Printf("xautoclaim: %v", err)
		} else {
			start = claimed.Start
			for _, m := range claimed.Messages {
				persisted, acked := handleMessage(ctx, rdb, store, stream, group, tenantID, idleTimeoutSeconds, m)
				if !persisted && !acked {
					break
				}
			}
		}

		msgs, err := rdb.XReadGroup(ctx, group, consumer, stream, ">", 5*time.Second, 200)
		if err != nil {
			log.Printf("xreadgroup: %v", err)
			t := time.NewTimer(250 * time.Millisecond)
			select {
			case <-ctx.Done():
				t.Stop()
				return
			case <-t.C:
			}
			continue
		}
		if len(msgs) == 0 {
			continue
		}
		for _, m := range msgs {
			persisted, acked := handleMessage(ctx, rdb, store, stream, group, tenantID, idleTimeoutSeconds, m)
			if !persisted && !acked {
				break
			}
		}
	}
}

func handleMessage(
	ctx context.Context,
	rdb *redisstreams.Client,
	store *pgstore.Store,
	stream string,
	group string,
	tenantID string,
	idleTimeoutSeconds int,
	m redisstreams.GroupMessage,
) (persisted bool, acked bool) {
	evtStr, _ := m.Values["event"].(string)
	if evtStr == "" {
		log.Printf("skip msg %s: missing event field", m.ID)
		_, _ = rdb.XAck(ctx, stream, group, m.ID)
		return false, true
	}
	e, err := eventide.DecodeEvent([]byte(evtStr))
	if err != nil {
		log.Printf("skip msg %s: decode event: %v", m.ID, err)
		_, _ = rdb.XAck(ctx, stream, group, m.ID)
		return false, true
	}

	if err := store.PersistEvent(ctx, tenantID, idleTimeoutSeconds, e); err != nil {
		log.Printf("persist event %s/%d: %v", e.ThreadID, e.Seq, err)
		return false, false
	}
	_, _ = rdb.XAck(ctx, stream, group, m.ID)
	return true, true
}

func moveToDLQ(ctx context.Context, rdb *redisstreams.Client, stream, group, dlqStream, id string) error {
	msgs, err := rdb.XRange(ctx, stream, id, id, 1)
	if err != nil {
		return err
	}
	if len(msgs) == 0 {
		_, _ = rdb.XAck(ctx, stream, group, id)
		_, _ = rdb.XDel(ctx, stream, id)
		return nil
	}
	values := msgs[0].Values
	values["dlq_from_stream"] = stream
	values["dlq_from_id"] = id
	values["dlq_ts"] = time.Now().UTC().Format(time.RFC3339Nano)
	if _, err := rdb.XAddToStream(ctx, dlqStream, values); err != nil {
		return err
	}
	_, _ = rdb.XAck(ctx, stream, group, id)
	_, _ = rdb.XDel(ctx, stream, id)
	return nil
}

func defaultConsumer() string {
	host, _ := os.Hostname()
	return host + "-" + strconv.FormatInt(int64(os.Getpid()), 10)
}

func getenvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func getenvIntDefault(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
