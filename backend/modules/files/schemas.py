import uuid
from datetime import datetime

from pydantic import BaseModel

from modules.files.models import FileType


class FileResponse(BaseModel):
    id: uuid.UUID
    object_id: uuid.UUID
    task_id: uuid.UUID | None
    uploaded_by: uuid.UUID | None
    file_type: FileType
    original_name: str
    public_url: str
    size_bytes: int
    created_at: datetime

    model_config = {"from_attributes": True}
