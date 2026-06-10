import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class ExpenseEntry(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "expense_entries"

    category: Mapped[str] = mapped_column(String(100))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    vat_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("suppliers.id"), nullable=True)
    expense_date: Mapped[date] = mapped_column(Date)
    attachment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("attachments.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    client_uuid: Mapped[uuid.UUID] = mapped_column(unique=True)
