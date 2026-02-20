# Example: mirrors cmd/reference-agent/main.go runTurn()

import asyncio
import os

from eventide import GatewayClient, Event, EventType, Level

GATEWAY_URL = os.getenv("EVENT_GATEWAY_URL", "http://127.0.0.1:18081")


async def run_turn(
    client: GatewayClient,
    thread_id: str,
    turn_id: str,
    user_input: dict,
) -> None:
    # 1. turn.started
    await client.append(Event(
        thread_id=thread_id,
        turn_id=turn_id,
        type=EventType.TURN_STARTED,
        level=Level.INFO,
        payload={"input": user_input},
    ))

    # 2. stream message deltas
    msg_id = "m1"
    chunks = ["hello ", "from ", "python ", "sdk"]
    for delta in chunks:
        await client.append(Event(
            thread_id=thread_id,
            turn_id=turn_id,
            type=EventType.MESSAGE_DELTA,
            level=Level.INFO,
            payload={"message_id": msg_id, "delta": delta},
        ))
        await asyncio.sleep(0.2)

    # 3. message.completed
    await client.append(Event(
        thread_id=thread_id,
        turn_id=turn_id,
        type=EventType.MESSAGE_COMPLETED,
        level=Level.INFO,
        payload={"message_id": msg_id},
    ))

    # 4. tool.call (optional demonstration)
    await client.append(Event(
        thread_id=thread_id,
        turn_id=turn_id,
        type=EventType.TOOL_CALL_STARTED,
        level=Level.INFO,
        payload={"tool": "search", "arguments": {}},
    ))
    await asyncio.sleep(0.5)
    await client.append(Event(
        thread_id=thread_id,
        turn_id=turn_id,
        type=EventType.TOOL_CALL_COMPLETED,
        level=Level.INFO,
        payload={"tool": "search", "result": "Python SDK found"},
    ))

    # 5. turn.completed
    await client.append(Event(
        thread_id=thread_id,
        turn_id=turn_id,
        type=EventType.TURN_COMPLETED,
        level=Level.INFO,
        payload={"ok": True},
    ))


async def main() -> None:
    thread_id = "thread-python-demo"
    turn_id = "turn-001"

    print(f"Sending events to {GATEWAY_URL} ...")
    async with GatewayClient(GATEWAY_URL) as client:
        await run_turn(client, thread_id, turn_id, {"message": "hi from Python SDK"})
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
