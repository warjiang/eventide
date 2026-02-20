// Example: mirrors cmd/reference-agent/main.go runTurn()

import { GatewayClient, EventType, Level } from "./index.js";

const GATEWAY_URL = process.env.EVENT_GATEWAY_URL || "http://127.0.0.1:18081";

async function runTurn(client, threadId, turnId, input) {
    // 1. turn.started
    await client.append({
        threadId,
        turnId,
        type: EventType.TurnStarted,
        level: Level.Info,
        payload: { input },
    });

    // 2. stream message deltas
    const msgId = "m1";
    const chunks = ["hello ", "from ", "nodejs ", "sdk"];
    for (const delta of chunks) {
        await client.append({
            threadId,
            turnId,
            type: EventType.MessageDelta,
            level: Level.Info,
            payload: { message_id: msgId, delta },
        });
        await sleep(200);
    }

    // 3. message.completed
    await client.append({
        threadId,
        turnId,
        type: EventType.MessageCompleted,
        level: Level.Info,
        payload: { message_id: msgId },
    });

    // 4. tool.call (optional demonstration)
    await client.append({
        threadId,
        turnId,
        type: EventType.ToolCallStarted,
        level: Level.Info,
        payload: { tool: "fetch_data" },
    });
    await sleep(200);
    await client.append({
        threadId,
        turnId,
        type: EventType.ToolCallCompleted,
        level: Level.Info,
        payload: { tool: "fetch_data", result: "success" },
    });

    // 5. turn.completed
    await client.append({
        threadId,
        turnId,
        type: EventType.TurnCompleted,
        level: Level.Info,
        payload: { ok: true },
    });
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- main ---
const client = new GatewayClient(GATEWAY_URL);
const threadId = "thread-nodejs-demo";
const turnId = "turn-001";

console.log(`Sending events to ${GATEWAY_URL} ...`);
await runTurn(client, threadId, turnId, { message: "hi from Node.js SDK" });
console.log("Done!");
