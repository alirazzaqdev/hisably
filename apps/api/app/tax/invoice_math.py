"""Invoice math — mirrors packages/shared/src/invoice-math/index.ts.

All monetary fields are integers in minor units (fils). Both implementations
are validated against the shared fixtures in packages/shared/test-fixtures/
so frontend (offline) and backend computations always agree to the fils.
"""

from dataclasses import dataclass, field, replace

from app.models.enums import Country, VatCategory
from app.tax.money import round_half_away_from_zero
from app.tax.regimes import vat_rate_for_category


@dataclass
class InvoiceLineItemInput:
    description: str
    unit_price: int  # minor units
    item_id: str | None = None
    description_ar: str | None = None
    quantity: float | None = None
    width_mm: float | None = None
    height_mm: float | None = None
    length_mm: float | None = None
    discount_percent: float | None = None
    discount_amount: int | None = None
    override_total: int | None = None  # minor units
    final_payment_factor: float | None = None
    vat_category: VatCategory = VatCategory.STANDARD


@dataclass
class InvoiceLineItemComputed(InvoiceLineItemInput):
    computed_gross: int = 0
    gross_amount: int = 0
    discount_applied: int = 0
    taxable_amount: int = 0
    vat_rate: float = 0
    vat_amount: int = 0
    line_total: int = 0


@dataclass
class InvoiceTotals:
    subtotal: int
    discount_total: int
    vat_breakdown: dict[str, int]
    vat_total: int
    grand_total: int
    lines: list[InvoiceLineItemComputed] = field(default_factory=list)


def resolve_line_quantity(line: InvoiceLineItemInput) -> float:
    """Resolves the effective quantity for a line item.

    - SQM lines (width_mm & height_mm provided): (width_mm/1000) * (height_mm/1000) * (quantity or 1).
    - LM lines (length_mm provided): (length_mm/1000) * (quantity or 1).
    - Otherwise: quantity or 1.
    """
    quantity = line.quantity if line.quantity is not None else 1
    if line.width_mm is not None and line.height_mm is not None:
        return (line.width_mm / 1000) * (line.height_mm / 1000) * quantity
    if line.length_mm is not None:
        return (line.length_mm / 1000) * quantity
    return quantity


def compute_line_item(line: InvoiceLineItemInput, country: Country) -> InvoiceLineItemComputed:
    quantity = resolve_line_quantity(line)
    final_payment_factor = line.final_payment_factor if line.final_payment_factor is not None else 1
    computed_gross = round_half_away_from_zero(line.unit_price * quantity * final_payment_factor)
    gross_amount = line.override_total if line.override_total is not None else computed_gross

    if line.discount_amount is not None:
        discount_applied = line.discount_amount
    elif line.discount_percent is not None:
        discount_applied = round_half_away_from_zero(gross_amount * line.discount_percent / 100)
    else:
        discount_applied = 0

    taxable_amount = gross_amount - discount_applied
    vat_rate = vat_rate_for_category(country, line.vat_category)
    vat_amount = round_half_away_from_zero(taxable_amount * vat_rate / 100)
    line_total = taxable_amount + vat_amount

    return InvoiceLineItemComputed(
        **{**line.__dict__, "quantity": quantity},
        computed_gross=computed_gross,
        gross_amount=gross_amount,
        discount_applied=discount_applied,
        taxable_amount=taxable_amount,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        line_total=line_total,
    )


def compute_invoice_totals(
    line_inputs: list[InvoiceLineItemInput],
    country: Country,
    invoice_level_discount: int = 0,
) -> InvoiceTotals:
    computed_lines = [compute_line_item(line, country) for line in line_inputs]

    gross_subtotal = sum(l.taxable_amount + l.discount_applied for l in computed_lines)
    line_discount_total = sum(l.discount_applied for l in computed_lines)

    lines = computed_lines
    extra_discount_total = 0

    taxable_subtotal = sum(l.taxable_amount for l in computed_lines)

    if invoice_level_discount > 0 and computed_lines and taxable_subtotal > 0:
        allocated = 0
        new_lines: list[InvoiceLineItemComputed] = []

        for idx, line in enumerate(computed_lines):
            is_last = idx == len(computed_lines) - 1
            if is_last:
                share = invoice_level_discount - allocated
            else:
                share = round_half_away_from_zero(
                    invoice_level_discount * line.taxable_amount / taxable_subtotal
                )
            allocated += share

            taxable_amount = line.taxable_amount - share
            vat_amount = round_half_away_from_zero(taxable_amount * line.vat_rate / 100)

            new_lines.append(
                replace(
                    line,
                    taxable_amount=taxable_amount,
                    vat_amount=vat_amount,
                    line_total=taxable_amount + vat_amount,
                )
            )

        lines = new_lines
        extra_discount_total = invoice_level_discount

    subtotal = gross_subtotal
    discount_total = line_discount_total + extra_discount_total

    vat_breakdown: dict[str, int] = {}
    for line in lines:
        if line.vat_amount == 0:
            continue
        key = _format_rate(line.vat_rate)
        vat_breakdown[key] = vat_breakdown.get(key, 0) + line.vat_amount

    vat_total = sum(vat_breakdown.values())
    taxable_total = sum(l.taxable_amount for l in lines)
    grand_total = taxable_total + vat_total

    return InvoiceTotals(
        subtotal=subtotal,
        discount_total=discount_total,
        vat_breakdown=vat_breakdown,
        vat_total=vat_total,
        grand_total=grand_total,
        lines=lines,
    )


def _format_rate(rate: float) -> str:
    """Matches JS String(number) formatting, e.g. 5 -> "5", 5.5 -> "5.5"."""
    if rate == int(rate):
        return str(int(rate))
    return str(rate)
