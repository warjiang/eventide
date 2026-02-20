CREATE TABLE IF NOT EXISTS threads (
  thread_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_active_at TIMESTAMPTZ NOT NULL,
  idle_timeout_seconds INT NOT NULL DEFAULT 900,
  last_seq BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS turns (
  thread_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  status TEXT NOT NULL,
  input JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (thread_id, turn_id)
);

CREATE TABLE IF NOT EXISTS agent_events (
  thread_id TEXT NOT NULL,
  seq BIGINT NOT NULL,
  event_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL,
  level TEXT NOT NULL,
  payload JSONB NOT NULL,
  source JSONB,
  trace JSONB,
  tags JSONB,
  UNIQUE (event_id),
  UNIQUE (thread_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_agent_events_thread_seq ON agent_events(thread_id, seq);
CREATE INDEX IF NOT EXISTS idx_agent_events_thread_turn ON agent_events(thread_id, turn_id);
