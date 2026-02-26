import os
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from typing_extensions import TypedDict, Annotated, NotRequired
from langchain.messages import HumanMessage, SystemMessage, ToolMessage, AnyMessage
from langchain.tools import tool
from dotenv import load_dotenv
from pydantic import SecretStr
from tools import read_excel, render_chart


load_dotenv()
model = ChatOpenAI(
    temperature=0,
    model="deepseek-v3.2",
    base_url=os.environ.get("LLM_BASE_URL"),
    api_key=SecretStr(os.environ.get("LLM_API_KEY") or ""),
)


tools = [read_excel, render_chart]
tools_by_name = {tool.name: tool for tool in tools}
model_with_tools = model.bind_tools(tools)


import operator


class MessagesState(TypedDict):
    messages: Annotated[list[AnyMessage], operator.add]
    llm_calls: int
    files: NotRequired[list[dict]]


def call_model(state: MessagesState):
    response = model.invoke(state["messages"])
    return {"messages": response}

def llm_call(state: MessagesState):
    """LLM decides whether to call a tool or not"""
    
    files = state.get("files", [])
    system_message = "You are a helpful assistant capable of analyzing Excel files and visualizing data."
    
    if files:
        for file in files:
            file_name = file.get("name")
            file_url = file.get("url")
            if file_name and file_url:
                system_message += f"\n\nYou have access to an Excel file: '{file_name}' (URL: {file_url}). Use 'read_excel' to inspect it."
            
    system_message += "\n\nWhen you need to display a table or chart, use the 'render_chart' tool. For tables, use component='DataTable' and provide 'columns' and 'rows' in props."

    return {
        "messages": [
            model_with_tools.invoke(
                [
                    SystemMessage(
                        content=system_message
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



if __name__ == "__main__":
    files = [{
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "name": "xx数据集.xlsx",
        "size": 22135,
        "url": "file_url"
    }]
    prompt = "请帮我分析一下这个表格，并把数据用图表展示出来"
    
    print(f"Starting agent with prompt: {prompt}")
    
    # Use stream for streaming output
    for chunk in agent.stream({
        "messages": [HumanMessage(content=prompt)],
        "llm_calls": 0,
        "files": files
    }):
        for node_name, node_output in chunk.items():
            print(f"--- Node: {node_name} ---")
            # The output of each node is a dictionary with a "messages" key
            if isinstance(node_output, dict) and "messages" in node_output:
                for m in node_output["messages"]:
                    m.pretty_print()
            else:
                print(node_output)