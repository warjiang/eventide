.PHONY: build
build:
	go build -ldflags='-linkmode=external' -o bin/event-gateway ./cmd/event-gateway
	go build -ldflags='-linkmode=external' -o bin/realtime ./cmd/realtime
	go build -ldflags='-linkmode=external' -o bin/reference-agent ./cmd/reference-agent
	go build -ldflags='-linkmode=external' -o bin/migrate ./cmd/migrate
	go build -ldflags='-linkmode=external' -o bin/persister ./cmd/persister
	go build -ldflags='-linkmode=external' -o bin/read-api ./cmd/read-api
	go build -ldflags='-linkmode=external' -o bin/archiver ./cmd/archiver

.PHONY: test
test:
	go test ./...
