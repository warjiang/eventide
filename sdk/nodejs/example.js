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

    // 2. turn.input
    await client.append({
        threadId,
        turnId,
        type: EventType.TurnInput,
        level: Level.Info,
        payload: { input },
    });

    // 3. stream assistant message deltas
    const msgId = "m1";
    const chunks = ["hello ", "from ", "nodejs ", "sdk"];
    for (const delta of chunks) {
        await client.append({
            threadId,
            turnId,
            type: EventType.AssistantDelta,
            level: Level.Info,
            payload: { message_id: msgId, delta },
        });
        await sleep(200);
    }

    // 4. assistant.message.completed
    await client.append({
        threadId,
        turnId,
        type: EventType.AssistantCompleted,
        level: Level.Info,
        payload: { message_id: msgId },
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
