# Hisably — Screen Map & Navigation (Phase 1)

## Navigation shell
- **Desktop:** persistent left sidebar — Dashboard, Invoices, Quotations, Parties, Items, Reports, More (Expenses, Settings, Users). Sync status indicator + business switcher (future) in top bar.
- **Mobile:** bottom tab bar — Dashboard, Invoices, Parties, Items, More. Quotations/Expenses/Reports/Settings live under "More" on mobile.
- **RTL:** sidebar flips to the right edge when Arabic UI is active; all icons/paddings use logical properties (`ps-*`, `pe-*`, `ms-*`, `me-*`).

## Route tree (`/apps/web` App Router)

```
/(auth)
  /login
  /signup
  /verify-otp
  /forgot-password
  /reset-password

/(onboarding)
  /onboarding                 — multi-step wizard:
                                 1. Country (UAE, others "coming soon")
                                 2. Business name + logo
                                 3. TRN or "Not VAT registered yet"
                                 4. Invoice prefix & starting number

/(app)                         — authenticated shell (sidebar/bottom-tabs)
  /dashboard

  /invoices                    — list, filter by status/customer/date
  /invoices/new
  /invoices/[id]
  /invoices/[id]/edit

  /quotations                  — list (type=quotation), same builder as invoices
  /quotations/new
  /quotations/[id]
  /quotations/[id]/edit

  /customers
  /customers/new
  /customers/[id]              — detail + statement of account (ledger)
  /customers/[id]/edit

  /suppliers                    (mirrors customers)
  /suppliers/new
  /suppliers/[id]
  /suppliers/[id]/edit

  /items
  /items/new
  /items/[id]
  /items/[id]/edit
  /items/[id]/stock-adjustment

  /payments                    — receivables-first list (overdue sorted to top)
  /payments/new
  /payables                    — purchase-side equivalent

  /expenses
  /expenses/new
  /expenses/[id]/edit

  /reports
  /reports/sales
  /reports/purchases
  /reports/vat-summary
  /reports/profit-summary

  /settings
  /settings/business           — profile, logo, TRN, currency
  /settings/invoice-templates   — minimal/classic/bold + accent color picker
  /settings/numbering           — prefixes & next numbers per invoice type
  /settings/users               — invite/manage staff (owner only)
  /settings/language            — EN now, AR structure ready

/i/[token]                      — public, unauthenticated invoice view (separate minimal layout, no sidebar)
```

## Key screen notes

### Dashboard (`/dashboard`)
- KPI cards row (Sales / To Collect / To Pay / Expenses) with delta + sparkline
- Sales trend chart with range selector + previous-period overlay toggle
- Cash flow grouped bar chart
- Top customers (bar) + Top items (bar, revenue/qty toggle)
- Receivables aging donut → click bucket navigates to `/payments?aging=31-60` etc.
- VAT position widget → links to `/reports/vat-summary`
- Low-stock alerts list → links to `/items?filter=low-stock`
- Recent invoices list → links to `/invoices/[id]`
- Every chart card has skeleton loader, empty state with tip, and PNG export icon
- Renders from IndexedDB cache; works fully offline

### Invoice builder (`/invoices/new`, `/invoices/[id]/edit`) — most-used screen
- Header: customer picker (create-inline), invoice type, issue/due date, language toggle, template picker
- Line items table: item search autocomplete, qty / W×H (auto-computes sqm for area-based items), unit price, discount, VAT category — keyboard-first (Enter adds new line)
- Footer: subtotal, discount total, VAT breakdown by rate, grand total
- Sidebar/drawer: notes, terms, attachments
- Sync status badge: shows `DRAFT-xxxx` placeholder number until synced, with tooltip explaining final numbering
- Actions: Save draft, Mark as sent, Convert to invoice (if quotation), Download PDF, Share (WhatsApp/email/public link), Void

### Customer/Supplier detail (`/customers/[id]`)
- Profile card (contact info, TRN, credit limit)
- Running balance + statement table (date, document, debit, credit, balance)
- "Export statement PDF" button
- Quick actions: New invoice for this customer, Record payment

### Items list/detail
- List: search, low-stock filter, columns include current stock, sale price, VAT category
- Detail: edit form + stock movement history table + "Adjust stock" action

### Payments / Receivables (`/payments`)
- Aging-sorted list (overdue first), badge per invoice (current/1-30/31-60/60+)
- Row action: "Remind via WhatsApp" (prewritten bilingual template)
- New payment: select customer → outstanding invoices checklist with allocation amounts (auto-suggest oldest-first)

### Reports
- Each report screen: chart at top (themed, matches dashboard components) + data table below + export buttons (PDF/Excel)
- VAT summary mirrors VAT201 box layout exactly, with date-range filter matching filing periods

### Settings
- Business profile, invoice templates (live preview pane), numbering, users, language toggle (AR shows "Coming soon" badge but UI strings are i18n-ready)

### Public invoice view (`/i/[token]`)
- No auth, no sidebar, mobile-first single column
- Invoice render (same template engine as PDF), "Download PDF" button, payment status badge
- If `vat_registered = false`, omits VAT/TRN sections entirely

## Empty / loading / error states
Every list and chart screen ships three variants from day one:
- **Loading:** skeleton matching the eventual layout (chart-shaped skeletons for charts, row skeletons for tables)
- **Empty:** friendly illustration-free message + one-line tip + primary CTA (e.g. "No invoices yet — create your first invoice")
- **Error:** inline retry affordance, never a raw stack trace
