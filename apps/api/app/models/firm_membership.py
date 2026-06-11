import uuid

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class FirmMembership(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Links a business owner's account to an additional firm (tenant) they
    can switch into. Every owner also has an implicit membership for their
    home tenant (User.tenant_id) — see migration backfill."""

    __tablename__ = "firm_memberships"
    __table_args__ = (UniqueConstraint("user_id", "tenant_id", name="uq_firm_membership_user_tenant"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    tenant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tenants.id"), index=True)
