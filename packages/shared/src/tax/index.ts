import type { Country, VatCategory } from "../types/index.js";

export interface InvoiceLabel {
  en: string;
  ar: string;
}

/**
 * A pluggable per-country tax regime. UAE is implemented for Phase 1.
 * Adding `SaudiZATCARegime` (15% VAT, ZATCA e-invoicing/XML, mandatory QR)
 * or `PakistanFBRRegime` (GST, FBR integration) means implementing this
 * interface and registering it in `TAX_REGIMES` — no changes to invoice
 * math or core invoice logic are required.
 */
export interface TaxRegime {
  country: Country;
  name: string;
  /** VAT/GST rate (%) per item VAT category. */
  vatRates: Record<VatCategory, number>;
  /** Fields/sections this regime requires on a tax invoice. */
  mandatoryInvoiceFields: string[];
  /** Document title shown on the invoice, depending on VAT-registration status. */
  invoiceLabel(vatRegistered: boolean): InvoiceLabel;
}

export const UAE_REGIME: TaxRegime = {
  country: "AE",
  name: "UAE VAT",
  vatRates: {
    standard: 5,
    zero_rated: 0,
    exempt: 0,
  },
  mandatoryInvoiceFields: [
    "trn",
    "tax_invoice_label",
    "vat_breakdown_per_line",
    "vat_breakdown_total",
  ],
  invoiceLabel(vatRegistered) {
    return vatRegistered
      ? { en: "Tax Invoice", ar: "فاتورة ضريبية" }
      : { en: "Invoice", ar: "فاتورة" };
  },
};

const TAX_REGIMES: Partial<Record<Country, TaxRegime>> = {
  AE: UAE_REGIME,
  // SA: SaudiZATCARegime — planned, includes 15% VAT + XML/QR generation
  // PK: PakistanFBRRegime — planned, includes GST + FBR API integration
};

export function getTaxRegime(country: Country): TaxRegime {
  const regime = TAX_REGIMES[country];
  if (!regime) {
    throw new Error(
      `Tax regime for country "${country}" is not implemented yet.`
    );
  }
  return regime;
}

export function vatRateForCategory(country: Country, category: VatCategory): number {
  return getTaxRegime(country).vatRates[category];
}

export * from "./zatca-qr.js";
