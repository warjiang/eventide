import { useState, useCallback, useRef, useEffect } from 'react'
import AgentSelector from './components/AgentSelector'
import SessionList from './components/SessionList'
import ChatView from './components/ChatView'
import ChatInput from './components/ChatInput'
import ThemeToggle from './components/ThemeToggle'
import { useTheme } from './hooks/useTheme'
import { Zap, Bot, AlertTriangle } from 'lucide-react'
import {
    invokeAgent,
    streamEvents,
    fetchSessions,
    createSession,
    addMessage,
    deleteSession as apiDeleteSession,
} from './api'

import { Agent, SessionData } from './api'

export default function App() {
    const { theme, setTheme, isDark } = useTheme()
    const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
    const [sessions, setSessions] = useState<SessionData[]>([])
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
    const [messages, setMessages] = useState<any[]>([])
    const [isStreaming, setIsStreaming] = useState<boolean>(false)
    const [streamingEvents, setStreamingEvents] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)
    const eventSourceRef = useRef<EventSource | null>(null)

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

    const handleCreateSession = useCallback(async () => {
        if (!selectedAgent) return
        try {
            const session = await createSession(
                selectedAgent.name,
                selectedAgent.namespace,
                'New Chat'
            )
            await refreshSessions()
            setActiveSessionId(session.session_id)
            setMessages([])
            setStreamingEvents([])
            setIsStreaming(false)
        } catch (err: any) {
            setError(err.message)
        }
    }, [selectedAgent, refreshSessions])

    const handleSelectSession = useCallback(
        async (sessionId: string) => {
            setActiveSessionId(sessionId)
            // Close any active SSE connection
            if (eventSourceRef.current) {
                eventSourceRef.current.close()
                eventSourceRef.current = null
            }
            setIsStreaming(false)
            setStreamingEvents([])

            // Load session messages from backend
            try {
                const resp = await fetch(`/api/sessions/${sessionId}`)
                if (resp.ok) {
                    const session = await resp.json()
                    setMessages(session.messages || [])
                    // Auto-select the agent for this session
                    if (session.agent_name) {
                        setSelectedAgent({
                            name: session.agent_name,
                            namespace: session.namespace || 'default',
                        })
                    }
                }
            } catch (err: any) {
                console.error('Failed to load session:', err)
            }
        },
        []
    )

    const handleDeleteSession = useCallback(
        async (sessionId: string) => {
            try {
                await apiDeleteSession(sessionId)
                if (activeSessionId === sessionId) {
                    setActiveSessionId(null)
                    setMessages([])
                }
                await refreshSessions()
            } catch (err: any) {
                console.error('Failed to delete session:', err)
            }
        },
        [activeSessionId, refreshSessions]
    )

    // ── Send message ────────────────────────────────────────────────────

    const handleSend = useCallback(
        async (prompt: string) => {
            if (!selectedAgent || isStreaming) return

            setError(null)

            // Create session if none active
            let sessionId = activeSessionId
            if (!sessionId) {
                try {
                    const session = await createSession(
                        selectedAgent.name,
                        selectedAgent.namespace,
                        prompt.slice(0, 50) + (prompt.length > 50 ? '...' : '')
                    )
                    sessionId = session.session_id
                    setActiveSessionId(sessionId)
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

            // Invoke agent
            setIsStreaming(true)
            setStreamingEvents([])

            try {
                const result = await invokeAgent(
                    selectedAgent.name,
                    selectedAgent.namespace,
                    prompt
                )
                const threadId = result.thread_id

                // Start streaming SSE events
                const collectedEvents: any[] = []
                const evtSource = streamEvents(
                    threadId,
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
        [selectedAgent, isStreaming, activeSessionId, refreshSessions]
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
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    onSelect={handleSelectSession}
                    onDelete={handleDeleteSession}
                    onCreate={handleCreateSession}
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
