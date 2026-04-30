import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

if TYPE_CHECKING:
    from modules.objects.models import Object
    from modules.files.models import ObjectFile
    from modules.tasks.comment_model import TaskComment


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class TaskStatus(str, enum.Enum):
    new = "new"
    in_progress = "in_progress"
    review = "review"
    done = "done"


class TaskCategory(str, enum.Enum):
    supply = "supply"
    installation = "installation"
    documents = "documents"
    quality = "quality"
    safety = "safety"
    other = "other"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[TaskPriority] = mapped_column(
        SAEnum(TaskPriority, name="taskpriority"), nullable=False, default=TaskPriority.medium
    )
    status: Mapped[TaskStatus] = mapped_column(
        SAEnum(TaskStatus, name="taskstatus"), nullable=False, default=TaskStatus.new
    )
    category: Mapped[TaskCategory | None] = mapped_column(
        SAEnum(TaskCategory, name="taskcategory")
    )
    object_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("objects.id", ondelete="CASCADE")
    )
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    checklist: Mapped[list["TaskChecklist"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="TaskChecklist.order_index"
    )
    object: Mapped["Object | None"] = relationship(back_populates="tasks", foreign_keys=[object_id])
    files: Mapped[list["ObjectFile"]] = relationship(
        back_populates="task", foreign_keys="ObjectFile.task_id"
    )
    comments: Mapped[list["TaskComment"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", foreign_keys="TaskComment.task_id"
    )


class TaskChecklist(Base):
    __tablename__ = "task_checklist"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    task: Mapped["Task"] = relationship(back_populates="checklist")
