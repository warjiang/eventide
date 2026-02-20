APPS := gateway realtime reference-agent migrate persister read-api archiver
LDFLAGS := -linkmode=external

.PHONY: build test $(APPS) docker-build

build: $(APPS)

$(APPS):
	go build -ldflags='$(LDFLAGS)' -o bin/$@ ./cmd/$@

test:
	go test ./...

docker-build:
	@for app in $(APPS); do \
		echo "Building docker image for $$app..."; \
		docker build --build-arg APP=$$app -t ghcr.io/warjiang/eventide/$$app:latest -f Dockerfile .; \
	done
