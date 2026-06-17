import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification


async def create(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    type: str,
    title: str,
    message: str,
    link: str | None = None,
    related_id: uuid.UUID | None = None,
) -> Notification:
    n = Notification(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        type=type,
        title=title,
        message=message,
        link=link,
        related_id=related_id,
    )
    db.add(n)
    await db.flush()
    return n


async def already_created_today(
    db: AsyncSession, tenant_id: uuid.UUID, type: str, related_id: uuid.UUID
) -> bool:
    """True if a notification of this type for this related_id was created in the last 20 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=20)
    result = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.tenant_id == tenant_id,
            Notification.type == type,
            Notification.related_id == related_id,
            Notification.created_at >= cutoff,
        )
    )
    return result.scalar_one() > 0


async def list_for_tenant(
    db: AsyncSession, tenant_id: uuid.UUID, *, limit: int = 50
) -> list[Notification]:
    result = await db.execute(
        select(Notification)
        .where(Notification.tenant_id == tenant_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def unread_count(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    result = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.tenant_id == tenant_id,
            Notification.read_at.is_(None),
        )
    )
    return result.scalar_one()


async def mark_read(db: AsyncSession, tenant_id: uuid.UUID, notification_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.tenant_id == tenant_id,
        )
    )
    n = result.scalar_one_or_none()
    if n and n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        await db.flush()


async def mark_all_read(db: AsyncSession, tenant_id: uuid.UUID) -> int:
    result = await db.execute(
        select(Notification).where(
            Notification.tenant_id == tenant_id,
            Notification.read_at.is_(None),
        )
    )
    now = datetime.now(timezone.utc)
    count = 0
    for n in result.scalars().all():
        n.read_at = now
        count += 1
    await db.flush()
    return count
