# Hisably

Offline-first, multi-country billing, invoicing, and business management SaaS
for SMBs — launching in the UAE.

## Architecture

```
hisably/
├── apps/
│   ├── web/      Next.js 14 (App Router) — PWA, offline-first via IndexedDB (Dexie)
│   └── api/      FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL
├── packages/
│   └── shared/   Shared TS types, invoice math, and pluggable tax-regime engine
├── docs/         ERD, API route list, screen map, design tokens
└── docker-compose.yml
```

The **invoice math and tax engine** (`packages/shared`) is the single source
of truth for VAT/discount/rounding calculations on the frontend (offline) —
the FastAPI backend has a Python port (`apps/api/app/tax/`) that is
cross-validated against the same fixtures
(`packages/shared/test-fixtures/`), so totals always agree to the fils.

See [`docs/`](docs/) for the full ERD, API route list, screen map, and design
token proposal produced before scaffolding.

## Prerequisites

- Node.js 20+ and npm
- Python 3.11+
- PostgreSQL 16 (or use `docker-compose up postgres`)
- Docker (optional, for full local stack)

## Local development

### 1. Install JS dependencies (workspace root)

```bash
npm install
```

### 2. Backend setup

```bash
cd apps/api
python -m venv .venv
source .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env            # adjust DATABASE_URL etc.
```

Start PostgreSQL (via Docker) and run migrations:

```bash
docker compose up -d postgres
alembic upgrade head
```

Run the API:

```bash
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

### 3. Frontend setup

```bash
npm run dev:web
```

App: http://localhost:3000

### 4. Full stack via Docker

```bash
docker compose up --build
```

## Testing

```bash
# Shared package (invoice math, tax engine, VAT rounding)
npm run test:shared

# Backend (pytest — includes the same VAT rounding fixtures as packages/shared)
cd apps/api && source .venv/Scripts/activate && pytest
```

## Tech stack

- **Frontend:** Next.js 14, TypeScript (strict), Tailwind CSS, shadcn/ui base,
  Zustand, TanStack Query, Dexie (IndexedDB), next-intl, Recharts
- **Backend:** FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2, argon2
  password hashing, PyJWT
- **Database:** PostgreSQL, multi-tenant via `tenant_id` + repository-layer scoping
- **PDF generation:** Playwright (chosen over WeasyPrint for Arabic RTL fidelity — TBD when invoice PDF module is built)

## Status

Scaffold complete — see [CHANGELOG.md](CHANGELOG.md). Next: Auth + onboarding module.
