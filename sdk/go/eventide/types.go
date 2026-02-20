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
	TypeCustom = "custom"

	// Thread
	TypeThreadReady = "thread.ready"
)
