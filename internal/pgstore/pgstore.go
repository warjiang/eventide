package pgstore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/warjiang/eventide/internal/eventproto"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct {
	pool *pgxpool.Pool
}

type Thread struct {
	ThreadID           string
	TenantID           string
	Status             string
	IdleTimeoutSeconds int
	LastSeq            int64
}

type EventArchive struct {
	ArchiveID       string
	ThreadID        string
	FromSeq         int64
	ToSeq           int64
	ObjectKey       string
	ContentEncoding string
	ContentType     string
	EventCount      int64
	CreatedAt       time.Time
}

func New(ctx context.Context, connString string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, err
	}
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.HealthCheckPeriod = 30 * time.Second
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	return &Store{pool: pool}, nil
}

func (s *Store) Close() {
	s.pool.Close()
}

func (s *Store) Ping(ctx context.Context) error {
	return s.pool.Ping(ctx)
}

func (s *Store) Exec(ctx context.Context, sql string, args ...any) error {
	_, err := s.pool.Exec(ctx, sql, args...)
	return err
}

func (s *Store) EnsureMigrationsTable(ctx context.Context) error {
	return s.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL
);`)
}

func (s *Store) IsMigrationApplied(ctx context.Context, version string) (bool, error) {
	version = strings.TrimSpace(version)
	if version == "" {
		return false, errors.New("version is required")
	}
	var exists bool
	err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)`, version).Scan(&exists)
	return exists, err
}

