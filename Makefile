APPS := gateway beacon reference-agent migrate persister archiver
LDFLAGS := -linkmode=external
GOOS := $(shell go env GOOS)
TEST_LDFLAGS :=
ifeq ($(GOOS),darwin)
TEST_LDFLAGS = -ldflags='$(LDFLAGS)'
endif

.PHONY: build test $(APPS) docker-build

build: $(APPS)

$(APPS):
	go build -ldflags='$(LDFLAGS)' -o bin/$@ ./cmd/$@

test:
	go test $(TEST_LDFLAGS) ./...

docker-build:
	@for app in $(APPS); do \
		echo "Building docker image for $$app..."; \
		docker build --build-arg APP=$$app -t ghcr.io/warjiang/eventide/$$app:latest -f Dockerfile .; \
	done
