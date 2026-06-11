import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.schemas.customer import CustomerOut
from app.schemas.expense import ExpenseOut
from app.schemas.invoice import InvoiceOut
from app.schemas.item import ItemOut
from app.schemas.payment import PaymentOut

EntityType = Literal["customer", "item", "expense", "invoice", "payment"]


class SyncMutation(BaseModel):
    entity_type: EntityType
    client_uuid: uuid.UUID
    data: dict


class SyncMutationResult(BaseModel):
    client_uuid: uuid.UUID
    entity_type: str
    status: Literal["applied", "duplicate", "error"]
    entity_id: uuid.UUID | None = None
    error: str | None = None


class SyncPushRequest(BaseModel):
    mutations: list[SyncMutation]


class SyncPushResponse(BaseModel):
    results: list[SyncMutationResult]
    server_time: datetime


class SyncPullResponse(BaseModel):
    server_time: datetime
    customers: list[CustomerOut]
    items: list[ItemOut]
    expenses: list[ExpenseOut]
    invoices: list[InvoiceOut]
    payments: list[PaymentOut]
