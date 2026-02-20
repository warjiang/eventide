# Copyright The Volcano Authors.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#!/usr/bin/env python3
"""
Simple Agent - A simple example AI agent.

This agent provides a basic HTTP API for greeting users.
"""

import asyncio
import json
import logging
import os
import threading
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict
from agent import agent
from langchain.messages import HumanMessage
from eventide import GatewayClient, Event, EventType, Level

# 配置日志
log_level = os.environ.get('LOG_LEVEL', 'INFO').upper()
logging.basicConfig(
    level=getattr(logging, log_level, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class SimpleAgentHandler(BaseHTTPRequestHandler):
    """HTTP handler for the Simple Agent."""

    def do_GET(self):
        """Handle GET requests."""
        if self.path == '/health':
            self._send_json_response({"status": "healthy", "agent": "simple-agent"})
        elif self.path == '/':
            self._send_json_response({
                "message": "Hello from Simple Agent!",
                "endpoints": [
                    "GET /health - Health check",
                    "POST /runcmd - Execute command using CodeInterpreterClient",
                    "GET / - Agent information"
                ]
            })
        else:
            self._send_error(404, "Endpoint not found")

    def do_POST(self):
        """Handle POST requests."""
        if self.path == '/runcmd':
            self._handle_runcmd()
        elif self.path == '/':
            self._handle_runcmd()
        else:
            self._send_error(404, "Endpoint not found")

    

    async def _handle_runcmd_async(self, prompt: str, thread_id: str):
        """异步处理 agent 执行（后台任务），使用流式输出."""
        try:
            # 创建 GatewayClient 并发送事件
            GATEWAY_URL = os.getenv("EVENT_GATEWAY_URL", "http://127.0.0.1:18081")
            client = GatewayClient(GATEWAY_URL)
            
            # 生成 turn_id
            turn_id = f"turn_{uuid.uuid4().hex[:8]}"
            
            await client.append(Event(
                thread_id=thread_id,
                turn_id=turn_id,
                type=EventType.TURN_STARTED,
                level=Level.INFO,
                payload={"input": prompt},
            ))
            
            logger.info(f"=== Agent execution result for prompt: '{prompt[:50]}...' ===")
            
            # 使用 graph.stream 流式执行 agent
            msg_id = f"msg_{uuid.uuid4().hex[:8]}"
            last_content = ""
            message_count = 0
            
            # agent.astream 返回节点输出流
            # 格式: {node_name: node_output} 或 node_output (如果是最终状态)
            async for chunk in agent.astream({
                "messages": [HumanMessage(content=prompt)],
                "llm_calls": 0,
            }):
                # astream 返回的是 {node_name: output} 格式
                # 我们需要遍历所有节点输出
                for node_name, node_output in chunk.items():
                    logger.debug(f"Node: {node_name}, Output: {node_output}")
                    
                    # 从节点输出中提取消息
                    messages = []
                    if isinstance(node_output, dict):
                        messages = node_output.get("messages", [])
                    elif isinstance(node_output, list):
                        messages = node_output
                    
                    if not messages:
                        continue
                    
                    # 处理每条消息
                    for last_message in messages:
                        msg_type = type(last_message).__name__
                        content = getattr(last_message, 'content', str(last_message))
                        
                        if msg_type == "AIMessage":
                            tool_calls = getattr(last_message, 'tool_calls', [])
                            if tool_calls:
                                for tool_call in tool_calls:
                                    tool_name = tool_call.get("name", "unknown")
                                    tool_args = tool_call.get("args", {})
                                    logger.info(f"[ToolCall]: {tool_name}({tool_args})")
                                    await client.append(Event(
                                        thread_id=thread_id,
                                        turn_id=turn_id,
                                        type=EventType.TOOL_CALL_STARTED,
                                        level=Level.INFO,
                                        payload={"tool": tool_name, "arguments": tool_args},
                                    ))
                            else:
                                message_count += 1
                                last_content = content
                                logger.info(f"[AIMessage]: {content}")
                                
                                # 一次性发送完整内容
                                await client.append(Event(
                                    thread_id=thread_id,
                                    turn_id=turn_id,
                                    type=EventType.MESSAGE_DELTA,
                                    level=Level.INFO,
                                    payload={"message_id": msg_id, "delta": content},
                                ))
                                
                                # await client.append(Event(
                                #     thread_id=thread_id,
                                #     turn_id=turn_id,
                                #     type=EventType.MESSAGE_COMPLETED,
                                #     level=Level.INFO,
                                #     payload={"message_id": msg_id},
                                # ))
                        
                        elif msg_type == "ToolMessage":
                            logger.info(f"[ToolResult]: {content}")
                            await client.append(Event(
                                thread_id=thread_id,
                                turn_id=turn_id,
                                type=EventType.TOOL_CALL_COMPLETED,
                                level=Level.INFO,
                                payload={"result": content},
                            ))
            
            logger.info(f"=== Agent execution completed ({message_count} messages) ===")
            
            await client.append(Event(
                thread_id=thread_id,
                turn_id=turn_id,
                type=EventType.TURN_COMPLETED,
                level=Level.INFO,
                payload={"output": last_content, "message_count": message_count},
            ))
            
            await client.close()
        except Exception as e:
            logger.error(f"Agent execution error: {e}")
            logger.exception("Agent execution traceback")

    def _handle_runcmd(self):
        """Handle runcmd requests using CodeInterpreterClient."""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data.decode('utf-8'))
            logger.info(f"Received data: {data}")
            # Handle different types of prompts
            prompt = data.get('prompt', '')
            # 如果 data 中有 thread_id 则复用，否则创建新的
            thread_id = data.get('thread_id') or f"thread_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:8]}"
            response_data = {
                "output": "success",
                "agent": "hello-agent",
                "timestamp": self._get_timestamp(),
                "thread_id": thread_id,
            }
            
            
            # 先返回响应
            self._send_json_response(response_data)
            
            # 在后台线程中运行异步任务
            def run_async_in_thread():
                asyncio.run(self._handle_runcmd_async(prompt, thread_id))
            
            thread = threading.Thread(target=run_async_in_thread)
            thread.daemon = True
            thread.start()

        except (json.JSONDecodeError, KeyError) as e:
            self._send_error(400, f"Invalid request: {str(e)}")

    def _send_json_response(self, data: Dict[str, Any], status_code: int = 200):
        """Send JSON response."""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        response = json.dumps(data, indent=2)
        self.wfile.write(response.encode('utf-8'))

    def _send_error(self, status_code: int, message: str):
        """Send error response."""
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.end_headers()

        error_response = json.dumps({
            "error": message,
            "status_code": status_code
        }, indent=2)

        self.wfile.write(error_response.encode('utf-8'))

    def _get_timestamp(self) -> str:
        """Get current timestamp."""
        from datetime import datetime
        return datetime.now().isoformat()

    def log_message(self, format, *args):
        """Override log_message to reduce noise."""
        pass


def main():
    """Main function to run the Simple Agent."""
    port = int(os.environ.get('PORT', 8080))

    logger.info(f"Starting Simple Agent on port {port}")
    logger.info(f"Health check: http://0.0.0.0:{port}/health")
    logger.info(f"Runcmd endpoint: http://0.0.0.0:{port}/runcmd")
    logger.info(f"Agent endpoint: http://0.0.0.0:{port}/")

    server_address = ('', port)
    httpd = HTTPServer(server_address, SimpleAgentHandler)

    try:
        logger.info(f"Simple Agent is running on port {port}")
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down Simple Agent")
        httpd.server_close()


if __name__ == '__main__':
    main()
