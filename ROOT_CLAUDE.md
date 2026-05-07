# Clickhome — AI Context for Claude Code

## Что это за проект
B2B платформа для управления строительными объектами (ClickHouse Irkutsk).
Стек: **FastAPI + SQLAlchemy async + PostgreSQL + pgvector** на бэкенде, **React + TypeScript + Vite + TailwindCSS** на фронтенде.

## Структура репозитория
```
/
├── backend/          # FastAPI приложение (Python 3.11)
├── frontend/         # React + Vite + TypeScript
├── CLAUDE.md         # этот файл
└── TASKS.md          # текущие задачи (если есть)
```

## Быстрый старт
```bash
# Backend
cd backend
pip install -r requirements.txt
alembic upgrade head
python scripts/create_admin.py
uvicorn main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

## Переменные окружения (backend/.env)
```
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=...
OPENROUTER_API_KEY=...        # для AI агентов и RAG
KIE_API_KEY=...               # для генерации изображений
R2_ACCOUNT_ID=...             # Cloudflare R2 хранилище
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=...
```

## Роли пользователей
- **admin** — полный доступ, управление пользователями
- **manager** — управление объектами и задачами, доступ к AI агентам
- **foreman** (прораб) — свои объекты, создание задач, доступ к AI агентам
- **worker** — только свои задачи, доступ к AI ассистенту (RAG)

## Ключевые модули
| Модуль | Путь | Назначение |
|--------|------|-----------|
| Auth | `modules/auth/` | JWT авторизация (access + refresh токены) |
| Objects | `modules/objects/` | Строительные объекты |
| Tasks | `modules/tasks/` | Задачи с чеклистами и комментариями |
| Files | `modules/files/` | Файлы объектов/задач в Cloudflare R2 |
| AI Gateway | `modules/ai_gateway/` | AI агенты (OpenRouter, streaming SSE) |
| Personal KB | `modules/personal_kb/` | RAG ассистент — заметки, файлы, векторный поиск |
| Agents | `agents/` | Три AI агента: task_assistant, object_analyst, doc_helper |

## AI агенты (agents/)
Три агента настроены через YAML конфиги в `agents/configs/`:
- `task_assistant` — создание/обновление задач
- `object_analyst` — анализ состояния объектов  
- `doc_helper` — генерация отчётов и документов

Агенты работают через OpenRouter, стриминг SSE, поддерживают tool_calls.

## RAG Ассистент (personal_kb)
Персональная база знаний каждого пользователя:
- Заметки (PersonalNote) и файлы (KBFile: pdf, docx, txt, md)
- Чанкинг: 400 слов, overlap 50
- Эмбеддинги: `text-embedding-3-small` через OpenRouter → **1536 измерений**
- Хранение: pgvector, HNSW индекс, cosine similarity
- LLM для ответов: `deepseek/deepseek-v4-flash` через OpenRouter
- Минимальный порог similarity: 0.30 (рассмотреть повышение до 0.42)

**ВАЖНО:** Таблица `kb_chunks` должна иметь `vector(1536)`, НЕ `vector(1024)`.
Если при индексации ошибки — проверить размерность колонки в БД.

## База данных
PostgreSQL + pgvector (расширение vector).
Миграции: Alembic, файлы в `backend/alembic/versions/`.

Таблицы:
- `users`, `user_profiles`
- `objects`, `tasks`, `task_checklist`
- `object_files`, `object_comments`, `task_comments`
- `personal_notes`, `kb_files`, `kb_chunks` (vector 1536-dim)
- `chat_sessions`, `assistant_chat_history` (с session_id)

## Frontend архитектура
```
src/
├── api/          # axios клиенты для каждого модуля
├── components/   # shared UI (layout, объекты, ui-primitives)
├── pages/        # страницы по роутам
├── store/        # Zustand (authStore, uiStore)
├── types/        # TypeScript типы и константы
└── utils/        # cn() и другие утилиты
```

Стейт менеджмент: **Zustand** (persist для authStore).
Серверный стейт: **TanStack Query** (React Query v5).
Стили: **TailwindCSS** + CSS переменные в `index.css`.

## Брендинг / дизайн
- Основной цвет: `#22b722` (зелёный)
- Фон: `#f2f4f7`
- Графит: `#3d3d3d`
- Шрифты: Syne (заголовки), DM Sans (текст)
- Компоненты из `components/ui/` — shadcn-совместимые

## Деплой
Бэкенд отдаёт фронтенд как статику из `backend/static/`.
Сборка: `cd frontend && npm run build` → копируется в `backend/static/`.
Хостинг: Render.com.

## Частые ошибки и решения
1. **pgvector dimension mismatch** — убедиться что `kb_chunks.embedding` = `vector(1536)`
2. **CORS** — настраивается через `CORS_ORIGINS` в .env (через запятую)
3. **Refresh token** — при 401 axios interceptor автоматически обновляет токен
4. **Streaming SSE** — агенты и чат используют `text/event-stream`, не используй axios для этого, только `fetch`

## Конвенции кода
- Python: async/await везде, SQLAlchemy 2.0 style (select/scalar_one_or_none)
- TypeScript: строгая типизация, интерфейсы в `types/index.ts`
- API роуты: REST, префиксы в `main.py`
- Новые миграции: нумерация `0007_...`, `0008_...` и т.д.
