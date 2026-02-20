CREATE TABLE IF NOT EXISTS event_archives (
  archive_id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  from_seq BIGINT NOT NULL,
  to_seq BIGINT NOT NULL,
  object_key TEXT NOT NULL,
  content_encoding TEXT NOT NULL,
  content_type TEXT NOT NULL,
  event_count BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_archives_thread_seq ON event_archives(thread_id, from_seq, to_seq);
