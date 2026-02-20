from eventide.types import Event, EventType, Level
e = Event(thread_id="t1", turn_id="t1", type=EventType.TURN_STARTED)
d = e.to_dict()
print(f"Serialized event: {d}")
assert "ts" not in d, "ts shouldn't be in dict when empty string"
assert "event_id" not in d, "event_id shouldn't be in dict when empty string"
assert "spec_version" in d, "spec_version should be in dict when it has a value"
print("Success")
