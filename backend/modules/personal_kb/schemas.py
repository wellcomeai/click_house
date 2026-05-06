import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NoteCreate(BaseModel):
    title: str
    content: str


class NoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None


class NoteListItem(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class NoteDetail(BaseModel):
    id: uuid.UUID
    title: str
    content: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class KBFileResponse(BaseModel):
    id: uuid.UUID
    original_name: str
    public_url: str
    file_type: str
    size_bytes: int
    status: str
    error_message: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChunkPreview(BaseModel):
    id: int
    source_type: str
    source_name: str
    chunk_index: int
    chunk_text_preview: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class KBStats(BaseModel):
    notes_count: int
    files_count: int
    chunks_count: int
    total_size_bytes: int


class ChatRequest(BaseModel):
    message: str
    skip_history: bool = False


class ChatHistoryItem(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SourceItem(BaseModel):
    source_type: str
    source_name: str
    chunk_index: int
    similarity: float
    excerpt: str
