"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    userrole = sa.Enum("admin", "manager", "foreman", "worker", name="userrole")
    objecttype = sa.Enum("residential", "commercial", "infrastructure", "renovation", name="objecttype")
    objectstatus = sa.Enum("planning", "active", "frozen", "completed", name="objectstatus")
    taskpriority = sa.Enum("low", "medium", "high", "critical", name="taskpriority")
    taskstatus = sa.Enum("new", "in_progress", "review", "done", name="taskstatus")
    taskcategory = sa.Enum("supply", "installation", "documents", "quality", "safety", "other", name="taskcategory")

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", userrole, nullable=False, server_default="worker"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # user_profiles
    op.create_table(
        "user_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("first_name", sa.String(100)),
        sa.Column("last_name", sa.String(100)),
        sa.Column("middle_name", sa.String(100)),
        sa.Column("position", sa.String(200)),
        sa.Column("phone", sa.String(20)),
        sa.Column("avatar_url", sa.String(500)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # objects
    op.create_table(
        "objects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("address", sa.Text()),
        sa.Column("object_type", objecttype),
        sa.Column("status", objectstatus, nullable=False, server_default="planning"),
        sa.Column("start_date", sa.Date()),
        sa.Column("planned_end_date", sa.Date()),
        sa.Column("actual_end_date", sa.Date()),
        sa.Column("budget_planned", sa.Numeric(15, 2)),
        sa.Column("budget_actual", sa.Numeric(15, 2)),
        sa.Column("description", sa.Text()),
        sa.Column("lat", sa.Numeric(10, 8)),
        sa.Column("lng", sa.Numeric(11, 8)),
        sa.Column("manager_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("foreman_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # tasks
    op.create_table(
        "tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("priority", taskpriority, nullable=False, server_default="medium"),
        sa.Column("status", taskstatus, nullable=False, server_default="new"),
        sa.Column("category", taskcategory),
        sa.Column("object_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("objects.id", ondelete="CASCADE")),
        sa.Column("deadline", sa.DateTime(timezone=True)),
        sa.Column("creator_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # task_checklist
    op.create_table(
        "task_checklist",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("is_done", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )


def downgrade() -> None:
    op.drop_table("task_checklist")
    op.drop_table("tasks")
    op.drop_table("objects")
    op.drop_table("user_profiles")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS taskcategory")
    op.execute("DROP TYPE IF EXISTS taskstatus")
    op.execute("DROP TYPE IF EXISTS taskpriority")
    op.execute("DROP TYPE IF EXISTS objectstatus")
    op.execute("DROP TYPE IF EXISTS objecttype")
    op.execute("DROP TYPE IF EXISTS userrole")
