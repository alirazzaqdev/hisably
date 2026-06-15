import secrets
import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import and_, delete as sa_delete
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import InvoiceStatus, InvoiceType, QuotationStatus
from app.models.invoice import Invoice, InvoiceLineItem, InvoiceNumberSequence
from app.models.tenant import Tenant
from app.repositories.invoice_sequences import SEQUENCED_INVOICE_TYPES
from app.schemas.invoice import InvoiceCreate, InvoiceLineItemInput, InvoiceUpdate
from app.tax.invoice_math import InvoiceLineItemInput as MathLineItem
from app.tax.invoice_math import compute_invoice_totals


def _to_minor(value: Decimal | None) -> int | None:
    if value is None:
        return None
    return int((value * 100).to_integral_value(rounding=ROUND_HALF_UP))


def _to_major(value: int) -> Decimal:
    return (Decimal(value) / 100).quantize(Decimal("0.01"))


def _to_math_line(line: InvoiceLineItemInput) -> MathLineItem:
    return MathLineItem(
        description=line.description,
        unit_price=_to_minor(line.unit_price) or 0,
        item_id=str(line.item_id) if line.item_id else None,
        description_ar=line.description_ar,
        quantity=float(line.quantity) if line.quantity is not None else None,
        width_mm=float(line.width_mm) if line.width_mm is not None else None,
        height_mm=float(line.height_mm) if line.height_mm is not None else None,
        length_mm=float(line.length_mm) if line.length_mm is not None else None,
        discount_percent=float(line.discount_percent) if line.discount_percent is not None else None,
        discount_amount=_to_minor(line.discount_amount),
        override_total=_to_minor(line.override_total),
        final_payment_factor=float(line.final_payment_factor) if line.final_payment_factor is not None else None,
        vat_category=line.vat_category,
    )


def _build_line_items(
    payload_lines: list[InvoiceLineItemInput], country, invoice_discount: Decimal
) -> tuple[list[InvoiceLineItem], dict]:
    math_lines = [_to_math_line(line) for line in payload_lines]
    totals = compute_invoice_totals(math_lines, country, _to_minor(invoice_discount) or 0)

    line_items: list[InvoiceLineItem] = []
    for sort_order, (input_line, computed) in enumerate(zip(payload_lines, totals.lines)):
        line_items.append(
            InvoiceLineItem(
                item_id=input_line.item_id,
                description=input_line.description,
                description_ar=input_line.description_ar,
                quantity=Decimal(str(computed.quantity)),
                width_mm=input_line.width_mm,
                height_mm=input_line.height_mm,
                length_mm=input_line.length_mm,
                unit_price=input_line.unit_price,
                discount_percent=input_line.discount_percent,
                discount_amount=input_line.discount_amount,
                computed_total=_to_major(computed.computed_gross),
                override_total=input_line.override_total,
                final_payment_factor=input_line.final_payment_factor,
                vat_category=input_line.vat_category,
                vat_rate=Decimal(str(computed.vat_rate)),
                vat_amount=_to_major(computed.vat_amount),
                line_total=_to_major(computed.line_total),
                sort_order=sort_order,
            )
        )

    summary = {
        "subtotal": _to_major(totals.subtotal),
        "discount_total": _to_major(totals.discount_total),
        "vat_total": _to_major(totals.vat_total),
        "grand_total": _to_major(totals.grand_total),
    }
    return line_items, summary


async def _next_invoice_number(db: AsyncSession, tenant: Tenant, invoice_type) -> str | None:
    if invoice_type not in SEQUENCED_INVOICE_TYPES:
        return None

    result = await db.execute(
        select(InvoiceNumberSequence).where(
            InvoiceNumberSequence.tenant_id == tenant.id,
            InvoiceNumberSequence.invoice_type == invoice_type,
        )
    )
    sequence = result.scalar_one_or_none()
    if sequence is None:
        sequence = InvoiceNumberSequence(tenant_id=tenant.id, invoice_type=invoice_type, next_number=1)
        db.add(sequence)
        await db.flush()

    number = sequence.next_number
    sequence.next_number += 1
    if invoice_type == InvoiceType.QUOTATION:
        prefix = tenant.quotation_prefix or "QUO-"
    else:
        prefix = tenant.invoice_prefix or "INV-"
    return f"{prefix}{number:04d}"


