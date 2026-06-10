/**
 * ZATCA (Saudi e-invoicing) Phase 1 "simplified" QR code generator.
 *
 * Not required for UAE Phase 1, but the TLV (Tag-Length-Value) encoding is
 * small, self-contained, and proves the multi-country tax abstraction now —
 * `SaudiZATCARegime` will reuse this verbatim when implemented.
 *
 * Spec: 5 mandatory fields, each encoded as [tag(1 byte)][length(1 byte)][UTF-8 value],
 * concatenated and Base64-encoded.
 */
export interface ZatcaQrFields {
  /** Seller's legal name. */
  sellerName: string;
  /** VAT registration number (15 digits for KSA). */
  vatRegistrationNumber: string;
  /** Invoice timestamp in ISO 8601 format. */
  timestamp: string;
  /** Invoice total including VAT, formatted with 2 decimals, e.g. "115.00". */
  invoiceTotal: string;
  /** Total VAT amount, formatted with 2 decimals, e.g. "5.00". */
  vatTotal: string;
}

const TLV_TAGS: ReadonlyArray<keyof ZatcaQrFields> = [
  "sellerName",
  "vatRegistrationNumber",
  "timestamp",
  "invoiceTotal",
  "vatTotal",
];

/**
 * Builds the raw TLV byte sequence for the given fields.
 * Each field's UTF-8 byte length must be <= 255 (true for all five fields
 * in practice).
 */
export function buildZatcaTlv(fields: ZatcaQrFields): Uint8Array {
  const encoder = new TextEncoder();
  const bytes: number[] = [];

  TLV_TAGS.forEach((key, index) => {
    const tag = index + 1;
    const valueBytes = encoder.encode(fields[key]);
    if (valueBytes.length > 255) {
      throw new Error(`ZATCA QR field "${key}" exceeds 255 bytes when UTF-8 encoded.`);
    }
    bytes.push(tag, valueBytes.length, ...valueBytes);
  });

  return Uint8Array.from(bytes);
}

/** Builds the TLV byte sequence and returns it Base64-encoded, ready to embed in a QR code. */
export function generateZatcaQrBase64(fields: ZatcaQrFields): string {
  return bytesToBase64(buildZatcaTlv(fields));
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Portable Base64 encoder (no Buffer/btoa dependency, works in Node and browsers). */
function bytesToBase64(bytes: Uint8Array): string {
  let result = "";
  let i = 0;

  for (; i + 3 <= bytes.length; i += 3) {
    const chunk = ((bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!) >>> 0;
    result +=
      BASE64_CHARS[(chunk >> 18) & 0x3f]! +
      BASE64_CHARS[(chunk >> 12) & 0x3f]! +
      BASE64_CHARS[(chunk >> 6) & 0x3f]! +
      BASE64_CHARS[chunk & 0x3f]!;
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const chunk = bytes[i]! << 16;
    result +=
      BASE64_CHARS[(chunk >> 18) & 0x3f]! +
      BASE64_CHARS[(chunk >> 12) & 0x3f]! +
      "==";
  } else if (remaining === 2) {
    const chunk = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    result +=
      BASE64_CHARS[(chunk >> 18) & 0x3f]! +
      BASE64_CHARS[(chunk >> 12) & 0x3f]! +
      BASE64_CHARS[(chunk >> 6) & 0x3f]! +
      "=";
  }

  return result;
}
