import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user, role_required
from modules.tasks import service
from modules.tasks.schemas import (
    ChecklistItemCreate,
    ChecklistItemUpdate,
    TaskCreate,
    TaskResponse,
    TaskStatusUpdate,
    TaskUpdate,
)

router = APIRouter()


@router.get("/", response_model=list[TaskResponse])
async def get_my_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    return await service.get_my_tasks(db, current_user)


@router.get("/all", response_model=list[TaskResponse])
async def get_all_tasks(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(role_required("admin", "manager")),
):
    return await service.get_all_tasks(db)


@router.get("/object/{object_id}", response_model=list[TaskResponse])
async def get_tasks_by_object(
    object_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    return await service.get_tasks_by_object(db, object_id, current_user)


@router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(
    data: TaskCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(role_required("admin", "manager", "foreman")),
):
    return await service.create_task(db, data.model_dump(exclude_none=True), current_user.id)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    return await service.get_task_by_id(db, task_id)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    data: TaskUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(role_required("admin", "manager", "foreman")),
):
    return await service.update_task(db, task_id, data.model_dump(exclude_none=True))


@router.patch("/{task_id}/status", response_model=TaskResponse)
async def update_status(
    task_id: uuid.UUID,
    data: TaskStatusUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    return await service.update_task_status(db, task_id, data.status)


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(role_required("admin", "manager", "foreman")),
):
    await service.delete_task(db, task_id)


@router.post("/{task_id}/checklist", response_model=TaskResponse)
async def add_checklist_item(
    task_id: uuid.UUID,
    data: ChecklistItemCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    return await service.add_checklist_item(db, task_id, data.title, data.order_index)


@router.patch("/{task_id}/checklist/{item_id}", response_model=TaskResponse)
async def update_checklist_item(
    task_id: uuid.UUID,
    item_id: uuid.UUID,
    data: ChecklistItemUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    return await service.update_checklist_item(db, task_id, item_id, data.is_done)