func (s *Store) ApplyMigration(ctx context.Context, version string, sql string) error {
	version = strings.TrimSpace(version)
	if version == "" {
		return errors.New("version is required")
	}
	if strings.TrimSpace(sql) == "" {
		return errors.New("sql is required")
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback(context.Background())
	}()

	if _, err := tx.Exec(ctx, sql); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(version, applied_at) VALUES ($1, now()) ON CONFLICT (version) DO NOTHING`, version); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	return nil
}

func (s *Store) PersistEvent(ctx context.Context, tenantID string, idleTimeoutSeconds int, e eventproto.Event) error {
	if strings.TrimSpace(tenantID) == "" {
		return errors.New("tenantID is required")
	}
	if idleTimeoutSeconds <= 0 {
		idleTimeoutSeconds = 900
	}
	if err := e.Validate(); err != nil {
		return fmt.Errorf("event invalid: %w", err)
	}

	_, err := s.pool.Exec(ctx, `INSERT INTO agent_events(
  thread_id, seq, event_id, turn_id, ts, type, level, payload, source, trace, tags
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
ON CONFLICT (event_id) DO NOTHING`,
		e.ThreadID,
		e.Seq,
		e.EventID,
		e.TurnID,
		e.TS,
		e.Type,
		string(e.Level),
		e.Payload,
		e.Source,
		e.Trace,
		e.Tags,
	)
	if err != nil {
		return err
	}

	status := "active"
	if e.Type == eventproto.TypeTurnCompleted || e.Type == eventproto.TypeTurnFailed || e.Type == eventproto.TypeTurnCancelled {
		status = "idle"
	}

	_, err = s.pool.Exec(ctx, `INSERT INTO threads(
  thread_id, tenant_id, status, created_at, last_active_at, idle_timeout_seconds, last_seq
) VALUES ($1,$2,$3,$4,$5,$6,$7)
ON CONFLICT (thread_id) DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  status = EXCLUDED.status,
  last_active_at = EXCLUDED.last_active_at,
  idle_timeout_seconds = EXCLUDED.idle_timeout_seconds,
  last_seq = GREATEST(threads.last_seq, EXCLUDED.last_seq)`,
		e.ThreadID,
		tenantID,
		status,
		time.Now().UTC(),
		time.Now().UTC(),
		idleTimeoutSeconds,
		e.Seq,
	)
	if err != nil {
		return err
	}

	_, err = s.pool.Exec(ctx, `INSERT INTO turns(
  thread_id, turn_id, status, input, created_at, completed_at
) VALUES ($1,$2,$3,$4,$5,$6)
ON CONFLICT (thread_id, turn_id) DO UPDATE SET
  status = EXCLUDED.status,
  completed_at = COALESCE(turns.completed_at, EXCLUDED.completed_at)`,
		e.ThreadID,
		e.TurnID,
		turnStatus(e),
		turnInputPayload(e),
		e.TS,
		turnCompletedAt(e),
	)
	if err != nil {
		return err
	}

	return nil
}

func (s *Store) GetThread(ctx context.Context, threadID string) (Thread, bool, error) {
	threadID = strings.TrimSpace(threadID)
	if threadID == "" {
		return Thread{}, false, errors.New("threadID is required")
	}
	var th Thread
	err := s.pool.QueryRow(ctx, `SELECT thread_id, tenant_id, status, idle_timeout_seconds, last_seq FROM threads WHERE thread_id=$1`, threadID).
		Scan(&th.ThreadID, &th.TenantID, &th.Status, &th.IdleTimeoutSeconds, &th.LastSeq)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Thread{}, false, nil
		}
		return Thread{}, false, err
	}
	return th, true, nil
}

func (s *Store) ListEvents(ctx context.Context, threadID string, fromSeq int64, limit int64) ([]json.RawMessage, error) {
	threadID = strings.TrimSpace(threadID)
	if threadID == "" {
		return nil, errors.New("threadID is required")
	}
	if fromSeq < 0 {
		fromSeq = 0
	}
	if limit <= 0 {
		limit = 500
	}
	if limit > 5000 {
		limit = 5000
	}

	rows, err := s.pool.Query(ctx, `SELECT thread_id, seq, event_id, turn_id, ts, type, level, payload, source, trace, tags
FROM agent_events
WHERE thread_id=$1 AND seq > $2
ORDER BY seq ASC
LIMIT $3`, threadID, fromSeq, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []json.RawMessage
	for rows.Next() {
		var (
			thID    string
			seq     int64
			eventID string
			turnID  string
			ts      time.Time
			typeStr string
			level   string
			payload json.RawMessage
			source  json.RawMessage
			trace   json.RawMessage
			tags    json.RawMessage
		)
		var sourceAny map[string]any
		var traceAny map[string]any
		var tagsAny map[string]string

		if err := rows.Scan(&thID, &seq, &eventID, &turnID, &ts, &typeStr, &level, &payload, &source, &trace, &tags); err != nil {
			return nil, err
		}
		if len(source) > 0 {
			_ = json.Unmarshal(source, &sourceAny)
		}
		if len(trace) > 0 {
			_ = json.Unmarshal(trace, &traceAny)
		}
		if len(tags) > 0 {
			_ = json.Unmarshal(tags, &tagsAny)
		}
		e := eventproto.Event{
			SpecVersion: eventproto.SpecVersion,
			EventID:     eventID,
			ThreadID:    thID,
			TurnID:      turnID,
			Seq:         seq,
			TS:          ts,
			Type:        typeStr,
			Level:       eventproto.Level(level),
			Payload:     payload,
			Source:      sourceAny,
			Trace:       traceAny,
			Tags:        tagsAny,
		}
		b, err := e.Encode()
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// ArchiveQueryResult holds the events and actual seq range returned by ListEventsForArchive.
type ArchiveQueryResult struct {
	Events []json.RawMessage
	MinSeq int64 // actual minimum seq in the result set
	MaxSeq int64 // actual maximum seq in the result set
}

func (s *Store) ListEventsForArchive(ctx context.Context, threadID string, fromSeqInclusive int64, toSeqInclusive int64, limit int64) (ArchiveQueryResult, error) {
	threadID = strings.TrimSpace(threadID)
	if threadID == "" {
		return ArchiveQueryResult{}, errors.New("threadID is required")
	}
	if fromSeqInclusive < 0 {
		fromSeqInclusive = 0
	}
	if toSeqInclusive < fromSeqInclusive {
		return ArchiveQueryResult{}, errors.New("invalid range")
	}
	if limit <= 0 {
		limit = 5000
	}
	rows, err := s.pool.Query(ctx, `SELECT thread_id, seq, event_id, turn_id, ts, type, level, payload, source, trace, tags
FROM agent_events
WHERE thread_id=$1 AND seq >= $2 AND seq <= $3
ORDER BY seq ASC
LIMIT $4`, threadID, fromSeqInclusive, toSeqInclusive, limit)
	if err != nil {
		return ArchiveQueryResult{}, err
	}
	defer rows.Close()
	var result ArchiveQueryResult
	first := true
	for rows.Next() {
		var (
			thID    string
			seq     int64
			eventID string
			turnID  string
			ts      time.Time
			typeStr string
			level   string
			payload json.RawMessage
			source  json.RawMessage
			trace   json.RawMessage
			tags    json.RawMessage
		)
		var sourceAny map[string]any
		var traceAny map[string]any
		var tagsAny map[string]string
		if err := rows.Scan(&thID, &seq, &eventID, &turnID, &ts, &typeStr, &level, &payload, &source, &trace, &tags); err != nil {
			return ArchiveQueryResult{}, err
		}
		if first {
			result.MinSeq = seq
			first = false
		}
		result.MaxSeq = seq // rows are ordered ASC, so the last one is the max
		if len(source) > 0 {
			_ = json.Unmarshal(source, &sourceAny)
		}
		if len(trace) > 0 {
			_ = json.Unmarshal(trace, &traceAny)
		}
		if len(tags) > 0 {
			_ = json.Unmarshal(tags, &tagsAny)
		}
		e := eventproto.Event{
			SpecVersion: eventproto.SpecVersion,
			EventID:     eventID,
			ThreadID:    thID,
			TurnID:      turnID,
			Seq:         seq,
			TS:          ts,
			Type:        typeStr,
			Level:       eventproto.Level(level),
			Payload:     payload,
			Source:      sourceAny,
			Trace:       traceAny,
			Tags:        tagsAny,
		}
		b, err := e.Encode()
		if err != nil {
			return ArchiveQueryResult{}, err
		}
		result.Events = append(result.Events, b)
	}
	if err := rows.Err(); err != nil {
		return ArchiveQueryResult{}, err
	}
	return result, nil
}

func (s *Store) InsertArchive(ctx context.Context, a EventArchive) error {
	if strings.TrimSpace(a.ArchiveID) == "" {
		return errors.New("archiveID is required")
	}
	if strings.TrimSpace(a.ThreadID) == "" {
		return errors.New("threadID is required")
	}
	if strings.TrimSpace(a.ObjectKey) == "" {
		return errors.New("objectKey is required")
	}
	if a.ToSeq < a.FromSeq {
		return errors.New("invalid seq range")
	}
	if a.CreatedAt.IsZero() {
		a.CreatedAt = time.Now().UTC()
	}
	_, err := s.pool.Exec(ctx, `INSERT INTO event_archives(
  archive_id, thread_id, from_seq, to_seq, object_key, content_encoding, content_type, event_count, created_at
) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
ON CONFLICT (archive_id) DO NOTHING`,
		a.ArchiveID, a.ThreadID, a.FromSeq, a.ToSeq, a.ObjectKey, a.ContentEncoding, a.ContentType, a.EventCount, a.CreatedAt,
	)
	return err
}

func (s *Store) ListArchives(ctx context.Context, threadID string, limit int64) ([]EventArchive, error) {
	threadID = strings.TrimSpace(threadID)
	if threadID == "" {
		return nil, errors.New("threadID is required")
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}
	rows, err := s.pool.Query(ctx, `SELECT archive_id, thread_id, from_seq, to_seq, object_key, content_encoding, content_type, event_count, created_at
FROM event_archives
WHERE thread_id=$1
ORDER BY from_seq ASC
LIMIT $2`, threadID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []EventArchive
	for rows.Next() {
		var a EventArchive
		if err := rows.Scan(&a.ArchiveID, &a.ThreadID, &a.FromSeq, &a.ToSeq, &a.ObjectKey, &a.ContentEncoding, &a.ContentType, &a.EventCount, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) GetArchive(ctx context.Context, archiveID string) (EventArchive, bool, error) {
	archiveID = strings.TrimSpace(archiveID)
	if archiveID == "" {
		return EventArchive{}, false, errors.New("archiveID is required")
	}
	var a EventArchive
	err := s.pool.QueryRow(ctx, `SELECT archive_id, thread_id, from_seq, to_seq, object_key, content_encoding, content_type, event_count, created_at
FROM event_archives WHERE archive_id=$1`, archiveID).
		Scan(&a.ArchiveID, &a.ThreadID, &a.FromSeq, &a.ToSeq, &a.ObjectKey, &a.ContentEncoding, &a.ContentType, &a.EventCount, &a.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return EventArchive{}, false, nil
		}
		return EventArchive{}, false, err
	}
	return a, true, nil
}

func turnStatus(e eventproto.Event) string {
	switch e.Type {
	case eventproto.TypeTurnStarted:
		return "started"
	case eventproto.TypeTurnCompleted:
		return "completed"
	case eventproto.TypeTurnFailed:
		return "failed"
	case eventproto.TypeTurnCancelled:
		return "cancelled"
	default:
		return "running"
	}
}

func turnCompletedAt(e eventproto.Event) any {
	switch e.Type {
	case eventproto.TypeTurnCompleted, eventproto.TypeTurnFailed, eventproto.TypeTurnCancelled:
		return e.TS
	default:
		return nil
	}
}

func turnInputPayload(e eventproto.Event) any {
	if e.Type != eventproto.TypeTurnInput {
		return json.RawMessage("{}")
	}
	return e.Payload
}
