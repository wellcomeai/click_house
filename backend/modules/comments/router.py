import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from dependencies import get_current_user, role_required
from modules.comments.models import ObjectComment
from modules.comments.schemas import CommentCreate, CommentResponse, CommentUpdate
from modules.users.models import User

router = APIRouter()


def _build_response(comment: ObjectComment) -> CommentResponse:
    author_name = None
    if comment.author and comment.author.profile:
        p = comment.author.profile
        parts = [p.last_name, p.first_name]
        author_name = " ".join(x for x in parts if x) or None
    return CommentResponse(
        id=comment.id,
        object_id=comment.object_id,
        author_id=comment.author_id,
        text=comment.text,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        author_name=author_name,
    )


async def _load_comment(
    db: AsyncSession, comment_id: uuid.UUID, object_id: uuid.UUID
) -> ObjectComment:
    result = await db.execute(
        select(ObjectComment)
        .options(selectinload(ObjectComment.author).selectinload(User.profile))
        .where(
            ObjectComment.id == comment_id,
            ObjectComment.object_id == object_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    return comment


@router.post("/objects/{object_id}/comments", response_model=CommentResponse, status_code=201)
async def create_comment(
    object_id: uuid.UUID,
    data: CommentCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(role_required("admin", "manager", "foreman")),
):
    comment = ObjectComment(
        object_id=object_id,
        author_id=current_user.id,
        text=data.text,
    )
    db.add(comment)
    await db.commit()

    result = await db.execute(
        select(ObjectComment)
        .options(selectinload(ObjectComment.author).selectinload(User.profile))
        .where(ObjectComment.id == comment.id)
    )
    comment = result.scalar_one()
    return _build_response(comment)


@router.get("/objects/{object_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    object_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(ObjectComment)
        .options(selectinload(ObjectComment.author).selectinload(User.profile))
        .where(ObjectComment.object_id == object_id)
        .order_by(ObjectComment.created_at.desc())
    )
    comments = result.scalars().all()
    return [_build_response(c) for c in comments]


@router.put("/objects/{object_id}/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    object_id: uuid.UUID,
    comment_id: uuid.UUID,
    data: CommentUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    comment = await _load_comment(db, comment_id, object_id)

    if current_user.role.value != "admin" and comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    comment.text = data.text
    comment.updated_at = datetime.now(timezone.utc)
    await db.commit()

    result = await db.execute(
        select(ObjectComment)
        .options(selectinload(ObjectComment.author).selectinload(User.profile))
        .where(ObjectComment.id == comment.id)
    )
    comment = result.scalar_one()
    return _build_response(comment)


@router.delete("/objects/{object_id}/comments/{comment_id}", status_code=204)
async def delete_comment(
    object_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    result = await db.execute(
        select(ObjectComment).where(
            ObjectComment.id == comment_id,
            ObjectComment.object_id == object_id,
        )
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")

    if current_user.role.value != "admin" and comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    await db.delete(comment)
    await db.commit()
