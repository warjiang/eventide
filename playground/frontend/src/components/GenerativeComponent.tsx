import React, { useMemo } from "react"
import { Renderer, JSONUIProvider } from "@json-render/react"
import { ComponentRegistry } from "./ComponentRegistry"

// Wrap the raw React components into json-render compatible renderers
const wrappedRegistry = Object.entries(ComponentRegistry).reduce((acc, [name, Comp]: [string, any]) => {
    // The renderer passes { element, children, emit, on, bindings, loading }
    // We proxy `element.props` -> `props` to match ComponentRegistry's expected props
    acc[name] = ({ element, children, emit, on, bindings, loading }: any) => (
        <Comp
            props={element.props || {}}
            children={children}
            emit={emit}
            on={on}
            bindings={bindings}
            loading={loading}
        />
    )
    return acc
}, {} as Record<string, any>)

export function GenerativeComponent({ payload }: { payload: any }) {
    // payload is the JSON tree object from the agent
    // Expected format: { __jr__: true, component: "DataTable", props: { ... } }

    const componentName = payload?.component
    const Component = ComponentRegistry[componentName]

    // Memoize the transformed spec so it doesn't trigger re-renders inside json-render
    const spec = useMemo(() => {
        if (!componentName) return null
        return {
            root: "root",
            elements: {
                root: {
                    type: componentName,
                    props: payload?.props || {},
                    children: []
                }
            }
        }
    }, [componentName, payload?.props])

    if (!Component || !spec) {
        return (
            <div className="text-muted-foreground text-sm p-2 bg-muted/20 rounded border border-border">
                Unknown component: {componentName || 'undefined'}
            </div>
        )
    }

    try {
        return (
            <div className="animate-in fade-in duration-300">
                <JSONUIProvider registry={wrappedRegistry}>
                    <Renderer spec={spec as any} registry={wrappedRegistry} />
                </JSONUIProvider>
            </div>
        )
    } catch (err) {
        console.error("Failed to render generative component", err)
        return (
            <div className="text-destructive text-sm p-2 bg-destructive/10 rounded border border-destructive/20">
                Failed to render component: {componentName}
            </div>
        )
    }
}

