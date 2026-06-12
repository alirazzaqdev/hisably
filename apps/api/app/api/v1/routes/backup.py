from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, require_owner
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import backup as backup_repo

router = APIRouter(prefix="/backup", tags=["backup"])


@router.get("/export", dependencies=[Depends(require_owner)])
async def export_backup(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await backup_repo.export_data(db, tenant.id)


@router.post("/import", dependencies=[Depends(require_owner)])
async def import_backup(
    payload: dict[str, Any] = Body(...),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    try:
        await backup_repo.import_data(db, tenant.id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    await db.commit()
    return {"status": "ok"}
