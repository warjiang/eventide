"""Pydantic models for the Playground API."""

from __future__ import annotations

import time
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ── Agent Models ─────────────────────────────────────────────────────────

class AgentInfo(BaseModel):
    name: str
    namespace: str
    status: str = "Unknown"
    created_at: str | None = None


class AgentListResponse(BaseModel):
    agents: list[AgentInfo]


# ── Invoke Models ────────────────────────────────────────────────────────

class InvokeRequest(BaseModel):
    agent_name: str
    namespace: str = "default"
    prompt: str
    session_id: str | None = None     # playground session_id, used to look up agentcube_session_id
    thread_id: str | None = None      # reuse existing thread_id for multi-turn conversations
    turn_id: str | None = None        # use existing turn_id if provided


class InvokeResponse(BaseModel):
    thread_id: str
    turn_id: str | None = None
    agentcube_session_id: str | None = None  # agentcube runtime session id for pod reuse
    output: str | None = None
    agent: str | None = None
    timestamp: str | None = None


# ── Session Models ───────────────────────────────────────────────────────

class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"


class AgentEvent(BaseModel):
    """A single SSE event from the agent execution trace."""
    event_id: str = ""
    thread_id: str = ""
    turn_id: str = ""
    seq: int = 0
    ts: str = ""
    type: str = ""
    level: str = "info"
    payload: dict[str, Any] = Field(default_factory=dict)


class Message(BaseModel):
    role: MessageRole
    content: str
    thread_id: str | None = None
    events: list[AgentEvent] = Field(default_factory=list)
    timestamp: float = Field(default_factory=time.time)


class Session(BaseModel):
    session_id: str
    thread_id: str | None = None
    agent_name: str
    namespace: str = "default"
    title: str = "New Chat"
    created_at: float = Field(default_factory=time.time)
    session_timeout_ms: int = 10 * 60 * 1000  # Default 10 minutes
    messages: list[Message] = Field(default_factory=list)
    # agentcube runtime tracking
    agentcube_session_id: str | None = None   # agentcube pod session id
    last_invoke_at: float | None = None       # timestamp of last successful invoke

    def is_agentcube_session_expired(self) -> bool:
        """Check if the agentcube session has expired based on last_invoke_at + session_timeout_ms."""
        if not self.agentcube_session_id or not self.last_invoke_at:
            return True
        return time.time() * 1000 > (self.last_invoke_at * 1000 + self.session_timeout_ms)


class SessionSummary(BaseModel):
    """Session metadata returned in list (without full messages)."""
    session_id: str
    thread_id: str | None = None
    agent_name: str
    namespace: str = "default"
    title: str
    created_at: float
    session_timeout_ms: int = 10 * 60 * 1000
    agentcube_session_id: str | None = None
    last_invoke_at: float | None = None
    message_count: int = 0


class SessionListResponse(BaseModel):
    sessions: list[SessionSummary]


class CreateSessionRequest(BaseModel):
    agent_name: str
    namespace: str = "default"
    title: str = "New Chat"
