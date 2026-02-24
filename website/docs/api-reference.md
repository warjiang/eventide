---
sidebar_position: 2
---

# API 定义

## Beacon 服务

Beacon 是 Eventide 的只读 API 服务，提供事件查询、归档下载和实时流功能。

### Base URL

```
http://localhost:8080
```

### 健康检查

**GET** `/healthz`

检查服务健康状态。

**响应示例**
```
ok
```

---

### Thread

#### 获取 Thread 信息

**GET** `/threads/{threadID}`

获取指定 Thread 的详细信息。

**路径参数**
| 参数 | 类型 | 描述 |
|------|------|------|
| threadID | string | Thread 的唯一标识 |

**响应示例**
```json
{
  "thread_id": "thread_abc123",
  "tenant_id": "tenant_xyz789",
  "status": "active",
  "idle_timeout_seconds": 3600,
  "last_seq": 42
}
```

---

### Events

#### 获取事件列表

**GET** `/threads/{threadID}/events`

获取指定 Thread 的事件列表。

**路径参数**
| 参数 | 类型 | 描述 |
|------|------|------|
| threadID | string | Thread 的唯一标识 |

**查询参数**
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| from_seq | int64 | 0 | 起始序列号 |
| limit | int | 500 | 返回事件数量，最大 5000 |

**响应示例**
```json
{
  "events": [
    {
      "event_id": "evt_001",
      "thread_id": "thread_abc123",
      "turn_id": "turn_001",
      "seq": 1,
      "type": "TurnStarted",
      "level": "info",
      "payload": "{}",
      "ts": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

#### 实时事件流 (SSE)

**GET** `/threads/{threadID}/events/stream`

通过 Server-Sent Events (SSE) 接收实时事件。

**路径参数**
| 参数 | 类型 | 描述 |
|------|------|------|
| threadID | string | Thread 的唯一标识 |

**查询参数**
| 参数 | 类型 | 描述 |
|------|------|------|
| after_seq | int64 | 开始接收的序列号（不包含） |
| turn_id | string | 只接收指定 turn 的事件（多个用逗号分隔） |
| turn_ids | string | 只接收指定 turns 的事件（多个用逗号分隔） |

**响应格式**
SSE 格式，每个事件包含：
- `data`: JSON 格式的事件数据
- 事件类型：`agent_event` 或 `done`

**示例**
```
data: {"event_id":"evt_001","type":"TurnStarted","...","payload":"..."}

data: [DONE]
```

---

### Archives

#### 获取归档列表

**GET** `/threads/{threadID}/archives`

获取指定 Thread 的归档列表。

**路径参数**
| 参数 | 类型 | 描述 |
|------|------|------|
| threadID | string | Thread 的唯一标识 |

**查询参数**
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| limit | int | 100 | 返回归档数量，最大 1000 |

**响应示例**
```json
{
  "archives": [
    {
      "archive_id": "arch_001",
      "thread_id": "thread_abc123",
      "from_seq": 0,
      "to_seq": 100,
      "object_key": "archives/thread_abc123/arch_001.tar.gz",
      "content_type": "application/gzip",
      "content_encoding": "gzip",
      "event_count": 101
    }
  ]
}
```

---

#### 下载归档文件

**GET** `/threads/{threadID}/archives/{archiveID}`

下载指定的归档文件。

**路径参数**
| 参数 | 类型 | 描述 |
|------|------|------|
| threadID | string | Thread 的唯一标识 |
| archiveID | string | 归档的唯一标识 |

**响应**
返回归档文件内容，设置适当的 `Content-Type` 和 `Content-Encoding` 头。

---

## 事件类型

| 类型 | 描述 |
|------|------|
| `TurnStarted` | Turn 开始 |
| `TurnCompleted` | Turn 完成 |
| `TurnFailed` | Turn 失败 |
| `TurnCancelled` | Turn 取消 |

## 事件级别

| 级别 | 描述 |
|------|------|
| `info` | 信息 |
| `warning` | 警告 |
| `error` | 错误 |