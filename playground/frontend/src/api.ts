/**
 * API client for the Playground backend.
 */

const BASE = '';  // proxied via Vite → http://127.0.0.1:8000

export interface Agent {
    name: string;
    namespace: string;
}

export interface SessionData {
    session_id: string;
    agent_name: string;
    namespace: string;
    title: string;
    messages?: any[];
    message_count?: number;
}

export async function fetchAgents() {
    const resp = await fetch(`${BASE}/api/agents`);
    if (!resp.ok) throw new Error(`Failed to fetch agents: ${resp.status}`);
    return resp.json();
}

export async function invokeAgent(agentName: string, namespace: string, prompt: string) {
    const resp = await fetch(`${BASE}/api/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_name: agentName, namespace, prompt }),
    });
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Invoke failed (${resp.status}): ${text}`);
    }
    return resp.json();
}

export function streamEvents(
    threadId: string,
    onEvent: (event: any) => void,
    onDone: () => void,
    onError: (err: Event) => void
) {
    const evtSource = new EventSource(`${BASE}/api/threads/${threadId}/events/stream`);
    evtSource.onmessage = (e) => {
        if (e.data === '[DONE]') {
            evtSource.close();
            onDone?.();
            return;
        }
        try {
            const event = JSON.parse(e.data);
            onEvent(event);
        } catch (err) {
            console.warn('Failed to parse SSE event:', e.data, err);
        }
    };
    evtSource.onerror = (err) => {
        evtSource.close();
        onError?.(err);
    };
    return evtSource;
}

// ── Sessions ─────────────────────────────────────────────────────────────

export async function fetchSessions() {
    const resp = await fetch(`${BASE}/api/sessions`);
    if (!resp.ok) throw new Error(`Failed to fetch sessions: ${resp.status}`);
    return resp.json();
}

export async function createSession(agentName: string, namespace: string, title: string) {
    const resp = await fetch(`${BASE}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_name: agentName, namespace, title }),
    });
    if (!resp.ok) throw new Error(`Failed to create session: ${resp.status}`);
    return resp.json();
}

export async function fetchSession(sessionId: string) {
    const resp = await fetch(`${BASE}/api/sessions/${sessionId}`);
    if (!resp.ok) throw new Error(`Failed to fetch session: ${resp.status}`);
    return resp.json();
}

export async function addMessage(sessionId: string, message: any) {
    const resp = await fetch(`${BASE}/api/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
    });
    if (!resp.ok) throw new Error(`Failed to add message: ${resp.status}`);
    return resp.json();
}

export async function deleteSession(sessionId: string) {
    const resp = await fetch(`${BASE}/api/sessions/${sessionId}`, {
        method: 'DELETE',
    });
    if (!resp.ok) throw new Error(`Failed to delete session: ${resp.status}`);
    return resp.json();
}
