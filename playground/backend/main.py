"""
Playground Backend — FastAPI server for the Agent Playground.

Provides:
  - GET  /api/agents                           → list AgentRuntime resources via kubectl
  - POST /api/invoke                           → invoke an agent via AgentRuntimeClient
  - GET  /api/threads/{thread_id}/events/stream → proxy SSE from beacon
  - CRUD /api/sessions                         → in-memory session management
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from kubernetes import client, config
from sse_starlette.sse import EventSourceResponse

from models import (
    AgentEvent,
    AgentInfo,
    AgentListResponse,
    CreateSessionRequest,
    InvokeRequest,
    InvokeResponse,
    Message,
    MessageRole,
    Session,
    SessionListResponse,
    SessionSummary,
)

# ── Config ───────────────────────────────────────────────────────────────

BEACON_URL = os.getenv("BEACON_URL", "http://127.0.0.1:28082")
AGENTCUBE_ROUTER_URL = os.getenv("AGENTCUBE_ROUTER_URL", "http://localhost:18081")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("playground")

# ── In-memory session store ──────────────────────────────────────────────

sessions: dict[str, Session] = {}


# ── Lifespan ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Playground backend starting — beacon=%s, router=%s", BEACON_URL, AGENTCUBE_ROUTER_URL)
    try:
        kubeconfig_path = os.getenv("KUBECONFIG", os.path.expanduser("~/.kube/agentcube-config"))
        if os.path.exists(kubeconfig_path):
            config.load_kube_config(config_file=kubeconfig_path)
            logger.info("Loaded kubernetes config from %s", kubeconfig_path)
        else:
            config.load_incluster_config()
            logger.info("Loaded in-cluster kubernetes config")
    except Exception as e:
        logger.warning("Failed to load kubernetes config: %s", e)
    yield
    logger.info("Playground backend shutting down")


# ── App ──────────────────────────────────────────────────────────────────

app = FastAPI(title="Agent Playground", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Agents ───────────────────────────────────────────────────────────────

_gvr_cache = None

def get_agent_runtime_gvr():
    global _gvr_cache
    if _gvr_cache is not None:
        return _gvr_cache
    
    try:
        api = client.ApiextensionsV1Api()
        crds = api.list_custom_resource_definition().items
        for crd in crds:
            if crd.spec.names.kind == "AgentRuntime":
                version = crd.spec.versions[0].name
                for v in crd.spec.versions:
                    if v.served and v.storage:
                        version = v.name
                        break
                _gvr_cache = (crd.spec.group, version, crd.spec.names.plural)
                return _gvr_cache
    except Exception as e:
        logger.warning("Failed to look up AgentRuntime CRD dynamically: %s", e)
    
    # Fallback to defaults
    _gvr_cache = ("agentcube.io", "v1alpha1", "agentruntimes")
    return _gvr_cache


def parse_duration(duration_str: str) -> int:
    """
    Parse duration string like '15m', '1h', '30s' to milliseconds.
    Returns milliseconds.
    """
    if not duration_str:
        return 10 * 60 * 1000  # Default 10 minutes
    
    pattern = r'^(\d+)([smhd])$'
    match = re.match(pattern, duration_str.lower())
    
    if not match:
        logger.warning(f"Invalid duration format: {duration_str}, using default 10m")
        return 10 * 60 * 1000
    
    value = int(match.group(1))
    unit = match.group(2)
    
    multipliers = {
        's': 1000,           # seconds to ms
        'm': 60 * 1000,      # minutes to ms
        'h': 60 * 60 * 1000, # hours to ms
        'd': 24 * 60 * 60 * 1000, # days to ms
    }
    
    return value * multipliers.get(unit, 60 * 1000)


async def get_agent_session_timeout(agent_name: str, namespace: str) -> int:
    """
    Get sessionTimeout from AgentRuntime CRD.
    Returns timeout in milliseconds.
    """
    try:
        loop = asyncio.get_running_loop()
        
        def fetch_agent():
            group, version, plural = get_agent_runtime_gvr()
            custom_api = client.CustomObjectsApi()
            return custom_api.get_namespaced_custom_object(
                group=group,
                version=version,
                namespace=namespace,
                plural=plural,
                name=agent_name
            )
        
        agent_data = await loop.run_in_executor(None, fetch_agent)
        spec = agent_data.get("spec", {})
        session_timeout = spec.get("sessionTimeout", "10m")
        
        logger.info(f"Agent {agent_name} sessionTimeout: {session_timeout}")
        return parse_duration(session_timeout)
        
    except Exception as e:
        logger.warning(f"Failed to get sessionTimeout for agent {agent_name}: {e}, using default 10m")
        return 10 * 60 * 1000  # Default 10 minutes

@app.get("/api/agents", response_model=AgentListResponse)
async def list_agents():
    """List AgentRuntime resources from the Kubernetes cluster."""
    try:
        loop = asyncio.get_running_loop()
        
        def fetch_agents():
            group, version, plural = get_agent_runtime_gvr()
            custom_api = client.CustomObjectsApi()
            return custom_api.list_cluster_custom_object(
                group=group,
                version=version,
                plural=plural
            )
            
        data = await loop.run_in_executor(None, fetch_agents)
        items = data.get("items", [])
        agents = []
        for item in items:
            metadata = item.get("metadata", {})
            status = item.get("status", {})
            
            phase = status.get("phase", "Unknown")
            if phase == "Unknown" and "conditions" in status and status["conditions"]:
                phase = status["conditions"][-1].get("type", "Unknown")
                
            agents.append(AgentInfo(
                name=metadata.get("name", "unknown"),
                namespace=metadata.get("namespace", "default"),
                status=phase,
                created_at=metadata.get("creationTimestamp"),
            ))
        return AgentListResponse(agents=agents)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to list agents")
        raise HTTPException(status_code=500, detail=str(e))


# ── Invoke ───────────────────────────────────────────────────────────────

@app.post("/api/invoke", response_model=InvokeResponse)
async def invoke_agent(req: InvokeRequest):
    """Invoke an agent via the AgentCube router.
    
    Manages agentcube session_id for pod reuse and thread_id for multi-turn conversations.
    """
    try:
        invoke_url = f"{AGENTCUBE_ROUTER_URL}/v1/namespaces/{req.namespace}/agent-runtimes/{req.agent_name}/invocations/runcmd"
        logger.info("Invoking agent at %s with prompt: %s", invoke_url, req.prompt[:100])

        headers = {"Content-Type": "application/json"}
        
        # Look up agentcube_session_id from the playground session
        agentcube_session_id = None
        session = sessions.get(req.session_id) if req.session_id else None
        if session and not session.is_agentcube_session_expired():
            agentcube_session_id = session.agentcube_session_id
            headers["x-agentcube-session-id"] = agentcube_session_id
            logger.info(f"Reusing agentcube session: {agentcube_session_id}")
        elif session and session.agentcube_session_id:
            logger.info(f"Agentcube session {session.agentcube_session_id} expired, will create new one")
        else:
            logger.info("No agentcube session found, will create new one")

        # Build request body — pass thread_id so agent reuses the same thread
        payload_data: dict = {"prompt": req.prompt}
        thread_id = req.thread_id or (session.thread_id if session else None)
        if not thread_id:
            from datetime import datetime
            thread_id = f"thread_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
            logger.info(f"Generated new thread_id: {thread_id}")
        else:
            logger.info(f"Reusing thread_id: {thread_id}")

        # Generate a turn_id for this invocation
        turn_id = req.turn_id or f"turn_{uuid.uuid4().hex[:8]}"
        payload_data["thread_id"] = thread_id
        payload_data["turn_id"] = turn_id
        
        body: dict = {"payload": payload_data}

        async with httpx.AsyncClient(timeout=120.0) as http_client:
            resp = await http_client.post(
                invoke_url,
                json=body,
                headers=headers,
            )
            resp.raise_for_status()
            result = resp.json()
            
            # Extract agentcube session_id from response header
            new_agentcube_session_id = resp.headers.get("x-agentcube-session-id")

        returned_thread_id = result.get("thread_id", "")
        if not returned_thread_id:
            raise HTTPException(status_code=400, detail="Agent did not return a thread_id. It likely doesn't support Eventide telemetry.")

        # Update session tracking
        if session:
            session.thread_id = returned_thread_id
            session.last_invoke_at = time.time()
            if new_agentcube_session_id:
                session.agentcube_session_id = new_agentcube_session_id
                logger.info(f"Stored agentcube session_id: {new_agentcube_session_id}")

        return InvokeResponse(
            thread_id=returned_thread_id,
            turn_id=turn_id,
            agentcube_session_id=new_agentcube_session_id or agentcube_session_id,
            output=result.get("output"),
            agent=result.get("agent"),
            timestamp=result.get("timestamp"),
        )
    except httpx.HTTPStatusError as e:
        logger.error("Agent invoke HTTP error: %s — %s", e.response.status_code, e.response.text)
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Failed to invoke agent")
        raise HTTPException(status_code=500, detail=str(e))


# ── SSE Proxy ────────────────────────────────────────────────────────────

@app.get("/api/threads/{thread_id}/events/stream")
async def stream_events(thread_id: str, request: Request):
    """Proxy SSE events from the beacon service."""
    beacon_stream_url = f"{BEACON_URL}/threads/{thread_id}/events/stream"
    logger.info("Proxying SSE from %s", beacon_stream_url)

    async def event_generator() -> AsyncGenerator[dict, None]:
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("GET", beacon_stream_url) as resp:
                    buffer = ""
                    async for chunk in resp.aiter_text():
                        if await request.is_disconnected():
                            return
                        buffer += chunk
                        while "\n" in buffer:
                            line, buffer = buffer.split("\n", 1)
                            line = line.strip()
                            if not line:
                                continue
                            if line.startswith("data: "):
                                data = line[6:]
                                if data == "[DONE]":
                                    yield {"data": "[DONE]"}
                                    return
                                yield {"data": data}
                            elif line.startswith(":"):
                                # Comment / keepalive — skip
                                continue
        except httpx.ReadError:
            logger.warning("SSE connection to beacon closed")
        except Exception as e:
            logger.exception("SSE proxy error")
            yield {"data": json.dumps({"error": str(e)})}

    return EventSourceResponse(event_generator())


# ── Sessions ─────────────────────────────────────────────────────────────

@app.get("/api/sessions", response_model=SessionListResponse)
async def list_sessions():
    """List all sessions (most recent first)."""
    summaries = []
    for s in sorted(sessions.values(), key=lambda x: x.created_at, reverse=True):
        summaries.append(SessionSummary(
            session_id=s.session_id,
            thread_id=s.thread_id,
            agent_name=s.agent_name,
            namespace=s.namespace,
            title=s.title,
            created_at=s.created_at,
            session_timeout_ms=s.session_timeout_ms,
            agentcube_session_id=s.agentcube_session_id,
            last_invoke_at=s.last_invoke_at,
            message_count=len(s.messages),
        ))
    return SessionListResponse(sessions=summaries)


@app.post("/api/sessions", response_model=Session)
async def create_session(req: CreateSessionRequest):
    """Create a new session."""
    session_id = str(uuid.uuid4())[:8]
    
    # Get agent's session timeout from AgentRuntime
    session_timeout_ms = await get_agent_session_timeout(req.agent_name, req.namespace)
    
    session = Session(
        session_id=session_id,
        agent_name=req.agent_name,
        namespace=req.namespace,
        title=req.title,
        session_timeout_ms=session_timeout_ms,
    )
    sessions[session_id] = session
    logger.info(f"Created session {session_id} with timeout {session_timeout_ms}ms")
    return session


@app.get("/api/sessions/{session_id}", response_model=Session)
async def get_session(session_id: str):
    """Get a session by ID."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.post("/api/sessions/{session_id}/messages")
async def add_message(session_id: str, message: Message):
    """Append a message to a session."""
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.messages.append(message)
    # Update thread_id from message if provided
    if message.thread_id and not session.thread_id:
        session.thread_id = message.thread_id
    # Auto-update title from first user message
    if len(session.messages) == 1 and message.role == MessageRole.USER:
        session.title = message.content[:50] + ("..." if len(message.content) > 50 else "")
    return {"ok": True}


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session."""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    del sessions[session_id]
    return {"ok": True}
