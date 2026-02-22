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
            <div className="flex items-center justify-between py-3 px-4 border-b border-border/30">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MessageCircle className="w-3 h-3" />
                    Sessions
                </span>
                <Button 
                    onClick={onCreate} 
                    size="sm" 
                    className="h-7 gap-1.5 cursor-pointer bg-primary hover:bg-primary/90 transition-all duration-200 hover:scale-105 active:scale-95 rounded-md text-xs px-2.5"
                >
                    <PlusIcon className="w-3 h-3" />
                    New
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="px-2 pt-2 pb-6 flex flex-col gap-1">
                    {sessions.length === 0 ? (
                        <div className="py-8 px-4 text-center text-xs text-muted-foreground">
                            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p>No conversations yet.</p>
                            <p className="mt-0.5 text-[10px]">Start a new chat!</p>
                        </div>
                    ) : (
                        sessions.map((s) => (
                            <div
                                key={s.session_id}
                                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${s.session_id === activeSessionId
                                    ? 'bg-primary/10 border border-primary/20 text-foreground'
                                    : 'hover:bg-surface/50 hover:border-border/30 border border-transparent'
                                    }`}
                                onClick={() => onSelect(s.session_id)}
                            >
                                <div className="flex-1 min-w-0 mr-2">
                                    <div className="text-sm font-medium truncate leading-tight">{s.title}</div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                        <span className="font-mono text-[9px] px-1 py-0 rounded bg-surface/50">{s.agent_name}</span>
                                        <span>·</span>
                                        <span>{s.message_count} msgs</span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all duration-200"
                                    onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation()
                                        onDelete(s.session_id)
                                    }}
                                    title="Delete session"
                                >
                                    <TrashIcon className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    )
}
