package eventide

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// AppendResult holds the response from the gateway append operation.
type AppendResult struct {
	EventID    string `json:"event_id"`
	Seq        int64  `json:"seq"`
	StreamID   string `json:"stream_id,omitempty"`
	Duplicated bool   `json:"duplicated,omitempty"`
}

// Client is the Go SDK client for the Eventide event gateway.
type Client struct {
	baseURL string
	hc      *http.Client
}

// NewClient creates a new Eventide gateway client.
func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		hc:      &http.Client{Timeout: 10 * time.Second},
	}
}

// WithHTTPClient allows overriding the default HTTP client.
func (c *Client) WithHTTPClient(hc *http.Client) *Client {
	c.hc = hc
	return c
}

// Append sends a single event to the gateway.
func (c *Client) Append(ctx context.Context, e Event) (*AppendResult, error) {
	if e.SpecVersion == "" {
		e.SpecVersion = SpecVersion
	}
	body, err := json.Marshal(map[string]any{"event": e})
	if err != nil {
		return nil, fmt.Errorf("encode event: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/events:append", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("content-type", "application/json")

	resp, err := c.hc.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 8192))
		return nil, &GatewayError{Status: resp.StatusCode, Body: string(b)}
	}

	var res AppendResult
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return &res, nil
}

// GatewayError represents a non-2xx HTTP response from the gateway.
type GatewayError struct {
	Status int
	Body   string
}

func (e *GatewayError) Error() string {
	return fmt.Sprintf("gateway error (status=%d): %s", e.Status, e.Body)
}
