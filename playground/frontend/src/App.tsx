import { useState, useCallback, useRef, useEffect } from 'react'
import AgentSelector from './components/AgentSelector'
import SessionList from './components/SessionList'
import ChatView from './components/ChatView'
import ChatInput from './components/ChatInput'
import ThemeToggle from './components/ThemeToggle'
import { useTheme } from './hooks/useTheme'
import { useParams, useNavigate } from 'react-router-dom'
import { Zap, Bot, AlertTriangle } from 'lucide-react'
import {
    invokeAgent,
    streamEvents,
    fetchSessions,
    createSession,
    addMessage,
    deleteSession,
} from './api'

import { Agent, SessionData } from './api'

export default function App() {
    const { theme, setTheme, isDark } = useTheme()
    const { sessionId: activeSessionId } = useParams()
    const navigate = useNavigate()
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [sessions, setSessions] = useState<SessionData[]>([])
    const [messages, setMessages] = useState<any[]>([])
    const [isStreaming, setIsStreaming] = useState<boolean>(false)
    const [streamingEvents, setStreamingEvents] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)
    const eventSourceRef = useRef<EventSource | null>(null)
    const ignoreSessionChangeRef = useRef(false)

    // ── Session management ──────────────────────────────────────────────

    const refreshSessions = useCallback(async () => {
        try {
            const data = await fetchSessions()
            setSessions(data.sessions || [])
        } catch (err: any) {
            console.error('Failed to refresh sessions:', err)
        }
    }, [])

    // ── Initial load ────────────────────────────────────────────────────

    useEffect(() => {
        refreshSessions()
    }, [refreshSessions])

    // Load session when URL changes
    useEffect(() => {
        if (ignoreSessionChangeRef.current) {
            ignoreSessionChangeRef.current = false
            return
        }

        if (!activeSessionId) {
            if (eventSourceRef.current) {
                eventSourceRef.current.close()
                eventSourceRef.current = null
            }
            setIsStreaming(false)
            setStreamingEvents([])
            setMessages([])
            return
        }

        let isMounted = true

        const loadSession = async () => {
            // Close any active SSE connection
            if (eventSourceRef.current) {
                eventSourceRef.current.close()
                eventSourceRef.current = null
            }
            setIsStreaming(false)
            setStreamingEvents([])
            setMessages([])

            // Load session messages from backend
            try {
                const resp = await fetch(`/api/sessions/${activeSessionId}`)
                if (resp.ok) {
                    const session = await resp.json()
                    if (isMounted) {
                        setMessages(session.messages || [])
                        // Auto-select the agent for this session
                        if (session.agent_name) {
                            setSelectedAgent({
                                name: session.agent_name,
                                namespace: session.namespace || 'default',
                            })
                        }
                    }
                }
            } catch (err: any) {
                console.error('Failed to load session:', err)
            }
        }

        loadSession()

        return () => {
            isMounted = false
        }
    }, [activeSessionId])

    const handleCreateSession = useCallback(async () => {
        if (!selectedAgent) return
        try {
            const session = await createSession(
                selectedAgent.name,
                selectedAgent.namespace,
                'New Chat'
            )
            await refreshSessions()
            navigate(`/chat/${session.session_id}`)
        } catch (err: any) {
            setError(err.message)
        }
    }, [selectedAgent, refreshSessions, navigate])

    const handleSelectSession = useCallback(
        (sessionId: string) => {
            navigate(`/chat/${sessionId}`)
        },
        [navigate]
    )

    const handleDeleteSession = useCallback(
        async (sessionId: string) => {
            try {
                await deleteSession(sessionId)
                if (activeSessionId === sessionId) {
                    navigate('/')
                }
                await refreshSessions()
            } catch (err: any) {
                console.error('Failed to delete session:', err)
            }
        },
        [activeSessionId, refreshSessions, navigate]
    )

    // ── Send message ────────────────────────────────────────────────────

    const handleSend = useCallback(
        async (prompt: string) => {
            if (!selectedAgent || isStreaming) return

            setError(null)

            // Get current session data
            const currentSession = sessions.find(s => s.session_id === activeSessionId)

            // Create session if none active
            let sessionId = activeSessionId
            let threadId = currentSession?.thread_id

            if (!sessionId) {
                try {
                    const session = await createSession(
                        selectedAgent.name,
                        selectedAgent.namespace,
                        prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '')
                    )
                    sessionId = session.session_id
                    threadId = session.thread_id
                    ignoreSessionChangeRef.current = true
                    navigate(`/chat/${sessionId}`, { replace: true })
                    await refreshSessions()
                } catch (err: any) {
                    setError(`Failed to create session: ${err.message}`)
                    return
                }
            }

            // Add user message
            const userMsg = { role: 'user', content: prompt, timestamp: Date.now() / 1000 }
            setMessages((prev) => [...prev, userMsg])

            // Save user message to backend
            if (sessionId) {
                try {
                    await addMessage(sessionId, userMsg)
                } catch (err: any) {
                    console.error('Failed to save user message:', err)
                }
            }

            // Invoke agent — backend handles agentcube session reuse and timeout
            setIsStreaming(true)
            setStreamingEvents([])

            try {
                const result = await invokeAgent(
                    selectedAgent.name,
                    selectedAgent.namespace,
                    prompt,
                    sessionId || undefined,   // playground session_id
                    threadId                  // reuse thread_id for multi-turn
                )

                // Update thread_id from response (first turn sets it, subsequent turns reuse it)
                if (result.thread_id) {
                    threadId = result.thread_id
                    // Update session list so next turn picks up the thread_id
                    setSessions(prev => prev.map(s =>
                        s.session_id === sessionId
                            ? { ...s, thread_id: result.thread_id, agentcube_session_id: result.agentcube_session_id }
                            : s
                    ))
                }

                // Ensure threadId is defined before streaming
                if (!threadId) {
                    setIsStreaming(false)
                    setError('No thread ID returned from agent')
                    return
                }

                // Start streaming SSE events
                const collectedEvents: any[] = []
                const evtSource = streamEvents(
                    threadId,
                    result.turn_id,
                    // onEvent
                    (event) => {
                        collectedEvents.push(event)
                        setStreamingEvents([...collectedEvents])
                    },
                    // onDone
                    async () => {
                        setIsStreaming(false)

                        // Extract final output from events
                        const turnEnd = collectedEvents.find(
                            (e) => e.type === 'turn.completed' || e.type === 'turn.failed'
                        )
                        const deltas = collectedEvents
                            .filter((e) => e.type === 'message.delta')
                            .map((e) => e.payload?.delta || '')
                            .join('')

                        const assistantContent = deltas || turnEnd?.payload?.output || ''
                        const assistantMsg = {
                            role: 'assistant',
                            content: assistantContent,
                            thread_id: threadId,
                            events: collectedEvents,
                            timestamp: Date.now() / 1000,
                        }

                        setMessages((prev) => [...prev, assistantMsg])
                        setStreamingEvents([])

                        // Save to backend
                        if (sessionId) {
                            try {
                                await addMessage(sessionId, assistantMsg)
                                await refreshSessions()
                            } catch (err: any) {
                                console.error('Failed to save assistant message:', err)
                            }
                        }
                    },
                    // onError
                    (err) => {
                        setIsStreaming(false)
                        setError('SSE connection error')
                        console.error('SSE error:', err)
                    }
                )
                eventSourceRef.current = evtSource
            } catch (err: any) {
                setIsStreaming(false)
                setError(err.message)
            }
        },
        [selectedAgent, isStreaming, activeSessionId, sessions, refreshSessions, navigate]
    )

    // ── Render ──────────────────────────────────────────────────────────

    return (
        <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
            {/* Sidebar */}
            <aside className="w-[280px] min-w-[280px] bg-muted/20 border-r border-border flex flex-col hidden sm:flex">
                <div className="px-5 py-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        <h1 className="text-sm font-semibold bg-gradient-to-br from-primary to-purple-400 bg-clip-text text-transparent tracking-tight flex items-center gap-2">
                            <Zap className="w-4 h-4 text-primary" /> Agent Playground
                        </h1>
                        <ThemeToggle theme={theme} setTheme={setTheme} isDark={isDark} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                        Eventide — Real-time Agent Traces
                    </p>
                </div>

                <AgentSelector selectedAgent={selectedAgent} onSelect={setSelectedAgent} />

                <SessionList
                    sessions={sessions.filter(s =>
                        selectedAgent &&
                        s.agent_name === selectedAgent.name &&
                        s.namespace === selectedAgent.namespace
                    )}
                    activeSessionId={activeSessionId || null}
                    onSelect={handleSelectSession}
                    onDelete={handleDeleteSession}
                    onCreate={handleCreateSession}
                    selectedAgent={selectedAgent}
                />
            </aside>

            {/* Main area */}
            <main className="flex-1 flex flex-col overflow-hidden bg-background">
                {!selectedAgent ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground p-8">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-transparent border border-border flex items-center justify-center text-primary shadow-sm">
                            <Bot className="w-8 h-8" />
                        </div>
                        <h2 className="text-lg font-semibold text-foreground">Select an Agent</h2>
                        <p className="text-sm max-w-sm text-center leading-relaxed">
                            Choose an agent from the sidebar to start a conversation.
                        </p>
                    </div>
                ) : (
                    <>
                        <ChatView
                            messages={messages}
                            streamingEvents={streamingEvents}
                            isStreaming={isStreaming}
                        />

                        {error && (
                            <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-sm text-center flex items-center justify-center gap-1.5">
                                <AlertTriangle className="w-4 h-4" /> {error}
                            </div>
                        )}

                        <div className="flex justify-center px-4 py-3">
                            <div className="w-full max-w-3xl">
                                <ChatInput
                                    onSend={handleSend}
                                    disabled={isStreaming || !selectedAgent}
                                    placeholder={
                                        isStreaming
                                            ? 'Agent is working...'
                                            : `Send a prompt to ${selectedAgent?.name || 'agent'}...`
                                    }
                                />
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
