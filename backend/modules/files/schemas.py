import uuid
from datetime import datetime

from pydantic import BaseModel

from modules.files.models import FileType


class UploaderInfo(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None = None
    position: str | None = None
    phone: str | None = None

    model_config = {"from_attributes": True}


class FileResponse(BaseModel):
    id: uuid.UUID
    object_id: uuid.UUID
    task_id: uuid.UUID | None
    uploaded_by: uuid.UUID | None
    file_type: FileType
    original_name: str
    public_url: str
    size_bytes: int
    caption: str | None = None
    created_at: datetime
    uploader: UploaderInfo | None = None

    model_config = {"from_attributes": True}
