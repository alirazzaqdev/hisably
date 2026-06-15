import type { Country, VatCategory } from "../types/index.js";
import { getCountryInfo } from "./countries.js";

export interface InvoiceLabel {
  en: string;
  ar: string;
}

const MANDATORY_VAT_INVOICE_FIELDS = ["trn", "tax_invoice_label", "vat_breakdown_per_line", "vat_breakdown_total"];

/**
 * Resolves the VAT/GST/Sales-tax rate (%) for a line item's VAT category.
 *
 * - `zero_rated` and `exempt` are always 0%.
 * - `standard` uses `standardRateOverride` if provided (the tenant's
 *   per-Settings VAT rate), otherwise falls back to the selling country's
 *   default rate from `COUNTRIES`.
 */
export function vatRateForCategory(country: Country, category: VatCategory, standardRateOverride?: number): number {
  if (category !== "standard") return 0;
  if (standardRateOverride !== undefined) return standardRateOverride;
  return getCountryInfo(country)?.vatRate ?? 0;
}

/** Fields/sections a tax invoice must carry when the tenant is VAT-registered. */
export function mandatoryInvoiceFields(): string[] {
  return MANDATORY_VAT_INVOICE_FIELDS;
}

/** Document title shown on the invoice, depending on VAT-registration status. */
export function invoiceLabel(vatRegistered: boolean): InvoiceLabel {
  return vatRegistered
    ? { en: "Tax Invoice", ar: "فاتورة ضريبية" }
    : { en: "Invoice", ar: "فاتورة" };
}

export * from "./countries.js";
export * from "./zatca-qr.js";
