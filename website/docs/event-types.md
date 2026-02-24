---
sidebar_position: 2
---

# Event 定义

本指南将帮助你快速熟悉 eventide 事件定义。

## event 格式：

```json
{
  "spec_version": "agent-events/1.0",
  "event_id": "01J00000000000000000000000",
  "thread_id": "thread_abc123",
  "turn_id": "turn_def456",
  "seq": 10,
  "ts": "2026-02-20T10:00:00Z",
  "type": "turn.started",
  "level": "info",
  "payload": {},
  "content_type": "application/json",
  "source": {},
  "trace": {},
  "tags": {}
}
```

- **`spec_version`**: 版本号 (默认 `agent-events/1.0`)。
- **`event_id`**: 事件的唯一id (如果不传默认会自动生成)。
- **`thread_id`**:  会话thread_id，用户在前端开启一个会话会生成一个新的thread_id, 可以在多轮会话中复用这个thread_id。
- **`turn_id`**:  对应用户单次交互的 ID。在一个 thread_id 中，用户可以开启多轮对话。
- **`seq`**: 序列号，用于保证单个thread内事件严格有序。(如果不传默认会自动生成)。
- **`ts`**: 事件时间戳，ISO-8601 UTC 格式。(如果不传默认会自动生成)。
- **`type`**: 具体事件类型。
- **`level`**: 日志级别  (`debug`, `info`, `warn`, `error`)。
- **`payload`**: 核心数据，结构取决于事件 `type` 。
- **`content_type`**, **`source`**, **`trace`**, **`tags`**: 可选元数据字段，用于追踪和过滤。


## 事件分类：
在eventide中定义了 13 种事件，归为 5 个主要类别，以完整描述自主 Agent 交互的全生命周期。

### **1. 生命周期事件（Lifecycle Events）**

标识高级 Agent 执行逻辑的启动与状态。
| 事件类型 | AG-UI 对应事件 | 描述 |
| --- | --- | --- |
| `turn.started` | `RUN_STARTED` | 当新的 Agent 执行轮次开始时触发。`payload` 通常包含启动该轮次的 `input` 参数。 |
| `turn.completed` | `RUN_FINISHED` | 当 Agent 成功完成该轮次时触发。`payload` 通常包含最终输出或 `{ "ok": true }` 状态。 |
| `turn.failed` | `RUN_ERROR` | 当 Agent 崩溃或返回错误时触发。`payload` 应包含 `{ "error": "描述信息..." }`。 |
| `turn.cancelled` | — | 当轮次执行在完成前被外部主动中止时触发。 |


### **2. 消息流事件（Message Streaming Events）**

用于将文本或交互式内容分块实时流式传输到用户界面。

| 事件类型 | AG-UI 对应事件 | 描述 |
| --- | --- | --- |
| `message.delta` | `TEXT_MESSAGE_CONTENT` | 流式传输的文本分块。Payload 示例：`{ "message_id": "msg1", "delta": "hello " }` |
| `message.completed` | `TEXT_MESSAGE_END` | 标识消息流结束。Payload 示例：`{ "message_id": "msg1" }` |


### **3. 工具调用事件（Tool Calling Events）**

捕获 Agent 调用外部工具或函数的行为，实现高可观测性。
| 事件类型 | AG-UI 对应事件 | 描述 |
| --- | --- | --- |
| `tool.call.started` | `TOOL_CALL_START` | Agent 决定调用工具时触发。Payload 示例：`{ "tool": "search_db" }` |
| `tool.call.args.delta` | `TOOL_CALL_ARGS` | 流式传输参数（JSON 分块），适用于 LLM 迭代生成参数的场景。 |
| `tool.call.completed` | `TOOL_CALL_END` | 工具执行完成时触发。Payload 示例：`{ "tool": "search_db", "result": "..." }` |
| `tool.call.error` | — | 工具执行失败时触发。 |


### **4. 状态管理事件（State Management Events）**

用于共享或增量持久化 Agent/图的状态数据。

| 事件类型 | AG-UI 对应事件 | 描述 |
| --- | --- | --- |
| `state.snapshot` | `STATE_SNAPSHOT` | 某一时刻 Agent 内部状态字典的完整快照。 |
| `state.delta` | `STATE_DELTA` | 部分更新（通常使用 JSON Patch 语法），用于增量更新前端状态。 |


### 5. 自定义 / 基础设施事件（Custom / Infrastructure Events）
| 事件类型 | AG-UI 对应事件 | 描述 |
| --- | --- | --- |
| `custom` | `CUSTOM` | 用于应用特定场景的事件。Payload 结构完全由用户自定义。 |
| `thread.ready` | — | 标识新的线程容器/虚拟机已完全配置就绪，可开始工作。 |