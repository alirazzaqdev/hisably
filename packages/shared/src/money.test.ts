import { describe, expect, it } from "vitest";
import { formatMinorUnits, roundHalfAwayFromZero, toMajorUnits, toMinorUnits } from "./money.js";

describe("roundHalfAwayFromZero", () => {
  it("rounds positive .5 up", () => {
    expect(roundHalfAwayFromZero(49.5)).toBe(50);
  });

  it("rounds negative .5 away from zero (credit notes)", () => {
    expect(roundHalfAwayFromZero(-49.5)).toBe(-50);
  });

  it("rounds values below .5 down", () => {
    expect(roundHalfAwayFromZero(49.49)).toBe(49);
    expect(roundHalfAwayFromZero(-49.49)).toBe(-49);
  });
});

describe("toMinorUnits / toMajorUnits", () => {
  it("converts AED amounts to fils and back", () => {
    expect(toMinorUnits(12.34)).toBe(1234);
    expect(toMajorUnits(1234)).toBe(12.34);
  });

  it("handles floating point edge cases", () => {
    // 0.1 + 0.2 style float drift must not leak into fils
    expect(toMinorUnits(10.1)).toBe(1010);
    expect(toMinorUnits(0.07)).toBe(7);
  });
});

describe("formatMinorUnits", () => {
  it("formats positive amounts with 2 decimals", () => {
    expect(formatMinorUnits(1234)).toBe("12.34");
    expect(formatMinorUnits(5)).toBe("0.05");
  });

  it("formats negative amounts (credit notes)", () => {
    expect(formatMinorUnits(-1234)).toBe("-12.34");
  });

  it("formats zero", () => {
    expect(formatMinorUnits(0)).toBe("0.00");
  });
});
