import uuid
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TenantScopedMixin, TimestampMixin, UUIDPrimaryKeyMixin


class PriceList(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "price_lists"

    name: Mapped[str] = mapped_column(String(255))


class ItemPrice(Base, UUIDPrimaryKeyMixin, TenantScopedMixin, TimestampMixin):
    __tablename__ = "item_prices"
    __table_args__ = (UniqueConstraint("item_id", "price_list_id", name="uq_item_prices_item_price_list"),)

    item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("items.id", ondelete="CASCADE"))
    price_list_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("price_lists.id", ondelete="CASCADE"))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
