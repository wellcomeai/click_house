# AI Agents — AI Context

## Архитектура
Три агента, каждый настроен через YAML + имеет свой класс (наследует BaseAgent).
Агенты работают через OpenRouter (OpenAI-compatible API), стриминг SSE, tool_calls.

## Файлы
```
agents/
├── base_agent.py          # BaseAgent: цикл инференса с tool_calls
├── agent_registry.py      # Загрузка агентов из YAML конфигов
├── configs/               # YAML конфиги агентов
│   ├── task_assistant.yaml
│   ├── object_analyst.yaml
│   └── doc_helper.yaml
├── task_assistant/agent.py
├── object_analyst/agent.py
├── doc_helper/agent.py
└── tools/
    ├── registry.py        # ToolRegistry — регистрация и вызов инструментов
    ├── decorators.py      # @tool декоратор — генерирует JSON schema
    ├── task_tools.py      # create_task, update_task, assign_task
    ├── object_tools.py    # get_object_summary, get_overdue_tasks
    ├── user_tools.py      # get_user_info, get_team_by_object
    ├── db_tools.py        # get_task_details, get_object_details, get_user_details
    ├── notification_tools.py  # send_notification
    ├── report_tools.py    # generate_report
    ├── search_tools.py    # semantic_search (LIKE по БД)
    └── gptimage.py        # generate_image (kie.ai API + polling)
```

## Цикл работы BaseAgent
```
for iteration in range(max_iterations):
    1. Отправить messages + tools на OpenRouter (streaming)
    2. Accumulate text chunks → yield SSE {"type":"text"}
    3. Accumulate tool_call fragments
    4. Если нет tool_calls → break (готово)
    5. Append assistant message с tool_calls
    6. Execute each tool → append tool result
    7. Continue loop (следующая итерация)
yield "data: [DONE]\n\n"
```

## SSE события от агентов
```json
{"type": "text", "content": "..."}       ← токен текста
{"type": "tool_call", "tool": "name"}    ← агент вызывает инструмент
{"type": "image", "url": "https://..."}  ← результат generate_image
{"type": "error", "content": "..."}      ← ошибка
[DONE]
```

## Добавление нового инструмента
1. Создать функцию в нужном `tools/*.py` с декоратором `@tool`
2. Параметры `db` и `current_user` — автоматически инжектируются из context
3. Добавить имя в `tools` список нужного YAML конфига
4. Инструмент автоматически появится через `_build_registry()` в `registry.py`

```python
@tool
async def my_tool(param1: str, param2: int, db=None, current_user=None) -> dict:
    """Описание для LLM — он видит эту строку."""
    return {"result": "..."}
```

## YAML конфиг агента
```yaml
name: agent_name
display_name: "Название для UI"
description: "Описание для пользователя"
model: anthropic/claude-3-haiku   # или любая модель OpenRouter
temperature: 0.3
max_tokens: 2000
max_tool_iterations: 5
tools:
  - tool_name_1
  - tool_name_2
system_prompt: |
  Ты — ...
```

## Контекст объекта
Если в запросе передан `object_id`, роутер `ai_gateway/router.py` предзагружает
данные объекта и передаёт их как `context_message` перед историей.
Это даёт агенту контекст без лишнего tool_call на старте.

## Генерация изображений (gptimage.py)
Использует kie.ai API:
1. `POST /jobs/createTask` — создать задачу
2. Polling `GET /jobs/recordInfo?taskId=xxx` каждые 5 сек
3. Таймаут 10 минут
4. Возвращает `{"image_url": "..."}` → base_agent передаёт как SSE event типа "image"
