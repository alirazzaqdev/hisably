import base64

import pytest

from app.models.enums import Country, VatCategory
from app.tax.regimes import invoice_label, vat_rate_for_category
from app.tax.zatca_qr import ZatcaQrFields, build_zatca_tlv, generate_zatca_qr_base64


def test_uae_invoice_label_depends_on_registration():
    assert invoice_label(vat_registered=True).en == "Tax Invoice"
    assert invoice_label(vat_registered=False).en == "Invoice"


def test_vat_rate_for_category():
    assert vat_rate_for_category(Country.AE, VatCategory.STANDARD) == 5


def test_other_country_default_rate():
    assert vat_rate_for_category(Country.SA, VatCategory.STANDARD) == 15


ZATCA_FIELDS = ZatcaQrFields(
    seller_name="Hisably Demo Trading LLC",
    vat_registration_number="300000000000003",
    timestamp="2024-01-15T10:30:00Z",
    invoice_total="1050.00",
    vat_total="50.00",
)


def test_build_zatca_tlv_encodes_tag_length_value_in_order():
    tlv = build_zatca_tlv(ZATCA_FIELDS)
    offset = 0
    values = [
        ZATCA_FIELDS.seller_name,
        ZATCA_FIELDS.vat_registration_number,
        ZATCA_FIELDS.timestamp,
        ZATCA_FIELDS.invoice_total,
        ZATCA_FIELDS.vat_total,
    ]
    for index, value in enumerate(values):
        value_bytes = value.encode("utf-8")
        assert tlv[offset] == index + 1
        assert tlv[offset + 1] == len(value_bytes)
        assert tlv[offset + 2 : offset + 2 + len(value_bytes)] == value_bytes
        offset += 2 + len(value_bytes)
    assert len(tlv) == offset


def test_zatca_field_too_long_raises():
    too_long = ZatcaQrFields(**{**ZATCA_FIELDS.__dict__, "seller_name": "x" * 256})
    with pytest.raises(ValueError, match="exceeds 255 bytes"):
        build_zatca_tlv(too_long)


def test_generate_zatca_qr_base64_round_trips():
    encoded = generate_zatca_qr_base64(ZATCA_FIELDS)
    decoded = base64.b64decode(encoded)
    assert decoded == build_zatca_tlv(ZATCA_FIELDS)
