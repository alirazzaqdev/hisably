from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant, require_owner
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import tenants as tenants_repo
from app.schemas.tenant import TenantOut, TenantUpdate

router = APIRouter(prefix="/tenants", tags=["tenants"])


@router.get("/me", response_model=TenantOut)
async def get_me(tenant: Tenant = Depends(get_current_tenant)) -> TenantOut:
    return TenantOut.model_validate(tenant)


@router.patch("/me", response_model=TenantOut)
async def update_me(
    payload: TenantUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    _owner=Depends(require_owner),
) -> TenantOut:
    tenant = await tenants_repo.update(db, tenant, payload)
    await db.commit()
    return TenantOut.model_validate(tenant)
