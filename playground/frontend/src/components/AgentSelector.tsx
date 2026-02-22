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
            <div className="px-8 py-6 border-b border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">Agent</label>
                <div className="text-sm text-muted-foreground text-center py-2">
                    Loading agents...
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="px-8 py-6 border-b border-border">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">Agent</label>
                <div className="text-destructive text-sm text-center flex flex-col items-center gap-2">
                    <span className="flex items-center justify-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {error}</span>
                    <div className="mt-3">
                        <button
                            onClick={loadAgents}
                            className="px-4 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-md text-xs transition-colors cursor-pointer"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const selectedKey = selectedAgent ? `${selectedAgent.namespace}/${selectedAgent.name}` : ''

    return (
        <div className="px-8 py-6 border-b border-border">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 block">Agent</label>

            <Select
                value={selectedKey}
                onValueChange={(val) => {
                    const [ns, name] = val.split('/')
                    onSelect({ name, namespace: ns })
                }}
                disabled={agents.length === 0}
            >
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an agent" />
                </SelectTrigger>
                <SelectContent>
                    {agents.length === 0 ? (
                        <SelectItem value="none" disabled>No agents available</SelectItem>
                    ) : (
                        agents.map((a) => (
                            <SelectItem key={`${a.namespace}/${a.name}`} value={`${a.namespace}/${a.name}`}>
                                {a.name} <span className="text-muted-foreground ml-1">({a.namespace})</span>
                            </SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>

            {selectedAgent && (
                <div className="mt-2">
                    <Badge variant="outline" className="gap-1.5 font-normal text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {selectedAgent.namespace}/{selectedAgent.name}
                    </Badge>
                </div>
            )}
        </div>
    )
}
