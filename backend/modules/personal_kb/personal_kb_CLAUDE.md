# Personal KB (RAG Ассистент) — AI Context

## Назначение
Персональная база знаний каждого пользователя с RAG-ответами.
Каждый пользователь загружает свои файлы и заметки → они индексируются →
ассистент отвечает на вопросы ТОЛЬКО по этим данным.

## Файлы модуля
```
personal_kb/
├── models.py     # PersonalNote, KBFile, KBChunk, ChatSession, AssistantChatHistory
├── schemas.py    # Pydantic схемы (в т.ч. ChatSessionResponse, ChatRequest)
├── router.py     # Все эндпоинты (notes, files, chunks, sessions, chat)
├── indexer.py    # Разбивка на чанки + создание эмбеддингов
├── search.py     # Векторный поиск через pgvector
└── llm.py        # Стриминг ответа через LLM (deepseek)
```

## Модели БД
```
personal_notes   — заметки пользователя (title, content)
kb_files         — загруженные файлы (pdf/docx/txt/md), статус индексации
kb_chunks        — чанки текста с эмбеддингами vector(1536) ← ВАЖНО: 1536!
chat_sessions    — сессии чата (id, user_id, title, created_at, updated_at)
assistant_chat_history — сообщения (id, user_id, session_id, role, content)
```

## Индексация (indexer.py)
```
Файл/Заметка → parse_text() → split_into_chunks(400 слов, overlap 50)
→ get_embedding() → text-embedding-3-small via OpenRouter → vector(1536)
→ INSERT INTO kb_chunks
```
- Файлы индексируются в фоне через `asyncio.create_task()`
- При обновлении заметки — старые чанки удаляются, создаются новые
- Поддерживаемые форматы: pdf (PyPDF2), docx (python-docx), txt/md (utf-8)

## Векторный поиск (search.py)
```sql
SELECT ... 1 - (embedding <=> CAST(:vec AS vector)) AS similarity
FROM kb_chunks
WHERE user_id = :uid
  AND 1 - (embedding <=> CAST(:vec AS vector)) >= :min_sim
ORDER BY embedding <=> CAST(:vec AS vector)
LIMIT :k
```
- Индекс: HNSW (m=16, ef_construction=64), cosine distance
- Текущий порог: 0.42 (было 0.30 — слишком много шума)
- TOP-K: 6 чанков

## RAG Pipeline (router.py /chat)
1. `POST /assistant/chat` с `{message, session_id}`
2. Embed запроса → поиск top-6 чанков
3. Загрузить историю сессии (последние 20 сообщений)
4. Сформировать системный промпт с чанками
5. Стриминг через deepseek/deepseek-v4-flash
6. Сохранить user/assistant сообщения в `assistant_chat_history`
7. При первом сообщении — обновить title сессии из текста вопроса

## API Эндпоинты (все под /assistant)
```
# Заметки
POST   /assistant/notes
GET    /assistant/notes
GET    /assistant/notes/{id}
PUT    /assistant/notes/{id}
DELETE /assistant/notes/{id}

# Файлы
POST   /assistant/files
GET    /assistant/files
DELETE /assistant/files/{id}

# Чанки (просмотр)
GET    /assistant/chunks?source_type=all|note|file

# Статистика
GET    /assistant/stats

# Сессии чата
POST   /assistant/sessions           → создать сессию
GET    /assistant/sessions           → список сессий с превью
PUT    /assistant/sessions/{id}      → переименовать
DELETE /assistant/sessions/{id}      → удалить сессию + все сообщения

# Чат
POST   /assistant/chat               → стриминг ответа (SSE)
GET    /assistant/chat/history?session_id=xxx&limit=50
DELETE /assistant/chat/history       → очистить всю историю пользователя
```

## SSE события из /chat
```json
{"type": "session_id", "session_id": "uuid..."}   ← первым, возвращает id сессии
{"type": "sources", "sources": [...]}              ← найденные чанки
{"type": "text", "content": "..."}                 ← токены ответа
{"type": "error", "content": "..."}               ← ошибка
[DONE]
```

## Особенности
- `skip_history: true` в ChatRequest — не сохранять сообщение в историю
  (используется для мета-запросов, e.g. auto-title)
- Если база знаний пуста — LLM не вызывается, сразу возвращается заглушка
- LLM промпт строго запрещает выдумывать, только по источникам

## Известные проблемы / что проверить
- `kb_chunks.embedding` ДОЛЖНА быть `vector(1536)`, проверить: `\d kb_chunks` в psql
- OpenRouter ключ должен поддерживать `text-embedding-3-small`
- При ошибках индексации — смотреть `kb_files.status` и `kb_files.error_message`
