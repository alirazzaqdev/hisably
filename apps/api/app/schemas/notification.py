import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: str
    title: str
    message: str
    link: str | None
    related_id: uuid.UUID | None
    read_at: datetime | None
    created_at: datetime


class NotificationSummary(BaseModel):
    unread_count: int
    items: list[NotificationOut]
