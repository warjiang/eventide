package eventproto

import (
	"testing"
	"time"
)

func TestEventValidate_OK(t *testing.T) {
	e := Event{
		SpecVersion: SpecVersion,
		EventID:     "01J00000000000000000000000",
		ThreadID:    "01J00000000000000000000001",
		TurnID:      "01J00000000000000000000002",
		Seq:         1,
		TS:          time.Now().UTC(),
		Type:        TypeTurnStarted,
		Level:       LevelInfo,
		Payload:     []byte(`{"ok":true}`),
	}

	if err := e.Validate(); err != nil {
		t.Fatalf("expected ok, got %v", err)
	}

	b, err := e.Encode()
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	if _, err := DecodeEvent(b); err != nil {
		t.Fatalf("decode: %v", err)
	}
}

func TestEventValidate_Missing(t *testing.T) {
	e := Event{SpecVersion: SpecVersion}
	if err := e.Validate(); err == nil {
		t.Fatalf("expected error")
	}
}
