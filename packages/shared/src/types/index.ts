/**
 * Shared domain types. Mirrors the Phase 1 ERD (see docs/01-erd.md).
 * These types are the contract between the FastAPI backend (Pydantic models
 * serialize to this shape) and the Next.js frontend (incl. IndexedDB records).
 */

export type Country = "AE" | "SA" | "PK";

export type VatCategory = "standard" | "zero_rated" | "exempt";

export type ItemUnit = "pcs" | "sqm" | "sqft" | "kg" | "m" | "box" | "ltr";

export type InvoiceType =
  | "tax_invoice"
  | "quotation"
  | "proforma"
  | "credit_note"
  | "purchase_bill";

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "other";

export type PdfTemplate = "minimal" | "classic" | "bold";

export type InvoiceLanguage = "en" | "ar" | "bilingual";

/**
 * All monetary amounts in invoice-math are integers in the currency's minor
 * unit (fils for AED, halala for SAR, paisa for PKR) to avoid floating-point
 * drift. UI/PDF layers convert to major units only for display.
 */
export type MinorUnits = number;

export interface InvoiceLineItemInput {
  itemId?: string;
  description: string;
  descriptionAr?: string;
  /** Explicit quantity. Ignored if width & height are both provided. */
  quantity?: number;
  width?: number;
  height?: number;
  /** Unit price in minor units. */
  unitPrice: MinorUnits;
  discountPercent?: number;
  /** Discount amount in minor units. Mutually exclusive with discountPercent. */
  discountAmount?: MinorUnits;
  vatCategory: VatCategory;
}

export interface InvoiceLineItemComputed extends InvoiceLineItemInput {
  /** Resolved quantity (= width * height for area-based lines). */
  quantity: number;
  /** unitPrice * quantity, before discount, in minor units. */
  grossAmount: MinorUnits;
  /** Discount applied to this line, in minor units. */
  discountApplied: MinorUnits;
  /** grossAmount - discountApplied. */
  taxableAmount: MinorUnits;
  vatRate: number;
  vatAmount: MinorUnits;
  /** taxableAmount + vatAmount. */
  lineTotal: MinorUnits;
}

export interface InvoiceTotals {
  subtotal: MinorUnits;
  discountTotal: MinorUnits;
  /** VAT amount grouped by rate, e.g. { 5: 12300 }. */
  vatBreakdown: Record<string, MinorUnits>;
  vatTotal: MinorUnits;
  grandTotal: MinorUnits;
  lines: InvoiceLineItemComputed[];
}
