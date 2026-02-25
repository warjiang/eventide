from typing import Any, Dict

def component_payload(component: str, props: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Convenience helper to wrap component props in the format expected by json-render.
    
    Args:
        component: Name of the registered component (e.g., 'DataTable')
        props: Properties to pass to the component
        
    Returns:
        JSON payload dictionary with the __jr__ marker
    """
    if props is None:
        props = {}
    
    return {
        "__jr__": True,
        "component": component,
        "props": props
    }
