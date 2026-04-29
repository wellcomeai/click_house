import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from modules.tasks.models import TaskCategory, TaskPriority, TaskStatus


class ChecklistItemResponse(BaseModel):
    id: uuid.UUID
    title: str
    is_done: bool
    order_index: int

    model_config = ConfigDict(from_attributes=True)


class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    priority: TaskPriority = TaskPriority.medium
    status: TaskStatus = TaskStatus.new
    category: TaskCategory | None = None
    object_id: uuid.UUID | None = None
    deadline: datetime | None = None
    assignee_id: uuid.UUID | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    category: TaskCategory | None = None
    deadline: datetime | None = None
    assignee_id: uuid.UUID | None = None


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class ChecklistItemCreate(BaseModel):
    title: str
    order_index: int = 0


class ChecklistItemUpdate(BaseModel):
    is_done: bool


class TaskResponse(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    priority: TaskPriority
    status: TaskStatus
    category: TaskCategory | None
    object_id: uuid.UUID | None
    deadline: datetime | None
    creator_id: uuid.UUID
    assignee_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    checklist: list[ChecklistItemResponse] = []

    model_config = ConfigDict(from_attributes=True)
