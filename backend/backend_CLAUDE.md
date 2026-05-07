# Backend — AI Context

## Стек
- Python 3.11, FastAPI 0.111, SQLAlchemy 2.0 async, Alembic
- PostgreSQL + pgvector, asyncpg драйвер
- Pydantic v2, python-jose (JWT), passlib (bcrypt)
- httpx (HTTP клиент для AI API), boto3 (Cloudflare R2)

## Запуск
```bash
pip install -r requirements.txt --break-system-packages
alembic upgrade head
python scripts/create_admin.py   # создаёт admin@... из .env
uvicorn main:app --reload --port 8000
```

## Структура
```
backend/
├── main.py               # FastAPI app, все роутеры
├── config.py             # Settings (pydantic-settings, .env)
├── database.py           # engine, AsyncSessionLocal, Base, get_db
├── dependencies.py       # get_current_user, role_required
├── alembic/
│   └── versions/         # миграции: 0001..0006
├── agents/               # AI агенты (см. agents/CLAUDE.md)
└── modules/
    ├── auth/             # JWT login/register/refresh
    ├── users/            # CRUD пользователей + профили
    ├── objects/          # Строительные объекты
    ├── tasks/            # Задачи + чеклисты + комментарии
    ├── files/            # Файлы (R2 + ObjectFile модель)
    ├── comments/         # Комментарии объектов
    ├── ai_gateway/       # Роутер для AI агентов (SSE streaming)
    ├── personal_kb/      # RAG ассистент (см. modules/personal_kb/CLAUDE.md)
    └── image_callback/   # Webhook от kie.ai для генерации изображений
```

## Паттерны

### Зависимости в эндпоинтах
```python
# Получить текущего пользователя
current_user = Depends(get_current_user)
# Проверка роли
_ = Depends(role_required("admin", "manager"))
# БД сессия
db: AsyncSession = Depends(get_db)
```

### SQLAlchemy 2.0 стиль
```python
# Всегда так:
result = await db.execute(select(Model).where(Model.field == value))
obj = result.scalar_one_or_none()
# Добавление:
db.add(obj)
await db.flush()   # в середине транзакции
await db.commit()  # в конце
```

### SSE Streaming
```python
async def stream():
    yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
    yield "data: [DONE]\n\n"

return StreamingResponse(stream(), media_type="text/event-stream")
```

## Добавление нового модуля
1. Создать папку `modules/new_module/`
2. Файлы: `__init__.py`, `models.py`, `schemas.py`, `router.py`, `service.py`
3. Добавить импорт модели в `alembic/env.py`
4. Создать миграцию: `alembic revision --autogenerate -m "описание"`
5. Зарегистрировать роутер в `main.py`

## Важные настройки
- `access_token_expire_minutes = 30` (короткоживущий)
- `refresh_token_expire_days = 7`
- `pool_size = 10`, `max_overflow = 20` для asyncpg
- Все даты — timezone-aware (UTC)
