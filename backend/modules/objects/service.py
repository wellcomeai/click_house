import uuid
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, exists
from sqlalchemy.ext.asyncio import AsyncSession

from modules.objects.models import Object
from modules.tasks.models import Task
from modules.users.models import User, UserRole

logger = logging.getLogger(__name__)


async def get_objects_for_user(db: AsyncSession, user: User) -> list[Object]:
    role = user.role

    if role in (UserRole.admin, UserRole.manager):
        result = await db.execute(select(Object).order_by(Object.created_at.desc()))
    elif role == UserRole.foreman:
        result = await db.execute(
            select(Object)
            .where(Object.foreman_id == user.id)
            .order_by(Object.created_at.desc())
        )
    else:
        # worker: objects where they have at least one task
        subq = (
            select(Task.object_id)
            .where(Task.assignee_id == user.id, Task.object_id.isnot(None))
            .scalar_subquery()
        )
        result = await db.execute(
            select(Object).where(Object.id.in_(subq)).order_by(Object.created_at.desc())
        )

    return list(result.scalars().all())


async def get_object_by_id(db: AsyncSession, object_id: uuid.UUID) -> Object:
    result = await db.execute(select(Object).where(Object.id == object_id))
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объект не найден")
    return obj


async def create_object(db: AsyncSession, data: dict, created_by: uuid.UUID) -> Object:
    obj = Object(**data, created_by=created_by)
    db.add(obj)
    await db.flush()
    logger.info("Object created: %s by %s", obj.id, created_by)
    return obj


async def update_object(
    db: AsyncSession, object_id: uuid.UUID, data: dict
) -> Object:
    obj = await get_object_by_id(db, object_id)
    for field, value in data.items():
        setattr(obj, field, value)
    obj.updated_at = datetime.now(timezone.utc)
    await db.flush()
    return obj


async def delete_object(db: AsyncSession, object_id: uuid.UUID) -> None:
    obj = await get_object_by_id(db, object_id)
    await db.delete(obj)
    await db.flush()
    logger.info("Object deleted: %s", object_id)


async def get_object_summary(db: AsyncSession, object_id: uuid.UUID) -> dict:
    obj = await get_object_by_id(db, object_id)

    tasks_result = await db.execute(
        select(Task).where(Task.object_id == object_id)
    )
    tasks = list(tasks_result.scalars().all())

    now = datetime.now(timezone.utc)
    overdue = [t for t in tasks if t.deadline and t.deadline < now and t.status.value != "done"]

    return {
        "id": str(obj.id),
        "name": obj.name,
        "status": obj.status.value,
        "address": obj.address,
        "description": obj.description,
        "start_date": obj.start_date.isoformat() if obj.start_date else None,
        "planned_end_date": obj.planned_end_date.isoformat() if obj.planned_end_date else None,
        "budget_planned": float(obj.budget_planned) if obj.budget_planned else None,
        "budget_actual": float(obj.budget_actual) if obj.budget_actual else None,
        "total_tasks": len(tasks),
        "done_tasks": len([t for t in tasks if t.status.value == "done"]),
        "overdue_tasks": len(overdue),
        "in_progress_tasks": len([t for t in tasks if t.status.value == "in_progress"]),
    }
