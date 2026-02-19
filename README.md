# eventide

Scalable, event-sourced Agent execution architecture on:

- Kubernetes (sticky Pods per `thread_id`)
- Redis Streams (hot event log)
- Postgres (warm event store)
- SeaweedFS via S3 Gateway (cold archives)

This repository is intentionally structured as a Go monorepo with multiple small services under `cmd/`.

## Quickstart (local milestone-1)

1) Start dependencies:

This repo's `docker-compose.yml` uses port `6380` (Redis) and `5433` (Postgres) to avoid conflicts.

```bash
docker compose up -d
```

2) Build and run all services:

```bash
chmod +x scripts/run-local-m1.sh
./scripts/run-local-m1.sh
```

3) Alternatively, run each service manually:

Gateway:

```bash
make build
HTTP_ADDR=127.0.0.1:18081 bin/event-gateway
```

Realtime SSE:

```bash
make build
HTTP_ADDR=127.0.0.1:18082 bin/realtime
```

Reference agent:

```bash
make build
EVENT_GATEWAY_URL=http://127.0.0.1:18081 bin/reference-agent
```

Create a thread + turn:

```bash
curl -sS -X POST http://127.0.0.1:18080/turns \
  -H 'content-type: application/json' \
  -d '{"thread_id":"01J00000000000000000000000","turn_id":"01J00000000000000000000001","input":{"text":"hello"}}'
```

Watch SSE:

```bash
curl -N "http://127.0.0.1:18082/threads/01J00000000000000000000000/events/stream"
```

## Quickstart (local milestone-2.5: warm + cold)

This starts Postgres persistence (warm store) and SeaweedFS S3 gateway (cold store), plus the read API.

1) Start dependencies (Redis, Postgres, SeaweedFS):

```bash
docker compose up -d
```

2) Run persister + read-api:

```bash
chmod +x scripts/run-local-m25.sh
./scripts/run-local-m25.sh
```

3) Generate some events (run milestone-1 in another terminal):

```bash
chmod +x scripts/run-local-m1.sh
./scripts/run-local-m1.sh
```

4) Archive a seq range to S3 (JSONL.gz):

```bash
ARCHIVE_THREAD_ID=01J00000000000000000000000 \
ARCHIVE_FROM_SEQ=1 ARCHIVE_TO_SEQ=200 \
bin/archiver
```

5) List archives (manifest in Postgres):

```bash
curl -sS "http://127.0.0.1:18084/threads/01J00000000000000000000000/archives" | jq
```

6) Fetch an archive object (streamed from SeaweedFS S3):

```bash
curl -sS "http://127.0.0.1:18084/threads/01J00000000000000000000000/archives/<archive_id>" > archive.jsonl.gz
```
