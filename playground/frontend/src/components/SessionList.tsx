import { Button } from "@/components/ui/button"
import { PlusIcon, TrashIcon, MessageCircle, Bot } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

import { SessionData, Agent } from "../api"

interface SessionListProps {
    sessions: SessionData[];
    activeSessionId: string | null;
    onSelect: (sessionId: string) => void;
    onDelete: (sessionId: string) => void;
    onCreate: () => void;
    selectedAgent: Agent | null;
}

export default function SessionList({
    sessions,
    activeSessionId,
    onSelect,
    onDelete,
    onCreate,
    selectedAgent,
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

            {/* Use native overflow-y-auto instead of ScrollArea to avoid display:table breaking truncation */}
            <div className="flex-1 overflow-y-auto">
                <div className="px-2 pt-2 pb-6 flex flex-col gap-1">
                    {!selectedAgent ? (
                        <div className="py-8 px-4 text-center text-xs text-muted-foreground">
                            <Bot className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p>Select an agent first</p>
                            <p className="mt-0.5 text-[10px]">Choose an agent to view sessions</p>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="py-8 px-4 text-center text-xs text-muted-foreground">
                            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p>No conversations yet.</p>
                            <p className="mt-0.5 text-[10px]">Start a new chat!</p>
                        </div>
                    ) : (
                        sessions.map((s) => (
                            <Tooltip key={s.session_id} delayDuration={300}>
                                <TooltipTrigger asChild>
                                    <div
                                        className={`group flex items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 ${s.session_id === activeSessionId
                                            ? 'bg-primary/10 border border-primary/20 text-foreground'
                                            : 'hover:bg-surface/50 hover:border-border/30 border border-transparent'
                                            }`}
                                        onClick={() => onSelect(s.session_id)}
                                    >
                                        {/* Text content: title + meta, constrained with overflow-hidden */}
                                        <div className="flex-1 min-w-0 overflow-hidden text-left">
                                            <div className="text-sm font-medium leading-tight overflow-hidden text-ellipsis whitespace-nowrap">
                                                {s.title}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                                                <span className="font-mono text-[9px] px-1 py-0 rounded bg-surface/50">{s.agent_name}</span>
                                                <span>·</span>
                                                <span>{s.message_count} msgs</span>
                                            </div>
                                        </div>

                                        {/* Delete button */}
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="w-7 h-7 ml-2 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0 transition-all duration-200"
                                            onClick={(e: React.MouseEvent) => {
                                                e.stopPropagation()
                                                onDelete(s.session_id)
                                            }}
                                            title="Delete session"
                                        >
                                            <TrashIcon className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="right" sideOffset={10} className="max-w-[300px] break-words">
                                    <p className="text-sm">{s.title}</p>
                                </TooltipContent>
                            </Tooltip>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
