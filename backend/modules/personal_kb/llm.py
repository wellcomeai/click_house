import json
import logging
from typing import AsyncGenerator

from openai import AsyncOpenAI

from config import settings
from modules.personal_kb.search import SearchResult

logger = logging.getLogger(__name__)

# Claude via OpenRouter — same API key already used for embeddings
CLAUDE_MODEL = "anthropic/claude-sonnet-4-5"

_llm_client = AsyncOpenAI(
    api_key=settings.openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)


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
    messages = [{"role": "system", "content": system_prompt}] + list(history) + [
        {"role": "user", "content": user_message}
    ]

    try:
        stream = await _llm_client.chat.completions.create(
            model=CLAUDE_MODEL,
            messages=messages,
            max_tokens=2048,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                yield f"data: {json.dumps({'type': 'text', 'content': delta.content}, ensure_ascii=False)}\n\n"
    except Exception as e:
        logger.exception("LLM streaming error: %s", e)
        yield f"data: {json.dumps({'type': 'error', 'content': str(e)}, ensure_ascii=False)}\n\n"

    yield "data: [DONE]\n\n"
