#!/usr/bin/env bash
set -euo pipefail

export REDIS_ADDR="${REDIS_ADDR:-127.0.0.1:6380}"

mkdir -p bin

make build

HTTP_ADDR=127.0.0.1:18081 bin/event-gateway &
GW_PID=$!

HTTP_ADDR=127.0.0.1:18082 bin/beacon &
RT_PID=$!

REFERENCE_AGENT_ADDR=127.0.0.1:18080 EVENT_GATEWAY_URL=http://127.0.0.1:18081 bin/reference-agent &
AG_PID=$!

cleanup() {
  kill "$AG_PID" "$RT_PID" "$GW_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "running:"
echo "- event-gateway  : http://127.0.0.1:18081"
echo "- beacon (SSE)   : http://127.0.0.1:18082"
echo "- reference-agent: http://127.0.0.1:18080"

echo ""
echo "Try:"
echo "curl -N 'http://127.0.0.1:18082/threads/01J00000000000000000000000/events/stream'"
echo "curl -sS -X POST http://127.0.0.1:18080/turns -H 'content-type: application/json' -d '{\"thread_id\":\"01J00000000000000000000000\",\"turn_id\":\"01J00000000000000000000001\",\"input\":{\"text\":\"hello\"}}'"

wait
