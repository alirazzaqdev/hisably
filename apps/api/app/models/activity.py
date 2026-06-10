import uuid

from sqlalchemy import Enum, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import ActivityAction


class ActivityLog(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "activity_log"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    entity_type: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[uuid.UUID] = mapped_column(index=True)
    action: Mapped[ActivityAction] = mapped_column(Enum(ActivityAction, native_enum=False))

    # Before/after diff, e.g. {"status": {"before": "draft", "after": "sent"}}
    changes: Mapped[dict] = mapped_column(JSON, default=dict)
