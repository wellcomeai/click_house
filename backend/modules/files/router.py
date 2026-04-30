import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user, role_required
from modules.files import r2_service
from modules.files.models import ObjectFile, FileType
from modules.files.schemas import FileResponse
from modules.tasks.models import Task

router = APIRouter()

MAX_SIZE = 100 * 1024 * 1024  # 100 MB


def _determine_file_type(content_type: str) -> FileType:
    if content_type.startswith("image/"):
        return FileType.image
    return FileType.document


# ── Object files ──────────────────────────────────────────────────────────────

@router.post("/objects/{object_id}/files", response_model=FileResponse, status_code=201)
async def upload_object_file(
    object_id: uuid.UUID,
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(role_required("admin", "manager", "foreman")),
):
    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Файл превышает лимит 100 МБ")

    content_type = file.content_type or "application/octet-stream"
    result = await r2_service.upload_file(
        file_bytes=file_bytes,
        original_name=file.filename or "file",
        content_type=content_type,
        folder=f"objects/{object_id}",
    )

    obj_file = ObjectFile(
        object_id=object_id,
        uploaded_by=current_user.id,
        file_type=_determine_file_type(content_type),
        original_name=file.filename or "file",
        storage_key=result["storage_key"],
        public_url=result["public_url"],
        size_bytes=len(file_bytes),
    )
    db.add(obj_file)
    await db.commit()
    await db.refresh(obj_file)
    return obj_file


@router.get("/objects/{object_id}/files", response_model=list[FileResponse])
async def list_object_files(
    object_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(ObjectFile)
        .where(ObjectFile.object_id == object_id, ObjectFile.task_id.is_(None))
        .order_by(ObjectFile.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/objects/{object_id}/files/{file_id}", status_code=204)
async def delete_object_file(
    object_id: uuid.UUID,
    file_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(ObjectFile).where(
            ObjectFile.id == file_id, ObjectFile.object_id == object_id
        )
    )
    obj_file = result.scalar_one_or_none()
    if not obj_file:
        raise HTTPException(status_code=404, detail="Файл не найден")

    role = current_user.role.value
    is_author = obj_file.uploaded_by == current_user.id
    if role not in ("admin", "manager") and not is_author:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    await r2_service.delete_file(obj_file.storage_key)
    await db.delete(obj_file)
    await db.commit()


# ── Task files ────────────────────────────────────────────────────────────────

@router.post("/tasks/{task_id}/files", response_model=FileResponse, status_code=201)
async def upload_task_file(
    task_id: uuid.UUID,
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(role_required("admin", "manager", "foreman")),
):
    task_result = await db.execute(select(Task).where(Task.id == task_id))
    task = task_result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Задача не найдена")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="Файл превышает лимит 100 МБ")

    content_type = file.content_type or "application/octet-stream"
    result = await r2_service.upload_file(
        file_bytes=file_bytes,
        original_name=file.filename or "file",
        content_type=content_type,
        folder=f"tasks/{task_id}",
    )

    obj_file = ObjectFile(
        object_id=task.object_id,
        task_id=task_id,
        uploaded_by=current_user.id,
        file_type=_determine_file_type(content_type),
        original_name=file.filename or "file",
        storage_key=result["storage_key"],
        public_url=result["public_url"],
        size_bytes=len(file_bytes),
    )
    db.add(obj_file)
    await db.commit()
    await db.refresh(obj_file)
    return obj_file


@router.get("/tasks/{task_id}/files", response_model=list[FileResponse])
async def list_task_files(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(ObjectFile)
        .where(ObjectFile.task_id == task_id)
        .order_by(ObjectFile.created_at.desc())
    )
    return result.scalars().all()
