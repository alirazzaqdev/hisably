from fastapi import APIRouter, Depends

from app.api.deps import get_current_tenant
from app.models.tenant import Tenant
from app.schemas.tenant import TenantOut

router = APIRouter(prefix="/tenants", tags=["tenants"])

# TODO (Phase 1, module: Settings/polish): PATCH /tenants/me, logo,
# invoice-settings, tax-settings


@router.get("/me", response_model=TenantOut)
async def get_me(tenant: Tenant = Depends(get_current_tenant)) -> TenantOut:
    return TenantOut.model_validate(tenant)
