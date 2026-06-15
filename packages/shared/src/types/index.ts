/**
 * Shared domain types. Mirrors the Phase 1 ERD (see docs/01-erd.md).
 * These types are the contract between the FastAPI backend (Pydantic models
 * serialize to this shape) and the Next.js frontend (incl. IndexedDB records).
 */

/** ISO 3166-1 alpha-2 country code. See `tax/countries.ts` for the supported list. */
export type Country = string;

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
  /**
   * Quantity multiplier. For SQM/LM lines this multiplies the per-unit area
   * or length (default 1). Ignored as a standalone value when widthMm/heightMm
   * or lengthMm are provided.
   */
  quantity?: number;
  /** Width in millimeters, for SQM lines. Used with heightMm. */
  widthMm?: number;
  /** Height in millimeters, for SQM lines. Used with widthMm. */
  heightMm?: number;
  /** Length in millimeters, for LM (linear meter) lines. */
  lengthMm?: number;
  /** Unit price in minor units. */
  unitPrice: MinorUnits;
  discountPercent?: number;
  /** Discount amount in minor units. Mutually exclusive with discountPercent. */
  discountAmount?: MinorUnits;
  /** Manual override of the gross (pre-discount/VAT) amount, in minor units. */
  overrideTotal?: MinorUnits;
  /**
   * Milestone-billing multiplier applied on top of quantity * unitPrice
   * (default 1 = bill the full amount). E.g. 0.5 = bill 50%.
   */
  finalPaymentFactor?: number;
  vatCategory: VatCategory;
}

export interface InvoiceLineItemComputed extends InvoiceLineItemInput {
  /**
   * Resolved quantity. For SQM lines = (widthMm/1000) * (heightMm/1000) * quantity.
   * For LM lines = (lengthMm/1000) * quantity. Otherwise = quantity (default 1).
   */
  quantity: number;
  /** unitPrice * quantity, before any override, in minor units. */
  computedGross: MinorUnits;
  /** overrideTotal if set, else computedGross. */
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
