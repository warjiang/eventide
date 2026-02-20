"""Core event types — mirrors internal/eventproto/."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, Optional

SPEC_VERSION = "agent-events/1.0"


class EventType(str, Enum):
    """Event type constants — mirrors internal/eventproto/types.go."""

    THREAD_READY = "thread.ready"
    THREAD_HEARTBEAT = "thread.heartbeat"
    THREAD_SUSPENDED = "thread.suspended"
    THREAD_RESUMED = "thread.resumed"

    TURN_STARTED = "turn.started"
    TURN_INPUT = "turn.input"
    TURN_COMPLETED = "turn.completed"
    TURN_FAILED = "turn.failed"
    TURN_CANCELLED = "turn.cancelled"

    ASSISTANT_DELTA = "assistant.message.delta"
    ASSISTANT_COMPLETED = "assistant.message.completed"

    STATE_CHECKPOINT = "state.checkpoint"


class Level(str, Enum):
    """Event level constants — mirrors internal/eventproto/event.go."""

    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"


@dataclass
class Event:
    """
    Represents a single event to send to the gateway.

    Only ``thread_id``, ``turn_id``, ``type``, and ``level`` are required.
    The gateway auto-fills ``spec_version``, ``event_id``, ``ts``, and ``seq``
    when omitted.
    """

    thread_id: str
    turn_id: str
    type: str  # use EventType values
    level: str = Level.INFO  # use Level values
    payload: Any = field(default_factory=dict)

    # Optional — auto-filled by gateway when omitted/empty
    spec_version: str = SPEC_VERSION
    event_id: str = ""
    ts: str = ""
    seq: int = 0

    # Optional metadata
    content_type: Optional[str] = None
    source: Optional[Dict[str, Any]] = None
    trace: Optional[Dict[str, Any]] = None
    tags: Optional[Dict[str, str]] = None

    def to_dict(self) -> dict:
        """Serialize to the JSON structure expected by POST /events:append."""
        d = asdict(self)
        # Remove None optional fields to keep the payload clean
        return {k: v for k, v in d.items() if v is not None}
