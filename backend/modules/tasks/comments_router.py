import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from dependencies import get_current_user
from modules.tasks.comment_model import TaskComment
from modules.users.models import User

router = APIRouter()


class TaskCommentCreate(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Текст комментария не может быть пустым")
        return v


class TaskCommentUpdate(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Текст комментария не может быть пустым")
        return v


class TaskCommentResponse(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID | None
    author_name: str | None
    text: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


def _build_response(comment: TaskComment) -> TaskCommentResponse:
    author_name = None
    if comment.author:
        if comment.author.profile:
            p = comment.author.profile
            parts = [p.last_name, p.first_name]
            author_name = " ".join(x for x in parts if x) or None
        if not author_name:
            author_name = comment.author.email
    return TaskCommentResponse(
        id=comment.id,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author_name=author_name,
        text=comment.text,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.get("/tasks/{task_id}/comments", response_model=list[TaskCommentResponse])
async def list_task_comments(
    task_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(TaskComment)
        .options(selectinload(TaskComment.author).selectinload(User.profile))
        .where(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.asc())
    )
    comments = result.scalars().all()
    return [_build_response(c) for c in comments]


@router.post("/tasks/{task_id}/comments", response_model=TaskCommentResponse, status_code=201)
async def create_task_comment(
    task_id: uuid.UUID,
    data: TaskCommentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    comment = TaskComment(
        task_id=task_id,
        author_id=current_user.id,
        text=data.text,
    )
    db.add(comment)
    await db.commit()

    result = await db.execute(
        select(TaskComment)
        .options(selectinload(TaskComment.author).selectinload(User.profile))
        .where(TaskComment.id == comment.id)
    )
    comment = result.scalar_one()
    return _build_response(comment)


@router.put(
    "/tasks/{task_id}/comments/{comment_id}", response_model=TaskCommentResponse
)
async def update_task_comment(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    data: TaskCommentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(TaskComment)
        .options(selectinload(TaskComment.author).selectinload(User.profile))
        .where(TaskComment.id == comment_id, TaskComment.task_id == task_id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")

    if current_user.role.value != "admin" and comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    comment.text = data.text
    comment.updated_at = datetime.now(timezone.utc)
    await db.commit()

    result = await db.execute(
        select(TaskComment)
        .options(selectinload(TaskComment.author).selectinload(User.profile))
        .where(TaskComment.id == comment.id)
    )
    comment = result.scalar_one()
    return _build_response(comment)


@router.delete("/tasks/{task_id}/comments/{comment_id}", status_code=204)
async def delete_task_comment(
    task_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(TaskComment).where(
            TaskComment.id == comment_id, TaskComment.task_id == task_id
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")

    if current_user.role.value != "admin" and comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    await db.delete(comment)
    await db.commit()
