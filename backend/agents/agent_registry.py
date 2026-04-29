import logging
import os
from pathlib import Path

import yaml

from agents.base_agent import BaseAgent

logger = logging.getLogger(__name__)

_CONFIGS_DIR = Path(__file__).parent / "configs"

_AGENT_CLASS_MAP = {
    "task_assistant": "agents.task_assistant.agent.TaskAssistantAgent",
    "object_analyst": "agents.object_analyst.agent.ObjectAnalystAgent",
    "doc_helper": "agents.doc_helper.agent.DocHelperAgent",
}

_registry: dict[str, BaseAgent] = {}
_agent_list: list[dict] = []


def _load_agents() -> None:
    for yaml_file in sorted(_CONFIGS_DIR.glob("*.yaml")):
        with open(yaml_file, encoding="utf-8") as f:
            config = yaml.safe_load(f)

        name = config["name"]

        # Resolve agent class
        class_path = _AGENT_CLASS_MAP.get(name)
        if class_path:
            module_path, cls_name = class_path.rsplit(".", 1)
            import importlib
            module = importlib.import_module(module_path)
            agent_cls = getattr(module, cls_name)
        else:
            agent_cls = BaseAgent

        _registry[name] = agent_cls(config)
        _agent_list.append(
            {
                "name": name,
                "display_name": config.get("display_name", name),
                "description": config.get("description", ""),
            }
        )
        logger.info("Agent loaded: %s (%s)", name, config.get("model"))


_load_agents()


def get_agent(name: str) -> BaseAgent | None:
    return _registry.get(name)


def get_agent_list() -> list[dict]:
    return _agent_list
