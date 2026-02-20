FROM golang:1.22 AS builder

WORKDIR /app

# Copy the go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the source code into the container
COPY . .

# Build the application
# We use a build argument to specify which app to build
ARG APP
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags="-w -s" -o /app/bin/${APP} ./cmd/${APP}

# Start a new stage from scratch
FROM alpine:3.18
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

ARG APP
# Copy the Pre-built binary file from the previous stage
COPY --from=builder /app/bin/${APP} /app/server

# Expose port (if applicable, can be overridden by docker run)
# EXPOSE 8080

# Command to run the executable
CMD ["/app/server"]
