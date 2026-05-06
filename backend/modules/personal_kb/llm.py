import json
import logging
from typing import AsyncGenerator

import anthropic

from config import settings
from modules.personal_kb.search import SearchResult

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "claude-sonnet-4-20250514"


def _build_system_prompt(chunks: list[SearchResult]) -> str:
    if not chunks:
        return (
            "Ты персональный AI-ассистент. У пользователя пока нет документов "
            "в базе знаний. Сообщи, что в базе знаний нет информации по данному вопросу."
        )
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(
            f"[Источник {i}: {chunk.source_name}, фрагмент {chunk.chunk_index}]\n"
            f"{chunk.chunk_text}"
        )
    context = "\n\n---\n\n".join(context_parts)
    return (
        "Ты персональный AI-ассистент пользователя. "
        "Отвечай ТОЛЬКО на основе предоставленных фрагментов из личной базы знаний. "
        "Если в контексте нет информации — честно скажи: "
        '"В вашей базе знаний нет информации по этому вопросу." '
        "Не придумывай факты. Ссылайся на источник (название заметки или файла). "
        "Отвечай на русском языке.\n\n"
        f"ФРАГМЕНТЫ ИЗ БАЗЫ ЗНАНИЙ:\n\n{context}"
    )


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
    messages = list(history) + [{"role": "user", "content": user_message}]

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    try:
        async with client.messages.stream(
            model=CLAUDE_MODEL,
            max_tokens=2048,
            system=system_prompt,
            messages=messages,
        ) as stream:
            async for text_chunk in stream.text_stream:
                yield f"data: {json.dumps({'type': 'text', 'content': text_chunk}, ensure_ascii=False)}\n\n"
    except Exception as e:
        logger.exception("LLM streaming error: %s", e)
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    yield "data: [DONE]\n\n"
