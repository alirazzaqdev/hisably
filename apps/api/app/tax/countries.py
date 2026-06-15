"""Country reference data — mirrors packages/shared/src/tax/countries.ts.

Each entry provides the ISO 3166-1 alpha-2 code, display name, ISO 4217
currency, and the country's default standard VAT/GST/Sales-tax rate (%) and
label. Selecting a country during onboarding/firm-creation seeds the
tenant's `currency` and `vat_rate` from this table; both remain editable
afterwards in Settings.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class CountryInfo:
    code: str
    name: str
    currency: str
    vat_rate: float
    vat_name: str


COUNTRIES: list[CountryInfo] = [
    CountryInfo("AE", "United Arab Emirates", "AED", 5, "VAT"),
    CountryInfo("SA", "Saudi Arabia", "SAR", 15, "VAT"),
    CountryInfo("PK", "Pakistan", "PKR", 18, "Sales Tax"),
    CountryInfo("IN", "India", "INR", 18, "GST"),
    CountryInfo("US", "United States", "USD", 0, "Sales Tax"),
    CountryInfo("GB", "United Kingdom", "GBP", 20, "VAT"),
    CountryInfo("CA", "Canada", "CAD", 5, "GST"),
    CountryInfo("AU", "Australia", "AUD", 10, "GST"),
    CountryInfo("DE", "Germany", "EUR", 19, "VAT"),
    CountryInfo("FR", "France", "EUR", 20, "VAT"),
    CountryInfo("IT", "Italy", "EUR", 22, "VAT"),
    CountryInfo("ES", "Spain", "EUR", 21, "VAT"),
    CountryInfo("NL", "Netherlands", "EUR", 21, "VAT"),
    CountryInfo("BE", "Belgium", "EUR", 21, "VAT"),
    CountryInfo("CH", "Switzerland", "CHF", 8.1, "VAT"),
    CountryInfo("SE", "Sweden", "SEK", 25, "VAT"),
    CountryInfo("NO", "Norway", "NOK", 25, "VAT"),
    CountryInfo("DK", "Denmark", "DKK", 25, "VAT"),
    CountryInfo("FI", "Finland", "EUR", 24, "VAT"),
    CountryInfo("PL", "Poland", "PLN", 23, "VAT"),
    CountryInfo("PT", "Portugal", "EUR", 23, "VAT"),
    CountryInfo("IE", "Ireland", "EUR", 23, "VAT"),
    CountryInfo("AT", "Austria", "EUR", 20, "VAT"),
    CountryInfo("GR", "Greece", "EUR", 24, "VAT"),
    CountryInfo("TR", "Turkey", "TRY", 20, "VAT"),
    CountryInfo("EG", "Egypt", "EGP", 14, "VAT"),
    CountryInfo("QA", "Qatar", "QAR", 0, "VAT"),
    CountryInfo("KW", "Kuwait", "KWD", 0, "VAT"),
    CountryInfo("BH", "Bahrain", "BHD", 10, "VAT"),
    CountryInfo("OM", "Oman", "OMR", 5, "VAT"),
    CountryInfo("JO", "Jordan", "JOD", 16, "Sales Tax"),
    CountryInfo("LB", "Lebanon", "LBP", 11, "VAT"),
    CountryInfo("CN", "China", "CNY", 13, "VAT"),
    CountryInfo("JP", "Japan", "JPY", 10, "Consumption Tax"),
    CountryInfo("KR", "South Korea", "KRW", 10, "VAT"),
    CountryInfo("SG", "Singapore", "SGD", 9, "GST"),
    CountryInfo("MY", "Malaysia", "MYR", 6, "Sales & Service Tax"),
    CountryInfo("ID", "Indonesia", "IDR", 11, "VAT"),
    CountryInfo("TH", "Thailand", "THB", 7, "VAT"),
    CountryInfo("PH", "Philippines", "PHP", 12, "VAT"),
    CountryInfo("VN", "Vietnam", "VND", 10, "VAT"),
    CountryInfo("BD", "Bangladesh", "BDT", 15, "VAT"),
    CountryInfo("NZ", "New Zealand", "NZD", 15, "GST"),
    CountryInfo("ZA", "South Africa", "ZAR", 15, "VAT"),
    CountryInfo("NG", "Nigeria", "NGN", 7.5, "VAT"),
    CountryInfo("KE", "Kenya", "KES", 16, "VAT"),
    CountryInfo("MA", "Morocco", "MAD", 20, "VAT"),
    CountryInfo("TN", "Tunisia", "TND", 19, "VAT"),
    CountryInfo("MX", "Mexico", "MXN", 16, "VAT"),
    CountryInfo("IL", "Israel", "ILS", 17, "VAT"),
]

COUNTRY_BY_CODE: dict[str, CountryInfo] = {c.code: c for c in COUNTRIES}


def get_country_info(code: str) -> CountryInfo | None:
    return COUNTRY_BY_CODE.get(code)
