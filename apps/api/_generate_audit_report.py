"""One-off script: generates the Hisably Code & Security Audit Report PDF."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.invoice_pdf import FONTS_DIR

ACCENT = colors.HexColor("#0d9488")
DARK = colors.HexColor("#0f172a")
MUTED = colors.HexColor("#475569")
GREEN = colors.HexColor("#16a34a")
AMBER = colors.HexColor("#d97706")
RED = colors.HexColor("#dc2626")
LIGHT_BG = colors.HexColor("#f1f5f9")

pdfmetrics.registerFont(TTFont("NotoSans", str(FONTS_DIR / "NotoSans-Regular.ttf")))
pdfmetrics.registerFont(TTFont("NotoSans-Bold", str(FONTS_DIR / "NotoSans-Bold.ttf")))
pdfmetrics.registerFontFamily("NotoSans", normal="NotoSans", bold="NotoSans-Bold")

styles = getSampleStyleSheet()

title_style = ParagraphStyle("Title", fontName="NotoSans-Bold", fontSize=26, textColor=ACCENT, alignment=TA_CENTER)
subtitle_style = ParagraphStyle("Subtitle", fontName="NotoSans", fontSize=13, textColor=MUTED, alignment=TA_CENTER, spaceBefore=6)
h1_style = ParagraphStyle("H1", fontName="NotoSans-Bold", fontSize=17, textColor=ACCENT, spaceBefore=4, spaceAfter=6)
h2_style = ParagraphStyle("H2", fontName="NotoSans-Bold", fontSize=11.5, textColor=DARK, spaceBefore=10, spaceAfter=3)
body_style = ParagraphStyle("Body", fontName="NotoSans", fontSize=9.5, leading=14, textColor=DARK, spaceAfter=4)
bullet_style = ParagraphStyle("Bullet", parent=body_style, leftIndent=14, bulletIndent=2, spaceAfter=2)
toc_style = ParagraphStyle("Toc", fontName="NotoSans", fontSize=11, leading=20, textColor=DARK)
cell_style = ParagraphStyle("Cell", fontName="NotoSans", fontSize=8.5, leading=12, textColor=DARK)
cell_head_style = ParagraphStyle("CellHead", fontName="NotoSans-Bold", fontSize=9, leading=12, textColor=colors.white)


def bullets(items, color=None):
    out = []
    for text in items:
        if color is not None:
            text = f'<font color="{color}">&#9679;</font>&nbsp;&nbsp;{text}'
        else:
            text = f"&bull;&nbsp;&nbsp;{text}"
        out.append(Paragraph(text, bullet_style))
    return out


def section_header(title):
    return [
        Paragraph(title, h1_style),
        HRFlowable(width="100%", thickness=1.2, color=ACCENT, spaceAfter=8),
    ]


elements = []

# Cover page
elements.append(Spacer(1, 55 * mm))
elements.append(Paragraph("Hisably", title_style))
elements.append(Spacer(1, 6 * mm))
elements.append(Paragraph("Code &amp; Security Audit Report", subtitle_style))
elements.append(Paragraph("Backend (FastAPI) and Frontend (Next.js) Review", subtitle_style))
elements.append(Spacer(1, 90 * mm))
elements.append(Paragraph("Overall risk level: <b><font color='#16a34a'>LOW</font></b> &mdash; no critical issues found", subtitle_style))
elements.append(PageBreak())

# Table of contents
elements.append(Paragraph("Contents", h1_style))
elements.append(HRFlowable(width="100%", thickness=1.2, color=ACCENT, spaceAfter=8))
toc_items = [
    "1. Executive Summary",
    "2. Backend Audit (FastAPI / SQLAlchemy)",
    "3. Frontend Audit (Next.js)",
    "4. Findings &amp; Recommendations",
]
for item in toc_items:
    elements.append(Paragraph(item, toc_style))
elements.append(PageBreak())

# 1. Executive Summary
elements += section_header("1. Executive Summary")
elements.append(Paragraph(
    "This report covers a code, security and completeness review of the Hisably application "
    "&mdash; the FastAPI/SQLAlchemy backend (apps/api) and the Next.js frontend (apps/web). The "
    "goal was to check authentication &amp; authorization, input validation, error handling, "
    "multi-tenancy isolation, business-logic correctness, and overall feature completeness.",
    body_style,
))
elements.append(Paragraph("Overall result", h2_style))
elements += bullets([
    "<b>No critical security vulnerabilities</b> were found (no SQL injection, no broken "
    "authentication, no missing tenant isolation).",
    "Authentication, authorization, multi-tenant scoping and input validation are all "
    "implemented consistently and follow good practice.",
    "The previously-flagged concern about Draft invoices appearing in receivables has been "
    "checked and is <b>handled correctly</b> &mdash; only Sent / Partially Paid / Overdue "
    "invoices count as receivables.",
    "All major pages and reports (Balance Sheet, Day Book, Profit &amp; Loss, Stock Summary, "
    "main Reports dashboard) are fully implemented with real data &mdash; nothing is a stub or "
    "\"coming soon\".",
    "A handful of <b>medium/low priority improvements</b> were identified, mostly around "
    "frontend validation edge-cases and error-state messaging. See section 4 for the full list.",
])
elements.append(Paragraph("Risk summary", h2_style))

risk_data = [
    [Paragraph("Area", cell_head_style), Paragraph("Risk level", cell_head_style), Paragraph("Notes", cell_head_style)],
    [Paragraph("Authentication &amp; Authorization", cell_style), Paragraph('<font color="#16a34a"><b>Low</b></font>', cell_style), Paragraph("JWT + role/permission based, tenant-isolated", cell_style)],
    [Paragraph("SQL Injection / Data Access", cell_style), Paragraph('<font color="#16a34a"><b>Low</b></font>', cell_style), Paragraph("ORM-only, parameterised queries", cell_style)],
    [Paragraph("Multi-tenancy isolation", cell_style), Paragraph('<font color="#16a34a"><b>Low</b></font>', cell_style), Paragraph("Consistent tenant_id scoping", cell_style)],
    [Paragraph("Backup &amp; Restore", cell_style), Paragraph('<font color="#16a34a"><b>Low</b></font>', cell_style), Paragraph("Owner-only; minor version-check gap", cell_style)],
    [Paragraph("Frontend form validation", cell_style), Paragraph('<font color="#d97706"><b>Medium</b></font>', cell_style), Paragraph("Negative prices possible on Items form", cell_style)],
    [Paragraph("Frontend route-level permissions", cell_style), Paragraph('<font color="#d97706"><b>Medium</b></font>', cell_style), Paragraph("Backend enforces, but UI doesn't gate by URL", cell_style)],
    [Paragraph("API error-state UI", cell_style), Paragraph('<font color="#d97706"><b>Medium</b></font>', cell_style), Paragraph("Failed requests not shown to user on list pages", cell_style)],
    [Paragraph("Invoice math edge case", cell_style), Paragraph('<font color="#d97706"><b>Low&ndash;Med</b></font>', cell_style), Paragraph("Possible div-by-zero on zero-subtotal discount", cell_style)],
]
risk_table = Table(risk_data, colWidths=[55 * mm, 22 * mm, 78 * mm])
risk_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
    ("BACKGROUND", (0, 1), (-1, -1), LIGHT_BG),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
elements.append(risk_table)
elements.append(PageBreak())

# 2. Backend Audit
elements += section_header("2. Backend Audit (FastAPI / SQLAlchemy)")

elements.append(Paragraph("Authentication &amp; Authorization", h2_style))
elements += bullets([
    "JWT-based access/refresh token authentication, with Argon2 password hashing and "
    "OTP-based email verification for new accounts.",
    "Role-based access control distinguishes <b>Owner</b> vs <b>Staff</b>, with staff limited "
    "to specific modules (Customers, Items, Invoices, Payments, Expenses, Reports).",
    "Every protected route resolves the current tenant via a dependency, and firm/tenant "
    "switching is restricted to Owners.",
], color="#16a34a")

elements.append(Paragraph("Input Validation &amp; SQL Safety", h2_style))
elements += bullets([
    "Request bodies are validated consistently with Pydantic v2 schemas (e.g. amounts must "
    "be &gt; 0, exchange rates &gt; 0, invoices require at least one line item).",
    "No raw SQL string-building was found &mdash; all database access goes through the "
    "SQLAlchemy ORM with parameterised queries, so there is no SQL-injection exposure.",
], color="#16a34a")

elements.append(Paragraph("Error Handling", h2_style))
elements += bullets([
    "Not-found resources consistently return 404; invalid state transitions (e.g. paying an "
    "already-void invoice) return 409; validation errors return 400.",
    "<font color='#d97706'><b>Minor:</b></font> the invoice discount-allocation calculation "
    "divides by the taxable subtotal without an explicit zero-guard. In the current code this "
    "path is only reached when there are computed lines, but an invoice made entirely of "
    "zero-rated/exempt items plus a discount could theoretically trigger a divide-by-zero. "
    "Recommend adding an explicit guard and a regression test.",
])

elements.append(Paragraph("Business Logic &mdash; Receivables", h2_style))
elements += bullets([
    "Both the Payments &gt; Receivables tab and the Reports &gt; Outstanding Receivables KPI "
    "filter invoices to <b>Sent, Partially Paid, and Overdue</b> only &mdash; Draft invoices "
    "are correctly excluded from receivables everywhere they're calculated. This matches the "
    "intended behaviour and is consistent across the dashboard, reports and payments modules.",
], color="#16a34a")

elements.append(Paragraph("Backup &amp; Restore", h2_style))
elements += bullets([
    "Export and import are both restricted to the business Owner.",
    "Import wipes the tenant's existing data and re-inserts the backup with the correct "
    "tenant ID forced on every row, in an order that respects foreign-key relationships "
    "(invoices/payments before their line items/allocations).",
    "<font color='#d97706'><b>Minor:</b></font> the import does not check the backup file's "
    "version number against the current schema version, so a backup taken on an older app "
    "version could import silently even if the schema has since changed. Recommend validating "
    "the version field and rejecting (or migrating) mismatched backups.",
])

elements.append(Paragraph("Multi-tenancy", h2_style))
elements += bullets([
    "Every repository query filters on <code>tenant_id</code> as a base condition, applied "
    "consistently across invoices, items, customers, payments and accounts &mdash; no ad-hoc "
    "or missing filters were found.",
    "The public invoice-sharing endpoint correctly relies on a signed/opaque token rather "
    "than requiring a login, without leaking cross-tenant data.",
], color="#16a34a")

elements.append(Paragraph("Dependencies", h2_style))
elements += bullets([
    "Core packages (FastAPI 0.136, SQLAlchemy 2.0.50, Pydantic 2.13, Argon2, PyJWT 2.13, "
    "asyncpg, Alembic, Pillow) are all current versions with no known outstanding CVEs at "
    "time of review.",
], color="#16a34a")
elements.append(PageBreak())

# 3. Frontend Audit
elements += section_header("3. Frontend Audit (Next.js)")

elements.append(Paragraph("Reports Pages", h2_style))
elements += bullets([
    "All five report pages &mdash; main Reports dashboard, Balance Sheet, Day Book, Profit "
    "&amp; Loss, and Stock Summary &mdash; are fully implemented: they fetch real data, render "
    "tables/charts, handle empty states, and support CSV export. None are placeholders.",
], color="#16a34a")

elements.append(Paragraph("Permission Gating", h2_style))
elements += bullets([
    "The sidebar correctly hides menu items a staff member doesn't have permission for, based "
    "on their assigned module permissions.",
    "<font color='#d97706'><b>Gap:</b></font> individual pages do not re-check permissions "
    "themselves. A staff member without, say, the \"Payments\" permission could type "
    "<code>/payments</code> directly into the address bar. The backend API would still reject "
    "the underlying data requests, but the page shell may render before that happens, which "
    "is a UX/consistency issue rather than a data leak. Recommend adding a lightweight "
    "permission check at the top of each page component.",
])

elements.append(Paragraph("Form Validation", h2_style))
elements += bullets([
    "Invoice, payment and customer forms all validate required fields and use sensible "
    "numeric constraints (amounts &gt; 0, non-negative quantities/discounts).",
    "<font color='#d97706'><b>Gap:</b></font> the Item form's Sale Price and Purchase Price "
    "fields don't set a minimum value, so a negative price can currently be entered. "
    "Recommend adding <code>min=\"0\"</code> to both fields.",
    "<font color='#d97706'><b>Minor gap:</b></font> the Supplier form's opening balance field "
    "is missing the same <code>min=\"0\"</code> constraint that the Customer form has.",
])

elements.append(Paragraph("Error &amp; Loading States", h2_style))
elements += bullets([
    "List pages (Customers, Items, Invoices, Payments, etc.) correctly show a loading "
    "indicator while fetching and an empty-state message when there's no data.",
    "<font color='#d97706'><b>Gap:</b></font> if the underlying API request fails (e.g. "
    "network error), these pages don't currently show an error message to the user &mdash; "
    "they simply show nothing or the loading state. Recommend adding a simple \"Something "
    "went wrong, please retry\" message on query failure.",
])

elements.append(Paragraph("Accessibility &amp; UX", h2_style))
elements += bullets([
    "Form fields are properly labelled and associated with their inputs; buttons that perform "
    "destructive actions (delete/remove) have descriptive aria-labels.",
    "A few secondary action buttons (e.g. Pause/Resume on recurring invoices) could benefit "
    "from additional aria-labels, but this is a minor polish item.",
], color="#16a34a")

elements.append(Paragraph("Feature Completeness &amp; Dependencies", h2_style))
elements += bullets([
    "No \"coming soon\", placeholder, or TODO markers were found anywhere in the frontend "
    "source &mdash; every page that exists is functionally complete.",
    "Dependencies (Next.js 14.2.35, React 18, React Query 5, Recharts 2, Radix UI, Tailwind 3, "
    "Zustand 5, Dexie 4) are all current, stable versions.",
], color="#16a34a")
elements.append(PageBreak())

# 4. Findings & Recommendations
elements += section_header("4. Findings &amp; Recommendations")
elements.append(Paragraph(
    "The table below lists every issue identified during this audit, ordered by priority. "
    "None are critical &mdash; all are quality/robustness improvements on top of an already "
    "solid codebase.",
    body_style,
))

rec_data = [
    [Paragraph("#", cell_head_style), Paragraph("Issue", cell_head_style), Paragraph("Recommendation", cell_head_style), Paragraph("Priority", cell_head_style)],
    [Paragraph("1", cell_style), Paragraph("Item form allows negative Sale/Purchase prices", cell_style), Paragraph("Add <code>min=\"0\"</code> to both price fields in item-form.tsx", cell_style), Paragraph('<font color="#d97706"><b>Medium</b></font>', cell_style)],
    [Paragraph("2", cell_style), Paragraph("Pages don't re-check staff permissions when reached by direct URL", cell_style), Paragraph("Add a permission check at the top of each gated page component", cell_style), Paragraph('<font color="#d97706"><b>Medium</b></font>', cell_style)],
    [Paragraph("3", cell_style), Paragraph("Failed API requests show no error message on list pages", cell_style), Paragraph("Add an error-state UI (\"Something went wrong, retry\") on query failure", cell_style), Paragraph('<font color="#d97706"><b>Medium</b></font>', cell_style)],
    [Paragraph("4", cell_style), Paragraph("Possible divide-by-zero in invoice discount allocation for all-exempt invoices", cell_style), Paragraph("Add explicit zero-guard in invoice_math.py plus a regression test", cell_style), Paragraph('<font color="#d97706"><b>Low&ndash;Med</b></font>', cell_style)],
    [Paragraph("5", cell_style), Paragraph("Backup import doesn't validate the backup file's version number", cell_style), Paragraph("Check <code>version</code> field on import and reject/migrate mismatches", cell_style), Paragraph('<font color="#16a34a"><b>Low</b></font>', cell_style)],
    [Paragraph("6", cell_style), Paragraph("Supplier form opening balance missing <code>min=\"0\"</code>", cell_style), Paragraph("Add the same constraint already present on the Customer form", cell_style), Paragraph('<font color="#16a34a"><b>Low</b></font>', cell_style)],
    [Paragraph("7", cell_style), Paragraph("A few secondary buttons lack aria-labels", cell_style), Paragraph("Add aria-labels for Pause/Resume and similar icon/text buttons", cell_style), Paragraph('<font color="#16a34a"><b>Low</b></font>', cell_style)],
]
rec_table = Table(rec_data, colWidths=[8 * mm, 58 * mm, 68 * mm, 21 * mm])
rec_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
    ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
elements.append(Spacer(1, 4 * mm))
elements.append(rec_table)

elements.append(Spacer(1, 8 * mm))
elements.append(Paragraph(
    "<b>Conclusion:</b> Hisably's backend and frontend are both in good shape from a security "
    "and completeness standpoint. There are no critical vulnerabilities or missing features. "
    "The items above are recommended polish/robustness improvements and can be scheduled at "
    "normal priority.",
    body_style,
))

elements.append(Spacer(1, 60 * mm))
elements.append(Paragraph("End of report.", subtitle_style))

doc = SimpleDocTemplate(
    "C:/Users/hp/Hisably-Audit-Report.pdf",
    pagesize=A4,
    topMargin=20 * mm,
    bottomMargin=20 * mm,
    leftMargin=18 * mm,
    rightMargin=18 * mm,
    title="Hisably Audit Report",
)
doc.build(elements)
print("done")
