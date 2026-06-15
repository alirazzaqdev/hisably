import uuid
from datetime import date as date_type
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account, AccountTransfer
from app.models.party import Customer, Supplier
from app.models.payment import Payment
from app.schemas.account import AccountCreate, AccountStatementEntry, AccountTransferCreate, AccountUpdate


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


async def get_statement(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    account: Account,
    date_from: date_type | None,
    date_to: date_type | None,
) -> tuple[Decimal, list[AccountStatementEntry], Decimal]:
    accounts = await list_all(db, tenant_id)
    account_name_by_id = {a.id: a.name for a in accounts}

    customers_result = await db.execute(select(Customer).where(Customer.tenant_id == tenant_id))
    customer_name_by_id = {c.id: c.name for c in customers_result.scalars().all()}
    suppliers_result = await db.execute(select(Supplier).where(Supplier.tenant_id == tenant_id))
    supplier_name_by_id = {s.id: s.name for s in suppliers_result.scalars().all()}

    payments_result = await db.execute(
        select(Payment).where(
            Payment.tenant_id == tenant_id,
            Payment.account_id == account.id,
            Payment.voided_at.is_(None),
        )
    )
    transfers = await list_transfers(db, tenant_id, account.id)

    rows: list[tuple[date_type, str, str, Decimal, Decimal]] = []  # (date, created_sort, description, amount_in, amount_out)

    for payment in payments_result.scalars().all():
        if payment.customer_id is not None:
            name = customer_name_by_id.get(payment.customer_id, "Customer")
            description = f"Payment received from {name}"
            if payment.reference_no:
                description += f" ({payment.reference_no})"
            rows.append((payment.payment_date, str(payment.created_at), description, payment.amount, Decimal("0")))
        elif payment.supplier_id is not None:
            name = supplier_name_by_id.get(payment.supplier_id, "Supplier")
            description = f"Payment to {name}"
            if payment.reference_no:
                description += f" ({payment.reference_no})"
            rows.append((payment.payment_date, str(payment.created_at), description, Decimal("0"), payment.amount))

    for transfer in transfers:
        if transfer.to_account_id == account.id:
            other = account_name_by_id.get(transfer.from_account_id, "Account")
            description = f"Transfer from {other}"
            if transfer.notes:
                description += f" ({transfer.notes})"
            rows.append((transfer.transfer_date, str(transfer.created_at), description, transfer.amount, Decimal("0")))
        if transfer.from_account_id == account.id:
            other = account_name_by_id.get(transfer.to_account_id, "Account")
            description = f"Transfer to {other}"
            if transfer.notes:
                description += f" ({transfer.notes})"
            rows.append((transfer.transfer_date, str(transfer.created_at), description, Decimal("0"), transfer.amount))

    rows.sort(key=lambda r: (r[0], r[1]))

    opening_balance = account.opening_balance
    for txn_date, _, _, amount_in, amount_out in rows:
        if date_from is not None and txn_date < date_from:
            opening_balance += amount_in - amount_out

    running_balance = opening_balance
    entries: list[AccountStatementEntry] = []
    for txn_date, _, description, amount_in, amount_out in rows:
        if date_from is not None and txn_date < date_from:
            continue
        if date_to is not None and txn_date > date_to:
            continue
        running_balance += amount_in - amount_out
        entries.append(
            AccountStatementEntry(
                date=txn_date,
                description=description,
                amount_in=amount_in,
                amount_out=amount_out,
                balance=running_balance,
            )
        )

    return opening_balance, entries, running_balance
