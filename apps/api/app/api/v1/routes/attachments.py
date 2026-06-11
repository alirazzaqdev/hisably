import base64

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import attachments as attachments_repo
from app.schemas.attachment import AttachmentOut

router = APIRouter(prefix="/attachments", tags=["attachments"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_FILE_SIZE = 5 * 1024 * 1024


@router.post("", response_model=AttachmentOut, status_code=status.HTTP_201_CREATED)
async def upload_attachment(
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> AttachmentOut:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Unsupported file type")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large (max 5MB)")

    encoded = base64.b64encode(contents).decode("ascii")
    file_url = f"data:{file.content_type};base64,{encoded}"

    attachment = await attachments_repo.create(
        db, tenant.id, entity_type=entity_type, file_url=file_url, file_type=file.content_type
    )
    await db.commit()
    return AttachmentOut.model_validate(attachment)