async def get_line_items(db: AsyncSession, invoice_id: uuid.UUID) -> list[InvoiceLineItem]:
    result = await db.execute(
        select(InvoiceLineItem).where(InvoiceLineItem.invoice_id == invoice_id).order_by(InvoiceLineItem.sort_order)
    )
    return list(result.scalars().all())


async def create(db: AsyncSession, tenant: Tenant, payload: InvoiceCreate) -> Invoice:
    line_items, summary = _build_line_items(payload.line_items, tenant.country, payload.discount_amount)
    number = await _next_invoice_number(db, tenant, payload.type)

    invoice = Invoice(
        tenant_id=tenant.id,
        type=payload.type,
        status=InvoiceStatus.DRAFT,
        quotation_status=QuotationStatus.DRAFT if payload.type == InvoiceType.QUOTATION else None,
        customer_id=payload.customer_id,
        supplier_id=payload.supplier_id,
        invoice_number=number,
        draft_number=number or f"DRAFT-{uuid.uuid4().hex[:8].upper()}",
        client_uuid=payload.client_uuid or uuid.uuid4(),
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        currency=payload.currency,
        exchange_rate=payload.exchange_rate,
        discount_amount=payload.discount_amount,
        notes=payload.notes,
        terms=payload.terms,
        pdf_template=payload.pdf_template,
        accent_color=payload.accent_color,
        language=payload.language,
        lpo_no=payload.lpo_no,
        project_villa_no=payload.project_villa_no,
        bill_to_address=payload.bill_to_address,
        ship_to_address=payload.ship_to_address,
        site_image_url=payload.site_image_url,
        converted_from_id=payload.converted_from_id,
        **summary,
    )
    db.add(invoice)
    await db.flush()

    for line_item in line_items:
        line_item.invoice_id = invoice.id
        db.add(line_item)
    await db.flush()

    invoice.line_items_loaded = line_items
    return invoice


async def get_by_id(db: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> Invoice | None:
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == tenant_id))
    invoice = result.scalar_one_or_none()
    if invoice is not None:
        invoice.line_items_loaded = await get_line_items(db, invoice.id)
    return invoice


async def ensure_public_token(db: AsyncSession, invoice: Invoice) -> str:
    if invoice.public_token is None:
        invoice.public_token = secrets.token_urlsafe(24)
        await db.flush()
    return invoice.public_token


async def get_by_public_token(db: AsyncSession, public_token: str) -> Invoice | None:
    result = await db.execute(select(Invoice).where(Invoice.public_token == public_token))
    invoice = result.scalar_one_or_none()
    if invoice is not None:
        invoice.line_items_loaded = await get_line_items(db, invoice.id)
    return invoice


async def list_paginated(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    search: str | None,
    status: InvoiceStatus | None,
    type: InvoiceType | None = None,
    page: int,
    page_size: int,
) -> tuple[list[Invoice], int]:
    query = select(Invoice).where(Invoice.tenant_id == tenant_id)
    count_query = select(func.count()).select_from(Invoice).where(Invoice.tenant_id == tenant_id)

    if status is not None:
        query = query.where(Invoice.status == status)
        count_query = count_query.where(Invoice.status == status)

    if type is not None:
        query = query.where(Invoice.type == type)
        count_query = count_query.where(Invoice.type == type)

    if search:
        pattern = f"%{search}%"
        condition = or_(Invoice.invoice_number.ilike(pattern), Invoice.draft_number.ilike(pattern))
        query = query.where(condition)
        count_query = count_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Invoice.issue_date.desc(), Invoice.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    invoices = list((await db.execute(query)).scalars().all())
    for invoice in invoices:
        invoice.line_items_loaded = await get_line_items(db, invoice.id)
    return invoices, total


