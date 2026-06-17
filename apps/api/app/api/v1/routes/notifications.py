import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import notifications as notif_repo
from app.schemas.notification import NotificationOut, NotificationSummary

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationSummary)
async def list_notifications(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> NotificationSummary:
    items = await notif_repo.list_for_tenant(db, tenant.id, limit=50)
    unread = await notif_repo.unread_count(db, tenant.id)
    return NotificationSummary(
        unread_count=unread,
        items=[NotificationOut.model_validate(n) for n in items],
    )


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    notification_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> NotificationOut:
    await notif_repo.mark_read(db, tenant.id, notification_id)
    await db.commit()
    items = await notif_repo.list_for_tenant(db, tenant.id, limit=50)
    n = next((x for x in items if x.id == notification_id), None)
    return NotificationOut.model_validate(n) if n else NotificationOut(
        id=notification_id, type="", title="", message="", link=None,
        related_id=None, read_at=None, created_at=__import__("datetime").datetime.utcnow()
    )


@router.post("/read-all")
async def mark_all_read(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    count = await notif_repo.mark_all_read(db, tenant.id)
    await db.commit()
    return {"marked_read": count}
