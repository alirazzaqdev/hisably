import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class LedgerEntry(BaseModel):
    date: date
    type: str
    reference: str
    debit: Decimal
    credit: Decimal
    balance: Decimal


class PartyStatement(BaseModel):
    party_id: uuid.UUID
    party_name: str
    opening_balance: Decimal
    closing_balance: Decimal
    entries: list[LedgerEntry]
