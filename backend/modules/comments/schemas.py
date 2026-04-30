import uuid
from datetime import datetime

from pydantic import BaseModel, field_validator


class CommentCreate(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Текст не может быть пустым")
        return v


class CommentUpdate(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Текст не может быть пустым")
        return v


class CommentResponse(BaseModel):
    id: uuid.UUID
    object_id: uuid.UUID
    author_id: uuid.UUID | None
    text: str
    created_at: datetime
    updated_at: datetime
    author_name: str | None = None

    model_config = {"from_attributes": True}
