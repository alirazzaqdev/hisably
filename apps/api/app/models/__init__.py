"""Import all models so they register on Base.metadata (required for Alembic autogenerate)."""

from app.db.base import Base
from app.models.account import Account
from app.models.activity import ActivityLog
from app.models.attachment import Attachment
from app.models.auth import RefreshToken
from app.models.expense import ExpenseEntry
from app.models.invoice import Invoice, InvoiceLineItem, InvoiceNumberSequence
from app.models.item import Item
from app.models.item_category import ItemCategory
from app.models.party import Customer, Supplier
from app.models.payment import Payment, PaymentAllocation
from app.models.recurring_invoice import RecurringInvoice
from app.models.stock import StockMovement
from app.models.sync import SyncLogEntry
from app.models.tenant import Tenant
from app.models.user import User

__all__ = [
    "Base",
    "Account",
    "Tenant",
    "User",
    "Customer",
    "Supplier",
    "Item",
    "ItemCategory",
    "Invoice",
    "InvoiceLineItem",
    "InvoiceNumberSequence",
    "Payment",
    "PaymentAllocation",
    "ExpenseEntry",
    "RecurringInvoice",
    "StockMovement",
    "ActivityLog",
    "Attachment",
    "SyncLogEntry",
    "RefreshToken",
]
