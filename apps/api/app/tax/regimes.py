"""Generic per-country tax helpers — mirrors packages/shared/src/tax/index.ts.

Every country in `app.tax.countries.COUNTRIES` has a default standard VAT/
GST/Sales-tax rate. Tenants may override the standard rate in Settings
(`Tenant.vat_rate`); `vat_rate_for_category` accepts that override and falls
back to the country default when unset.
"""

from dataclasses import dataclass

from app.models.enums import Country, VatCategory
from app.tax.countries import get_country_info

MANDATORY_VAT_INVOICE_FIELDS = ["trn", "tax_invoice_label", "vat_breakdown_per_line", "vat_breakdown_total"]


@dataclass(frozen=True)
class InvoiceLabel:
    en: str
    ar: str


def vat_rate_for_category(
    country: Country, category: VatCategory, standard_rate_override: float | None = None
) -> float:
    if category != VatCategory.STANDARD:
        return 0
    if standard_rate_override is not None:
        return standard_rate_override
    info = get_country_info(country.value if isinstance(country, Country) else country)
    return info.vat_rate if info else 0


def mandatory_invoice_fields() -> list[str]:
    return MANDATORY_VAT_INVOICE_FIELDS


def invoice_label(vat_registered: bool) -> InvoiceLabel:
    if vat_registered:
        return InvoiceLabel(en="Tax Invoice", ar="فاتورة ضريبية")
    return InvoiceLabel(en="Invoice", ar="فاتورة")
