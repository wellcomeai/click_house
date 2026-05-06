import json
import logging
import re
from typing import AsyncGenerator

from openai import AsyncOpenAI

from config import settings
from modules.personal_kb.search import SearchResult

logger = logging.getLogger(__name__)

CLAUDE_MODEL = "ibm-granite/granite-4.1-8b"

_llm_client = AsyncOpenAI(
    api_key=settings.openrouter_api_key,
    base_url="https://openrouter.ai/api/v1",
)


def sanitize_llm_response(content: str) -> str:
    """Удаляет любые попытки LLM нарисовать таблицу или использовать запрещённое форматирование."""
    lines = content.split('\n')
    cleaned_lines = []
    
    for line in lines:
        # Пропускаем строки, которые являются markdown-таблицами
        if '|' in line:
            # Проверяем, не является ли строка частью таблицы
            # Строка с трубами и тире/двоеточиями для выравнивания
            if re.match(r'^\s*\|?[\s\-:|]+\|?\s*$', line):
                continue
            # Строка с данными таблицы (содержит | и хотя бы одну цифру/букву до и после)
            if re.match(r'^\s*\|.+\|.+\|\s*$', line):
                continue
        
        # Убираем ASCII-таблицы (содержат +---+--- и т.д.)
        if re.match(r'^[\+\-\=\|]+$', line) and ('+' in line or '-' in line):
            continue
            
        # Если строка прошла проверку, добавляем её
        cleaned_lines.append(line)
    
    result = '\n'.join(cleaned_lines)
    
    # Заменяем одиночные символы | на дефисы (если они остались в тексте)
    # Но не трогаем те, что внутри слов (например, "привет|мир")
    result = re.sub(r'(?<!\w)\s*\|\s*(?!\w)', ' - ', result)
    
    # Убираем лишние пробелы и пустые строки в начале/конце
    result = result.strip()
    
    return result


def _build_system_prompt(chunks: list[SearchResult]) -> str:
    if not chunks:
        return (
            "Ты персональный AI-ассистент. У пользователя пока нет документов "
            "в базе знаний. Сообщи, что в базе знаний нет информации по данному вопросу "
            "и предложи свою точку зрения на основе твоих общих знаний, если это уместно.\n\n"
            "Важно: отвечай естественно, без таблиц и ASCII-графики."
        )
    
    context_parts = []
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(
            f"[Источник {i}: {chunk.source_name}, фрагмент {chunk.chunk_index}]\n"
            f"{chunk.chunk_text}"
        )
    context = "\n\n---\n\n".join(context_parts)
    
    return (
        "Ты персональный AI-ассистент пользователя.\n\n"
        
        "## ❌ СТРОГО ЗАПРЕЩЕНО (никогда не делай это):\n"
        "1. Использовать символ | для создания таблиц\n"
        "2. Использовать комбинации ---, |---|, :---: и т.п.\n"
        "3. Рисовать ASCII-таблицы: +---+---+\n"
        "4. Создавать любые визуальные структуры с колонками\n"
        "5. Использовать markdown-разметку таблиц\n\n"
        
        "## ✅ РАЗРЕШЕНО (и поощряется):\n"
        "1. Маркированные списки с дефисом (-)\n"
        "2. Нумерованные списки (1., 2., 3.)\n"
        "3. Обычный связный текст\n"
        "4. Выделение жирным **важных терминов**\n"
        "5. Разделение на абзацы с пустыми строками\n\n"
        
        "## 📋 ПРИМЕРЫ ФОРМАТИРОВАНИЯ:\n\n"
        "❌ НЕПРАВИЛЬНО (таблица):\n"
        "| Отделение | Процедуры |\n"
        "|-----------|-----------|\n"
        "| Хаммам | Расслабление |\n\n"
        
        "✅ ПРАВИЛЬНО (список):\n"
        "- **Хаммам**: расслабление и стерилизация организма\n"
        "- **Сауны**: улучшение кровообращения\n\n"
        
        "✅ ПРАВИЛЬНО (текст):\n"
        "В влажных зонах можно найти хаммам для расслабления и сауны для улучшения кровообращения.\n\n"
        
        "## 📖 ПРАВИЛА РАБОТЫ С КОНТЕКСТОМ:\n"
        "1. Отвечай ТОЛЬКО на основе предоставленных фрагментов из базы знаний пользователя\n"
        "2. Если в контексте нет полной информации — скажи:\n"
        "   'В вашей базе знаний нет полной информации по этому вопросу, но на основе доступных данных...'\n"
        "3. Если информации нет совсем — скажи:\n"
        "   'В вашей базе знаний нет информации по этому вопросу. На основе моих общих знаний, вот что я могу сказать...'\n"
        "   и предложи свою точку зрения\n"
        "4. Не выдумывай факты, которых нет в контексте, но можешь добавлять общеизвестную информацию после фразы 'Дополнительно:'\n"
        "5. Всегда ссылайся на источник в формате: (Источник: название файла)\n"
        "6. Отвечай на русском языке, естественно и понятно\n"
        "7. Не пиши 'в соответствии с предоставленными фрагментами' — просто отвечай по делу\n\n"
        
        "## 📄 КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ:\n\n"
        f"{context}"
    )


