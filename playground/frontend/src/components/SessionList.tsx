import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlusIcon, TrashIcon } from "@radix-ui/react-icons"

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
            <div className="flex items-center justify-between py-6 px-5 border-b border-border/50">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Sessions</span>
                <Button onClick={onCreate} size="sm" className="h-8 gap-1">
                    <PlusIcon className="w-3.5 h-3.5" />
                    New
                </Button>
            </div>

            <ScrollArea className="flex-1">
                <div className="px-3 pt-4 pb-6 flex flex-col gap-2">
                    {sessions.length === 0 ? (
                        <div className="py-10 px-4 text-center text-sm text-muted-foreground">
                            No conversations yet.
                            <br />
                            Start a new chat!
                        </div>
                    ) : (
                        sessions.map((s) => (
                            <div
                                key={s.session_id}
                                className={`group flex items-center justify-between p-4 rounded-xl cursor-pointer transition-colors ${s.session_id === activeSessionId
                                    ? 'bg-accent text-accent-foreground'
                                    : 'hover:bg-accent/50 text-foreground'
                                    }`}
                                onClick={() => onSelect(s.session_id)}
                            >
                                <div className="flex-1 min-w-0 mr-2">
                                    <div className="text-sm font-medium truncate">{s.title}</div>
                                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                                        <span>{s.agent_name}</span>
                                        <span>·</span>
                                        <span>{s.message_count} msgs</span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-7 h-7 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 transition-opacity"
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
