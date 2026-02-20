package eventproto

const (
	TypeThreadReady     = "thread.ready"
	TypeThreadHeartbeat = "thread.heartbeat"
	TypeThreadSuspended = "thread.suspended"
	TypeThreadResumed   = "thread.resumed"

	TypeTurnStarted   = "turn.started"
	TypeTurnInput     = "turn.input"
	TypeTurnCompleted = "turn.completed"
	TypeTurnFailed    = "turn.failed"
	TypeTurnCancelled = "turn.cancelled"

	TypeAssistantDelta     = "assistant.message.delta"
	TypeAssistantCompleted = "assistant.message.completed"

	TypeStateCheckpoint = "state.checkpoint"
)
