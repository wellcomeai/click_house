import uuid
import logging

from agents.tools.decorators import tool

logger = logging.getLogger(__name__)


@tool
async def create_task(
    title: str,
    assignee_id: str,
    priority: str,
    object_id: str,
    db=None,
    current_user=None,
) -> dict:
    """Создать новую задачу и назначить её на пользователя."""
    from modules.tasks.service import create_task as svc_create

    data = {
        "title": title,
        "priority": priority,
        "assignee_id": uuid.UUID(assignee_id) if assignee_id else None,
        "object_id": uuid.UUID(object_id) if object_id else None,
    }
    # Remove None values
    data = {k: v for k, v in data.items() if v is not None}

    task = await svc_create(db, data, creator_id=current_user.id)
    return {
        "success": True,
        "task_id": str(task.id),
        "title": task.title,
        "status": task.status.value,
    }


@tool
async def update_task(
    task_id: str,
    status: str,
    priority: str,
    db=None,
    current_user=None,
) -> dict:
    """Обновить статус или приоритет существующей задачи."""
    from modules.tasks.service import update_task as svc_update

    data = {}
    if status:
        data["status"] = status
    if priority:
        data["priority"] = priority

    task = await svc_update(db, uuid.UUID(task_id), data)
    return {
        "success": True,
        "task_id": str(task.id),
        "title": task.title,
        "status": task.status.value,
        "priority": task.priority.value,
    }


@tool
async def assign_task(task_id: str, assignee_id: str, db=None, current_user=None) -> dict:
    """Назначить задачу на указанного пользователя."""
    from modules.tasks.service import update_task as svc_update

    task = await svc_update(db, uuid.UUID(task_id), {"assignee_id": uuid.UUID(assignee_id)})
    return {
        "success": True,
        "task_id": str(task.id),
        "assignee_id": str(task.assignee_id),
    }
