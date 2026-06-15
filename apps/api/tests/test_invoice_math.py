import pytest

from app.models.enums import Country, VatCategory
from app.tax.invoice_math import (
    InvoiceLineItemInput,
    compute_invoice_totals,
    compute_line_item,
)
from app.tax.money import format_minor_units, round_half_away_from_zero, to_major_units, to_minor_units


def _line_from_fixture(case_input: dict) -> InvoiceLineItemInput:
    return InvoiceLineItemInput(
        description=case_input["description"],
        unit_price=case_input["unit_price"],
        quantity=case_input.get("quantity"),
        width_mm=case_input.get("width_mm"),
        height_mm=case_input.get("height_mm"),
        length_mm=case_input.get("length_mm"),
        discount_percent=case_input.get("discount_percent"),
        discount_amount=case_input.get("discount_amount"),
        override_total=case_input.get("override_total"),
        final_payment_factor=case_input.get("final_payment_factor"),
        vat_category=VatCategory(case_input["vat_category"]),
    )


def test_fixture_cases(line_item_fixtures):
    """Cross-validated against packages/shared/test-fixtures/line-item-cases.json
    so the TS (offline frontend) and Python (backend) implementations agree."""
    country = Country(line_item_fixtures["country"])

    for case in line_item_fixtures["cases"]:
        line = _line_from_fixture(case["input"])
        result = compute_line_item(line, country)
        expected = case["expected"]

        assert result.quantity == pytest.approx(expected["quantity"]), case["name"]
        if "computed_gross" in expected:
            assert result.computed_gross == expected["computed_gross"], case["name"]
        assert result.gross_amount == expected["gross_amount"], case["name"]
        assert result.discount_applied == expected["discount_applied"], case["name"]
        assert result.taxable_amount == expected["taxable_amount"], case["name"]
        assert result.vat_rate == expected["vat_rate"], case["name"]
        assert result.vat_amount == expected["vat_amount"], case["name"]
        assert result.line_total == expected["line_total"], case["name"]


def test_invoice_totals_mixed_vat_categories():
    lines = [
        InvoiceLineItemInput(description="Item A", quantity=2, unit_price=1000, vat_category=VatCategory.STANDARD),
        InvoiceLineItemInput(description="Item B", quantity=1, unit_price=500, vat_category=VatCategory.ZERO_RATED),
    ]
    totals = compute_invoice_totals(lines, Country.AE)

    assert totals.subtotal == 2500
    assert totals.discount_total == 0
    assert totals.vat_breakdown == {"5": 100}
    assert totals.vat_total == 100
    assert totals.grand_total == 2600


def test_invoice_level_discount_distributed_proportionally():
    lines = [
        InvoiceLineItemInput(description="Item A", quantity=2, unit_price=1000, vat_category=VatCategory.STANDARD),
        InvoiceLineItemInput(description="Item B", quantity=1, unit_price=500, vat_category=VatCategory.ZERO_RATED),
    ]
    totals = compute_invoice_totals(lines, Country.AE, invoice_level_discount=250)

    line_a, line_b = totals.lines
    assert line_a.taxable_amount == 1800
    assert line_a.vat_amount == 90
    assert line_b.taxable_amount == 450
    assert line_b.vat_amount == 0

    assert totals.discount_total == 250
    assert totals.vat_total == 90
    assert totals.grand_total == 1800 + 90 + 450


def test_empty_invoice_returns_zeroed_totals():
    totals = compute_invoice_totals([], Country.AE)
    assert totals.subtotal == 0
    assert totals.vat_total == 0
    assert totals.grand_total == 0
    assert totals.vat_breakdown == {}
    assert totals.lines == []


def test_other_country_uses_default_rate():
    lines = [InvoiceLineItemInput(description="Item A", quantity=1, unit_price=1000, vat_category=VatCategory.STANDARD)]
    totals = compute_invoice_totals(lines, Country.SA)
    assert totals.lines[0].vat_rate == 15
    assert totals.vat_total == 150


def test_standard_rate_override():
    lines = [InvoiceLineItemInput(description="Item A", quantity=1, unit_price=1000, vat_category=VatCategory.STANDARD)]
    totals = compute_invoice_totals(lines, Country.AE, standard_rate_override=8)
    assert totals.lines[0].vat_rate == 8
    assert totals.vat_total == 80


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (49.5, 50),
        (-49.5, -50),
        (49.49, 49),
        (-49.49, -49),
        (0.5, 1),
        (0, 0),
    ],
)
def test_round_half_away_from_zero(value, expected):
    assert round_half_away_from_zero(value) == expected


def test_money_conversions():
    assert to_minor_units(12.34) == 1234
    assert to_major_units(1234) == 12.34
    assert format_minor_units(1234) == "12.34"
    assert format_minor_units(-1234) == "-12.34"
    assert format_minor_units(0) == "0.00"
