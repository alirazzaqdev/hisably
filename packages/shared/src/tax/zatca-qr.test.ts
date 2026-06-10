import { describe, expect, it } from "vitest";
import { buildZatcaTlv, generateZatcaQrBase64, type ZatcaQrFields } from "./zatca-qr.js";

const fields: ZatcaQrFields = {
  sellerName: "Hisably Demo Trading LLC",
  vatRegistrationNumber: "300000000000003",
  timestamp: "2024-01-15T10:30:00Z",
  invoiceTotal: "1050.00",
  vatTotal: "50.00",
};

describe("buildZatcaTlv", () => {
  it("encodes each field as [tag][length][utf8 bytes] in order", () => {
    const tlv = buildZatcaTlv(fields);
    let offset = 0;

    [fields.sellerName, fields.vatRegistrationNumber, fields.timestamp, fields.invoiceTotal, fields.vatTotal].forEach(
      (value, index) => {
        const expectedBytes = new TextEncoder().encode(value);
        expect(tlv[offset]).toBe(index + 1); // tag
        expect(tlv[offset + 1]).toBe(expectedBytes.length); // length
        const valueBytes = tlv.slice(offset + 2, offset + 2 + expectedBytes.length);
        expect(Array.from(valueBytes)).toEqual(Array.from(expectedBytes));
        offset += 2 + expectedBytes.length;
      }
    );

    expect(tlv.length).toBe(offset);
  });

  it("rejects fields longer than 255 UTF-8 bytes", () => {
    expect(() =>
      buildZatcaTlv({ ...fields, sellerName: "x".repeat(256) })
    ).toThrow(/exceeds 255 bytes/);
  });
});

describe("generateZatcaQrBase64", () => {
  it("produces a base64 string that round-trips back to the original TLV bytes", () => {
    const base64 = generateZatcaQrBase64(fields);
    const decoded = Uint8Array.from(Buffer.from(base64, "base64"));
    const expected = buildZatcaTlv(fields);
    expect(Array.from(decoded)).toEqual(Array.from(expected));
  });
});
