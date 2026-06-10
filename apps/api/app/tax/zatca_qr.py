"""ZATCA (Saudi e-invoicing) Phase 1 simplified QR generator.

Mirrors packages/shared/src/tax/zatca-qr.ts. Not required for UAE Phase 1 —
included now to prove the multi-country tax abstraction; `SaudiZATCARegime`
will reuse this when implemented.
"""

import base64
from dataclasses import dataclass, fields


@dataclass(frozen=True)
class ZatcaQrFields:
    seller_name: str
    vat_registration_number: str
    timestamp: str
    invoice_total: str
    vat_total: str


def build_zatca_tlv(qr_fields: ZatcaQrFields) -> bytes:
    chunks: list[bytes] = []
    for index, f in enumerate(fields(qr_fields)):
        tag = index + 1
        value_bytes = getattr(qr_fields, f.name).encode("utf-8")
        if len(value_bytes) > 255:
            raise ValueError(f'ZATCA QR field "{f.name}" exceeds 255 bytes when UTF-8 encoded.')
        chunks.append(bytes([tag, len(value_bytes)]) + value_bytes)
    return b"".join(chunks)


def generate_zatca_qr_base64(qr_fields: ZatcaQrFields) -> str:
    return base64.b64encode(build_zatca_tlv(qr_fields)).decode("ascii")
