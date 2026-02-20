# Eventide Python SDK

Python SDK for the Eventide event gateway, mirroring the reference-agent implementation.

## Usage

```python
import asyncio
from eventide import GatewayClient, Event, EventType, Level

async def main():
    async with GatewayClient("http://127.0.0.1:18081") as client:
        await client.append(Event(
            thread_id="t1",
            turn_id="turn1",
            type=EventType.TURN_STARTED,
            payload={"input": {"msg": "hello"}},
        ))

if __name__ == "__main__":
    asyncio.run(main())
```
