import json
import logging
import re
from typing import AsyncGenerator

from openai import AsyncOpenAI

from config import settings
from modules.personal_kb.search import SearchResult

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "deepseek/deepseek-v4-flash"

_llm_client = AsyncOpenAI(
    api_key=settings.openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)


def _sanitize(chunk: str) -> str:
    """Вырезает markdown-таблицы и ASCII-art которые мелкие модели иногда генерируют."""
    lines = chunk.split("\n")
    out = []
    for line in lines:
        # разделители таблиц: |---|, :---:, +---+
        if re.match(r"^\s*[\|\+][\s\-\:\|\+]+[\|\+]\s*$", line):
            continue
        # строки с данными таблицы (≥2 символов |)
        if line.count("|") >= 2:
            continue
        out.append(line)
    result = "\n".join(out)
    # одиночный | вне слов → пробел
    result = re.sub(r"(?<!\w)\s*\|\s*(?!\w)", " ", result)
    return result


def _build_system_prompt(chunks: list[SearchResult]) -> str:
    if not chunks:
        return (
            "Ты персональный AI-ассистент пользователя.\n"
            "В базе знаний пока нет документов. "
            "Вежливо сообщи об этом и предложи загрузить файлы или создать заметки."
        )

    context_parts = [
        f"[Источник {i}: {c.source_name}]\n{c.chunk_text}"
        for i, c in enumerate(chunks, 1)
    ]
    context = "\n\n".join(context_parts)
    return f"""Ты — персональный AI-ассистент. Отвечай на вопросы пользователя строго по фрагментам из его базы знаний.

ПРАВИЛА:
1. Используй ТОЛЬКО информацию из фрагментов ниже. Не добавляй ничего от себя.
2. Нет ответа в контексте → скажи: «В вашей базе знаний нет информации по этому вопросу.»
3. Язык — русский. Стиль — живой и понятный, как объяснение эксперта коллеге.
4. Форматирование:
   - **жирный** для ключевых терминов и важных выводов
   - нумерованные (1. 2. 3.) или маркированные (- ) списки при перечислении
   - короткие абзацы с пустой строкой между ними
   - НЕ используй таблицы, символы |, ASCII-графику, блоки кода (```)
5. Ссылайся на конкретный источник, из которого взята информация: «согласно [Источнику 1]» или «(из документа "[Источник 2]")». Не упоминай источник, если не использовал его в ответе.
6. Начинай ответ сразу с сути — без вводных фраз «На основе предоставленных данных...».
7. В конце ответа — только текст. Никакого JSON, XML, технических блоков, списков вопросов.

ФРАГМЕНТЫ ИЗ БАЗЫ ЗНАНИЙ:

{context}"""


async def stream_answer(
    user_message: str,
    history: list[dict],
    chunks: list[SearchResult],
) -> AsyncGenerator[str, None]:
    sources_payload = [
        {
            "source_type": c.source_type,
            "source_name": c.source_name,
            "chunk_index": c.chunk_index,
            "similarity": round(c.similarity, 4),
            "excerpt": c.chunk_text[:200],
        }
        for c in chunks
    ]
    yield f"data: {json.dumps({'type': 'sources', 'sources': sources_payload}, ensure_ascii=False)}\n\n"

    system_prompt = _build_system_prompt(chunks)
    messages = (
        [{"role": "system", "content": system_prompt}]
        + list(history)
        + [{"role": "user", "content": user_message}]
    )

    try:
        stream = await _llm_client.chat.completions.create(
            model=CLAUDE_MODEL,
            messages=messages,
            max_tokens=2048,
            temperature=0.3,
            stream=True,
        )
        # Buffer text until newline so _sanitize always sees whole lines
        line_buffer = ""
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if not delta.content:
                continue
            line_buffer += delta.content
            # Flush complete lines; keep the incomplete tail in the buffer
            while "\n" in line_buffer:
                line, line_buffer = line_buffer.split("\n", 1)
                clean = _sanitize(line + "\n")
                if clean:
                    yield f"data: {json.dumps({'type': 'text', 'content': clean}, ensure_ascii=False)}\n\n"
        # Flush remaining text that has no trailing newline
        if line_buffer:
            clean = _sanitize(line_buffer)
            if clean:
                yield f"data: {json.dumps({'type': 'text', 'content': clean}, ensure_ascii=False)}\n\n"
    except Exception as e:
        logger.exception("LLM streaming error: %s", e)
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    yield "data: [DONE]\n\n"
