import uuid
from decimal import Decimal

from sqlalchemy import Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class PartyMixin(UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    """Shared shape for customers and suppliers (separate tables — see docs/01-erd.md)."""

    name: Mapped[str] = mapped_column(String(255))
    name_ar: Mapped[str | None] = mapped_column(String(255), nullable=True)
    trn: Mapped[str | None] = mapped_column(String(32), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    billing_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    client_uuid: Mapped[uuid.UUID | None] = mapped_column(nullable=True, unique=True)


class Customer(Base, PartyMixin):
    __tablename__ = "customers"

    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)


class Supplier(Base, PartyMixin):
    __tablename__ = "suppliers"
