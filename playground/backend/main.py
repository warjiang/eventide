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
import uuid
from contextlib import asynccontextmanager
from typing import AsyncGenerator

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
    """Invoke an agent via the AgentCube router and return the thread_id."""
    try:
        # Use the AgentCube HTTP API to invoke the agent
        # The router URL pattern is from agentcube router logs: POST /v1/namespaces/:namespace/agent-runtimes/:name/invocations/*path
        invoke_url = f"{AGENTCUBE_ROUTER_URL}/v1/namespaces/{req.namespace}/agent-runtimes/{req.agent_name}/invocations/runcmd"
        logger.info("Invoking agent at %s with prompt: %s", invoke_url, req.prompt[:100])

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                invoke_url,
                json={"payload": {"prompt": req.prompt}},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            result = resp.json()

        thread_id = result.get("thread_id", "")
        if not thread_id:
            raise HTTPException(status_code=400, detail="Agent did not return a thread_id. It likely doesn't support Eventide telemetry.")

        return InvokeResponse(
            thread_id=thread_id,
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
            agent_name=s.agent_name,
            namespace=s.namespace,
            title=s.title,
            created_at=s.created_at,
            message_count=len(s.messages),
        ))
    return SessionListResponse(sessions=summaries)


@app.post("/api/sessions", response_model=Session)
async def create_session(req: CreateSessionRequest):
    """Create a new session."""
    session_id = str(uuid.uuid4())[:8]
    session = Session(
        session_id=session_id,
        agent_name=req.agent_name,
        namespace=req.namespace,
        title=req.title,
    )
    sessions[session_id] = session
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
