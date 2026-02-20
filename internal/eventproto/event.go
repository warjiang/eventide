package eventproto

import (
	"encoding/json"
	"errors"
	"strings"
	"time"
)

const SpecVersion = "agent-events/1.0"

type Level string

const (
	LevelDebug Level = "debug"
	LevelInfo  Level = "info"
	LevelWarn  Level = "warn"
	LevelError Level = "error"
)

type Event struct {
	SpecVersion string          `json:"spec_version"`
	EventID     string          `json:"event_id"`
	ThreadID    string          `json:"thread_id"`
	TurnID      string          `json:"turn_id"`
	Seq         int64           `json:"seq"`
	TS          time.Time       `json:"ts"`
	Type        string          `json:"type"`
	Level       Level           `json:"level"`
	Payload     json.RawMessage `json:"payload"`

	ContentType string            `json:"content_type,omitempty"`
	Source      map[string]any    `json:"source,omitempty"`
	Trace       map[string]any    `json:"trace,omitempty"`
	Tags        map[string]string `json:"tags,omitempty"`
}

func DecodeEvent(b []byte) (Event, error) {
	var e Event
	if err := json.Unmarshal(b, &e); err != nil {
		return Event{}, err
	}
	if err := e.Validate(); err != nil {
		return Event{}, err
	}
	return e, nil
}

func (e Event) Encode() ([]byte, error) {
	if err := e.Validate(); err != nil {
		return nil, err
	}
	return json.Marshal(e)
}

func (e Event) Validate() error {
	if e.SpecVersion == "" {
		return errors.New("spec_version is required")
	}
	if e.SpecVersion != SpecVersion {
		return errors.New("unsupported spec_version")
	}
	if strings.TrimSpace(e.EventID) == "" {
		return errors.New("event_id is required")
	}
	if strings.TrimSpace(e.ThreadID) == "" {
		return errors.New("thread_id is required")
	}
	if strings.TrimSpace(e.TurnID) == "" {
		return errors.New("turn_id is required")
	}
	if strings.TrimSpace(e.Type) == "" {
		return errors.New("type is required")
	}
	switch e.Level {
	case LevelDebug, LevelInfo, LevelWarn, LevelError:
	default:
		return errors.New("invalid level")
	}
	if e.TS.IsZero() {
		return errors.New("ts is required")
	}
	if e.Payload == nil {
		return errors.New("payload is required")
	}
	if e.Seq < 0 {
		return errors.New("seq must be >= 0")
	}
	return nil
}
