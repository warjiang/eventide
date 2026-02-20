"""eventide-sdk — Python SDK for the Eventide event gateway."""

from .types import SPEC_VERSION, Event, EventType, Level
from .client import GatewayClient, GatewayError

__all__ = [
    "SPEC_VERSION",
    "Event",
    "EventType",
    "Level",
    "GatewayClient",
    "GatewayError",
]
