import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user, role_required
from modules.objects import service
from modules.objects.schemas import ObjectCreate, ObjectResponse, ObjectUpdate

router = APIRouter()


@router.get("/", response_model=list[ObjectResponse])
async def list_objects(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    return await service.get_objects_for_user(db, current_user)


@router.post("/", response_model=ObjectResponse, status_code=201)
async def create_object(
    data: ObjectCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(role_required("admin", "manager")),
):
    return await service.create_object(db, data.model_dump(exclude_none=True), current_user.id)


@router.get("/{object_id}", response_model=ObjectResponse)
async def get_object(
    object_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    return await service.get_object_by_id(db, object_id)


@router.put("/{object_id}", response_model=ObjectResponse)
async def update_object(
    object_id: uuid.UUID,
    data: ObjectUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(role_required("admin", "manager")),
):
    return await service.update_object(db, object_id, data.model_dump(exclude_none=True))


@router.delete("/{object_id}", status_code=204)
async def delete_object(
    object_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(role_required("admin")),
):
    await service.delete_object(db, object_id)


@router.get("/{object_id}/summary")
async def get_object_summary(
    object_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    return await service.get_object_summary(db, object_id)
