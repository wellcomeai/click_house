import inspect
import functools
from typing import Callable, get_type_hints

TOOL_REGISTRY: dict[str, Callable] = {}

_SKIP_PARAMS = {"db", "current_user", "return"}

_TYPE_MAP = {
    str: {"type": "string"},
    int: {"type": "integer"},
    float: {"type": "number"},
    bool: {"type": "boolean"},
}


def _python_type_to_json_schema(annotation) -> dict:
    return _TYPE_MAP.get(annotation, {"type": "string"})


def tool(func: Callable) -> Callable:
    """Decorator that registers a function as an agent tool and generates its JSON schema."""
    try:
        hints = get_type_hints(func)
    except Exception:
        hints = {}

    sig = inspect.signature(func)
    properties: dict = {}
    required: list[str] = []

    for name, param in sig.parameters.items():
        if name in _SKIP_PARAMS:
            continue
        annotation = hints.get(name, str)
        properties[name] = _python_type_to_json_schema(annotation)
        if param.default is inspect.Parameter.empty:
            required.append(name)

    schema = {
        "type": "function",
        "function": {
            "name": func.__name__,
            "description": (inspect.getdoc(func) or "").strip(),
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required,
            },
        },
    }

    TOOL_REGISTRY[func.__name__] = func

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        return await func(*args, **kwargs)

    wrapper._tool_schema = schema  # type: ignore[attr-defined]
    wrapper._is_tool = True  # type: ignore[attr-defined]
    TOOL_REGISTRY[func.__name__] = wrapper
    return wrapper
