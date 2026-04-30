import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from dependencies import get_current_user, role_required
from modules.files import r2_service
from modules.files.models import ObjectFile, FileType
from modules.files.schemas import FileResponse, UploaderInfo
from modules.tasks.models import Task
from modules.users.models import User

router = APIRouter()

MAX_SIZE = 100 * 1024 * 1024  # 100 MB


def _determine_file_type(content_type: str) -> FileType:
    if content_type.startswith("image/"):
        return FileType.image
    return FileType.document


def _build_uploader(user: User | None) -> UploaderInfo | None:
    if user is None:
        return None
    profile = user.profile
    parts = []
    if profile:
        if profile.last_name:
            parts.append(profile.last_name)
        if profile.first_name:
            parts.append(profile.first_name)
        if profile.middle_name:
            parts.append(profile.middle_name)
    return UploaderInfo(
        id=user.id,
        email=user.email,
        full_name=" ".join(parts) or None,
        position=profile.position if profile else None,
        phone=profile.phone if profile else None,
    )


def _build_response(obj_file: ObjectFile) -> FileResponse:
    return FileResponse(
        id=obj_file.id,
        object_id=obj_file.object_id,
        task_id=obj_file.task_id,
        uploaded_by=obj_file.uploaded_by,
        file_type=obj_file.file_type,
        original_name=obj_file.original_name,
        public_url=obj_file.public_url,
        size_bytes=obj_file.size_bytes,
        caption=obj_file.caption,
        created_at=obj_file.created_at,
        uploader=_build_uploader(obj_file.uploader),
    )


def _file_query():
    return select(ObjectFile).options(
        selectinload(ObjectFile.uploader).selectinload(User.profile)
    )


# ── Object files ──────────────────────────────────────────────────────────────

@router.post("/objects/{object_id}/files", response_model=FileResponse, status_code=201)
async def upload_object_file(
    object_id: uuid.UUID,
    file: Annotated[UploadFile, File()],
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(role_required("admin", "manager", "foreman")),
    caption: Annotated[str | None, Form()] = None,
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
        caption=caption.strip() if caption and caption.strip() else None,
    )
    db.add(obj_file)
    await db.commit()

    loaded = await db.execute(_file_query().where(ObjectFile.id == obj_file.id))
    return _build_response(loaded.scalar_one())


@router.get("/objects/{object_id}/files", response_model=list[FileResponse])
async def list_object_files(
    object_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    result = await db.execute(
        _file_query()
        .where(ObjectFile.object_id == object_id, ObjectFile.task_id.is_(None))
        .order_by(ObjectFile.created_at.desc())
    )
    return [_build_response(f) for f in result.scalars().all()]


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
    caption: Annotated[str | None, Form()] = None,
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
        caption=caption.strip() if caption and caption.strip() else None,
    )
    db.add(obj_file)
    await db.commit()

    loaded = await db.execute(_file_query().where(ObjectFile.id == obj_file.id))
    return _build_response(loaded.scalar_one())


@router.get("/tasks/{task_id}/files", response_model=list[FileResponse])
async def list_task_files(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    result = await db.execute(
        _file_query()
        .where(ObjectFile.task_id == task_id)
        .order_by(ObjectFile.created_at.desc())
    )
    return [_build_response(f) for f in result.scalars().all()]
