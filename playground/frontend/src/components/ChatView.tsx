import { useEffect, useRef } from 'react'
import EventTrace from './EventTrace'
import { MessageSquare, User, Bot } from 'lucide-react'

interface ChatViewProps {
    messages: any[];
    streamingEvents: any[];
    isStreaming: boolean;
}

export default function ChatView({ messages, streamingEvents, isStreaming }: ChatViewProps) {
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, streamingEvents, isStreaming])

    if (messages.length === 0 && !isStreaming) {
        return (
            <div className="flex-1 flex items-center justify-center p-6 text-muted-foreground">
                <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-border/50 flex items-center justify-center text-primary mb-4 shadow-lg shadow-primary/5">
                        <MessageSquare className="w-7 h-7" />
                    </div>
                    <h2 className="text-lg font-semibold text-foreground mb-2">Start a Conversation</h2>
                    <p className="text-xs text-center max-w-xs leading-relaxed text-muted-foreground">
                        Send a message to the selected agent and watch its execution trace in real-time.
                    </p>
                </div>
            </div>
        )
    }

    // Get final output from turn.completed in streaming events
    const turnCompleted = streamingEvents?.find(
        (e: any) => e.type === 'turn.completed' || e.type === 'turn.failed'
    )

    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="max-w-4xl mx-auto px-3 py-4 md:px-4 md:py-5 lg:px-6 space-y-5">
                {messages.map((msg, i) => (
                    <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className={`text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${msg.role === 'user' ? 'text-primary' : 'text-emerald-500'}`}>
                            {msg.role === 'user' ? (
                                <>
                                    <User className="w-3 h-3" />
                                    You
                                </>
                            ) : (
                                <>
                                    <Bot className="w-3 h-3" />
                                    Agent
                                </>
                            )}
                        </div>

                        {msg.role === 'user' && (
                            <div className="rounded-lg p-3 border bg-primary/5 border-primary/20">
                                <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                    {msg.content}
                                </div>
                            </div>
                        )}

                        {msg.events && msg.events.length > 0 && (
                            <div className="mt-3 pl-4">
                                <EventTrace events={msg.events} isStreaming={false} />
                            </div>
                        )}
                    </div>
                ))}

                {/* Streaming assistant message */}
                {isStreaming && (
                    <div className="animate-in fade-in duration-300">
                        <div className="text-[10px] font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-emerald-500">
                            <Bot className="w-3 h-3" />
                            Agent
                        </div>

                        <div className="mt-3 pl-3">
                            <EventTrace
                                events={streamingEvents}
                                isStreaming={!turnCompleted}
                            />
                        </div>
                    </div>
                )}

                <div ref={bottomRef} className="h-2" />
            </div>
        </div>
    )
}
