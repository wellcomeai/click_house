import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from modules.objects.models import ObjectStatus, ObjectType


class ObjectCreate(BaseModel):
    name: str
    address: str | None = None
    object_type: ObjectType | None = None
    status: ObjectStatus = ObjectStatus.planning
    start_date: date | None = None
    planned_end_date: date | None = None
    budget_planned: Decimal | None = None
    description: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None
    manager_id: uuid.UUID | None = None
    foreman_id: uuid.UUID | None = None


class ObjectUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    object_type: ObjectType | None = None
    status: ObjectStatus | None = None
    start_date: date | None = None
    planned_end_date: date | None = None
    actual_end_date: date | None = None
    budget_planned: Decimal | None = None
    budget_actual: Decimal | None = None
    description: str | None = None
    lat: Decimal | None = None
    lng: Decimal | None = None
    manager_id: uuid.UUID | None = None
    foreman_id: uuid.UUID | None = None


class ObjectResponse(BaseModel):
    id: uuid.UUID
    name: str
    address: str | None
    object_type: ObjectType | None
    status: ObjectStatus
    start_date: date | None
    planned_end_date: date | None
    actual_end_date: date | None
    budget_planned: Decimal | None
    budget_actual: Decimal | None
    description: str | None
    lat: Decimal | None
    lng: Decimal | None
    manager_id: uuid.UUID | None
    foreman_id: uuid.UUID | None
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
