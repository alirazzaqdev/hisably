import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import PaymentMethod


class Payment(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "payments"

    customer_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    supplier_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("suppliers.id"), nullable=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("accounts.id"), nullable=True)

    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    method: Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod, native_enum=False))
    reference_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    payment_date: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    client_uuid: Mapped[uuid.UUID] = mapped_column(unique=True)


class PaymentAllocation(Base, UUIDPrimaryKeyMixin):
    __tablename__ = "payment_allocations"

    payment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("payments.id"), index=True)
    invoice_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("invoices.id"), index=True)
    amount_allocated: Mapped[Decimal] = mapped_column(Numeric(12, 2))
