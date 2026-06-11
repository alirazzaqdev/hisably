import enum


class Country(str, enum.Enum):
    AE = "AE"
    SA = "SA"
    PK = "PK"


class VatCategory(str, enum.Enum):
    STANDARD = "standard"
    ZERO_RATED = "zero_rated"
    EXEMPT = "exempt"


class ItemUnit(str, enum.Enum):
    PCS = "pcs"
    SQM = "sqm"
    SQFT = "sqft"
    KG = "kg"
    M = "m"
    BOX = "box"
    LTR = "ltr"


class UserRole(str, enum.Enum):
    OWNER = "owner"
    STAFF = "staff"


class InvoiceType(str, enum.Enum):
    TAX_INVOICE = "tax_invoice"
    QUOTATION = "quotation"
    PROFORMA = "proforma"
    CREDIT_NOTE = "credit_note"
    DEBIT_NOTE = "debit_note"
    PURCHASE_BILL = "purchase_bill"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    VOID = "void"


class PdfTemplate(str, enum.Enum):
    MINIMAL = "minimal"
    CLASSIC = "classic"
    BOLD = "bold"


class InvoiceLanguage(str, enum.Enum):
    EN = "en"
    AR = "ar"
    BILINGUAL = "bilingual"


class AccountType(str, enum.Enum):
    CASH = "cash"
    BANK = "bank"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CHEQUE = "cheque"
    CARD = "card"
    OTHER = "other"


class ChequeStatus(str, enum.Enum):
    PENDING = "pending"
    CLEARED = "cleared"
    BOUNCED = "bounced"


class RecurrenceFrequency(str, enum.Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class StockMovementReason(str, enum.Enum):
    SALE = "sale"
    PURCHASE = "purchase"
    ADJUSTMENT = "adjustment"
    OPENING = "opening"


class ActivityAction(str, enum.Enum):
    CREATED = "created"
    EDITED = "edited"
    VOIDED = "voided"
    PAYMENT_RECORDED = "payment_recorded"
    PAYMENT_ALLOCATED = "payment_allocated"
    STOCK_ADJUSTED = "stock_adjusted"
