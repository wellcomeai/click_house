import uuid
import logging

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from modules.users.models import User, UserProfile, UserRole

logger = logging.getLogger(__name__)


async def get_all_users(db: AsyncSession) -> list[User]:
    result = await db.execute(
        select(User).options(selectinload(User.profile)).order_by(User.created_at.desc())
    )
    return list(result.scalars().all())


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User:
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return user


async def update_profile(
    db: AsyncSession,
    user_id: uuid.UUID,
    data: dict,
) -> User:
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    if user.profile is None:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        user.profile = profile

    for field, value in data.items():
        if value is not None:
            setattr(user.profile, field, value)

    await db.flush()
    return user


async def update_role(db: AsyncSession, user_id: uuid.UUID, role: UserRole) -> User:
    result = await db.execute(
        select(User).options(selectinload(User.profile)).where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    user.role = role
    await db.flush()
    logger.info("User %s role updated to %s", user_id, role)
    return user
