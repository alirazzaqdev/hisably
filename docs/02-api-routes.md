# Hisably — API Route List (Phase 1)

Base: `/api/v1`. Auth via `Authorization: Bearer <access_token>` (JWT), except
`/auth/*`, `/invoices/public/{token}`, and `/sync/*` (sync uses access token too,
listed separately for clarity). All tenant-scoped routes resolve `tenant_id` from
the authenticated user — never from a request parameter.

## Auth & Onboarding
| Method | Route | Notes |
|---|---|---|
| POST | `/auth/signup` | email + password → creates user (unverified), sends OTP |
| POST | `/auth/verify-otp` | confirms email, activates account |
| POST | `/auth/resend-otp` | |
| POST | `/auth/login` | returns access + refresh token |
| POST | `/auth/refresh` | rotates access token |
| POST | `/auth/logout` | revokes refresh token |
| POST | `/auth/forgot-password` | |
| POST | `/auth/reset-password` | |
| POST | `/onboarding/business` | creates `tenants` row for the new user (owner), sets country/name/TRN/logo/invoice prefix |

## Tenant / Settings
| Method | Route | Notes |
|---|---|---|
| GET / PATCH | `/tenants/me` | business profile, currency, country |
| POST | `/tenants/me/logo` | multipart upload → attachments/S3 |
| GET / PATCH | `/tenants/me/invoice-settings` | prefix, numbering, default template, language |
| GET / PATCH | `/tenants/me/tax-settings` | VAT registration toggle, TRN, default VAT category |

## Users
| Method | Route | Notes |
|---|---|---|
| GET | `/users` | owner only |
| POST | `/users/invite` | owner invites one staff user (Phase 1 cap) |
| PATCH | `/users/{id}` | role/permissions |
| DELETE | `/users/{id}` | |

## Customers / Suppliers
(identical route shapes under `/customers` and `/suppliers`)
| Method | Route | Notes |
|---|---|---|
| GET | `/customers` | paginated, search by name/phone |
| POST | `/customers` | accepts `client_uuid` for offline-created idempotency |
| GET | `/customers/{id}` | |
| PATCH | `/customers/{id}` | |
| DELETE | `/customers/{id}` | soft-delete (only if no invoices) |
| GET | `/customers/{id}/statement` | running ledger, JSON |
| GET | `/customers/{id}/statement/pdf` | rendered PDF |

## Items
| Method | Route | Notes |
|---|---|---|
| GET | `/items` | search, filter by low-stock |
| POST | `/items` | |
| GET | `/items/{id}` | |
| PATCH | `/items/{id}` | |
| DELETE | `/items/{id}` | soft-delete if unused in any invoice |
| POST | `/items/{id}/stock-adjustment` | manual +/- with reason → `stock_movements` |
| GET | `/items/low-stock` | for dashboard widget |

## Invoices (covers tax_invoice / quotation / proforma / credit_note / purchase_bill)
| Method | Route | Notes |
|---|---|---|
| GET | `/invoices` | filter by `type`, `status`, `customer_id`, date range |
| POST | `/invoices` | accepts `client_uuid`; assigns `draft_number` immediately, `invoice_number` on sync confirm |
| GET | `/invoices/{id}` | |
| PATCH | `/invoices/{id}` | only while `status = draft` |
| POST | `/invoices/{id}/void` | requires `void_reason`; writes activity_log |
| POST | `/invoices/{id}/convert` | quotation → tax_invoice; sets `converted_from_id` |
| GET | `/invoices/{id}/pdf` | bilingual EN/AR render |
| POST | `/invoices/{id}/share-link` | generates/returns `public_token` + wa.me link |
| GET | `/invoices/public/{token}` | **no auth** — read-only invoice view |

## Payments
| Method | Route | Notes |
|---|---|---|
| GET | `/payments` | |
| POST | `/payments` | accepts `allocations: [{invoice_id, amount}]` |
| GET | `/payments/{id}` | |
| PATCH | `/payments/{id}` | re-allocate (before any sync conflicts) |
| GET | `/receivables` | outstanding sales invoices, sorted overdue-first, with aging bucket |
| GET | `/payables` | outstanding purchase bills |
| POST | `/receivables/{invoice_id}/remind` | generates WhatsApp reminder text + link |

## Expenses
| Method | Route | Notes |
|---|---|---|
| GET | `/expenses` | |
| POST | `/expenses` | multipart for receipt photo, or separate `/attachments` then reference |
| GET / PATCH / DELETE | `/expenses/{id}` | |

## Reports
| Method | Route | Notes |
|---|---|---|
| GET | `/reports/sales` | by period/customer/item |
| GET | `/reports/purchases` | |
| GET | `/reports/vat-summary` | UAE VAT201-shaped: output VAT, input VAT, net payable |
| GET | `/reports/profit-summary` | sales − purchases − expenses (cash-basis) |
| GET | `/reports/{report}/export.xlsx` | |
| GET | `/reports/{report}/export.pdf` | |

## Dashboard
| Method | Route | Notes |
|---|---|---|
| GET | `/dashboard/kpis` | sales, receivables, payables, expenses + deltas + sparkline series |
| GET | `/dashboard/sales-trend` | params: range, compare_previous |
| GET | `/dashboard/cash-flow` | weekly/monthly grouped in vs out |
| GET | `/dashboard/top-customers` | |
| GET | `/dashboard/top-items` | by revenue / by quantity |
| GET | `/dashboard/receivables-aging` | current/1-30/31-60/60+ buckets |
| GET | `/dashboard/vat-position` | output vs input VAT, projected net |

> Note: dashboard is primarily computed **client-side from IndexedDB** for offline
> support; these endpoints exist for the initial sync / first-load and as a
> server-side cross-check.

## Sync
| Method | Route | Notes |
|---|---|---|
| POST | `/sync/push` | batch of mutations `{entity_type, op, client_uuid, payload}[]`; idempotent via `sync_log` unique constraint |
| GET | `/sync/pull?since=<timestamp>` | returns all entities updated since timestamp, paginated |

## Attachments
| Method | Route | Notes |
|---|---|---|
| POST | `/attachments` | multipart, returns `{id, file_url}` |
