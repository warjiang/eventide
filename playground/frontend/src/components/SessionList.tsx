import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlusIcon, TrashIcon, MessageCircle } from 'lucide-react'

import { SessionData } from "../api"

interface SessionListProps {
    sessions: SessionData[];
    activeSessionId: string | null;
    onSelect: (sessionId: string) => void;
    onDelete: (sessionId: string) => void;
    onCreate: () => void;
}

export default function SessionList({
    sessions,
    activeSessionId,
    onSelect,
    onDelete,
    onCreate,
}: SessionListProps) {
    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between py-5 px-6 border-b border-border/30">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <MessageCircle className="w-3.5 h-3.5" />
                    Sessions
                </span>
                <Button 
                    onClick={onCreate} 
                    size="sm" 
                    className="h-8 gap-2 cursor-pointer bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95 rounded-lg"
                >
                    <PlusIcon className="w-3.5 h-3.5" />
                    New
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="px-4 pt-4 pb-8 flex flex-col gap-2">
                    {sessions.length === 0 ? (
                        <div className="py-10 px-4 text-center text-sm text-muted-foreground">
                            <MessageCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p>No conversations yet.</p>
                            <p className="mt-1 text-xs">Start a new chat!</p>
                        </div>
                    ) : (
                        sessions.map((s) => (
                            <div
                                key={s.session_id}
                                className={`group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all duration-200 hover:scale-[1.02] ${s.session_id === activeSessionId
                                    ? 'bg-primary/10 border border-primary/20 text-foreground'
                                    : 'hover:bg-surface/50 border border-transparent'
                                    }`}
                                onClick={() => onSelect(s.session_id)}
                            >
                                <div className="flex-1 min-w-0 mr-3">
                                    <div className="text-sm font-medium truncate">{s.title}</div>
                                    <div className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
                                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface/50">{s.agent_name}</span>
                                        <span>·</span>
                                        <span>{s.message_count} msgs</span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-8 h-8 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all duration-200"
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation()
                                        onDelete(s.session_id)
                                    }}
                                    title="Delete session"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
