import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, UUIDPrimaryKeyMixin


class SyncLogEntry(Base, UUIDPrimaryKeyMixin, TenantScopedMixin):
    """Idempotency ledger for offline sync. Replaying a `/sync/push` mutation
    with the same client_uuid + entity_type is a no-op (see docs/01-erd.md)."""

    __tablename__ = "sync_log"
    __table_args__ = (
        UniqueConstraint("tenant_id", "client_uuid", "entity_type", name="uq_sync_idempotency"),
    )

    client_uuid: Mapped[uuid.UUID] = mapped_column(index=True)
    entity_type: Mapped[str] = mapped_column(String(32))
    result_entity_id: Mapped[uuid.UUID]
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
