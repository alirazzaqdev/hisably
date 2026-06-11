import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.invoice import Invoice
from app.models.party import Customer
from app.models.tenant import Tenant

ACCENT_COLOR = colors.HexColor("#0f766e")


def render_invoice_pdf(invoice: Invoice, tenant: Tenant, customer: Customer | None) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title=invoice.invoice_number or invoice.draft_number,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("InvoiceTitle", parent=styles["Title"], textColor=ACCENT_COLOR, fontSize=22)
    heading_style = ParagraphStyle("InvoiceHeading", parent=styles["Heading3"], textColor=ACCENT_COLOR)
    normal = styles["Normal"]
    right = ParagraphStyle("Right", parent=normal, alignment=2)

    label = "Tax Invoice" if tenant.vat_registered else "Invoice"
    if invoice.status.value == "void":
        label = f"VOID {label}"

    elements: list = []

    header_table = Table(
        [
            [
                Paragraph(f"<b>{tenant.business_name}</b>", styles["Heading2"]),
                Paragraph(f"<b>{label}</b>", title_style),
            ],
            [
                Paragraph(_business_details(tenant), normal),
                Paragraph(_invoice_details(invoice), right),
            ],
        ],
        colWidths=[90 * mm, 70 * mm],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
            ]
        )
    )
    elements.append(header_table)
    elements.append(Spacer(1, 10 * mm))

    if customer is not None:
        elements.append(Paragraph("Bill To", heading_style))
        elements.append(Paragraph(_customer_details(customer), normal))
        elements.append(Spacer(1, 8 * mm))

    line_items = getattr(invoice, "line_items_loaded", [])
    table_data = [["#", "Description", "Qty", "Unit price", "VAT", "Total"]]
    for idx, line in enumerate(line_items, start=1):
        table_data.append(
            [
                str(idx),
                line.description,
                _format_decimal(line.quantity),
                f"{line.unit_price:.2f}",
                f"{line.vat_rate:.0f}%",
                f"{line.line_total:.2f}",
            ]
        )

    items_table = Table(table_data, colWidths=[10 * mm, 80 * mm, 20 * mm, 25 * mm, 15 * mm, 25 * mm])
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), ACCENT_COLOR),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(items_table)
    elements.append(Spacer(1, 6 * mm))

    currency = invoice.currency
    totals_data = [
        ["Subtotal", f"{currency} {invoice.subtotal:.2f}"],
        ["Discount", f"{currency} {invoice.discount_total:.2f}"],
        ["VAT total", f"{currency} {invoice.vat_total:.2f}"],
        ["Grand total", f"{currency} {invoice.grand_total:.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[40 * mm, 40 * mm], hAlign="RIGHT")
    totals_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("LINEABOVE", (0, -1), (-1, -1), 0.75, ACCENT_COLOR),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(totals_table)

    if invoice.notes:
        elements.append(Spacer(1, 8 * mm))
        elements.append(Paragraph("Notes", heading_style))
        elements.append(Paragraph(invoice.notes.replace("\n", "<br/>"), normal))

    if invoice.terms:
        elements.append(Spacer(1, 6 * mm))
        elements.append(Paragraph("Terms & Conditions", heading_style))
        elements.append(Paragraph(invoice.terms.replace("\n", "<br/>"), normal))

    doc.build(elements)
    return buffer.getvalue()


def _business_details(tenant: Tenant) -> str:
    lines = [tenant.business_name]
    if tenant.address:
        lines.append(tenant.address)
    if tenant.trn:
        lines.append(f"TRN: {tenant.trn}")
    return "<br/>".join(lines)


def _invoice_details(invoice: Invoice) -> str:
    number = invoice.invoice_number or invoice.draft_number
    lines = [
        f"<b>Invoice #:</b> {number}",
        f"<b>Issue date:</b> {invoice.issue_date.isoformat()}",
    ]
    if invoice.due_date:
        lines.append(f"<b>Due date:</b> {invoice.due_date.isoformat()}")
    lines.append(f"<b>Status:</b> {invoice.status.value.replace('_', ' ').title()}")
    return "<br/>".join(lines)


def _customer_details(customer: Customer) -> str:
    lines = [customer.name]
    if customer.billing_address:
        lines.append(customer.billing_address)
    if customer.trn:
        lines.append(f"TRN: {customer.trn}")
    if customer.phone:
        lines.append(customer.phone)
    if customer.email:
        lines.append(customer.email)
    return "<br/>".join(lines)


def _format_decimal(value) -> str:
    normalized = value.normalize()
    if normalized == normalized.to_integral():
        return str(normalized.to_integral())
    return str(normalized)
