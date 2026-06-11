import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.models.payment import Payment
from app.schemas.account import AccountCreate, AccountUpdate


async def create(db: AsyncSession, tenant_id: uuid.UUID, payload: AccountCreate) -> Account:
    account = Account(tenant_id=tenant_id, **payload.model_dump())
    db.add(account)
    await db.flush()
    return account


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, account_id: uuid.UUID) -> Account | None:
    result = await db.execute(select(Account).where(Account.id == account_id, Account.tenant_id == tenant_id))
    return result.scalar_one_or_none()


async def list_all(db: AsyncSession, tenant_id: uuid.UUID) -> list[Account]:
    result = await db.execute(select(Account).where(Account.tenant_id == tenant_id).order_by(Account.name))
    return list(result.scalars().all())


async def update(db: AsyncSession, account: Account, payload: AccountUpdate) -> Account:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(account, field, value)
    await db.flush()
    return account


async def delete(db: AsyncSession, account: Account) -> None:
    await db.delete(account)
    await db.flush()


async def get_balance(db: AsyncSession, tenant_id: uuid.UUID, account: Account) -> Decimal:
    received = (
        await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.tenant_id == tenant_id,
                Payment.account_id == account.id,
                Payment.customer_id.is_not(None),
            )
        )
    ).scalar_one()
    paid = (
        await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.tenant_id == tenant_id,
                Payment.account_id == account.id,
                Payment.supplier_id.is_not(None),
            )
        )
    ).scalar_one()
    return account.opening_balance + received - paid
