"""Core event types — mirrors internal/eventproto/."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from enum import Enum
from typing import Any, Dict, Optional

SPEC_VERSION = "agent-events/1.0"


class EventType(str, Enum):
    """Event type constants — mirrors internal/eventproto/types.go."""

    # Lifecycle
    TURN_STARTED = "turn.started"
    TURN_COMPLETED = "turn.completed"
    TURN_FAILED = "turn.failed"
    TURN_CANCELLED = "turn.cancelled"

    # Message
    MESSAGE_DELTA = "message.delta"
    MESSAGE_COMPLETED = "message.completed"

    # Tool
    TOOL_CALL_STARTED = "tool.call.started"
    TOOL_CALL_ARGS_DELTA = "tool.call.args.delta"
    TOOL_CALL_COMPLETED = "tool.call.completed"
    TOOL_CALL_ERROR = "tool.call.error"

    # State
    STATE_SNAPSHOT = "state.snapshot"
    STATE_DELTA = "state.delta"

    # Custom
    CUSTOM = "custom"
    CUSTOM_COMPONENT = "custom.component"

    # Thread
    THREAD_READY = "thread.ready"


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
        # Remove None optional fields, and empty string fields that should be omitted if unset
        return {
            k: v for k, v in d.items()
            if v is not None and not (isinstance(v, str) and v == "" and k in ["ts", "event_id", "spec_version"])
        }
