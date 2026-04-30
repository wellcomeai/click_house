import json
import logging
from typing import AsyncGenerator

import httpx

from config import settings

logger = logging.getLogger(__name__)


class BaseAgent:
    def __init__(self, config: dict):
        self.config = config
        self.model: str = config["model"]
        self.system_prompt: str = config.get("system_prompt", "")
        self.tool_names: list[str] = config.get("tools", [])
        self.temperature: float = config.get("temperature", 0.3)
        self.max_tokens: int = config.get("max_tokens", 2000)
        self.max_iterations: int = config.get("max_tool_iterations", 5)

    def _get_tool_schemas(self) -> list[dict]:
        from agents.tools.registry import tool_registry

        return tool_registry.get_schemas_for(self.tool_names)

    async def run(
        self,
        message: str,
        context: dict,
        history: list[dict] | None = None,
        context_message: str | None = None,
    ) -> AsyncGenerator[str, None]:
        messages: list[dict] = [{"role": "system", "content": self.system_prompt}]

        if context_message:
            messages.append({"role": "user", "content": context_message})
            messages.append({"role": "assistant", "content": "Понял, учту данные по объекту при ответе."})

        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": message})

        tool_schemas = self._get_tool_schemas()

        for iteration in range(self.max_iterations):
            response_text = ""
            # tool_calls_accumulator: {index: {id, name, arguments_str}}
            tool_calls_acc: dict[int, dict] = {}
            finish_reason = None

            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    async with client.stream(
                        "POST",
                        f"{settings.openrouter_base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.openrouter_api_key}",
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://clickhouse-irkutsk.onrender.com",
                            "X-Title": "ClickHouse Irkutsk",
                        },
                        json={
                            "model": self.model,
                            "messages": messages,
                            "tools": tool_schemas if tool_schemas else None,
                            "temperature": self.temperature,
                            "max_tokens": self.max_tokens,
                            "stream": True,
                        },
                    ) as resp:
                        if resp.status_code != 200:
                            error_body = await resp.aread()
                            logger.error("OpenRouter error %s: %s", resp.status_code, error_body)
                            yield f"data: {json.dumps({'type': 'error', 'content': 'Ошибка соединения с AI провайдером'})}\n\n"
                            return

                        async for line in resp.aiter_lines():
                            if not line.startswith("data: "):
                                continue
                            data_str = line[6:]
                            if data_str.strip() == "[DONE]":
                                break

                            try:
                                chunk = json.loads(data_str)
                            except json.JSONDecodeError:
                                continue

                            choice = chunk.get("choices", [{}])[0]
                            delta = choice.get("delta", {})
                            finish_reason = choice.get("finish_reason")

                            # Accumulate text content
                            if content := delta.get("content"):
                                response_text += content
                                yield f"data: {json.dumps({'type': 'text', 'content': content})}\n\n"

                            # Accumulate tool call fragments
                            for tc in delta.get("tool_calls") or []:
                                idx = tc.get("index", 0)
                                if idx not in tool_calls_acc:
                                    tool_calls_acc[idx] = {
                                        "id": tc.get("id", ""),
                                        "name": "",
                                        "arguments": "",
                                    }
                                if fn := tc.get("function"):
                                    if fn.get("name"):
                                        tool_calls_acc[idx]["name"] += fn["name"]
                                    if fn.get("arguments"):
                                        tool_calls_acc[idx]["arguments"] += fn["arguments"]
                                if tc.get("id"):
                                    tool_calls_acc[idx]["id"] = tc["id"]

            except httpx.TimeoutException:
                yield f"data: {json.dumps({'type': 'error', 'content': 'Превышено время ожидания ответа от AI'})}\n\n"
                return
            except Exception as exc:
                logger.exception("Agent streaming error: %s", exc)
                yield f"data: {json.dumps({'type': 'error', 'content': 'Внутренняя ошибка агента'})}\n\n"
                return

            # No tool calls → done
            if not tool_calls_acc:
                break

            # Build OpenAI-format tool_calls list for message history
            tool_calls_list = [
                {
                    "id": acc["id"],
                    "type": "function",
                    "function": {
                        "name": acc["name"],
                        "arguments": acc["arguments"],
                    },
                }
                for acc in tool_calls_acc.values()
                if acc["name"]
            ]

            messages.append(
                {
                    "role": "assistant",
                    "content": response_text or None,
                    "tool_calls": tool_calls_list,
                }
            )

            # Execute each tool and append results
            from agents.tools.registry import tool_registry

            for tc in tool_calls_list:
                tool_name = tc["function"]["name"]
                try:
                    tool_args = json.loads(tc["function"]["arguments"] or "{}")
                except json.JSONDecodeError:
                    tool_args = {}

                yield f"data: {json.dumps({'type': 'tool_call', 'tool': tool_name})}\n\n"
                logger.info("Agent calling tool: %s(%s)", tool_name, tool_args)

                result = await tool_registry.execute(tool_name, tool_args, context)

                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(result, ensure_ascii=False, default=str),
                    }
                )

        yield "data: [DONE]\n\n"
