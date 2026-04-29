from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies import get_current_user
from modules.auth import service
from modules.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserMeResponse,
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: RegisterRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tokens = await service.register(
        db,
        email=data.email,
        password=data.password,
        first_name=data.first_name,
        last_name=data.last_name,
    )
    return TokenResponse(**tokens)


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tokens = await service.login(db, email=data.email, password=data.password)
    return TokenResponse(**tokens)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    data: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tokens = await service.refresh_tokens(db, refresh_token=data.refresh_token)
    return TokenResponse(**tokens)


@router.post("/logout", status_code=204)
async def logout():
    # Stateless JWT — client discards the token
    return None


@router.get("/me", response_model=UserMeResponse)
async def me(current_user=Depends(get_current_user)):
    return current_user
