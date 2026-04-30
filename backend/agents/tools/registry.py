import logging
from typing import Any, Callable

logger = logging.getLogger(__name__)


class ToolRegistry:
    def __init__(self):
        self._tools: dict[str, Callable] = {}

    def register(self, func: Callable) -> None:
        name = func.__name__
        self._tools[name] = func
        logger.debug("Tool registered: %s", name)

    def get_schemas_for(self, tool_names: list[str]) -> list[dict]:
        schemas = []
        for name in tool_names:
            fn = self._tools.get(name)
            if fn and hasattr(fn, "_tool_schema"):
                schemas.append(fn._tool_schema)
        return schemas

    def get_all_schemas(self) -> list[dict]:
        return [fn._tool_schema for fn in self._tools.values() if hasattr(fn, "_tool_schema")]

    async def execute(self, name: str, args: dict, context: dict) -> Any:
        fn = self._tools.get(name)
        if not fn:
            return {"error": f"Инструмент '{name}' не найден"}
        try:
            return await fn(**args, **context)
        except Exception as exc:
            logger.error("Tool %s failed: %s", name, exc)
            return {"error": str(exc)}


def _build_registry() -> ToolRegistry:
    registry = ToolRegistry()

    # Import all tool modules to trigger @tool registration into TOOL_REGISTRY
    from agents.tools import (  # noqa: F401
        db_tools,
        task_tools,
        object_tools,
        user_tools,
        notification_tools,
        report_tools,
        search_tools,
        gptimage,
    )
    from agents.tools.decorators import TOOL_REGISTRY

    for fn in TOOL_REGISTRY.values():
        registry.register(fn)

    return registry


# Singleton registry built at import time
tool_registry = _build_registry()
