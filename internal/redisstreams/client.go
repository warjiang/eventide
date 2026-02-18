package redisstreams

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type Client struct {
	rdb               *redis.Client
	idempotentXAddLua *redis.Script
}

func New(addr, username, password string, db int) *Client {
	return &Client{
		rdb: redis.NewClient(&redis.Options{Addr: addr, Username: username, Password: password, DB: db}),
		idempotentXAddLua: redis.NewScript(`
local dedupeKey = KEYS[1]
local threadStream = KEYS[2]
local globalStream = KEYS[3]

local ttlSeconds = tonumber(ARGV[1])
local trimMaxLen = tonumber(ARGV[2])

local eventID = ARGV[3]
local threadID = ARGV[4]
local seq = ARGV[5]
local turnID = ARGV[6]
local ts = ARGV[7]
local typeStr = ARGV[8]
local level = ARGV[9]
local payload = ARGV[10]
local eventJSON = ARGV[11]

local existing = redis.call('GET', dedupeKey)
if existing then
  return {1, existing}
end

local streamID = redis.call('XADD', threadStream, '*',
  'seq', seq,
  'event_id', eventID,
  'turn_id', turnID,
  'ts', ts,
  'type', typeStr,
  'level', level,
  'payload', payload,
  'event', eventJSON
)

redis.call('XADD', globalStream, '*',
  'thread_id', threadID,
  'seq', seq,
  'event_id', eventID,
  'event', eventJSON
)

if trimMaxLen and trimMaxLen > 0 then
  redis.call('XTRIM', threadStream, 'MAXLEN', '~', trimMaxLen)
end

if ttlSeconds and ttlSeconds > 0 then
  redis.call('SET', dedupeKey, streamID, 'EX', ttlSeconds)
end

return {0, streamID}
`),
	}
}

func (c *Client) Ping(ctx context.Context) error {
	return c.rdb.Ping(ctx).Err()
}

func (c *Client) Close() error {
	return c.rdb.Close()
}

func StreamKey(threadID string) string {
	return fmt.Sprintf("stream:thread:%s", threadID)
}

func GlobalStreamKey() string {
	return "stream:global:events"
}

func SeqKey(threadID string) string {
	return fmt.Sprintf("seq:thread:%s", threadID)
}

func (c *Client) NextSeq(ctx context.Context, threadID string) (int64, error) {
	return c.rdb.Incr(ctx, SeqKey(threadID)).Result()
}

func (c *Client) ReserveSeqRange(ctx context.Context, threadID string, n int64) (int64, error) {
	if n <= 0 {
		return 0, fmt.Errorf("n must be > 0")
	}
	end, err := c.rdb.IncrBy(ctx, SeqKey(threadID), n).Result()
	if err != nil {
		return 0, err
	}
	return end - n + 1, nil
}

func (c *Client) XAddEvent(ctx context.Context, threadID string, values map[string]any) (string, error) {
	return c.rdb.XAdd(ctx, &redis.XAddArgs{Stream: StreamKey(threadID), Values: values}).Result()
}

func (c *Client) XAddGlobalEvent(ctx context.Context, values map[string]any) (string, error) {
	return c.rdb.XAdd(ctx, &redis.XAddArgs{Stream: GlobalStreamKey(), Values: values}).Result()
}

func (c *Client) IdempotentXAddEvent(
	ctx context.Context,
	threadID string,
	eventID string,
	seq int64,
	turnID string,
	tsRFC3339Nano string,
	typeStr string,
	level string,
	payload string,
	eventJSON string,
	trimMaxLen int64,
	dedupeTTL time.Duration,
) (string, bool, error) {
	dedupeKey := fmt.Sprintf("dedupe:event:%s", eventID)
	keys := []string{dedupeKey, StreamKey(threadID), GlobalStreamKey()}
	args := []any{
		int64(dedupeTTL.Seconds()),
		trimMaxLen,
		eventID,
		threadID,
		seq,
		turnID,
		tsRFC3339Nano,
		typeStr,
		level,
		payload,
		eventJSON,
	}
	res, err := c.idempotentXAddLua.Run(ctx, c.rdb, keys, args...).Result()
	if err != nil {
		return "", false, err
	}
	arr, ok := res.([]any)
	if !ok || len(arr) != 2 {
		return "", false, fmt.Errorf("unexpected lua result")
	}
	dupInt, ok := arr[0].(int64)
	if !ok {
		return "", false, fmt.Errorf("unexpected lua result[0]")
	}
	streamID, ok := arr[1].(string)
	if !ok {
		return "", false, fmt.Errorf("unexpected lua result[1]")
	}
	return streamID, dupInt != 0, nil
}

func (c *Client) TrimMaxLenApprox(ctx context.Context, threadID string, maxLen int64) error {
	return c.rdb.XTrimMaxLenApprox(ctx, StreamKey(threadID), maxLen, 0).Err()
}

