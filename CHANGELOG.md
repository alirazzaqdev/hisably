# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Added — Monorepo scaffold

- `docs/`: ERD (Mermaid), API route list, screen map, design token proposal (Phase 1 planning deliverables).
- `packages/shared`: TypeScript package with shared domain types, money helpers
  (integer-fils arithmetic, FTA round-half-away-from-zero), invoice math
  (`computeLineItem`, `computeInvoiceTotals` with proportional invoice-level
  discounts), pluggable `TaxRegime` abstraction (UAE implemented, Saudi/Pakistan
  stubbed), and a ZATCA Phase 1 QR (TLV/Base64) generator. 30 vitest tests passing.
- `packages/shared/test-fixtures/line-item-cases.json`: shared VAT-rounding
  fixtures consumed by both the TS and Python test suites.
- `apps/web`: Next.js 14 (App Router, TS strict, Tailwind) scaffold wired to
  the design tokens (deep-teal accent, Geist Sans + IBM Plex Sans Arabic,
  type scale, RTL/dark-mode CSS variables). Base shadcn-style `Button`, `Card`,
  `Badge` components. TanStack Query provider. Home page renders a sample
  invoice computed via `@hisably/shared`.
- `apps/api`: FastAPI scaffold with SQLAlchemy 2.0 async models for the full
  Phase 1 ERD (tenants, users, customers/suppliers, items, invoices + line
  items, invoice number sequences, payments + allocations, expenses, stock
  movements, activity log, attachments, sync log). Alembic configured.
  Python port of the tax engine/invoice math, cross-validated against the
  shared fixtures. 21 pytest tests passing, including a tenant-isolation test.
- Root `docker-compose.yml` + Dockerfiles for `apps/api` and `apps/web`
  (Postgres + API + web for local dev).

### Added — Auth + onboarding module

- `apps/api`: full signup → email OTP verification → login/refresh/logout →
  forgot/reset password flow (`app/api/v1/routes/auth.py`,
  `app/services/auth_service.py`). Argon2-hashed passwords and OTP codes,
  stateless JWT access tokens, opaque SHA256-hashed refresh tokens stored in a
  new `refresh_tokens` table for real revocation. Signup atomically creates a
  placeholder `Tenant` + owner `User` (every user needs a `tenant_id`).
- `POST /onboarding/business` (`app/services/onboarding_service.py`) updates
  the tenant's business profile (name, country, TRN, VAT registration, invoice
  prefix) and seeds per-type `invoice_number_sequences` from a chosen starting
  number.
- `app/api/deps.py`: `get_current_user` / `get_current_tenant` Bearer-JWT deps.
- `app/core/email.py` (logs OTPs in dev — swappable for a real provider) and
  `app/core/time.py` (`utcnow()` naive-UTC helper, used consistently so SQLite
  test runs and Postgres agree on datetime comparisons).
- Initial Alembic migration (`29b40581ac0a_initial_schema.py`) covering the
  full ERD including `refresh_tokens`.
- 4 new pytest tests (25 total) covering signup/verify/login/refresh/logout,
  resend-OTP, forgot/reset password, and onboarding.
- `apps/web`: `(auth)` route group (`/login`, `/signup`, `/verify-otp`,
  `/forgot-password`, `/reset-password`) and `(onboarding)/onboarding`
  4-step wizard (country → business name → TRN/VAT → invoice numbering).
  Zustand `auth-store` persists tokens and mirrors a non-sensitive
  "has session" cookie for `middleware.ts`, which protects the future
  `(app)` routes and onboarding, and keeps logged-in users out of
  `/login`/`/signup`. `apiRequest` client auto-refreshes on 401. New `Input`
  and `Label` components.

### Decisions made (flagged for review)

- Accent color: deep teal (`#0D9488`); indigo documented as an easy swap.
- Customers and suppliers kept as separate tables (see open questions in `docs/01-erd.md`).
- Invoice numbering: independent `invoice_number_sequences` per `(tenant_id, invoice_type)`.
- PDF engine: leaning Playwright over WeasyPrint for Arabic RTL fidelity — final call deferred to the invoice PDF module.
- OTP codes are 6 digits, valid for 10 minutes, argon2-hashed (same hasher as passwords).
- Refresh tokens are opaque (not JWT) so logout/rotation can revoke them server-side.
- No `/auth/me` endpoint yet — the frontend doesn't need user profile data
  until the dashboard/settings modules; tokens alone are enough to gate routes.

### Pending

- Pydantic schemas, repository/service layer, and real route implementations
  for the remaining `apps/api/app/api/v1/routes/*` stubs (Customers/Items next).
- IndexedDB schema (Dexie) + sync queue on the frontend.
- Seed script with demo UAE tenant data.
- `(app)` authenticated shell (sidebar/bottom-tabs) — middleware already
  protects these routes, but the layout and `/dashboard` page don't exist yet.
