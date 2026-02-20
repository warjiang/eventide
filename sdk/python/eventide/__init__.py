"""eventide-sdk — Python SDK for the Eventide event gateway."""

import logging

from .types import SPEC_VERSION, Event, EventType, Level
from .client import GatewayClient, GatewayError

# Mute httpx INFO logs by default
logging.getLogger("httpx").setLevel(logging.WARNING)

__all__ = [
    "SPEC_VERSION",
    "Event",
    "EventType",
    "Level",
    "GatewayClient",
    "GatewayError",
]
