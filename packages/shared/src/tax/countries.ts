/**
 * Country reference data: ISO 3166-1 alpha-2 code, display name, ISO 4217
 * currency, and the country's default standard VAT/GST/Sales-tax rate (%)
 * and label. Selecting a country during onboarding/firm-creation seeds the
 * tenant's `currency` and `vat_rate` from this table; both remain editable
 * afterwards in Settings.
 *
 * Mirrored in `apps/api/app/tax/countries.py` — keep the two in sync.
 */
export interface CountryInfo {
  code: string;
  name: string;
  currency: string;
  vatRate: number;
  vatName: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: "AE", name: "United Arab Emirates", currency: "AED", vatRate: 5, vatName: "VAT" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", vatRate: 15, vatName: "VAT" },
  { code: "PK", name: "Pakistan", currency: "PKR", vatRate: 18, vatName: "Sales Tax" },
  { code: "IN", name: "India", currency: "INR", vatRate: 18, vatName: "GST" },
  { code: "US", name: "United States", currency: "USD", vatRate: 0, vatName: "Sales Tax" },
  { code: "GB", name: "United Kingdom", currency: "GBP", vatRate: 20, vatName: "VAT" },
  { code: "CA", name: "Canada", currency: "CAD", vatRate: 5, vatName: "GST" },
  { code: "AU", name: "Australia", currency: "AUD", vatRate: 10, vatName: "GST" },
  { code: "DE", name: "Germany", currency: "EUR", vatRate: 19, vatName: "VAT" },
  { code: "FR", name: "France", currency: "EUR", vatRate: 20, vatName: "VAT" },
  { code: "IT", name: "Italy", currency: "EUR", vatRate: 22, vatName: "VAT" },
  { code: "ES", name: "Spain", currency: "EUR", vatRate: 21, vatName: "VAT" },
  { code: "NL", name: "Netherlands", currency: "EUR", vatRate: 21, vatName: "VAT" },
  { code: "BE", name: "Belgium", currency: "EUR", vatRate: 21, vatName: "VAT" },
  { code: "CH", name: "Switzerland", currency: "CHF", vatRate: 8.1, vatName: "VAT" },
  { code: "SE", name: "Sweden", currency: "SEK", vatRate: 25, vatName: "VAT" },
  { code: "NO", name: "Norway", currency: "NOK", vatRate: 25, vatName: "VAT" },
  { code: "DK", name: "Denmark", currency: "DKK", vatRate: 25, vatName: "VAT" },
  { code: "FI", name: "Finland", currency: "EUR", vatRate: 24, vatName: "VAT" },
  { code: "PL", name: "Poland", currency: "PLN", vatRate: 23, vatName: "VAT" },
  { code: "PT", name: "Portugal", currency: "EUR", vatRate: 23, vatName: "VAT" },
  { code: "IE", name: "Ireland", currency: "EUR", vatRate: 23, vatName: "VAT" },
  { code: "AT", name: "Austria", currency: "EUR", vatRate: 20, vatName: "VAT" },
  { code: "GR", name: "Greece", currency: "EUR", vatRate: 24, vatName: "VAT" },
  { code: "TR", name: "Turkey", currency: "TRY", vatRate: 20, vatName: "VAT" },
  { code: "EG", name: "Egypt", currency: "EGP", vatRate: 14, vatName: "VAT" },
  { code: "QA", name: "Qatar", currency: "QAR", vatRate: 0, vatName: "VAT" },
  { code: "KW", name: "Kuwait", currency: "KWD", vatRate: 0, vatName: "VAT" },
  { code: "BH", name: "Bahrain", currency: "BHD", vatRate: 10, vatName: "VAT" },
  { code: "OM", name: "Oman", currency: "OMR", vatRate: 5, vatName: "VAT" },
  { code: "JO", name: "Jordan", currency: "JOD", vatRate: 16, vatName: "Sales Tax" },
  { code: "LB", name: "Lebanon", currency: "LBP", vatRate: 11, vatName: "VAT" },
  { code: "CN", name: "China", currency: "CNY", vatRate: 13, vatName: "VAT" },
  { code: "JP", name: "Japan", currency: "JPY", vatRate: 10, vatName: "Consumption Tax" },
  { code: "KR", name: "South Korea", currency: "KRW", vatRate: 10, vatName: "VAT" },
  { code: "SG", name: "Singapore", currency: "SGD", vatRate: 9, vatName: "GST" },
  { code: "MY", name: "Malaysia", currency: "MYR", vatRate: 6, vatName: "Sales & Service Tax" },
  { code: "ID", name: "Indonesia", currency: "IDR", vatRate: 11, vatName: "VAT" },
  { code: "TH", name: "Thailand", currency: "THB", vatRate: 7, vatName: "VAT" },
  { code: "PH", name: "Philippines", currency: "PHP", vatRate: 12, vatName: "VAT" },
  { code: "VN", name: "Vietnam", currency: "VND", vatRate: 10, vatName: "VAT" },
  { code: "BD", name: "Bangladesh", currency: "BDT", vatRate: 15, vatName: "VAT" },
  { code: "NZ", name: "New Zealand", currency: "NZD", vatRate: 15, vatName: "GST" },
  { code: "ZA", name: "South Africa", currency: "ZAR", vatRate: 15, vatName: "VAT" },
  { code: "NG", name: "Nigeria", currency: "NGN", vatRate: 7.5, vatName: "VAT" },
  { code: "KE", name: "Kenya", currency: "KES", vatRate: 16, vatName: "VAT" },
  { code: "MA", name: "Morocco", currency: "MAD", vatRate: 20, vatName: "VAT" },
  { code: "TN", name: "Tunisia", currency: "TND", vatRate: 19, vatName: "VAT" },
  { code: "MX", name: "Mexico", currency: "MXN", vatRate: 16, vatName: "VAT" },
  { code: "IL", name: "Israel", currency: "ILS", vatRate: 17, vatName: "VAT" },
];

const COUNTRY_BY_CODE: Record<string, CountryInfo> = {};
for (const c of COUNTRIES) {
  COUNTRY_BY_CODE[c.code] = c;
}

export function getCountryInfo(code: string): CountryInfo | undefined {
  return COUNTRY_BY_CODE[code];
}
