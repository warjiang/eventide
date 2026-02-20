#!/usr/bin/env bash
set -euo pipefail

export REDIS_ADDR="${REDIS_ADDR:-127.0.0.1:6380}"
export PG_CONN="${PG_CONN:-postgres://eventide:eventide@127.0.0.1:5433/eventide?sslmode=disable}"

export S3_ENDPOINT="${S3_ENDPOINT:-http://127.0.0.1:8333}"
export S3_REGION="${S3_REGION:-us-east-1}"
export S3_BUCKET="${S3_BUCKET:-eventide}"
export S3_ACCESS_KEY_ID="${S3_ACCESS_KEY_ID:-eventide}"
export S3_SECRET_ACCESS_KEY="${S3_SECRET_ACCESS_KEY:-eventide}"
export S3_PREFIX="${S3_PREFIX:-eventide}"
export S3_USE_PATH_STYLE="${S3_USE_PATH_STYLE:-1}"

mkdir -p bin
make build

bin/migrate

PERSISTER_GROUP=local PERSISTER_CONSUMER=local-1 bin/persister &
PERSIST_PID=$!

HTTP_ADDR=127.0.0.1:18084 bin/beacon &
READ_PID=$!

cleanup() {
  kill "$READ_PID" "$PERSIST_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "running:"
echo "- persister : writes Redis -> Postgres"
echo "- beacon    : http://127.0.0.1:18084"
echo ""
echo "Tip: run milestone-1 stack too (gateway/beacon/agent) to generate events"
echo ""
echo "Note: this repo currently expects running from prebuilt binaries (bin/*)."
echo "If 'go run ./cmd/...' aborts with dyld LC_UUID errors on your machine, use 'make build' + run bin/* instead."
echo ""

wait
