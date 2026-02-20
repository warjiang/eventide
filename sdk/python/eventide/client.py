"""Gateway client — async HTTP client for POST /events:append."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import httpx

from .types import Event


class GatewayError(Exception):
    """Raised when the gateway returns a non-2xx response."""

    def __init__(self, status: int, body: str) -> None:
        super().__init__(f"gateway responded with {status}: {body}")
        self.status = status
        self.body = body


@dataclass
class AppendResult:
    """Result from a successful append call."""

    event_id: str
    seq: int
    stream_id: Optional[str] = None
    duplicated: bool = False


class GatewayClient:
    """
    Async client for the Eventide event gateway.

    Usage::

        async with GatewayClient("http://127.0.0.1:18081") as client:
            await client.append(Event(
                thread_id="t1",
                turn_id="turn1",
                type=EventType.TURN_STARTED,
                payload={"input": {"msg": "hi"}},
            ))
    """

    def __init__(self, base_url: str, *, timeout: float = 10.0) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(timeout=timeout)

    async def __aenter__(self) -> "GatewayClient":
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    async def append(self, event: Event) -> AppendResult:
        """
        Append a single event to the gateway.

        Args:
            event: The event to send.

        Returns:
            AppendResult with the assigned event_id, seq, etc.

        Raises:
            GatewayError: If the gateway returns a non-2xx status.
        """
        resp = await self._client.post(
            f"{self.base_url}/events:append",
            json={"event": event.to_dict()},
        )
        if resp.status_code < 200 or resp.status_code >= 300:
            raise GatewayError(resp.status_code, resp.text)

        data = resp.json()
        return AppendResult(
            event_id=data.get("event_id", ""),
            seq=data.get("seq", 0),
            stream_id=data.get("stream_id"),
            duplicated=data.get("duplicated", False),
        )

    async def append_all(self, events: List[Event]) -> List[AppendResult]:
        """Append multiple events sequentially."""
        results = []
        for event in events:
            results.append(await self.append(event))
        return results