func (c *Client) EnsureConsumerGroup(ctx context.Context, threadID, group string) error {
	// MKSTREAM creates the stream if missing.
	err := c.rdb.XGroupCreateMkStream(ctx, StreamKey(threadID), group, "$").Err()
	if err != nil && !isBusyGroup(err) {
		return err
	}
	return nil
}

func (c *Client) EnsureConsumerGroupOnStream(ctx context.Context, stream, group string) error {
	err := c.rdb.XGroupCreateMkStream(ctx, stream, group, "$").Err()
	if err != nil && !isBusyGroup(err) {
		return err
	}
	return nil
}

type GroupMessage struct {
	Stream string
	ID     string
	Values map[string]any
}

func (c *Client) XRange(ctx context.Context, stream, start, stop string, count int64) ([]GroupMessage, error) {
	res, err := c.rdb.XRangeN(ctx, stream, start, stop, count).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	out := make([]GroupMessage, 0, len(res))
	for _, m := range res {
		out = append(out, GroupMessage{Stream: stream, ID: m.ID, Values: m.Values})
	}
	return out, nil
}

func (c *Client) XDel(ctx context.Context, stream string, ids ...string) (int64, error) {
	return c.rdb.XDel(ctx, stream, ids...).Result()
}

func (c *Client) XAddToStream(ctx context.Context, stream string, values map[string]any) (string, error) {
	return c.rdb.XAdd(ctx, &redis.XAddArgs{Stream: stream, Values: values}).Result()
}

func (c *Client) XReadGroup(ctx context.Context, group, consumer, stream, start string, block time.Duration, count int64) ([]GroupMessage, error) {
	res, err := c.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
		Group:    group,
		Consumer: consumer,
		Streams:  []string{stream, start},
		Block:    block,
		Count:    count,
		NoAck:    false,
	}).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	var out []GroupMessage
	for _, st := range res {
		for _, msg := range st.Messages {
			out = append(out, GroupMessage{Stream: st.Stream, ID: msg.ID, Values: msg.Values})
		}
	}
	return out, nil
}

func (c *Client) XAck(ctx context.Context, stream, group string, ids ...string) (int64, error) {
	return c.rdb.XAck(ctx, stream, group, ids...).Result()
}

type PendingEntry struct {
	ID         string
	Consumer   string
	Idle       time.Duration
	RetryCount int64
}

func (c *Client) XPendingExt(ctx context.Context, stream, group, start, end string, count int64) ([]PendingEntry, error) {
	res, err := c.rdb.XPendingExt(ctx, &redis.XPendingExtArgs{
		Stream: stream,
		Group:  group,
		Start:  start,
		End:    end,
		Count:  count,
	}).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	out := make([]PendingEntry, 0, len(res))
	for _, p := range res {
		out = append(out, PendingEntry{ID: p.ID, Consumer: p.Consumer, Idle: p.Idle, RetryCount: p.RetryCount})
	}
	return out, nil
}

type AutoClaimResult struct {
	Start    string
	Messages []GroupMessage
}

func (c *Client) XAutoClaim(ctx context.Context, stream, group, consumer, start string, minIdle time.Duration, count int64) (AutoClaimResult, error) {
	messages, next, err := c.rdb.XAutoClaim(ctx, &redis.XAutoClaimArgs{
		Stream:   stream,
		Group:    group,
		Consumer: consumer,
		MinIdle:  minIdle,
		Start:    start,
		Count:    count,
	}).Result()
	if err != nil {
		if err == redis.Nil {
			return AutoClaimResult{Start: start}, nil
		}
		return AutoClaimResult{}, err
	}
	out := AutoClaimResult{Start: next}
	for _, m := range messages {
		out.Messages = append(out.Messages, GroupMessage{Stream: stream, ID: m.ID, Values: m.Values})
	}
	return out, nil
}

func (c *Client) Incr(ctx context.Context, key string) (int64, error) {
	return c.rdb.Incr(ctx, key).Result()
}

func isBusyGroup(err error) bool {
	if err == nil {
		return false
	}
	// go-redis returns plain error strings for BUSYGROUP
	return strings.HasPrefix(err.Error(), "BUSYGROUP")
}

type StreamMessage struct {
	ID     string
	Values map[string]any
}

func (c *Client) XRead(ctx context.Context, stream, start string, block time.Duration, count int64) ([]StreamMessage, error) {
	res, err := c.rdb.XRead(ctx, &redis.XReadArgs{Streams: []string{stream, start}, Block: block, Count: count}).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, nil
		}
		return nil, err
	}
	var out []StreamMessage
	for _, st := range res {
		for _, msg := range st.Messages {
			out = append(out, StreamMessage{ID: msg.ID, Values: msg.Values})
		}
	}
	return out, nil
}