async def update(db: AsyncSession, tenant: Tenant, invoice: Invoice, payload: InvoiceUpdate) -> Invoice:
    data = payload.model_dump(exclude_unset=True, exclude={"line_items"})
    for field, value in data.items():
        setattr(invoice, field, value)

    if payload.line_items is not None:
        discount_amount = payload.discount_amount if payload.discount_amount is not None else invoice.discount_amount
        line_items, summary = _build_line_items(payload.line_items, tenant.country, discount_amount)

        await db.execute(sa_delete(InvoiceLineItem).where(InvoiceLineItem.invoice_id == invoice.id))
        await db.flush()

        for line_item in line_items:
            line_item.invoice_id = invoice.id
            db.add(line_item)

        for field, value in summary.items():
            setattr(invoice, field, value)

    await db.flush()
    invoice.line_items_loaded = await get_line_items(db, invoice.id)
    return invoice


async def set_status(db: AsyncSession, invoice: Invoice, status: InvoiceStatus, void_reason: str | None) -> Invoice:
    from datetime import datetime, timezone

    invoice.status = status
    if status == InvoiceStatus.VOID:
        invoice.voided_at = datetime.now(timezone.utc)
        invoice.void_reason = void_reason
    await db.flush()
    invoice.line_items_loaded = await get_line_items(db, invoice.id)
    return invoice


async def delete(db: AsyncSession, invoice: Invoice) -> None:
    await db.execute(sa_delete(InvoiceLineItem).where(InvoiceLineItem.invoice_id == invoice.id))
    await db.delete(invoice)
    await db.flush()


def effective_quotation_status(invoice: Invoice) -> QuotationStatus | None:
    if invoice.quotation_status is None:
        return None
    if (
        invoice.quotation_status == QuotationStatus.PENDING
        and invoice.due_date is not None
        and invoice.due_date < date.today()
    ):
        return QuotationStatus.EXPIRED
    return invoice.quotation_status


def _quotation_status_condition(status: QuotationStatus, today: date):
    if status == QuotationStatus.PENDING:
        return and_(
            Invoice.quotation_status == QuotationStatus.PENDING,
            or_(Invoice.due_date.is_(None), Invoice.due_date >= today),
        )
    if status == QuotationStatus.EXPIRED:
        return and_(Invoice.quotation_status == QuotationStatus.PENDING, Invoice.due_date < today)
    return Invoice.quotation_status == status


async def list_quotations(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    status: QuotationStatus | None,
    search: str | None,
    page: int,
    page_size: int,
) -> tuple[list[Invoice], int]:
    today = date.today()
    base_filters = [Invoice.tenant_id == tenant_id, Invoice.type == InvoiceType.QUOTATION]
    query = select(Invoice).where(*base_filters)
    count_query = select(func.count()).select_from(Invoice).where(*base_filters)

    if status is not None:
        condition = _quotation_status_condition(status, today)
        query = query.where(condition)
        count_query = count_query.where(condition)

    if search:
        pattern = f"%{search}%"
        condition = or_(Invoice.invoice_number.ilike(pattern), Invoice.draft_number.ilike(pattern))
        query = query.where(condition)
        count_query = count_query.where(condition)

    total = (await db.execute(count_query)).scalar_one()

    query = query.order_by(Invoice.issue_date.desc(), Invoice.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    invoices = list((await db.execute(query)).scalars().all())
    for invoice in invoices:
        invoice.line_items_loaded = await get_line_items(db, invoice.id)
    return invoices, total


async def count_quotations_by_status(db: AsyncSession, tenant_id: uuid.UUID) -> dict[str, int]:
    today = date.today()
    base_filters = [Invoice.tenant_id == tenant_id, Invoice.type == InvoiceType.QUOTATION]
    counts: dict[str, int] = {}
    for s in QuotationStatus:
        condition = _quotation_status_condition(s, today)
        result = await db.execute(select(func.count()).select_from(Invoice).where(*base_filters, condition))
        counts[s.value] = result.scalar_one()
    counts["total"] = sum(counts.values())
    return counts


async def set_quotation_status(
    db: AsyncSession, invoice: Invoice, status: QuotationStatus, due_date: date | None
) -> Invoice:
    invoice.quotation_status = status
    if due_date is not None:
        invoice.due_date = due_date
    await db.flush()
    invoice.line_items_loaded = await get_line_items(db, invoice.id)
    return invoice
