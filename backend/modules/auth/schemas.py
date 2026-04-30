import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    first_name: str | None = None
    last_name: str | None = None

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Пароль должен содержать не менее 8 символов")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ProfileData(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    position: str | None = None
    phone: str | None = None
    avatar_url: str | None = None

    model_config = {"from_attributes": True}


class UserMeResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    is_active: bool
    created_at: datetime
    profile: ProfileData | None = None

    model_config = {"from_attributes": True}
