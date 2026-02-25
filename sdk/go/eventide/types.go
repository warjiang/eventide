package eventide

const (
	// Lifecycle
	TypeTurnStarted   = "turn.started"
	TypeTurnCompleted = "turn.completed"
	TypeTurnFailed    = "turn.failed"
	TypeTurnCancelled = "turn.cancelled"

	// Message
	TypeMessageDelta     = "message.delta"
	TypeMessageCompleted = "message.completed"

	// Tool
	TypeToolCallStarted   = "tool.call.started"
	TypeToolCallArgsDelta = "tool.call.args.delta"
	TypeToolCallCompleted = "tool.call.completed"
	TypeToolCallError     = "tool.call.error"

	// State
	TypeStateSnapshot = "state.snapshot"
	TypeStateDelta    = "state.delta"

	// Custom
	TypeCustom          = "custom"
	TypeCustomComponent = "custom.component"

	// Thread
	TypeThreadReady = "thread.ready"
)

// ComponentPayload helper to create a payload for json-render
func ComponentPayload(component string, props map[string]any) map[string]any {
	if props == nil {
		props = make(map[string]any)
	}
	return map[string]any{
		"__jr__":    true,
		"component": component,
		"props":     props,
	}
}
