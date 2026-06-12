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
 * Computes all derived fields for a single invoice line item.
 * - For area-based items (width & height provided), quantity = width * height.
 * - Discount: discountAmount takes precedence; otherwise discountPercent is
 *   applied to the gross amount.
 * - VAT is computed on the post-discount (taxable) amount.
 * - All monetary results are integers in minor units (fils).
 */
export function computeLineItem(
  input: InvoiceLineItemInput,
  country: Country
): InvoiceLineItemComputed {
  const quantity =
    input.width !== undefined && input.height !== undefined
      ? input.width * input.height
      : input.quantity ?? 1;

  const grossAmount = roundHalfAwayFromZero(input.unitPrice * quantity);

  let discountApplied = 0;
  if (input.discountAmount !== undefined) {
    discountApplied = input.discountAmount;
  } else if (input.discountPercent !== undefined) {
    discountApplied = roundHalfAwayFromZero(
      (grossAmount * input.discountPercent) / 100
    );
  }

  const taxableAmount = grossAmount - discountApplied;
  const vatRate = vatRateForCategory(country, input.vatCategory);
  const vatAmount = roundHalfAwayFromZero((taxableAmount * vatRate) / 100);
  const lineTotal = taxableAmount + vatAmount;

  return {
    ...input,
    quantity,
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
  invoiceLevelDiscount: MinorUnits = 0
): InvoiceTotals {
  const computedLines = lineInputs.map((line) => computeLineItem(line, country));

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
