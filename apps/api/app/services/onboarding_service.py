from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.enums import AccountType
from app.models.tenant import Tenant
from app.repositories import invoice_sequences as invoice_sequences_repo
from app.schemas.tenant import OnboardingBusinessRequest

# UAE is the only launch country, so it's the only one with a non-zero
# default VAT rate; SA/PK tenants start unregistered until those regimes ship.
COUNTRY_CURRENCY = {
    "AE": "AED",
    "SA": "SAR",
    "PK": "PKR",
}


async def update_business(db: AsyncSession, tenant: Tenant, payload: OnboardingBusinessRequest) -> Tenant:
    tenant.business_name = payload.business_name
    tenant.country = payload.country
    tenant.currency = COUNTRY_CURRENCY[payload.country.value]
    tenant.trn = payload.trn
    tenant.vat_registered = payload.vat_registered
    tenant.logo_url = payload.logo_url
    tenant.invoice_prefix = payload.invoice_prefix

    await invoice_sequences_repo.create_default_sequences(db, tenant.id, payload.invoice_starting_number)

    existing_account = (
        await db.execute(select(Account).where(Account.tenant_id == tenant.id))
    ).scalar_one_or_none()
    if existing_account is None:
        db.add(Account(tenant_id=tenant.id, name="Cash", type=AccountType.CASH))

    await db.commit()
    await db.refresh(tenant)
    return tenant