async def stream_answer(
    user_message: str,
    history: list[dict],
    chunks: list[SearchResult],
) -> AsyncGenerator[str, None]:
    """Генерирует потоковый ответ от LLM с предварительной очисткой от таблиц."""
    
    # Отправляем информацию об источниках
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

    # Строим системный промт на основе найденных фрагментов
    system_prompt = _build_system_prompt(chunks)
    
    # Формируем сообщения для LLM
    messages = [{"role": "system", "content": system_prompt}] + list(history) + [
        {"role": "user", "content": user_message}
    ]
    
    # Дополнительная инструкция в user message для надёжности
    # (Granite модели лучше воспринимают запреты ближе к запросу)
    enhanced_user_message = (
        f"{user_message}\n\n"
        f"ВАЖНО: Отвечай без таблиц и символов |. Используй только текст и списки с дефисом."
    )
    messages[-1]["content"] = enhanced_user_message

    try:
        stream = await _llm_client.chat.completions.create(
            model=CLAUDE_MODEL,
            messages=messages,
            max_tokens=2048,
            temperature=0.3,  # Снижаем температуру для более предсказуемого форматирования
            stream=True,
        )
        
        accumulated_content = ""
        
        async for chunk in stream:
            delta = chunk.choices[0].delta
            if delta.content:
                # Накопление для пост-обработки (опционально, если нужно чистить целиком)
                accumulated_content += delta.content
                
                # Реальная очистка от таблиц
                cleaned_content = sanitize_llm_response(delta.content)
                
                # Отправляем очищенный контент
                if cleaned_content:
                    yield f"data: {json.dumps({'type': 'text', 'content': cleaned_content}, ensure_ascii=False)}\n\n"
                    
    except Exception as e:
        logger.exception("LLM streaming error: %s", e)
        error_message = "Извините, произошла ошибка при генерации ответа. Пожалуйста, попробуйте позже."
        yield f"data: {json.dumps({'type': 'error', 'content': error_message}, ensure_ascii=False)}\n\n"

    yield "data: [DONE]\n\n"


# Дополнительная функция для non-streaming режима (если понадобится)
async def answer_sync(
    user_message: str,
    history: list[dict],
    chunks: list[SearchResult],
) -> str:
    """Не-потоковый вариант получения ответа."""
    system_prompt = _build_system_prompt(chunks)
    
    enhanced_user_message = (
        f"{user_message}\n\n"
        f"ВАЖНО: Отвечай без таблиц и символов |. Используй только текст и списки с дефисом."
    )
    
    messages = [{"role": "system", "content": system_prompt}] + list(history) + [
        {"role": "user", "content": enhanced_user_message}
    ]
    
    try:
        response = await _llm_client.chat.completions.create(
            model=CLAUDE_MODEL,
            messages=messages,
            max_tokens=2048,
            temperature=0.3,
            stream=False,
        )
        
        content = response.choices[0].message.content or ""
        cleaned_content = sanitize_llm_response(content)
        return cleaned_content
        
    except Exception as e:
        logger.exception("LLM sync answer error: %s", e)
        return "Извините, произошла ошибка при генерации ответа. Пожалуйста, попробуйте позже."
