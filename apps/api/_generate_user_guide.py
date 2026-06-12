"""One-off script: generates the Hisably User Guide PDF."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
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

pdfmetrics.registerFont(TTFont("NotoSans", str(FONTS_DIR / "NotoSans-Regular.ttf")))
pdfmetrics.registerFont(TTFont("NotoSans-Bold", str(FONTS_DIR / "NotoSans-Bold.ttf")))
pdfmetrics.registerFontFamily("NotoSans", normal="NotoSans", bold="NotoSans-Bold")

styles = getSampleStyleSheet()

title_style = ParagraphStyle("Title", fontName="NotoSans-Bold", fontSize=28, textColor=ACCENT, alignment=TA_CENTER)
subtitle_style = ParagraphStyle("Subtitle", fontName="NotoSans", fontSize=13, textColor=MUTED, alignment=TA_CENTER, spaceBefore=6)
h1_style = ParagraphStyle("H1", fontName="NotoSans-Bold", fontSize=17, textColor=ACCENT, spaceBefore=4, spaceAfter=6)
h2_style = ParagraphStyle("H2", fontName="NotoSans-Bold", fontSize=11.5, textColor=DARK, spaceBefore=10, spaceAfter=3)
body_style = ParagraphStyle("Body", fontName="NotoSans", fontSize=9.5, leading=14, textColor=DARK, spaceAfter=4)
bullet_style = ParagraphStyle("Bullet", parent=body_style, leftIndent=14, bulletIndent=2, spaceAfter=2)
toc_style = ParagraphStyle("Toc", fontName="NotoSans", fontSize=11, leading=20, textColor=DARK)


def bullets(items):
    return [Paragraph(f"&bull;&nbsp;&nbsp;{text}", bullet_style) for text in items]


def section_header(title):
    return [
        Paragraph(title, h1_style),
        HRFlowable(width="100%", thickness=1.2, color=ACCENT, spaceAfter=8),
    ]


elements = []

# Cover page
elements.append(Spacer(1, 60 * mm))
elements.append(Paragraph("Hisably", title_style))
elements.append(Spacer(1, 6 * mm))
elements.append(Paragraph("Complete User Guide", subtitle_style))
elements.append(Paragraph("Dashboard, Customers, Items &amp; Stock, Invoices, Payments, Reports &amp; Settings", subtitle_style))
elements.append(Spacer(1, 100 * mm))
elements.append(Paragraph("Offline-first billing &amp; business management for UAE businesses", subtitle_style))
elements.append(PageBreak())

# Table of contents
elements.append(Paragraph("Contents", h1_style))
elements.append(HRFlowable(width="100%", thickness=1.2, color=ACCENT, spaceAfter=8))
toc_items = [
    "1. Dashboard",
    "2. Customers &amp; Suppliers",
    "3. Items, Stock &amp; Categories",
    "4. Price Lists",
    "5. Invoices &amp; Documents",
    "6. Recurring Invoices",
    "7. Payments &amp; Accounts",
    "8. Expenses",
    "9. Reports",
    "10. Settings",
]
for item in toc_items:
    elements.append(Paragraph(item, toc_style))
elements.append(PageBreak())

# 1. Dashboard
elements += section_header("1. Dashboard")
elements.append(Paragraph(
    "The Dashboard is the home screen after you log in. It gives you a quick snapshot of your "
    "business so you don't have to dig through every menu to see how things stand.",
    body_style,
))
elements += bullets([
    "<b>Welcome banner</b> — shows your business name.",
    "<b>Low stock alert</b> — if any item you track inventory for has fallen to or below its reorder "
    "level, a red banner lists the affected items. Click it to jump straight to the Items page.",
    "<b>Quick-stat cards</b> — total Customers, total Items, and total Invoices, each clickable to "
    "open that section directly.",
])
elements.append(PageBreak())

# 2. Customers & Suppliers
elements += section_header("2. Customers &amp; Suppliers")
elements.append(Paragraph(
    "Customers are the people or businesses you sell to; Suppliers are who you buy from. Both work "
    "the same way and both have their own ledger/statement.",
    body_style,
))
elements.append(Paragraph("Customers", h2_style))
elements += bullets([
    "Add a customer with name, phone, email, billing address, and TRN (tax registration number) if "
    "they are VAT-registered.",
    "Search the list by name, phone, or email.",
    "Each customer has a running <b>balance</b> (how much they owe you) shown in the list.",
    "Open a customer's <b>Statement</b> to see every invoice and payment recorded against them, in "
    "date order — useful for sending a statement of account.",
    "Edit or remove a customer from their detail page.",
])
elements.append(Paragraph("Suppliers", h2_style))
elements += bullets([
    "Same fields as Customers (name, phone, email, address, TRN).",
    "Used when recording <b>Purchase bills</b> in the Invoices section.",
    "Each supplier also has a Statement showing bills and payments to them.",
])
elements.append(PageBreak())

# 3. Items, Stock & Categories
elements += section_header("3. Items, Stock &amp; Categories")
elements.append(Paragraph(
    "This is your product/service catalogue. Anything you put on an invoice — a product, a service, "
    "a labour charge — is set up here once and then reused.",
    body_style,
))
elements.append(Paragraph("Item fields", h2_style))
elements += bullets([
    "<b>Name</b> — what the item is called on invoices.",
    "<b>SKU</b> — your own internal code/reference for the item.",
    "<b>Barcode</b> — scan one in, type one, or click <b>Generate</b> to create a random EAN-13 "
    "barcode with a printable preview.",
    "<b>Unit</b> — pcs, sqm, sqft, kg, m, box or ltr.",
    "<b>Sale price</b> and <b>Purchase price</b>.",
    "<b>VAT category</b> — Standard (5%), Zero-rated, or Exempt.",
    "<b>Category</b> — group items for filtering/reporting (see Categories below).",
])
elements.append(Paragraph("Stock tracking", h2_style))
elements += bullets([
    "Items can optionally track inventory. When enabled, the item carries a <b>current stock</b> "
    "quantity and a <b>low-stock threshold</b> (reorder level).",
    "The Items list shows the current stock for every tracked item, with a warning icon and red "
    "text when stock has fallen to or below the threshold.",
    "Low-stock items also appear as a banner on the Dashboard.",
])
elements.append(Paragraph("Item categories", h2_style))
elements += bullets([
    "Every new business starts with a set of ready-made categories (General, Electronics &amp; "
    "Accessories, Hardware &amp; Tools, Groceries &amp; FMCG, Stationery &amp; Office Supplies, "
    "Cosmetics &amp; Personal Care, Clothing &amp; Textiles, Spare Parts &amp; Machinery).",
    "Rename any category to match your own business (e.g. \"Glass &amp; Aluminium\") using the pencil "
    "icon — click the checkmark to save or the cross to cancel.",
    "Add as many custom categories as you like from the \"Add category\" box.",
    "Delete a category you no longer need with the trash icon.",
])
elements.append(PageBreak())

# 4. Price lists
elements += section_header("4. Price Lists")
elements.append(Paragraph(
    "Price lists let you offer different prices to different groups of customers — for example "
    "\"Wholesale\" vs \"Retail\".",
    body_style,
))
elements += bullets([
    "Create named price lists (e.g. Wholesale, Retail, VIP).",
    "On each item's edit page, optionally set a special price for any price list. If left blank, "
    "the item's normal sale price is used.",
    "When creating an invoice, picking a customer's assigned price list automatically applies the "
    "right prices to the line items.",
])
elements.append(PageBreak())

# 5. Invoices & Documents
elements += section_header("5. Invoices &amp; Documents")
elements.append(Paragraph(
    "The Invoices section handles every kind of sales/purchase document your business needs — not "
    "just tax invoices.",
    body_style,
))
elements.append(Paragraph("Document types", h2_style))
elements += bullets([
    "<b>Tax invoice</b> — your standard VAT invoice.",
    "<b>Quotation</b> — a price quote sent before a sale is confirmed; can later be converted to an "
    "invoice.",
    "<b>Proforma</b> — a preliminary bill sent before goods/services are delivered.",
    "<b>Credit note</b> / <b>Debit note</b> — adjustments (refunds, corrections) against an existing "
    "invoice.",
    "<b>Purchase bill</b> — records what you owe a supplier.",
])
elements.append(Paragraph("Creating an invoice", h2_style))
elements += bullets([
    "Choose the document type, a customer (or supplier for purchase bills), issue date and due date.",
    "Add line items by picking an existing item (auto-fills description, price, VAT) or typing a "
    "custom line.",
    "Use the <b>barcode scan</b> field to add items instantly with a barcode scanner — scan or type "
    "a code and press Enter.",
    "Apply a discount, choose the currency and exchange rate (for foreign-currency invoices), and "
    "add Notes / Terms &amp; Conditions that will print on the PDF.",
    "Subtotal, VAT total and Grand total are calculated automatically as you edit lines.",
])
elements.append(Paragraph("PDF appearance", h2_style))
elements += bullets([
    "<b>PDF template</b> — Minimal (teal), Classic (navy, boxed), or Bold (solid colour header).",
    "<b>Accent colour</b> — override the template's default colour with your own brand colour.",
    "<b>Language</b> — English, Arabic (fully right-to-left with shaped Arabic text), or Bilingual "
    "(English / Arabic side by side).",
    "Every PDF includes your logo (if set in Settings), business details, TRN, the Bill To section, "
    "an itemised table, totals, notes/terms, and a thank-you footer.",
])
elements.append(Paragraph("Status &amp; workflow", h2_style))
elements += bullets([
    "Invoices move through statuses: Draft &rarr; Sent &rarr; Partially Paid / Paid, or Overdue if "
    "the due date has passed unpaid. A Void status is also available for cancelled invoices.",
    "Filter the invoice list by document type or search by invoice number.",
])
elements.append(PageBreak())

# 6. Recurring invoices
elements += section_header("6. Recurring Invoices")
elements.append(Paragraph(
    "For customers you bill on a regular schedule (rent, retainers, subscriptions), set up a "
    "recurring invoice once and Hisably generates new invoices automatically.",
    body_style,
))
elements += bullets([
    "Pick the customer, a start date, an optional end date, and a frequency: Weekly, Monthly, "
    "Quarterly, or Yearly.",
    "Add the same line items, discount, notes and terms as a normal invoice — these are copied to "
    "every generated invoice.",
    "A recurring invoice can be <b>Active</b> or <b>Paused</b> — use Pause/Resume to temporarily "
    "stop generation without deleting the setup.",
    "<b>Generate now</b> creates the next invoice immediately, outside the normal schedule.",
    "Delete a recurring invoice when it's no longer needed (this does not delete invoices already "
    "generated from it).",
])
elements.append(PageBreak())

# 7. Payments & Accounts
elements += section_header("7. Payments &amp; Accounts")
elements.append(Paragraph(
    "Track money coming in from customers and going out to suppliers, and which bank/cash account "
    "it moved through.",
    body_style,
))
elements.append(Paragraph("Recording a payment", h2_style))
elements += bullets([
    "Choose the customer, the amount, payment date, and <b>method</b>: Cash, Bank transfer, Cheque, "
    "Card, or Other.",
    "If the method is Cheque, also record the cheque number and cheque date — cheque status can be "
    "tracked separately as pending / cleared / bounced.",
    "Select which <b>Account</b> the money was received into/paid from (see Accounts below).",
    "Add a reference number and notes for your own records.",
])
elements.append(Paragraph("Receivables tab", h2_style))
elements += bullets([
    "Shows outstanding invoices that still need payment, so you can see at a glance who owes you "
    "money and how much.",
    "Note: only invoices that have been marked Sent (or are Partially Paid / Overdue) appear here — "
    "invoices left in Draft status are not yet counted as receivables.",
])
elements.append(Paragraph("Payment history tab", h2_style))
elements += bullets([
    "Lists every payment recorded, with the customer, amount, method, account, and date. Delete a "
    "payment if it was recorded in error.",
])
elements.append(Paragraph("Accounts", h2_style))
elements += bullets([
    "Represents your real-world cash drawer and bank accounts.",
    "<b>Type</b> — Cash or Bank. For bank accounts you can record the bank name and account number.",
    "Set an <b>opening balance</b> when you first add the account; Hisably then tracks the running "
    "balance as payments and expenses are recorded against it.",
    "The Accounts list shows each account's current balance — useful for reconciling against your "
    "real bank statement.",
])
elements.append(PageBreak())

# 8. Expenses
elements += section_header("8. Expenses")
elements.append(Paragraph(
    "Record what your business spends — rent, utilities, supplies, salaries — so your Reports give "
    "you a true picture of profit.",
    body_style,
))
elements += bullets([
    "Each expense has an amount, date, category, and optional notes.",
    "Mark whether <b>VAT was paid</b> on the expense, so it is correctly included in your VAT "
    "position (Input VAT) in Reports.",
    "Attach a <b>receipt</b> for record-keeping.",
    "The expense list totals everything at the bottom of the table for a quick monthly total.",
])
elements.append(PageBreak())

# 9. Reports
elements += section_header("9. Reports")
elements.append(Paragraph(
    "The Reports page turns your invoices, payments and expenses into visual charts so you can spot "
    "trends at a glance, without exporting anything.",
    body_style,
))
elements += bullets([
    "<b>KPI cards</b> — Revenue collected, Outstanding receivables, Expenses this month, and number "
    "of Overdue invoices.",
    "<b>Sales trend</b> — an area chart comparing Invoiced vs Collected amounts over time, so you can "
    "see your cash-flow gap.",
    "<b>Receivables aging</b> — a donut chart breaking down outstanding invoices by how overdue they "
    "are, with the total amount due shown in the centre.",
    "<b>Top customers</b> and <b>Top items</b> — horizontal bar charts ranking your best customers "
    "and best-selling items.",
    "<b>VAT position</b> — a donut chart comparing Output VAT (VAT you charged on sales) vs Input "
    "VAT (VAT you paid on expenses), with the net VAT due shown in the centre — this is what you'd "
    "owe (or reclaim) on your VAT return.",
])
elements.append(PageBreak())

# 10. Settings
elements += section_header("10. Settings")
elements.append(Paragraph("Business profile", h2_style))
elements += bullets([
    "<b>Business name, TRN, invoice prefix, address, logo URL</b> — all of this appears on your "
    "invoice PDFs.",
    "<b>Default VAT category</b> and whether your business is <b>VAT registered</b> — controls "
    "whether invoices print as \"Invoice\" or \"Tax Invoice\" by default.",
    "Country and currency are shown for reference (set during onboarding).",
])
elements.append(Paragraph("Account", h2_style))
elements += bullets([
    "Shows your login email and role (Owner or Staff).",
])
elements.append(Paragraph("Team &amp; permissions (Owner only)", h2_style))
elements += bullets([
    "Invite staff members by email and set a password for them.",
    "Grant access module-by-module: Customers &amp; suppliers, Items, Invoices, Payments &amp; "
    "accounts, Expenses, Reports. A staff member only sees the menu items they have permission for.",
    "Update permissions or remove a staff account at any time.",
])
elements.append(Paragraph("Backup &amp; restore (Owner only)", h2_style))
elements += bullets([
    "<b>Export</b> downloads a complete JSON backup of your business data to your device.",
    "<b>Import</b> restores your business data from a previously exported backup file.",
])
elements.append(PageBreak())

elements.append(Spacer(1, 100 * mm))
elements.append(Paragraph("Thank you for using Hisably.", subtitle_style))

doc = SimpleDocTemplate(
    "C:/Users/hp/Hisably-User-Guide.pdf",
    pagesize=A4,
    topMargin=20 * mm,
    bottomMargin=20 * mm,
    leftMargin=20 * mm,
    rightMargin=20 * mm,
    title="Hisably User Guide",
)
doc.build(elements)
print("done")
