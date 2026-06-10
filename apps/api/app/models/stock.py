import uuid
from decimal import Decimal

from sqlalchemy import Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import StockMovementReason


class StockMovement(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "stock_movements"

    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id"), index=True)
    qty_delta: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    reason: Mapped[StockMovementReason] = mapped_column(Enum(StockMovementReason, native_enum=False))

    # Polymorphic reference, e.g. ("invoice", invoice_id) for sale/purchase movements.
    reference_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    reference_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
