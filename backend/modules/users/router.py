import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user, role_required
from modules.users import service
from modules.users.schemas import ProfileUpdateRequest, RoleUpdateRequest, UserResponse

router = APIRouter()


@router.get("/", response_model=list[UserResponse])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(role_required("admin")),
):
    return await service.get_all_users(db)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(get_current_user),
):
    return await service.get_user_by_id(db, user_id)


@router.put("/{user_id}", response_model=UserResponse)
async def update_profile(
    user_id: uuid.UUID,
    data: ProfileUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user=Depends(get_current_user),
):
    # Users can only update their own profile unless admin
    if str(current_user.id) != str(user_id) and current_user.role.value != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Недостаточно прав доступа")

    return await service.update_profile(db, user_id, data.model_dump(exclude_none=True))


@router.patch("/{user_id}/role", response_model=UserResponse)
async def update_role(
    user_id: uuid.UUID,
    data: RoleUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _=Depends(role_required("admin")),
):
    return await service.update_role(db, user_id, data.role)
