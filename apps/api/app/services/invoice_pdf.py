import io

import httpx
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.enums import PdfTemplate
from app.models.invoice import Invoice
from app.models.party import Customer
from app.models.tenant import Tenant

DEFAULT_ACCENT_COLORS = {
    PdfTemplate.MINIMAL: "#0f766e",
    PdfTemplate.CLASSIC: "#1e3a5f",
    PdfTemplate.BOLD: "#b91c1c",
}

LABELS = {
    "bill_to": ("Bill To", "إلى"),
    "description": ("Description", "الوصف"),
    "qty": ("Qty", "الكمية"),
    "unit_price": ("Unit price", "سعر الوحدة"),
    "vat": ("VAT", "ضريبة"),
    "total": ("Total", "الإجمالي"),
    "subtotal": ("Subtotal", "المجموع الفرعي"),
    "discount": ("Discount", "الخصم"),
    "vat_total": ("VAT total", "إجمالي الضريبة"),
    "grand_total": ("Grand total", "الإجمالي الكلي"),
    "notes": ("Notes", "ملاحظات"),
    "terms": ("Terms & Conditions", "الشروط والأحكام"),
    "tax_invoice": ("Tax Invoice", "فاتورة ضريبية"),
    "invoice": ("Invoice", "فاتورة"),
}


def _label(key: str, language) -> str:
    en, ar = LABELS[key]
    value = language.value if hasattr(language, "value") else language
    if value == "ar":
        return ar
    if value == "bilingual":
        return f"{en} / {ar}"
    return en


def render_invoice_pdf(invoice: Invoice, tenant: Tenant, customer: Customer | None) -> bytes:
    template = invoice.pdf_template
    accent_color = colors.HexColor(invoice.accent_color or DEFAULT_ACCENT_COLORS.get(template, "#0f766e"))
    language = invoice.language

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

    base_font = "Times-Roman" if template == PdfTemplate.CLASSIC else "Helvetica"
    bold_font = "Times-Bold" if template == PdfTemplate.CLASSIC else "Helvetica-Bold"

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Title"],
        textColor=colors.white if template == PdfTemplate.BOLD else accent_color,
        fontSize=26 if template == PdfTemplate.BOLD else 22,
        fontName=bold_font,
    )
    heading_style = ParagraphStyle(
        "InvoiceHeading", parent=styles["Heading3"], textColor=accent_color, fontName=bold_font
    )
    normal = ParagraphStyle("Normal", parent=styles["Normal"], fontName=base_font)
    normal_white = ParagraphStyle("NormalWhite", parent=normal, textColor=colors.white)
    right = ParagraphStyle("Right", parent=normal, alignment=2)
    right_white = ParagraphStyle("RightWhite", parent=right, textColor=colors.white)

    label = _label("tax_invoice", language) if tenant.vat_registered else _label("invoice", language)
    if invoice.status.value == "void":
        label = f"VOID {label}"

    elements: list = []

    business_name_style = ParagraphStyle(
        "BusinessName",
        parent=styles["Heading2"],
        fontName=bold_font,
        textColor=colors.white if template == PdfTemplate.BOLD else colors.black,
    )

    name_cell: list = [Paragraph(f"<b>{tenant.business_name}</b>", business_name_style)]
    logo = _load_logo(tenant.logo_url)
    if logo is not None:
        name_cell.insert(0, logo)

    if template == PdfTemplate.BOLD:
        header_table = Table(
            [
                [name_cell, Paragraph(f"<b>{label}</b>", title_style)],
                [
                    Paragraph(_business_details(tenant), normal_white),
                    Paragraph(_invoice_details(invoice, language), right_white),
                ],
            ],
            colWidths=[90 * mm, 70 * mm],
        )
        header_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                    ("BACKGROUND", (0, 0), (-1, -1), accent_color),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
    else:
        header_table = Table(
            [
                [name_cell, Paragraph(f"<b>{label}</b>", title_style)],
                [
                    Paragraph(_business_details(tenant), normal),
                    Paragraph(_invoice_details(invoice, language), right),
                ],
            ],
            colWidths=[90 * mm, 70 * mm],
        )
        table_style = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ]
        if template == PdfTemplate.CLASSIC:
            table_style += [
                ("BOX", (0, 0), (-1, -1), 1, accent_color),
                ("LINEBELOW", (0, 0), (-1, 0), 0.75, accent_color),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        header_table.setStyle(TableStyle(table_style))

    elements.append(header_table)
    elements.append(Spacer(1, 10 * mm))

    if customer is not None:
        elements.append(Paragraph(_label("bill_to", language), heading_style))
        elements.append(Paragraph(_customer_details(customer), normal))
        elements.append(Spacer(1, 8 * mm))

    line_items = getattr(invoice, "line_items_loaded", [])
    table_data = [
        [
            "#",
            _label("description", language),
            _label("qty", language),
            _label("unit_price", language),
            _label("vat", language),
            _label("total", language),
        ]
    ]
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
    items_table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), accent_color),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), bold_font),
        ("FONTNAME", (0, 1), (-1, -1), base_font),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    if template == PdfTemplate.CLASSIC:
        items_table_style.append(("BOX", (0, 0), (-1, -1), 1, accent_color))
    items_table.setStyle(TableStyle(items_table_style))
    elements.append(items_table)
    elements.append(Spacer(1, 6 * mm))

    currency = invoice.currency
    totals_data = [
        [_label("subtotal", language), f"{currency} {invoice.subtotal:.2f}"],
        [_label("discount", language), f"{currency} {invoice.discount_total:.2f}"],
        [_label("vat_total", language), f"{currency} {invoice.vat_total:.2f}"],
        [_label("grand_total", language), f"{currency} {invoice.grand_total:.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[40 * mm, 40 * mm], hAlign="RIGHT")
    totals_table.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
                ("FONTNAME", (0, 0), (-1, -2), base_font),
                ("FONTNAME", (0, -1), (-1, -1), bold_font),
                ("LINEABOVE", (0, -1), (-1, -1), 0.75, accent_color),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    elements.append(totals_table)

    if invoice.notes:
        elements.append(Spacer(1, 8 * mm))
        elements.append(Paragraph(_label("notes", language), heading_style))
        elements.append(Paragraph(invoice.notes.replace("\n", "<br/>"), normal))

    if invoice.terms:
        elements.append(Spacer(1, 6 * mm))
        elements.append(Paragraph(_label("terms", language), heading_style))
        elements.append(Paragraph(invoice.terms.replace("\n", "<br/>"), normal))

    doc.build(elements)
    return buffer.getvalue()


def _load_logo(logo_url: str | None) -> Image | None:
    if not logo_url:
        return None
    try:
        response = httpx.get(logo_url, timeout=5.0)
        response.raise_for_status()
        image = Image(io.BytesIO(response.content), width=25 * mm, height=25 * mm, kind="proportional")
        return image
    except Exception:
        return None


def _business_details(tenant: Tenant) -> str:
    lines = [tenant.business_name]
    if tenant.address:
        lines.append(tenant.address)
    if tenant.trn:
        lines.append(f"TRN: {tenant.trn}")
    return "<br/>".join(lines)


def _invoice_details(invoice: Invoice, language) -> str:
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
