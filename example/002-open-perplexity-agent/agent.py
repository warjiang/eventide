import os
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from typing_extensions import TypedDict, Annotated
from langchain.messages import HumanMessage, SystemMessage, ToolMessage, AnyMessage
from langchain.tools import tool
from dotenv import load_dotenv
from pydantic import SecretStr
from tavily import TavilyClient


load_dotenv()
tavily_client = TavilyClient(api_key=os.environ.get("TAVILY_API_KEY"))

model = ChatOpenAI(
    temperature=0,
    model="deepseek-v3.2",
    base_url=os.environ.get("LLM_BASE_URL"),
    api_key=SecretStr(os.environ.get("LLM_API_KEY") or ""),
)

@tool
def search_web(query: str) -> str:
    """Search the web for information using Tavily search engine.

    Args:
        query: The search query string.
    """
    result = tavily_client.search(query=query, max_results=5)
    return str(result)


tools = [search_web]
tools_by_name = {tool.name: tool for tool in tools}
model_with_tools = model.bind_tools(tools)


import operator


class MessagesState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    llm_calls: int


def call_model(state: MessagesState):
    response = model.invoke(state["messages"])
    return {"messages": response}

def llm_call(state: MessagesState):
    """LLM decides whether to call a tool or not"""

    return {
        "messages": [
            model_with_tools.invoke(
                [
                    SystemMessage(
                        content="You are a helpful assistant with web search capabilities. Use the search_web tool to find information when needed."
                    )
                ]
                + state["messages"]
            )
        ],
        "llm_calls": state.get('llm_calls', 0) + 1
    }


def tool_node(state: MessagesState):
    """Performs the tool call"""

    last_message = state["messages"][-1]
    tool_calls = getattr(last_message, 'tool_calls', [])
    
    result = []
    for tool_call in tool_calls:
        tool = tools_by_name[tool_call["name"]]
        observation = tool.invoke(tool_call["args"])
        result.append(ToolMessage(content=observation, tool_call_id=tool_call["id"]))
    return {"messages": result}


def should_continue(state: MessagesState):
    """Decide if we should continue the loop or stop based upon whether the LLM made a tool call"""

    messages = state["messages"]
    last_message = messages[-1]

    tool_calls = getattr(last_message, 'tool_calls', [])
    if tool_calls:
        return "tool_node"

    return END


graph = StateGraph(MessagesState)

# Add nodes
graph.add_node("llm_call", llm_call)
graph.add_node("tool_node", tool_node)

graph.add_edge(START, "llm_call")
graph.add_conditional_edges(
    "llm_call",
    should_continue,
    ["tool_node", END]
)
graph.add_edge("tool_node", "llm_call")


agent = graph.compile()

# messages = agent.invoke({
#     "messages": [HumanMessage(content="1 + 2 * 3 = ？")],
#     "llm_calls": 0,
# })

# for m in messages["messages"]:
#     m.pretty_print()