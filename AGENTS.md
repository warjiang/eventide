# AGENTS.md — eventide

## Project Overview

**eventide** is a scalable, event-sourced Agent execution architecture built as a Go monorepo. It orchestrates agent turns via sticky Kubernetes Pods, streams events through Redis Streams (hot log), persists them to Postgres (warm store), and archives cold data to SeaweedFS via its S3-compatible gateway.

- **Module path**: `github.com/warjiang/eventide`
- **Go version**: 1.22+
- **Build system**: Makefile (`make build`, `make test`)

## Architecture

```
                    ┌────────────┐
   HTTP POST /turns │  gateway   │──► Redis Stream (per-thread + global)
                    └────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌────────────┐  ┌────────────┐  ┌────────────┐
   │  realtime  │  │  persister │  │  reference  │
   │  (SSE)     │  │  (PG warm) │  │  -agent     │
   └────────────┘  └────────────┘  └────────────┘
                          │
                   ┌──────┴──────┐
                   ▼             ▼
            ┌──────────┐  ┌──────────┐
            │ read-api │  │ archiver │
            │ (query)  │  │ (S3 cold)│
            └──────────┘  └──────────┘
```

### Data Tiers

| Tier | Storage       | Purpose                    |
|------|---------------|----------------------------|
| Hot  | Redis Streams | Real-time event streaming   |
| Warm | Postgres      | Queryable event persistence |
| Cold | SeaweedFS/S3  | Compressed JSONL.gz archives|

## Directory Structure

```
cmd/                     # Executable entry points
├── gateway/             # HTTP API — accepts turns, publishes to Redis
├── realtime/            # SSE endpoint — streams events to clients
├── persister/           # Consumer — writes Redis events to Postgres
├── read-api/            # HTTP API — queries events/archives from PG/S3
├── archiver/            # CLI tool — archives event ranges to S3
├── migrate/             # DB migration runner
└── reference-agent/     # Example agent consuming events

internal/                # Shared libraries (no external consumers)
├── config/              # Environment-based configuration (.env via godotenv)
├── eventproto/          # Core event types and serialization
├── httpx/               # HTTP helpers and middleware
├── id/                  # ULID generation utilities
├── logx/                # Structured logging helpers
├── operator/            # Kubernetes operator / lifecycle helpers
├── pgstore/             # Postgres event store (pgx/v5 connection pool)
├── redisstreams/        # Redis Streams producer/consumer wrappers
└── s3store/             # S3-compatible object storage (aws-sdk-go-v2)

migrations/              # SQL migration files (ordered: 001_init, 002_archives)
scripts/                 # Local run scripts (run-local-m1.sh, run-local-m25.sh)
seaweedfs/               # SeaweedFS S3 gateway config
docs/                    # Design documents (system-design.txt)
```

## Key Dependencies

| Package                  | Purpose                         |
|--------------------------|---------------------------------|
| `go-chi/chi/v5`          | HTTP routing                    |
| `jackc/pgx/v5`           | PostgreSQL driver & pool        |
| `redis/go-redis/v9`      | Redis client (Streams support)  |
| `aws/aws-sdk-go-v2`      | S3-compatible storage access    |
| `oklog/ulid/v2`          | Lexicographically sortable IDs  |
| `k8s.io/apimachinery`    | Kubernetes resource utilities   |

## Database Schema

### Core Tables (001_init.sql)

- **threads** — thread lifecycle tracking (`thread_id`, `tenant_id`, `status`, `last_seq`)
- **turns** — individual turns within a thread (`thread_id`, `turn_id`, `status`, `input` JSONB)
- **agent_events** — immutable event log (`thread_id`, `seq`, `event_id`, `type`, `payload` JSONB); indexed on `(thread_id, seq)` and `(thread_id, turn_id)`

### Archive Tables (002_archives.sql)

- **event_archives** — metadata for S3 archive objects (`archive_id`, `thread_id`, `from_seq`, `to_seq`, `object_key`); indexed on `(thread_id, from_seq, to_seq)`

## Development

### Prerequisites

- Go 1.22+
- Docker & Docker Compose
- `.env` file (copy from `.env.example`)

### Local Setup

```bash
# Start infrastructure (Redis :6380, Postgres :5433, SeaweedFS)
docker compose up -d

# Build all services
make build

# Run migrations
bin/migrate

# Run milestone-1 (gateway + realtime + reference-agent)
./scripts/run-local-m1.sh

# Run milestone-2.5 (persister + read-api)
./scripts/run-local-m25.sh
```

### Testing

```bash
make test
```

## Coding Conventions

- **Configuration**: All services read from environment variables, loaded via `godotenv` from `.env` file. See `internal/config/` for the loader.
- **ID generation**: Use ULIDs via `internal/id/` for all entity identifiers (`thread_id`, `turn_id`, `event_id`, `archive_id`).
- **Event serialization**: Events follow the protobuf-like structure defined in `internal/eventproto/`.
- **Error handling**: Use Go's standard `error` wrapping; avoid third-party error libraries.
- **Redis Streams**: Consumer groups are created with offset `"0"` (from beginning) to prevent data loss. Both per-thread and global streams are used.
- **Database access**: Use `pgx/v5` connection pool via `internal/pgstore/`. Queries use raw SQL (no ORM).
- **S3 access**: Use AWS SDK v2 with path-style addressing for SeaweedFS compatibility. See `internal/s3store/`.
- **Build flags**: Services are built with `-ldflags='-linkmode=external'`.

## Environment Variables

| Variable                 | Description                     | Default             |
|--------------------------|---------------------------------|---------------------|
| `POSTGRES_SERVER`        | Postgres host                   | `127.0.0.1`         |
| `POSTGRES_PORT`          | Postgres port                   | `5433`              |
| `POSTGRES_DB`            | Database name                   | `eventide`          |
| `POSTGRES_USER`          | Database user                   | `eventide`          |
| `POSTGRES_PASSWORD`      | Database password               | —                   |
| `REDIS_HOST`             | Redis host                      | `127.0.0.1`         |
| `REDIS_PORT`             | Redis port                      | `6380`              |
| `REDIS_PASSWORD`         | Redis password                  | —                   |
| `S3_ENDPOINT`            | S3-compatible endpoint          | `http://127.0.0.1:8333` |
| `S3_BUCKET`              | S3 bucket name                  | `uploads`           |
| `S3_ACCESS_KEY_ID`       | S3 access key                   | `eventide`          |
| `S3_SECRET_ACCESS_KEY`   | S3 secret key                   | `eventide`          |
| `S3_USE_PATH_STYLE`      | Use path-style S3 addressing    | `1`                 |
| `HTTP_ADDR`              | HTTP listen address (per svc)   | varies              |
| `EVENT_GATEWAY_URL`      | Gateway URL (for agents)        | —                   |
