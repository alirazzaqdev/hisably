from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_tenant
from app.db.session import get_db
from app.models.tenant import Tenant
from app.repositories import customers as customers_repo
from app.repositories import expenses as expenses_repo
from app.repositories import invoices as invoices_repo
from app.repositories import items as items_repo
from app.repositories import payments as payments_repo
from app.repositories import sync as sync_repo
from app.schemas.customer import CustomerCreate, CustomerOut
from app.schemas.expense import ExpenseCreate, ExpenseOut
from app.schemas.invoice import InvoiceCreate, InvoiceLineItemOut, InvoiceOut
from app.schemas.item import ItemCreate, ItemOut
from app.schemas.payment import PaymentAllocationOut, PaymentCreate, PaymentOut
from app.schemas.sync import SyncMutationResult, SyncPullResponse, SyncPushRequest, SyncPushResponse

router = APIRouter(prefix="/sync", tags=["sync"])


def _invoice_to_out(invoice) -> InvoiceOut:
    out = InvoiceOut.model_validate(invoice)
    out.line_items = [InvoiceLineItemOut.model_validate(li) for li in getattr(invoice, "line_items_loaded", [])]
    return out


def _payment_to_out(payment) -> PaymentOut:
    out = PaymentOut.model_validate(payment)
    out.allocations = [PaymentAllocationOut.model_validate(a) for a in getattr(payment, "allocations_loaded", [])]
    return out


@router.post("/push", response_model=SyncPushResponse)
async def push(
    payload: SyncPushRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SyncPushResponse:
    results: list[SyncMutationResult] = []

    for mutation in payload.mutations:
        existing = await sync_repo.get_log_entry(db, tenant.id, mutation.client_uuid, mutation.entity_type)
        if existing is not None:
            results.append(
                SyncMutationResult(
                    client_uuid=mutation.client_uuid,
                    entity_type=mutation.entity_type,
                    status="duplicate",
                    entity_id=existing.result_entity_id,
                )
            )
            continue

        try:
            data = {**mutation.data, "client_uuid": str(mutation.client_uuid)}
            if mutation.entity_type == "customer":
                entity = await customers_repo.create(db, tenant.id, CustomerCreate(**data))
            elif mutation.entity_type == "item":
                entity = await items_repo.create(db, tenant.id, ItemCreate(**data))
            elif mutation.entity_type == "expense":
                entity = await expenses_repo.create(db, tenant.id, ExpenseCreate(**data))
            elif mutation.entity_type == "invoice":
                entity = await invoices_repo.create(db, tenant, InvoiceCreate(**data))
            elif mutation.entity_type == "payment":
                entity = await payments_repo.create(db, tenant.id, PaymentCreate(**data))
            else:
                raise ValueError(f"Unsupported entity type: {mutation.entity_type}")
        except (ValidationError, ValueError) as exc:
            await db.rollback()
            results.append(
                SyncMutationResult(
                    client_uuid=mutation.client_uuid,
                    entity_type=mutation.entity_type,
                    status="error",
                    error=str(exc),
                )
            )
            continue

        await sync_repo.record_log_entry(db, tenant.id, mutation.client_uuid, mutation.entity_type, entity.id)
        await db.commit()
        results.append(
            SyncMutationResult(
                client_uuid=mutation.client_uuid,
                entity_type=mutation.entity_type,
                status="applied",
                entity_id=entity.id,
            )
        )

    return SyncPushResponse(results=results, server_time=datetime.now(timezone.utc))


@router.get("/pull", response_model=SyncPullResponse)
async def pull(
    since: datetime | None = Query(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SyncPullResponse:
    if since is not None:
        if since.tzinfo is not None:
            since = since.astimezone(timezone.utc).replace(tzinfo=None)
        since = since.replace(microsecond=0)

    customers, items, expenses, invoices, payments = await sync_repo.pull_changes(db, tenant.id, since)

    return SyncPullResponse(
        server_time=datetime.now(timezone.utc),
        customers=[CustomerOut.model_validate(c) for c in customers],
        items=[ItemOut.model_validate(i) for i in items],
        expenses=[ExpenseOut.model_validate(e) for e in expenses],
        invoices=[_invoice_to_out(inv) for inv in invoices],
        payments=[_payment_to_out(p) for p in payments],
    )
