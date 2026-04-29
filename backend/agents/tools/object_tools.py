import uuid
import logging
from datetime import datetime, timezone

from agents.tools.decorators import tool

logger = logging.getLogger(__name__)


@tool
async def get_object_summary(object_id: str, db=None, current_user=None) -> dict:
    """Получить сводную информацию по строительному объекту: статус, задачи, сроки, бюджет."""
    from modules.objects.service import get_object_summary as svc_summary

    return await svc_summary(db, uuid.UUID(object_id))


@tool
async def get_overdue_tasks(object_id: str, db=None, current_user=None) -> dict:
    """Получить список просроченных задач по объекту."""
    from sqlalchemy import select
    from modules.tasks.models import Task, TaskStatus

    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Task).where(
            Task.object_id == uuid.UUID(object_id),
            Task.deadline < now,
            Task.status != TaskStatus.done,
        )
    )
    tasks = result.scalars().all()
    return {
        "count": len(tasks),
        "tasks": [
            {
                "id": str(t.id),
                "title": t.title,
                "deadline": t.deadline.isoformat() if t.deadline else None,
                "status": t.status.value,
                "priority": t.priority.value,
                "assignee_id": str(t.assignee_id) if t.assignee_id else None,
            }
            for t in tasks
        ],
    }
