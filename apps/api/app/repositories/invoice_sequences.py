import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import InvoiceType
from app.models.invoice import InvoiceNumberSequence

# Document types that consume their own numbering sequence per tenant.
SEQUENCED_INVOICE_TYPES = (
    InvoiceType.TAX_INVOICE,
    InvoiceType.QUOTATION,
    InvoiceType.PROFORMA,
    InvoiceType.CREDIT_NOTE,
    InvoiceType.DEBIT_NOTE,
    InvoiceType.PURCHASE_BILL,
)


async def create_default_sequences(db: AsyncSession, tenant_id: uuid.UUID, starting_number: int = 1) -> None:
    for invoice_type in SEQUENCED_INVOICE_TYPES:
        db.add(
            InvoiceNumberSequence(
                tenant_id=tenant_id,
                invoice_type=invoice_type,
                next_number=starting_number,
            )
        )
    await db.flush()
