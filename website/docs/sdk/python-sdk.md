---
sidebar_position: 6
---

# Python SDK

Eventide Python SDK 是 Eventide 事件网关的异步客户端，用于向事件系统发送事件。

## 安装

```bash
pip install eventide-sdk
```

## 快速开始

```python
import asyncio
from eventide import GatewayClient, Event, EventType, Level

async def main():
    async with GatewayClient("http://127.0.0.1:18081") as client:
        await client.append(Event(
            thread_id="t1",
            turn_id="turn1",
            type=EventType.TURN_STARTED,
            payload={"input": {"msg": "hello"}},
        ))

if __name__ == "__main__":
    asyncio.run(main())
```

## 核心类型

### EventType

事件类型枚举，定义事件的种类。

```python
from eventide import EventType

# Lifecycle
EventType.TURN_STARTED      # turn.started
EventType.TURN_COMPLETED     # turn.completed
EventType.TURN_FAILED        # turn.failed
EventType.TURN_CANCELLED     # turn.cancelled

# Message
EventType.MESSAGE_DELTA      # message.delta
EventType.MESSAGE_COMPLETED  # message.completed

# Tool
EventType.TOOL_CALL_STARTED       # tool.call.started
EventType.TOOL_CALL_ARGS_DELTA    # tool.call.args.delta
EventType.TOOL_CALL_COMPLETED     # tool.call.completed
EventType.TOOL_CALL_ERROR         # tool.call.error

# State
EventType.STATE_SNAPSHOT    # state.snapshot
EventType.STATE_DELTA       # state.delta

# Custom
EventType.CUSTOM            # custom

# Thread
EventType.THREAD_READY      # thread.ready
```

### Level

事件级别枚举。

```python
from eventide import Level

Level.DEBUG  # debug
Level.INFO   # info
Level.WARN   # warn
Level.ERROR  # error
```

### Event

表示单个事件的数据类。

```python
from eventide import Event, EventType, Level

event = Event(
    thread_id="thread_123",
    turn_id="turn_456",
    type=EventType.TURN_STARTED,
    level=Level.INFO,
    payload={"input": {"msg": "hello"}},
    # 可选字段
    content_type="application/json",
    source={"module": "my-app"},
    trace={"trace_id": "abc"},
    tags={"env": "prod"},
)
```

**Event 字段说明**

| 字段 | 类型 | 必填 | 描述 |
|------|------|------|------|
| thread_id | string | 是 | Thread 标识 |
| turn_id | string | 是 | Turn 标识 |
| type | string | 是 | 事件类型，使用 EventType 值 |
| level | string | 否 | 事件级别，默认 INFO |
| payload | any | 否 | 事件载荷数据 |
| spec_version | string | 否 | 规范版本，默认 "agent-events/1.0" |
| event_id | string | 否 | 事件 ID，由网关自动生成 |
| ts | string | 否 | 时间戳，由网关自动生成 |
| seq | int | 否 | 序列号，由网关自动生成 |
| content_type | string | 否 | 内容类型 |
| source | dict | 否 | 来源信息 |
| trace | dict | 否 | 链路追踪信息 |
| tags | dict | 否 | 自定义标签 |

### AppendResult

追加事件的结果。

```python
result = await client.append(event)
print(result.event_id)    # 事件 ID
print(result.seq)         # 序列号
print(result.stream_id)   # 流 ID（可选）
print(result.duplicated)  # 是否重复
```

### GatewayError

网关错误异常。

```python
from eventide import GatewayClient, GatewayError

try:
    await client.append(event)
except GatewayError as e:
    print(f"Status: {e.status}")
    print(f"Body: {e.body}")
```

## 客户端使用

### 初始化客户端

```python
from eventide import GatewayClient

# 默认配置
client = GatewayClient("http://127.0.0.1:18081")

# 自定义超时
client = GatewayClient("http://127.0.0.1:18081", timeout=30.0)

# 使用 async with 自动管理连接
async with GatewayClient("http://127.0.0.1:18081") as client:
    await client.append(event)
```

### 追加单个事件

```python
from eventide import GatewayClient, Event, EventType

async with GatewayClient("http://127.0.0.1:18081") as client:
    result = await client.append(Event(
        thread_id="t1",
        turn_id="turn1",
        type=EventType.TURN_STARTED,
        payload={"input": {"msg": "hello"}},
    ))
    print(f"Event appended: {result.event_id}, seq: {result.seq}")
```

### 批量追加事件

```python
from eventide import GatewayClient, Event, EventType

async with GatewayClient("http://127.0.0.1:18081") as client:
    events = [
        Event(thread_id="t1", turn_id="turn1", type=EventType.TURN_STARTED),
        Event(thread_id="t1", turn_id="turn1", type=EventType.MESSAGE_DELTA, payload={"delta": "Hello"}),
        Event(thread_id="t1", turn_id="turn1", type=EventType.TURN_COMPLETED),
    ]
    results = await client.append_all(events)
```

### 关闭客户端

```python
client = GatewayClient("http://127.0.0.1:18081")
try:
    await client.append(event)
finally:
    await client.close()
```

## 完整示例

```python
import asyncio
from eventide import GatewayClient, Event, EventType, Level

async def main():
    async with GatewayClient("http://127.0.0.1:18081") as client:
        # 发送 Turn 开始事件
        start_result = await client.append(Event(
            thread_id="thread_demo",
            turn_id="turn_001",
            type=EventType.TURN_STARTED,
            level=Level.INFO,
            payload={
                "input": {
                    "type": "message",
                    "content": "Hello, world!"
                }
            }
        ))
        print(f"Turn started: {start_result.event_id}")

        # 发送消息增量
        await client.append(Event(
            thread_id="thread_demo",
            turn_id="turn_001",
            type=EventType.MESSAGE_DELTA,
            payload={"delta": "Hello"}
        ))

        # 发送消息完成
        await client.append(Event(
            thread_id="thread_demo",
            turn_id="turn_001",
            type=EventType.MESSAGE_COMPLETED,
            payload={"content": "Hello, world!"}
        ))

        # 发送 Turn 完成事件
        await client.append(Event(
            thread_id="thread_demo",
            turn_id="turn_001",
            type=EventType.TURN_COMPLETED,
            payload={"status": "success"}
        ))

if __name__ == "__main__":
    asyncio.run(main())
```