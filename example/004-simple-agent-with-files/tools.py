import pandas as pd
import requests
import os
import json
import uuid
from langchain.tools import tool

@tool
def read_excel(file_path_or_url: str) -> str:
    """
    Reads an Excel file from a local path or a URL and returns a summary of its content.
    If the input is a URL, it downloads the file to a temporary location first.
    Returns the first few rows of the dataframe and column names.
    """
    try:
        file_path = file_path_or_url
        if file_path_or_url.startswith("http://") or file_path_or_url.startswith("https://"):
            response = requests.get(file_path_or_url)
            response.raise_for_status()
            temp_filename = f"temp_{uuid.uuid4()}.xlsx"
            with open(temp_filename, "wb") as f:
                f.write(response.content)
            file_path = temp_filename
        
        # Read Excel
        df = pd.read_excel(file_path)
        
        # Prepare summary
        summary = []
        summary.append(f"Columns: {', '.join(map(str, df.columns))}")
        summary.append(f"Shape: {df.shape}")
        summary.append("First 5 rows:")
        summary.append(df.head().to_string())
        
        # Clean up temp file if created
        if file_path != file_path_or_url and os.path.exists(file_path):
            os.remove(file_path)
            
        return "\n".join(summary)
    except Exception as e:
        return f"Error reading Excel file: {str(e)}"

PLACEHOLDER_VALUES = {"计算中", "loading", "Loading", "LOADING", "..."}

@tool
def render_chart(component: str, props: dict) -> str:
    """
    Renders a customizable component (chart, table, metric card, alert, etc.) for the frontend.
    
    Arguments:
    - component: The name of the component to render. Supported components:
      * "DataTable" - Display tabular data
      * "MetricCard" - Display a metric with title, value, and trend
      * "Chart" - Display a bar, line, or pie chart
      * "Alert" - Display an alert message
    
    - props: A dictionary containing properties for the component.
    
    Returns:
    - A JSON string with the special payload that the frontend will render.
    
    Examples:
    
    1. DataTable:
       component="DataTable"
       props={
         "columns": ["Name", "Status", "Last Active"],
         "rows": [["Alice", "Online", "2 mins ago"], ["Bob", "Offline", "1 hour ago"]]
       }
    
    2. MetricCard:
       component="MetricCard"
       props={
         "title": "Total Revenue",
         "value": "$45,231",
         "trend": "+20.1% from last month",
         "unit": "USD"
       }
    
    3. Chart (bar):
       component="Chart"
       props={
         "type": "bar",
         "xKey": "name",
         "yKey": "sales",
         "height": 250,
         "data": [{"name": "Jan", "sales": 400}, {"name": "Feb", "sales": 300}]
       }
    
    4. Alert:
       component="Alert"
       props={
         "variant": "success",
         "title": "Operation Completed",
         "message": "The data pipeline has finished processing successfully."
       }
       (variant can be: "success", "info", "warning", "error")
    """
    try:
        if component == "MetricCard":
            value = props.get("value")
            if value in PLACEHOLDER_VALUES:
                return json.dumps({
                    "__jr__": True,
                    "component": "Alert",
                    "props": {
                        "variant": "error",
                        "title": "渲染错误",
                        "message": "MetricCard 的 value 不能使用占位符（如'计算中'）。请先完成计算，再调用 render_chart 渲染最终结果。"
                    }
                })
            
            trend = props.get("trend")
            if trend in PLACEHOLDER_VALUES:
                return json.dumps({
                    "__jr__": True,
                    "component": "Alert",
                    "props": {
                        "variant": "error",
                        "title": "渲染错误",
                        "message": "MetricCard 的 trend 不能使用占位符（如'计算中'）。请先完成计算，再调用 render_chart 渲染最终结果。"
                    }
                })
        
        payload = {
            "__jr__": True,
            "component": component,
            "props": props
        }
        
        return json.dumps(payload)
    except Exception as e:
        return f"Error rendering chart: {str(e)}"
