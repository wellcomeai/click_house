import uuid
import logging

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from agents.tools.decorators import tool

logger = logging.getLogger(__name__)


@tool
async def get_task_details(task_id: str, db=None, current_user=None) -> dict:
    """Получить детальную информацию о задаче по её ID."""
    from modules.tasks.models import Task

    try:
        result = await db.execute(
            select(Task)
            .options(selectinload(Task.checklist))
            .where(Task.id == uuid.UUID(task_id))
        )
        task = result.scalar_one_or_none()
        if not task:
            return {"error": "Задача не найдена"}
        return {
            "id": str(task.id),
            "title": task.title,
            "description": task.description,
            "status": task.status.value,
            "priority": task.priority.value,
            "category": task.category.value if task.category else None,
            "object_id": str(task.object_id) if task.object_id else None,
            "deadline": task.deadline.isoformat() if task.deadline else None,
            "assignee_id": str(task.assignee_id) if task.assignee_id else None,
            "creator_id": str(task.creator_id),
            "checklist": [
                {"title": item.title, "is_done": item.is_done}
                for item in task.checklist
            ],
        }
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_object_details(object_id: str, db=None, current_user=None) -> dict:
    """Получить детальную информацию о строительном объекте по его ID."""
    from modules.objects.models import Object

    try:
        result = await db.execute(select(Object).where(Object.id == uuid.UUID(object_id)))
        obj = result.scalar_one_or_none()
        if not obj:
            return {"error": "Объект не найден"}
        return {
            "id": str(obj.id),
            "name": obj.name,
            "status": obj.status.value,
            "address": obj.address,
            "object_type": obj.object_type.value if obj.object_type else None,
            "description": obj.description,
            "start_date": obj.start_date.isoformat() if obj.start_date else None,
            "planned_end_date": obj.planned_end_date.isoformat() if obj.planned_end_date else None,
            "budget_planned": float(obj.budget_planned) if obj.budget_planned else None,
            "budget_actual": float(obj.budget_actual) if obj.budget_actual else None,
        }
    except Exception as e:
        return {"error": str(e)}


@tool
async def get_user_details(user_id: str, db=None, current_user=None) -> dict:
    """Получить информацию о пользователе по его ID."""
    from modules.users.models import User

    try:
        result = await db.execute(
            select(User)
            .options(selectinload(User.profile))
            .where(User.id == uuid.UUID(user_id))
        )
        user = result.scalar_one_or_none()
        if not user:
            return {"error": "Пользователь не найден"}
        profile = user.profile
        return {
            "id": str(user.id),
            "email": user.email,
            "role": user.role.value,
            "full_name": " ".join(
                filter(
                    None,
                    [
                        profile.last_name if profile else None,
                        profile.first_name if profile else None,
                        profile.middle_name if profile else None,
                    ],
                )
            )
            or user.email,
            "position": profile.position if profile else None,
            "phone": profile.phone if profile else None,
        }
    except Exception as e:
        return {"error": str(e)}
