#!/bin/bash
# test-custom-component.sh
# Sends a test custom component event to the active session/thread

THREAD_ID=$1
TURN_ID=$2

if [ -z "$THREAD_ID" ] || [ -z "$TURN_ID" ]; then
    echo "Usage: ./test-component.sh <thread_id> <turn_id>"
    exit 1
fi

PAYLOAD='{
  "event": {
    "spec_version": "agent-events/1.0",
    "thread_id": "'$THREAD_ID'",
    "turn_id": "'$TURN_ID'",
    "type": "custom",
    "payload": {
      "__jr__": true,
      "component": "DataTable",
      "props": {
        "columns": ["Name", "Score", "Status"],
        "rows": [
          ["Alice", 95, "Active"],
          ["Bob", 87, "Pending"],
          ["Charlie", 99, "Active"]
        ]
      }
    }
  }
}'

curl -X POST http://127.0.0.1:18081/events:append \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD"

echo -e "\nEvent sent!"
