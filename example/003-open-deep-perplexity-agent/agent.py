import os
import asyncio
from dotenv import load_dotenv
from pydantic import SecretStr
from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI
from langchain.tools import tool
from tavily import TavilyClient
from langchain.messages import HumanMessage


load_dotenv()


def create_model():
    return ChatOpenAI(
        temperature=0,
        model="deepseek-v3.2",
        base_url=os.environ.get("LLM_BASE_URL"),
        api_key=SecretStr(os.environ.get("LLM_API_KEY") or ""),
    )


tavily_client = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY"))


@tool
def search_web(query: str) -> str:
    """Search the web for information using Tavily search engine.

    Args:
        query: The search query string.
    """
    result = tavily_client.search(query=query, max_results=5)
    return str(result)


agent = create_deep_agent(
    model=create_model(),
    tools=[search_web],
)


async def stream_with_tool_calls():
    """流式输出 + 工具调用兼容的处理方式"""
    async for event in agent.astream_events(
        {"messages": [HumanMessage(content="帮我对比下react和vue的区别")]},
        version="v2"
    ):
        kind = event["event"]
        
        if kind == "on_chat_model_stream":
            chunk = event["data"].get("chunk")
            if chunk and chunk.content:
                print(f"{chunk.content}", end="", flush=True)
        
        elif kind == "on_tool_start":
            print(f"\n🔧 [工具调用]: {event['name']}", flush=True)
            print(f"   参数: {event['data'].get('input', {})}", flush=True)
        
        elif kind == "on_tool_end":
            print(f"✅ [工具完成]: {event['name']}", flush=True)
            output = event["data"].get("output", "")
            if output:
                output_str = str(output)
                if len(output_str) > 200:
                    output_str = output_str[:200] + "..."
                print(f"   结果: {output_str}", flush=True)


if __name__ == "__main__":
    asyncio.run(stream_with_tool_calls())
