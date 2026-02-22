import { useEffect, useState } from 'react'
import { fetchAgents, Agent } from '../api'
import { AlertTriangle } from 'lucide-react'

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface AgentSelectorProps {
    selectedAgent: Agent | null;
    onSelect: (agent: Agent) => void;
}

export default function AgentSelector({ selectedAgent, onSelect }: AgentSelectorProps) {
    const [agents, setAgents] = useState<Agent[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        loadAgents()
    }, [])

    async function loadAgents() {
        setLoading(true)
        setError(null)
        try {
            const data = await fetchAgents()
            setAgents(data.agents || [])
            // Auto-select first agent if none selected
            if (!selectedAgent && data.agents?.length > 0) {
                const first = data.agents[0]
                onSelect({ name: first.name, namespace: first.namespace })
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return (
            <div className="px-4 py-3 border-b border-border/50">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Agent</label>
                <div className="h-8 rounded-md bg-surface animate-pulse" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="px-4 py-3 border-b border-border/50">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Agent</label>
                <div className="text-xs text-destructive flex flex-col items-center gap-2 p-3 rounded-md bg-destructive/5 border border-destructive/20">
                    <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {error}</span>
                    <button
                        onClick={loadAgents}
                        className="px-3 py-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md text-xs transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    const selectedKey = selectedAgent ? `${selectedAgent.namespace}/${selectedAgent.name}` : ''

    return (
        <div className="px-4 py-3 border-b border-border/50">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Agent</label>

            <Select
                value={selectedKey}
                onValueChange={(val) => {
                    const [ns, name] = val.split('/')
                    onSelect({ name, namespace: ns })
                }}
                disabled={agents.length === 0}
            >
                <SelectTrigger className="w-full h-8 text-sm rounded-md border-border/60 focus:ring-2 focus:ring-primary/30 transition-all duration-200 cursor-pointer">
                    <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-border/60 shadow-xl">
                    {agents.length === 0 ? (
                        <SelectItem value="none" disabled>No agents available</SelectItem>
                    ) : (
                        agents.map((a) => (
                            <SelectItem 
                                key={`${a.namespace}/${a.name}`} 
                                value={`${a.namespace}/${a.name}`}
                                className="cursor-pointer text-sm"
                            >
                                <span className="font-medium">{a.name}</span>
                                <span className="text-muted-foreground ml-2 text-xs">({a.namespace})</span>
                            </SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>

            {selectedAgent && (
                <div className="mt-2">
                    <Badge variant="outline" className="gap-1.5 font-normal text-[10px] text-muted-foreground border-border/40 bg-surface/50 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-mono text-[10px]">{selectedAgent.namespace}/{selectedAgent.name}</span>
                    </Badge>
                </div>
            )}
        </div>
    )
}
