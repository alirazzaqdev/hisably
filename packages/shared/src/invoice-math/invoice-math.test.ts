import { describe, expect, it } from "vitest";
import { computeInvoiceTotals, computeLineItem } from "./index.js";
import type { InvoiceLineItemInput } from "../types/index.js";

const AE = "AE" as const;

describe("computeLineItem", () => {
  it("computes a simple standard-rated line", () => {
    const line = computeLineItem(
      { description: "Item A", quantity: 2, unitPrice: 1000, vatCategory: "standard" },
      AE
    );
    expect(line.quantity).toBe(2);
    expect(line.grossAmount).toBe(2000);
    expect(line.discountApplied).toBe(0);
    expect(line.taxableAmount).toBe(2000);
    expect(line.vatRate).toBe(5);
    expect(line.vatAmount).toBe(100);
    expect(line.lineTotal).toBe(2100);
  });

  it("derives quantity from widthMm x heightMm for SQM lines", () => {
    const line = computeLineItem(
      { description: "Glass panel", widthMm: 2500, heightMm: 1200, unitPrice: 500, vatCategory: "standard" },
      AE
    );
    expect(line.quantity).toBe(3);
    expect(line.computedGross).toBe(1500);
    expect(line.grossAmount).toBe(1500);
    expect(line.vatAmount).toBe(75);
    expect(line.lineTotal).toBe(1575);
  });

  it("multiplies SQM area by quantity for SQM lines with qty > 1", () => {
    const line = computeLineItem(
      {
        description: "Glass panel",
        widthMm: 6450,
        heightMm: 5650,
        quantity: 1,
        unitPrice: 110000,
        vatCategory: "standard",
      },
      AE
    );
    // 6.45 * 5.65 = 36.4425 sqm * 110000 fils = 4,008,675 fils = 40,086.75
    expect(line.quantity).toBeCloseTo(36.4425, 4);
    expect(line.computedGross).toBe(4008675);
    expect(line.grossAmount).toBe(4008675);
  });

  it("derives quantity from lengthMm for LM lines", () => {
    const line = computeLineItem(
      { description: "Aluminium profile", lengthMm: 3000, quantity: 2, unitPrice: 1000, vatCategory: "standard" },
      AE
    );
    // 3m * 2 = 6 lm
    expect(line.quantity).toBe(6);
    expect(line.computedGross).toBe(6000);
    expect(line.grossAmount).toBe(6000);
  });

  it("overrideTotal replaces the computed gross amount but keeps discount/VAT logic", () => {
    const line = computeLineItem(
      {
        description: "Glass panel",
        widthMm: 2500,
        heightMm: 1200,
        unitPrice: 500,
        overrideTotal: 1400,
        vatCategory: "standard",
      },
      AE
    );
    expect(line.computedGross).toBe(1500);
    expect(line.grossAmount).toBe(1400);
    expect(line.taxableAmount).toBe(1400);
    expect(line.vatAmount).toBe(70);
    expect(line.lineTotal).toBe(1470);
  });

  it("applies a percentage discount before VAT", () => {
    const line = computeLineItem(
      { description: "Item B", quantity: 1, unitPrice: 2000, discountPercent: 10, vatCategory: "standard" },
      AE
    );
    expect(line.discountApplied).toBe(200);
    expect(line.taxableAmount).toBe(1800);
    expect(line.vatAmount).toBe(90);
    expect(line.lineTotal).toBe(1890);
  });

  it("applies a fixed discount amount, taking precedence over percent", () => {
    const line = computeLineItem(
      {
        description: "Item C",
        quantity: 1,
        unitPrice: 2000,
        discountAmount: 150,
        discountPercent: 50,
        vatCategory: "standard",
      },
      AE
    );
    expect(line.discountApplied).toBe(150);
    expect(line.taxableAmount).toBe(1850);
  });

  it("zero-rated and exempt categories produce zero VAT", () => {
    const zeroRated = computeLineItem(
      { description: "Export", quantity: 1, unitPrice: 1000, vatCategory: "zero_rated" },
      AE
    );
    const exempt = computeLineItem(
      { description: "Residential rent", quantity: 1, unitPrice: 1000, vatCategory: "exempt" },
      AE
    );
    expect(zeroRated.vatAmount).toBe(0);
    expect(zeroRated.lineTotal).toBe(1000);
    expect(exempt.vatAmount).toBe(0);
    expect(exempt.lineTotal).toBe(1000);
  });

  it("rounds VAT half away from zero (FTA rounding)", () => {
    // 999 fils * 5% = 49.95 fils -> rounds to 50
    const line = computeLineItem(
      { description: "Item D", quantity: 3, unitPrice: 333, vatCategory: "standard" },
      AE
    );
    expect(line.grossAmount).toBe(999);
    expect(line.vatAmount).toBe(50);
    expect(line.lineTotal).toBe(1049);
  });

  it("defaults quantity to 1 when neither quantity nor dimensions are given", () => {
    const line = computeLineItem(
      { description: "Service fee", unitPrice: 5000, vatCategory: "standard" },
      AE
    );
    expect(line.quantity).toBe(1);
    expect(line.grossAmount).toBe(5000);
  });
});

describe("computeInvoiceTotals", () => {
  const lines: InvoiceLineItemInput[] = [
    { description: "Item A", quantity: 2, unitPrice: 1000, vatCategory: "standard" }, // 2000 + 100 vat
    { description: "Item B (zero-rated)", quantity: 1, unitPrice: 500, vatCategory: "zero_rated" }, // 500 + 0
  ];

  it("aggregates subtotal, VAT breakdown, and grand total across mixed VAT categories", () => {
    const totals = computeInvoiceTotals(lines, AE);
    expect(totals.subtotal).toBe(2500);
    expect(totals.discountTotal).toBe(0);
    expect(totals.vatBreakdown).toEqual({ "5": 100 });
    expect(totals.vatTotal).toBe(100);
    expect(totals.grandTotal).toBe(2600);
  });

  it("applies an invoice-level discount proportionally and re-derives VAT", () => {
    const totals = computeInvoiceTotals(lines, AE, 250);
    // taxableSubtotal = 2500, discount 250 split proportionally:
    // line A share = round(250 * 2000 / 2500) = 200, line B share = 250 - 200 = 50
    const lineA = totals.lines[0]!;
    const lineB = totals.lines[1]!;

    expect(lineA.taxableAmount).toBe(1800); // 2000 - 200
    expect(lineA.vatAmount).toBe(90); // 5% of 1800
    expect(lineB.taxableAmount).toBe(450); // 500 - 50
    expect(lineB.vatAmount).toBe(0);

    expect(totals.discountTotal).toBe(250);
    expect(totals.vatTotal).toBe(90);
    expect(totals.grandTotal).toBe(1800 + 90 + 450); // 2340
  });

  it("returns zeroed totals for an empty invoice", () => {
    const totals = computeInvoiceTotals([], AE);
    expect(totals.subtotal).toBe(0);
    expect(totals.vatTotal).toBe(0);
    expect(totals.grandTotal).toBe(0);
    expect(totals.vatBreakdown).toEqual({});
    expect(totals.lines).toEqual([]);
  });

  it("throws for an unimplemented country regime", () => {
    expect(() => computeInvoiceTotals(lines, "SA")).toThrow(/not implemented/);
  });
});
