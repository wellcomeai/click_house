# backend/modules/ai_gateway/router.py

import logging
import uuid as uuid_lib
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, AsyncSessionLocal  # ← добавить AsyncSessionLocal
from dependencies import get_current_user
from modules.users.models import UserRole

logger = logging.getLogger(__name__)
router = APIRouter()


class AgentRunRequest(BaseModel):
    message: str
    history: list[dict] | None = None
    object_id: str | None = None


@router.get("/")
async def list_agents(_=Depends(get_current_user)):
    from agents.agent_registry import get_agent_list
    return {"agents": get_agent_list()}


@router.post("/{agent_name}/run")
async def run_agent(
    agent_name: str,
    request: AgentRunRequest,
    current_user=Depends(get_current_user),
    # ← убираем db из зависимостей здесь
):
    if current_user.role == UserRole.worker:
        raise HTTPException(status_code=403, detail="Нет доступа к агентам")

    from agents.agent_registry import get_agent
    agent = get_agent(agent_name)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Агент '{agent_name}' не найден")

    # Контекстное сообщение объекта формируем ДО стриминга
    context_message = None
    if request.object_id:
        try:
            async with AsyncSessionLocal() as db:
                from modules.objects.service import get_object_summary as svc_summary
                summary = await svc_summary(db, uuid_lib.UUID(request.object_id))
                context_message = (
                    f"КОНТЕКСТ ТЕКУЩЕГО ОБЪЕКТА (используй эти данные для анализа):\n"
                    f"ID: {summary['id']}\n"
                    f"Название: {summary['name']}\n"
                    f"Статус: {summary['status']}\n"
                    f"Адрес: {summary.get('address', 'не указан')}\n"
                    f"Описание: {summary.get('description', 'нет')}\n"
                    f"Дата начала: {summary.get('start_date', 'не указана')}\n"
                    f"Плановое завершение: {summary.get('planned_end_date', 'не указано')}\n"
                    f"Бюджет плановый: {summary.get('budget_planned', 'не указан')}\n"
                    f"Бюджет фактический: {summary.get('budget_actual', 'не указан')}\n"
                    f"Всего задач: {summary.get('total_tasks', 0)}\n"
                    f"Выполнено задач: {summary.get('done_tasks', 0)}\n"
                    f"Просроченных задач: {summary.get('overdue_tasks', 0)}\n"
                    f"Задач в работе: {summary.get('in_progress_tasks', 0)}\n"
                )
        except Exception as e:
            logger.warning("Не удалось получить контекст объекта: %s", e)

    async def stream_with_own_db():
        # ← сессия живёт всё время стриминга
        async with AsyncSessionLocal() as db:
            try:
                context = {"db": db, "current_user": current_user}
                async for chunk in agent.run(
                    request.message, context, request.history, context_message
                ):
                    yield chunk
            except Exception as exc:
                logger.exception("Streaming error: %s", exc)
                raise

    return StreamingResponse(
        stream_with_own_db(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
