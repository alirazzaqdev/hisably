import uuid
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountTransfer
from app.models.payment import Payment
from app.schemas.account import AccountCreate, AccountTransferCreate, AccountUpdate


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
                Payment.voided_at.is_(None),
            )
        )
    ).scalar_one()
    paid = (
        await db.execute(
            select(func.coalesce(func.sum(Payment.amount), 0)).where(
                Payment.tenant_id == tenant_id,
                Payment.account_id == account.id,
                Payment.supplier_id.is_not(None),
                Payment.voided_at.is_(None),
            )
        )
    ).scalar_one()
    transfers_in = (
        await db.execute(
            select(func.coalesce(func.sum(AccountTransfer.amount), 0)).where(
                AccountTransfer.tenant_id == tenant_id,
                AccountTransfer.to_account_id == account.id,
            )
        )
    ).scalar_one()
    transfers_out = (
        await db.execute(
            select(func.coalesce(func.sum(AccountTransfer.amount), 0)).where(
                AccountTransfer.tenant_id == tenant_id,
                AccountTransfer.from_account_id == account.id,
            )
        )
    ).scalar_one()
    return account.opening_balance + received - paid + transfers_in - transfers_out


async def create_transfer(db: AsyncSession, tenant_id: uuid.UUID, payload: AccountTransferCreate) -> AccountTransfer:
    if payload.from_account_id == payload.to_account_id:
        raise ValueError("Cannot transfer to the same account")

    from_account = await get_by_id(db, tenant_id, payload.from_account_id)
    if from_account is None:
        raise ValueError("Source account not found")
    to_account = await get_by_id(db, tenant_id, payload.to_account_id)
    if to_account is None:
        raise ValueError("Destination account not found")

    transfer = AccountTransfer(
        tenant_id=tenant_id,
        from_account_id=payload.from_account_id,
        to_account_id=payload.to_account_id,
        amount=payload.amount,
        transfer_date=payload.transfer_date,
        notes=payload.notes,
        client_uuid=payload.client_uuid or uuid.uuid4(),
    )
    db.add(transfer)
    await db.flush()
    return transfer


async def list_transfers(db: AsyncSession, tenant_id: uuid.UUID, account_id: uuid.UUID | None = None) -> list[AccountTransfer]:
    query = select(AccountTransfer).where(AccountTransfer.tenant_id == tenant_id)
    if account_id is not None:
        query = query.where(
            (AccountTransfer.from_account_id == account_id) | (AccountTransfer.to_account_id == account_id)
        )
    query = query.order_by(AccountTransfer.transfer_date.desc(), AccountTransfer.created_at.desc())
    return list((await db.execute(query)).scalars().all())
