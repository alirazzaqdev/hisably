import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import InvoiceStatus, InvoiceType
from app.models.invoice import Invoice
from app.models.party import Customer, Supplier
from app.models.payment import Payment
from app.schemas.ledger import LedgerEntry, PartyStatement


async def customer_statement(db: AsyncSession, tenant_id: uuid.UUID, customer: Customer) -> PartyStatement:
    invoices = (
        await db.execute(
            select(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.customer_id == customer.id,
                Invoice.status != InvoiceStatus.DRAFT,
                Invoice.status != InvoiceStatus.VOID,
                Invoice.type.in_([InvoiceType.TAX_INVOICE, InvoiceType.CREDIT_NOTE]),
            )
        )
    ).scalars().all()

    payments = (
        await db.execute(select(Payment).where(Payment.tenant_id == tenant_id, Payment.customer_id == customer.id))
    ).scalars().all()

    raw_entries: list[tuple] = []
    for invoice in invoices:
        if invoice.type == InvoiceType.CREDIT_NOTE:
            raw_entries.append((invoice.issue_date, "credit_note", invoice.invoice_number or invoice.draft_number, Decimal("0"), invoice.grand_total))
        else:
            raw_entries.append((invoice.issue_date, "invoice", invoice.invoice_number or invoice.draft_number, invoice.grand_total, Decimal("0")))

    for payment in payments:
        raw_entries.append((payment.payment_date, "payment", payment.reference_no or str(payment.id)[:8], Decimal("0"), payment.amount))

    return _build_statement(customer.id, customer.name, customer.opening_balance, raw_entries)


async def supplier_statement(db: AsyncSession, tenant_id: uuid.UUID, supplier: Supplier) -> PartyStatement:
    invoices = (
        await db.execute(
            select(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.supplier_id == supplier.id,
                Invoice.status != InvoiceStatus.DRAFT,
                Invoice.status != InvoiceStatus.VOID,
                Invoice.type.in_([InvoiceType.PURCHASE_BILL, InvoiceType.DEBIT_NOTE]),
            )
        )
    ).scalars().all()

    payments = (
        await db.execute(select(Payment).where(Payment.tenant_id == tenant_id, Payment.supplier_id == supplier.id))
    ).scalars().all()

    raw_entries: list[tuple] = []
    for invoice in invoices:
        if invoice.type == InvoiceType.DEBIT_NOTE:
            raw_entries.append((invoice.issue_date, "debit_note", invoice.invoice_number or invoice.draft_number, Decimal("0"), invoice.grand_total))
        else:
            raw_entries.append((invoice.issue_date, "purchase_bill", invoice.invoice_number or invoice.draft_number, invoice.grand_total, Decimal("0")))

    for payment in payments:
        raw_entries.append((payment.payment_date, "payment", payment.reference_no or str(payment.id)[:8], Decimal("0"), payment.amount))

    return _build_statement(supplier.id, supplier.name, supplier.opening_balance, raw_entries)


def _build_statement(
    party_id: uuid.UUID, party_name: str, opening_balance: Decimal, raw_entries: list[tuple]
) -> PartyStatement:
    raw_entries.sort(key=lambda e: e[0])

    balance = opening_balance
    entries: list[LedgerEntry] = []
    for entry_date, entry_type, reference, debit, credit in raw_entries:
        balance += debit - credit
        entries.append(
            LedgerEntry(date=entry_date, type=entry_type, reference=reference, debit=debit, credit=credit, balance=balance)
        )

    return PartyStatement(
        party_id=party_id,
        party_name=party_name,
        opening_balance=opening_balance,
        closing_balance=balance,
        entries=entries,
    )
