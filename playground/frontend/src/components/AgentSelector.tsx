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
            <div className="px-8 py-6 border-b border-border/50">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 block">Agent</label>
                <div className="h-10 rounded-lg bg-surface animate-pulse" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="px-8 py-6 border-b border-border/50">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 block">Agent</label>
                <div className="text-sm text-destructive flex flex-col items-center gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                    <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</span>
                    <button
                        onClick={loadAgents}
                        className="px-4 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg text-xs transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95"
                    >
                        Retry
                    </button>
                </div>
            </div>
        )
    }

    const selectedKey = selectedAgent ? `${selectedAgent.namespace}/${selectedAgent.name}` : ''

    return (
        <div className="px-8 py-6 border-b border-border/50">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 block">Agent</label>

            <Select
                value={selectedKey}
                onValueChange={(val) => {
                    const [ns, name] = val.split('/')
                    onSelect({ name, namespace: ns })
                }}
                disabled={agents.length === 0}
            >
                <SelectTrigger className="w-full h-10 rounded-lg border-border/60 focus:ring-2 focus:ring-primary/30 transition-all duration-200 cursor-pointer">
                    <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-xl">
                    {agents.length === 0 ? (
                        <SelectItem value="none" disabled>No agents available</SelectItem>
                    ) : (
                        agents.map((a) => (
                            <SelectItem 
                                key={`${a.namespace}/${a.name}`} 
                                value={`${a.namespace}/${a.name}`}
                                className="cursor-pointer"
                            >
                                <span className="font-medium">{a.name}</span>
                                <span className="text-muted-foreground ml-2">({a.namespace})</span>
                            </SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>

            {selectedAgent && (
                <div className="mt-3">
                    <Badge variant="outline" className="gap-2 font-normal text-xs text-muted-foreground border-border/40 bg-surface/50">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-mono text-[11px]">{selectedAgent.namespace}/{selectedAgent.name}</span>
                    </Badge>
                </div>
            )}
        </div>
    )
}
