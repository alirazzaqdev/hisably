import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import JSON, Boolean, Date, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import RecurrenceFrequency


class RecurringInvoice(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "recurring_invoices"

    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), nullable=True)

    frequency: Mapped[RecurrenceFrequency] = mapped_column(Enum(RecurrenceFrequency, native_enum=False))
    start_date: Mapped[date] = mapped_column(Date)
    next_run_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    currency: Mapped[str] = mapped_column(String(3), default="AED")
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    terms: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    line_items: Mapped[list] = mapped_column(JSON)

    last_generated_invoice_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
