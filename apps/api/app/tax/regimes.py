"""Pluggable per-country tax regimes — mirrors packages/shared/src/tax/index.ts.

UAE is implemented for Phase 1. Adding `SaudiZATCARegime` (15% VAT, ZATCA
e-invoicing/XML, mandatory QR) or `PakistanFBRRegime` (GST, FBR integration)
means implementing `TaxRegime` and registering it in `TAX_REGIMES` — no
changes to invoice math or core invoice logic are required.
"""

from dataclasses import dataclass, field

from app.models.enums import Country, VatCategory


@dataclass(frozen=True)
class InvoiceLabel:
    en: str
    ar: str


@dataclass(frozen=True)
class TaxRegime:
    country: Country
    name: str
    vat_rates: dict[VatCategory, float]
    mandatory_invoice_fields: list[str] = field(default_factory=list)

    def invoice_label(self, vat_registered: bool) -> InvoiceLabel:
        raise NotImplementedError


@dataclass(frozen=True)
class UAERegime(TaxRegime):
    def invoice_label(self, vat_registered: bool) -> InvoiceLabel:
        if vat_registered:
            return InvoiceLabel(en="Tax Invoice", ar="فاتورة ضريبية")
        return InvoiceLabel(en="Invoice", ar="فاتورة")


UAE_REGIME = UAERegime(
    country=Country.AE,
    name="UAE VAT",
    vat_rates={
        VatCategory.STANDARD: 5,
        VatCategory.ZERO_RATED: 0,
        VatCategory.EXEMPT: 0,
    },
    mandatory_invoice_fields=[
        "trn",
        "tax_invoice_label",
        "vat_breakdown_per_line",
        "vat_breakdown_total",
    ],
)

TAX_REGIMES: dict[Country, TaxRegime] = {
    Country.AE: UAE_REGIME,
    # Country.SA: SaudiZATCARegime — planned, includes 15% VAT + XML/QR generation
    # Country.PK: PakistanFBRRegime — planned, includes GST + FBR API integration
}


def get_tax_regime(country: Country) -> TaxRegime:
    regime = TAX_REGIMES.get(country)
    if regime is None:
        raise NotImplementedError(f'Tax regime for country "{country.value}" is not implemented yet.')
    return regime


def vat_rate_for_category(country: Country, category: VatCategory) -> float:
    return get_tax_regime(country).vat_rates[category]
