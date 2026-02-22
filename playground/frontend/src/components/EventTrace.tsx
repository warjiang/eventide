import { Badge } from "@/components/ui/badge"
import { PenTool, CheckCircle2, Clock } from 'lucide-react'

interface EventTraceProps {
    events: any[];
    isStreaming: boolean;
}

export default function EventTrace({ events, isStreaming }: EventTraceProps) {
    if (!events || events.length === 0) return null

    // Group tool calls for paired rendering
    const rendered: any[] = []
    const toolPairs: Record<string, { started: any, completed: any }> = {}

    for (const evt of events) {
        if (evt.type === 'tool.call.started') {
            const toolKey = `${evt.turn_id}_${evt.seq}`
            toolPairs[toolKey] = { started: evt, completed: null }
            rendered.push({ type: 'tool_pair', key: toolKey, evt })
        } else if (evt.type === 'tool.call.completed') {
            // Try to match with most recent unmatched started
            const keys = Object.keys(toolPairs)
            const unmatchedKey = keys.reverse().find((k) => !toolPairs[k].completed)
            if (unmatchedKey) {
                toolPairs[unmatchedKey].completed = evt
            } else {
                rendered.push({ type: 'event', evt })
            }
        } else {
            rendered.push({ type: 'event', evt })
        }
    }

    return (
        <div className="relative pl-6 before:absolute before:inset-y-0 before:left-[11px] before:w-0.5 before:bg-border/60 space-y-3">
            {rendered.map((item, i) => {
                if (item.type === 'tool_pair') {
                    const pair = toolPairs[item.key]
                    return <ToolCallCard key={i} started={pair.started} completed={pair.completed} />
                }
                return <EventItem key={i} evt={item.evt} />
            })}

            {isStreaming && (
                <div className="relative text-sm text-muted-foreground flex items-center gap-2 py-1">
                    <span className="absolute -left-6 w-2.5 h-2.5 rounded-full border-2 border-background bg-border ring-2 ring-primary/20 animate-pulse" />
                    <div className="flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce" />
                    </div>
                    Processing...
                </div>
            )}
        </div>
    )
}

function EventItem({ evt }: { evt: any }) {
    const type = evt.type || ''

    switch (type) {
        case 'turn.started':
            return (
                <div className="relative py-1">
                    <span className="absolute -left-6 w-2.5 h-2.5 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20" />
                    <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary hover:bg-primary/20 mb-1">
                        TURN STARTED
                    </Badge>
                    {evt.payload?.input && (
                        <div className="text-xs text-muted-foreground">Input: {String(evt.payload.input)}</div>
                    )}
                </div>
            )

        case 'message.delta':
            return (
                <div className="relative py-1">
                    <span className="absolute -left-6 w-2.5 h-2.5 rounded-full border-2 border-background bg-amber-500" />
                    <Badge variant="outline" className="text-[10px] font-mono bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 mb-1">
                        MESSAGE
                    </Badge>
                    <div className="text-sm whitespace-pre-wrap">{evt.payload?.delta}</div>
                </div>
            )

        case 'message.completed':
            return (
                <div className="relative py-1">
                    <span className="absolute -left-6 w-2.5 h-2.5 rounded-full border-2 border-background bg-emerald-500" />
                    <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
                        MESSAGE COMPLETED
                    </Badge>
                </div>
            )

        case 'turn.completed':
            return (
                <div className="relative py-1">
                    <span className="absolute -left-6 w-2.5 h-2.5 rounded-full border-2 border-background bg-emerald-500 ring-2 ring-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                    <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 mb-1">
                        TURN COMPLETED
                    </Badge>
                    {evt.payload?.output && (
                        <div className="text-xs text-muted-foreground">{String(evt.payload.output)}</div>
                    )}
                </div>
            )

        case 'turn.failed':
            return (
                <div className="relative py-1">
                    <span className="absolute -left-6 w-2.5 h-2.5 rounded-full border-2 border-background bg-destructive ring-2 ring-destructive/20" />
                    <Badge variant="destructive" className="text-[10px] font-mono mb-1">
                        TURN FAILED
                    </Badge>
                    {evt.payload?.error && <div className="text-xs text-destructive/80">{evt.payload.error}</div>}
                </div>
            )

        case 'state.delta':
            return (
                <div className="relative py-1">
                    <span className="absolute -left-6 w-2.5 h-2.5 rounded-full border-2 border-background bg-blue-500" />
                    <Badge variant="outline" className="text-[10px] font-mono bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 mb-1">
                        STATE DELTA
                    </Badge>
                    <div className="text-xs text-muted-foreground break-all">{JSON.stringify(evt.payload)}</div>
                </div>
            )

        default:
            return (
                <div className="relative py-1">
                    <span className="absolute -left-6 w-2.5 h-2.5 rounded-full border-2 border-background bg-cyan-500" />
                    <Badge variant="outline" className="text-[10px] font-mono bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 mb-1">
                        {type.toUpperCase()}
                    </Badge>
                    <div className="text-xs text-muted-foreground break-all">{JSON.stringify(evt.payload)}</div>
                </div>
            )
    }
}

function ToolCallCard({ started, completed }: { started: any, completed: any }) {
    const toolName = started?.payload?.tool || 'unknown'
    const args = started?.payload?.arguments
    const result = completed?.payload?.result

    return (
        <div className="relative py-1 group">
            <span className="absolute -left-6 w-2.5 h-2.5 rounded-full border-2 border-background bg-cyan-500 ring-2 ring-cyan-500/10" />
            <Badge variant="outline" className="text-[10px] font-mono bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 mb-1.5">
                TOOL CALL
            </Badge>
            <div className="mt-1 p-3 bg-card border border-border rounded-lg shadow-sm">
                <div className="font-semibold text-sm text-cyan-600 dark:text-cyan-400 mb-1 flex items-center gap-2">
                    <span className="flex items-center gap-1.5"><PenTool className="w-3.5 h-3.5" /> {toolName}</span>
                    {completed && <span className="text-emerald-500 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Done</span>}
                    {!completed && <span className="text-muted-foreground text-xs animate-pulse flex items-center gap-1"><Clock className="w-3 h-3" /> Executing</span>}
                </div>
                {args && (
                    <div className="font-mono text-[11px] text-muted-foreground bg-muted/50 p-2 rounded max-h-32 overflow-y-auto">
                        {JSON.stringify(args, null, 2)}
                    </div>
                )}
                {result && (
                    <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded font-mono text-[11px] text-emerald-600 dark:text-emerald-400 overflow-x-auto">
                        → {String(result)}
                    </div>
                )}
            </div>
        </div>
    )
}
