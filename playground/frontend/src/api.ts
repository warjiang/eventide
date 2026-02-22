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
    thread_id: string;
    agent_name: string;
    namespace: string;
    title: string;
    messages?: any[];
    message_count?: number;
    // Session expiration tracking
    session_created_at?: number;
    session_expires_at?: number;
}

export async function fetchAgents() {
    const resp = await fetch(`${BASE}/api/agents`);
    if (!resp.ok) throw new Error(`Failed to fetch agents: ${resp.status}`);
    return resp.json();
}

export async function invokeAgent(
    agentName: string, 
    namespace: string, 
    prompt: string,
    sessionId?: string
) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    
    // If session_id is provided and not expired, use it for reuse
    if (sessionId) {
        headers['x-agentcube-session-id'] = sessionId;
    }
    
    const resp = await fetch(`${BASE}/api/invoke`, {
        method: 'POST',
        headers,
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

// ── Thread Session Mapping ───────────────────────────────────────────────

/**
 * Check if a session is still valid (not expired)
 * Default expiration is 10 minutes (600000 ms)
 */
export function isSessionValid(session: SessionData | null, expirationMs: number = 600000): boolean {
    if (!session || !session.session_created_at) return false;
    const now = Date.now();
    const expiresAt = session.session_expires_at || (session.session_created_at + expirationMs);
    return now < expiresAt;
}

/**
 * Get the session_id to use for invocation
 * Returns undefined if session is expired or not found
 */
export function getValidSessionId(session: SessionData | null): string | undefined {
    if (!session) return undefined;
    if (!isSessionValid(session)) return undefined;
    return session.session_id;
}
