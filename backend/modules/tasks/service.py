import uuid
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from modules.tasks.models import Task, TaskChecklist, TaskStatus
from modules.users.models import User, UserRole

logger = logging.getLogger(__name__)


def _task_query():
    return select(Task).options(selectinload(Task.checklist))


async def get_my_tasks(db: AsyncSession, user: User) -> list[Task]:
    result = await db.execute(
        _task_query()
        .where(Task.assignee_id == user.id)
        .order_by(Task.created_at.desc())
    )
    return list(result.scalars().all())


async def get_all_tasks(db: AsyncSession) -> list[Task]:
    result = await db.execute(
        _task_query().order_by(Task.created_at.desc())
    )
    return list(result.scalars().all())


async def get_tasks_by_object(
    db: AsyncSession, object_id: uuid.UUID, user: User
) -> list[Task]:
    query = _task_query().where(Task.object_id == object_id)

    if user.role == UserRole.worker:
        query = query.where(Task.assignee_id == user.id)

    result = await db.execute(query.order_by(Task.created_at.desc()))
    return list(result.scalars().all())


async def get_task_by_id(db: AsyncSession, task_id: uuid.UUID) -> Task:
    result = await db.execute(
        _task_query().where(Task.id == task_id)
    )
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Задача не найдена")
    return task


async def create_task(db: AsyncSession, data: dict, creator_id: uuid.UUID) -> Task:
    task = Task(**data, creator_id=creator_id)
    db.add(task)
    await db.flush()
    await db.refresh(task, ["checklist"])
    logger.info("Task created: %s by %s", task.id, creator_id)
    return task


async def update_task(db: AsyncSession, task_id: uuid.UUID, data: dict) -> Task:
    task = await get_task_by_id(db, task_id)
    for field, value in data.items():
        setattr(task, field, value)
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return task


async def update_task_status(
    db: AsyncSession, task_id: uuid.UUID, new_status: TaskStatus
) -> Task:
    task = await get_task_by_id(db, task_id)
    task.status = new_status
    task.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return task


async def delete_task(db: AsyncSession, task_id: uuid.UUID) -> None:
    task = await get_task_by_id(db, task_id)
    await db.delete(task)
    await db.flush()
    logger.info("Task deleted: %s", task_id)


async def add_checklist_item(
    db: AsyncSession, task_id: uuid.UUID, title: str, order_index: int = 0
) -> Task:
    await get_task_by_id(db, task_id)
    item = TaskChecklist(task_id=task_id, title=title, order_index=order_index)
    db.add(item)
    await db.flush()
    return await get_task_by_id(db, task_id)


async def update_checklist_item(
    db: AsyncSession, task_id: uuid.UUID, item_id: uuid.UUID, is_done: bool
) -> Task:
    result = await db.execute(
        select(TaskChecklist).where(
            TaskChecklist.id == item_id,
            TaskChecklist.task_id == task_id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пункт чеклиста не найден",
        )
    item.is_done = is_done
    await db.flush()
    return await get_task_by_id(db, task_id)
