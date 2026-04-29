import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from modules.users.models import UserRole


class ProfileData(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    position: str | None = None
    phone: str | None = None
    avatar_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime
    profile: ProfileData | None = None

    model_config = ConfigDict(from_attributes=True)


class ProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    position: str | None = None
    phone: str | None = None
    avatar_url: str | None = None


class RoleUpdateRequest(BaseModel):
    role: UserRole
