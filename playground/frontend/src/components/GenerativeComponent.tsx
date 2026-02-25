import { Renderer } from "@json-render/react"
import { ComponentRegistry } from "./ComponentRegistry"

export function GenerativeComponent({ payload }: { payload: any }) {
    // payload should be the literal JSON tree that json-render understands
    // { component: "...", props: { ... } }
    try {
        return (
            <div className="animate-in fade-in duration-300">
                <Renderer spec={payload} registry={ComponentRegistry} />
            </div>
        )
    } catch (err) {
        console.error("Failed to render generative component", err);
        return (
            <div className="text-destructive text-sm p-2 bg-destructive/10 rounded border border-destructive/20">
                Failed to render component: {payload?.component || 'Unknown'}
            </div>
        )
    }
}
