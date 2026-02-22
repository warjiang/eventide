import { useEffect, useRef } from 'react'
import EventTrace from './EventTrace'
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare } from 'lucide-react'

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
            <div className="flex-1 flex items-center justify-center p-10 text-muted-foreground">
                <div className="flex flex-col items-center justify-center">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent border border-border flex items-center justify-center text-primary mb-5 shadow-sm">
                        <MessageSquare className="w-9 h-9" />
                    </div>
                    <h2 className="text-xl font-semibold text-foreground mb-3">Start a Conversation</h2>
                    <p className="text-sm text-center max-w-xs leading-relaxed">
                        Send a message to the selected agent and watch its execution trace in real-time.
                    </p>
                </div>
            </div>
        )
    }

    // Collect streaming message delta text
    const streamingText = isStreaming
        ? streamingEvents
            .filter((e: any) => e.type === 'message.delta')
            .map((e: any) => e.payload?.delta || '')
            .join('')
        : ''

    // Get final output from turn.completed in streaming events
    const turnCompleted = streamingEvents?.find(
        (e: any) => e.type === 'turn.completed' || e.type === 'turn.failed'
    )

    return (
        <ScrollArea className="flex-1">
            <div className="max-w-4xl mx-auto px-4 py-6 md:px-6 md:py-8 lg:px-8 space-y-6">
                {messages.map((msg, i) => (
                    <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className={`text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2 ${msg.role === 'user' ? 'text-primary' : 'text-emerald-500'
                            }`}>
                            {msg.role === 'user' ? (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M8 8a3 3 0 100-6 3 3 0 000 6zM2 14a6 6 0 0112 0H2z" />
                                    </svg>
                                    You
                                </>
                            ) : (
                                <>
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                        <path d="M6 1a2 2 0 00-2 2v1H3a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a2 2 0 00-2-2H6zm0 2h4v1H6V3zM5 8a1 1 0 110-2 1 1 0 010 2zm6 0a1 1 0 110-2 1 1 0 010 2zM5 10h6v1H5v-1z" />
                                    </svg>
                                    Agent
                                </>
                            )}
                        </div>

                        <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                            {msg.content}
                        </div>

                        {msg.events?.length > 0 && (
                            <div className="mt-4 pl-5 border-l-2 border-border/60">
                                <EventTrace events={msg.events} isStreaming={false} />
                            </div>
                        )}
                    </div>
                ))}

                {/* Streaming assistant message */}
                {isStreaming && (
                    <div className="animate-in fade-in duration-300">
                        <div className="text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-emerald-500">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M6 1a2 2 0 00-2 2v1H3a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a2 2 0 00-2-2H6zm0 2h4v1H6V3zM5 8a1 1 0 110-2 1 1 0 010 2zm6 0a1 1 0 110-2 1 1 0 010 2zM5 10h6v1H5v-1z" />
                            </svg>
                            Agent
                        </div>

                        {streamingText && (
                            <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                                {streamingText}
                                <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-text-bottom animate-pulse" />
                            </div>
                        )}

                        <div className="mt-3 pl-4 border-l-2 border-border/60">
                            <EventTrace
                                events={streamingEvents}
                                isStreaming={!turnCompleted}
                            />
                        </div>
                    </div>
                )}

                <div ref={bottomRef} className="h-4" />
            </div>
        </ScrollArea>
    )
}
