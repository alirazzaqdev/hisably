import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeLineItem } from "./index.js";
import type { InvoiceLineItemInput, VatCategory } from "../types/index.js";

interface FixtureCase {
  name: string;
  input: {
    description: string;
    quantity?: number;
    width?: number;
    height?: number;
    unit_price: number;
    discount_percent?: number;
    discount_amount?: number;
    vat_category: VatCategory;
  };
  expected: {
    quantity: number;
    gross_amount: number;
    discount_applied: number;
    taxable_amount: number;
    vat_rate: number;
    vat_amount: number;
    line_total: number;
  };
}

const fixturesPath = fileURLToPath(
  new URL("../../test-fixtures/line-item-cases.json", import.meta.url)
);
const fixtures = JSON.parse(readFileSync(fixturesPath, "utf-8")) as {
  country: "AE";
  cases: FixtureCase[];
};

describe("shared invoice-math fixtures (cross-validated with apps/api)", () => {
  for (const { name, input, expected } of fixtures.cases) {
    it(name, () => {
      const lineInput: InvoiceLineItemInput = {
        description: input.description,
        quantity: input.quantity,
        width: input.width,
        height: input.height,
        unitPrice: input.unit_price,
        discountPercent: input.discount_percent,
        discountAmount: input.discount_amount,
        vatCategory: input.vat_category,
      };

      const result = computeLineItem(lineInput, fixtures.country);

      expect(result.quantity).toBe(expected.quantity);
      expect(result.grossAmount).toBe(expected.gross_amount);
      expect(result.discountApplied).toBe(expected.discount_applied);
      expect(result.taxableAmount).toBe(expected.taxable_amount);
      expect(result.vatRate).toBe(expected.vat_rate);
      expect(result.vatAmount).toBe(expected.vat_amount);
      expect(result.lineTotal).toBe(expected.line_total);
    });
  }
});
