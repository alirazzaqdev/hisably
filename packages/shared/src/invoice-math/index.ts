import { roundHalfAwayFromZero } from "../money.js";
import type {
  InvoiceLineItemComputed,
  InvoiceLineItemInput,
  InvoiceTotals,
  MinorUnits,
  VatCategory,
} from "../types/index.js";
import { vatRateForCategory } from "../tax/index.js";
import type { Country } from "../types/index.js";

/**
 * Resolves the effective quantity for a line item:
 * - SQM lines (widthMm & heightMm provided): (widthMm/1000) * (heightMm/1000) * (quantity ?? 1).
 * - LM lines (lengthMm provided): (lengthMm/1000) * (quantity ?? 1).
 * - Otherwise: quantity ?? 1.
 *
 * This is the core "new math" for area/linear-meter pricing and is shared
 * between the offline frontend (for live totals while editing) and the
 * backend (as part of computeLineItem), so both agree to the fils.
 */
export function resolveLineQuantity(
  input: Pick<InvoiceLineItemInput, "widthMm" | "heightMm" | "lengthMm" | "quantity">
): number {
  if (input.widthMm !== undefined && input.heightMm !== undefined) {
    return (input.widthMm / 1000) * (input.heightMm / 1000) * (input.quantity ?? 1);
  }
  if (input.lengthMm !== undefined) {
    return (input.lengthMm / 1000) * (input.quantity ?? 1);
  }
  return input.quantity ?? 1;
}

/**
 * Computes all derived fields for a single invoice line item.
 * - For SQM lines (widthMm & heightMm provided), quantity = (widthMm/1000) *
 *   (heightMm/1000) * (quantity ?? 1).
 * - For LM lines (lengthMm provided), quantity = (lengthMm/1000) * (quantity ?? 1).
 * - computedGross = unitPrice * quantity * (finalPaymentFactor ?? 1), where
 *   finalPaymentFactor is a milestone-billing multiplier (default 1).
 * - overrideTotal, if set, replaces the computed gross amount (e.g. for
 *   negotiated/rounded line totals); discount and VAT are then applied on top
 *   of it as usual.
 * - Discount: discountAmount takes precedence; otherwise discountPercent is
 *   applied to the gross amount.
 * - VAT is computed on the post-discount (taxable) amount.
 * - All monetary results are integers in minor units (fils).
 */
export function computeLineItem(
  input: InvoiceLineItemInput,
  country: Country,
  standardRateOverride?: number
): InvoiceLineItemComputed {
  const quantity = resolveLineQuantity(input);
  const computedGross = roundHalfAwayFromZero(
    input.unitPrice * quantity * (input.finalPaymentFactor ?? 1)
  );
  const grossAmount = input.overrideTotal ?? computedGross;

  let discountApplied = 0;
  if (input.discountAmount !== undefined) {
    discountApplied = input.discountAmount;
  } else if (input.discountPercent !== undefined) {
    discountApplied = roundHalfAwayFromZero(
      (grossAmount * input.discountPercent) / 100
    );
  }

  const taxableAmount = grossAmount - discountApplied;
  const vatRate = vatRateForCategory(country, input.vatCategory, standardRateOverride);
  const vatAmount = roundHalfAwayFromZero((taxableAmount * vatRate) / 100);
  const lineTotal = taxableAmount + vatAmount;

  return {
    ...input,
    quantity,
    computedGross,
    grossAmount,
    discountApplied,
    taxableAmount,
    vatRate,
    vatAmount,
    lineTotal,
  };
}

/**
 * Computes invoice-level totals from a set of line items, plus an optional
 * invoice-level discount (applied proportionally across lines before VAT,
 * so VAT is always calculated on the final taxable amount).
 */
export function computeInvoiceTotals(
  lineInputs: InvoiceLineItemInput[],
  country: Country,
  invoiceLevelDiscount: MinorUnits = 0,
  standardRateOverride?: number
): InvoiceTotals {
  const computedLines = lineInputs.map((line) => computeLineItem(line, country, standardRateOverride));

  const grossSubtotal = sum(computedLines.map((l) => l.taxableAmount + l.discountApplied));
  const lineDiscountTotal = sum(computedLines.map((l) => l.discountApplied));

  let lines = computedLines;
  let extraDiscountTotal = 0;

  const taxableSubtotal = sum(computedLines.map((l) => l.taxableAmount));

  if (invoiceLevelDiscount > 0 && taxableSubtotal > 0) {
    // Apply the invoice-level discount proportionally to each line's taxable
    // amount, then re-derive VAT on the reduced taxable amount. The last
    // line absorbs any rounding remainder so totals foot exactly.
    let allocated = 0;

    lines = computedLines.map((line, idx) => {
      const isLast = idx === computedLines.length - 1;
      const share = isLast
        ? invoiceLevelDiscount - allocated
        : roundHalfAwayFromZero(
            (invoiceLevelDiscount * line.taxableAmount) / taxableSubtotal
          );
      allocated += share;

      const taxableAmount = line.taxableAmount - share;
      const vatAmount = roundHalfAwayFromZero((taxableAmount * line.vatRate) / 100);

      return {
        ...line,
        taxableAmount,
        vatAmount,
        lineTotal: taxableAmount + vatAmount,
      };
    });

    extraDiscountTotal = invoiceLevelDiscount;
  }

  const subtotal = grossSubtotal;
  const discountTotal = lineDiscountTotal + extraDiscountTotal;

  const vatBreakdown: Record<string, MinorUnits> = {};
  for (const line of lines) {
    if (line.vatAmount === 0) continue;
    const key = String(line.vatRate);
    vatBreakdown[key] = (vatBreakdown[key] ?? 0) + line.vatAmount;
  }

  const vatTotal = sum(Object.values(vatBreakdown));
  const taxableTotal = sum(lines.map((l) => l.taxableAmount));
  const grandTotal = taxableTotal + vatTotal;

  return {
    subtotal,
    discountTotal,
    vatBreakdown,
    vatTotal,
    grandTotal,
    lines,
  };
}

function sum(values: number[]): number {
  return values.reduce((acc, v) => acc + v, 0);
}

export type { VatCategory };
