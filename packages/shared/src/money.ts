import type { MinorUnits } from "./types/index.js";

/**
 * Convert a major-unit amount (e.g. AED 12.345) to integer minor units
 * (fils), rounding half away from zero per UAE FTA rounding rules.
 */
export function toMinorUnits(amountMajor: number): MinorUnits {
  return roundHalfAwayFromZero(amountMajor * 100);
}

/** Convert integer minor units back to a major-unit number (e.g. 1234 -> 12.34). */
export function toMajorUnits(amountMinor: MinorUnits): number {
  return amountMinor / 100;
}

/**
 * Round-half-away-from-zero to the nearest integer. Used for all VAT and
 * monetary rounding so frontend (offline) and backend computations agree to
 * the fils. Math.round() rounds .5 toward +Infinity, which is wrong for
 * negative amounts (credit notes) — this implementation is symmetric.
 */
export function roundHalfAwayFromZero(value: number): number {
  return value >= 0 ? Math.round(value) : -Math.round(-value);
}

/** Format minor units as a fixed-point string with 2 decimals, e.g. "1234" -> "12.34". */
export function formatMinorUnits(amountMinor: MinorUnits): string {
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor);
  const major = Math.floor(abs / 100);
  const minor = abs % 100;
  return `${sign}${major}.${minor.toString().padStart(2, "0")}`;
}
