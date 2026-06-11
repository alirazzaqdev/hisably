import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attachment import Attachment


async def create(db: AsyncSession, tenant_id: uuid.UUID, *, entity_type: str, file_url: str, file_type: str) -> Attachment:
    attachment = Attachment(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=uuid.uuid4(),
        file_url=file_url,
        file_type=file_type,
    )
    db.add(attachment)
    await db.flush()
    return attachment


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, attachment_id: uuid.UUID) -> Attachment | None:
    result = await db.execute(
        select(Attachment).where(Attachment.id == attachment_id, Attachment.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()
