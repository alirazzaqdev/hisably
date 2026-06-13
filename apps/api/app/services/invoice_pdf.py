import io
import re
from decimal import Decimal
from pathlib import Path

import arabic_reshaper
import httpx
from bidi.algorithm import get_display
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.enums import InvoiceType, PdfTemplate
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
    "ship_to": ("Ship To", "الشحن إلى"),
    "description": ("Description", "الوصف"),
    "qty": ("Qty", "الكمية"),
    "size_lm": ("Size / LM", "القياس"),
    "unit_price": ("Unit price", "سعر الوحدة"),
    "vat": ("VAT", "ضريبة"),
    "total": ("Total", "الإجمالي"),
    "final_payment": ("Final Payment", "الدفعة النهائية"),
    "rate": ("Rate", "السعر"),
    "subtotal": ("Subtotal", "المجموع الفرعي"),
    "discount": ("Discount", "الخصم"),
    "vat_total": ("VAT total", "إجمالي الضريبة"),
    "grand_total": ("Grand total", "الإجمالي الكلي"),
    "total_amount": ("Total Amount", "المبلغ الإجمالي"),
    "payable_amount": ("Payable Amount", "المبلغ المستحق"),
    "notes": ("Notes", "ملاحظات"),
    "terms": ("Terms & Conditions", "الشروط والأحكام"),
    "tax_invoice": ("Tax Invoice", "فاتورة ضريبية"),
    "invoice": ("Invoice", "فاتورة"),
    "proforma_invoice": ("Proforma Invoice", "فاتورة مبدئية"),
    "invoice_no": ("Invoice #", "رقم الفاتورة"),
    "issue_date": ("Issue date", "تاريخ الإصدار"),
    "due_date": ("Due date", "تاريخ الاستحقاق"),
    "status": ("Status", "الحالة"),
    "thank_you": ("Thank you for your business.", "شكراً لتعاملكم معنا."),
    "trn": ("TRN", "الرقم الضريبي"),
    "lpo_no": ("LPO #", "رقم أمر الشراء"),
    "villa_no": ("Villa / Project No", "رقم الفيلا / المشروع"),
    "make_cheques_payable": ("Make all cheques payable to", "يتم سداد جميع الشيكات لـ"),
    "bank_name": ("Bank Name", "اسم البنك"),
    "bank_account": ("Account Number", "رقم الحساب"),
    "iban": ("IBAN", "آيبان"),
    "contact": ("Contact", "التواصل"),
    "authorized_signatory": ("Authorized Signatory", "التوقيع المعتمد"),
}

STATUS_LABELS = {
    "draft": ("Draft", "مسودة"),
    "sent": ("Sent", "مرسلة"),
    "partially_paid": ("Partially Paid", "مدفوعة جزئياً"),
    "paid": ("Paid", "مدفوعة"),
    "overdue": ("Overdue", "متأخرة"),
    "void": ("Void", "ملغاة"),
}

# Arabic + Arabic presentation forms unicode ranges.
_ARABIC_RE = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]+")

_ARABIC_RESHAPER = arabic_reshaper.ArabicReshaper(
    configuration={"delete_harakat": False, "support_ligatures": True}
)

FONTS_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"

LATIN_FONT = "NotoSans"
LATIN_FONT_BOLD = "NotoSans-Bold"
ARABIC_FONT = "NotoNaskhArabic"
ARABIC_FONT_BOLD = "NotoNaskhArabic-Bold"

_FONTS_REGISTERED = False


def _register_fonts() -> None:
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    pdfmetrics.registerFont(TTFont(LATIN_FONT, str(FONTS_DIR / "NotoSans-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(LATIN_FONT_BOLD, str(FONTS_DIR / "NotoSans-Bold.ttf")))
    pdfmetrics.registerFont(TTFont(ARABIC_FONT, str(FONTS_DIR / "NotoNaskhArabic-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(ARABIC_FONT_BOLD, str(FONTS_DIR / "NotoNaskhArabic-Bold.ttf")))
    pdfmetrics.registerFontFamily(LATIN_FONT, normal=LATIN_FONT, bold=LATIN_FONT_BOLD)
    pdfmetrics.registerFontFamily(ARABIC_FONT, normal=ARABIC_FONT, bold=ARABIC_FONT_BOLD)
    _FONTS_REGISTERED = True


def _xml_escape(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _shape_arabic(text: str) -> str:
    return get_display(_ARABIC_RESHAPER.reshape(text))


def _rtl(text: str, bold_font: str | None = None) -> str:
    """Render text for a ReportLab Paragraph, shaping any Arabic runs into their
    correct visual presentation form and tagging them with an Arabic-capable font
    so they no longer render as missing-glyph boxes."""
    arabic_font = ARABIC_FONT_BOLD if bold_font else ARABIC_FONT
    parts: list[str] = []
    last_end = 0
    for match in _ARABIC_RE.finditer(text):
        if match.start() > last_end:
            parts.append(_xml_escape(text[last_end : match.start()]))
        shaped = _shape_arabic(match.group())
        parts.append(f'<font face="{arabic_font}">{_xml_escape(shaped)}</font>')
        last_end = match.end()
    if last_end < len(text):
        parts.append(_xml_escape(text[last_end:]))
    return "".join(parts)


def _is_arabic_only(language) -> bool:
    value = language.value if hasattr(language, "value") else language
    return value == "ar"


def _label(key: str, language) -> str:
    en, ar = LABELS[key]
    value = language.value if hasattr(language, "value") else language
    if value == "ar":
        return _rtl(ar)
    if value == "bilingual":
        return _rtl(f"{en} / {ar}")
    return en


def _status_label(status_value: str, language) -> str:
    en, ar = STATUS_LABELS.get(status_value, (status_value.replace("_", " ").title(), status_value))
    value = language.value if hasattr(language, "value") else language
    if value == "ar":
        return _rtl(ar)
    if value == "bilingual":
        return _rtl(f"{en} / {ar}")
    return en


def render_invoice_pdf(invoice: Invoice, tenant: Tenant, customer: Customer | None) -> bytes:
    _register_fonts()

    template = invoice.pdf_template
    accent_color = colors.HexColor(invoice.accent_color or DEFAULT_ACCENT_COLORS.get(template, "#0f766e"))
    language = invoice.language
    is_arabic = _is_arabic_only(language)
    is_proforma = invoice.type == InvoiceType.PROFORMA

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title=invoice.invoice_number or invoice.draft_number,
    )

    base_font = LATIN_FONT
    bold_font = LATIN_FONT_BOLD
    if is_arabic:
        base_font = ARABIC_FONT
        bold_font = ARABIC_FONT_BOLD

    text_align = TA_RIGHT if is_arabic else TA_LEFT
    opposite_align = TA_LEFT if is_arabic else TA_RIGHT

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Title"],
        textColor=colors.white if template == PdfTemplate.BOLD else accent_color,
        fontSize=26 if template == PdfTemplate.BOLD else 22,
        fontName=bold_font,
        alignment=opposite_align if is_arabic else TA_RIGHT,
    )
    heading_style = ParagraphStyle(
        "InvoiceHeading",
        parent=styles["Heading3"],
        textColor=accent_color,
        fontName=bold_font,
        alignment=text_align,
    )
    normal = ParagraphStyle("Normal", parent=styles["Normal"], fontName=base_font, alignment=text_align)
    normal_white = ParagraphStyle("NormalWhite", parent=normal, textColor=colors.white)
    right = ParagraphStyle("Right", parent=normal, alignment=opposite_align if is_arabic else TA_RIGHT)
    right_white = ParagraphStyle("RightWhite", parent=right, textColor=colors.white)
    muted_small = ParagraphStyle(
        "MutedSmall",
        parent=normal,
        fontSize=8.5,
        textColor=colors.HexColor("#94a3b8"),
        alignment=TA_CENTER,
    )

    if is_proforma:
        label = _label("proforma_invoice", language)
    elif tenant.vat_registered:
        label = _label("tax_invoice", language)
    else:
        label = _label("invoice", language)
    if invoice.status.value == "void":
        label = f"VOID {label}" if not is_arabic else f"{label} - VOID"

    elements: list = []

    business_name_style = ParagraphStyle(
        "BusinessName",
        parent=styles["Heading2"],
        fontName=bold_font,
        textColor=colors.white if template == PdfTemplate.BOLD else colors.HexColor("#0f172a"),
        alignment=opposite_align if is_arabic else TA_LEFT,
    )

    name_cell: list = [Paragraph(_rtl(tenant.business_name, bold_font=True), business_name_style)]
    logo = _load_logo(tenant.logo_url)
    if logo is not None:
        name_cell.insert(0, logo)

    title_cell = Paragraph(f"<b>{label}</b>", title_style)
    detail_normal = normal_white if template == PdfTemplate.BOLD else normal
    detail_right = right_white if template == PdfTemplate.BOLD else right
    business_info_cell = Paragraph(_business_details(tenant, language), detail_normal if not is_arabic else detail_right)
    invoice_info_cell = Paragraph(_invoice_details(invoice, language), detail_right if not is_arabic else detail_normal)

    if is_arabic:
        # Mirror the header for right-to-left reading: title on the left, business
        # identity on the right.
        header_rows = [
            [title_cell, name_cell],
            [invoice_info_cell, business_info_cell],
        ]
        col_widths = [70 * mm, 90 * mm]
        title_col = 0
        title_align = "LEFT"
    else:
        header_rows = [
            [name_cell, title_cell],
            [business_info_cell, invoice_info_cell],
        ]
        col_widths = [90 * mm, 70 * mm]
        title_col = 1
        title_align = "RIGHT"

    if template == PdfTemplate.BOLD:
        header_table = Table(header_rows, colWidths=col_widths)
        header_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (title_col, 0), (title_col, -1), title_align),
                    ("BACKGROUND", (0, 0), (-1, -1), accent_color),
                    ("LEFTPADDING", (0, 0), (-1, -1), 10),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                    ("TOPPADDING", (0, 0), (-1, -1), 10),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ]
            )
        )
    else:
        header_table = Table(header_rows, colWidths=col_widths)
        table_style = [
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ALIGN", (title_col, 0), (title_col, -1), title_align),
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
    elements.append(Spacer(1, 4 * mm))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=accent_color, spaceAfter=6 * mm))

    if is_proforma:
        bill_to_text = _rtl(invoice.bill_to_address).replace("\n", "<br/>") if invoice.bill_to_address else (
            _customer_details(customer, language) if customer is not None else None
        )
        if bill_to_text:
            elements.append(Paragraph(_label("bill_to", language), heading_style))
            elements.append(Paragraph(bill_to_text, normal))
            elements.append(Spacer(1, 4 * mm))
        if invoice.ship_to_address and invoice.ship_to_address != invoice.bill_to_address:
            elements.append(Paragraph(_label("ship_to", language), heading_style))
            elements.append(Paragraph(_rtl(invoice.ship_to_address).replace("\n", "<br/>"), normal))
            elements.append(Spacer(1, 4 * mm))
        elements.append(Spacer(1, 4 * mm))
    elif customer is not None:
        elements.append(Paragraph(_label("bill_to", language), heading_style))
        elements.append(Paragraph(_customer_details(customer, language), normal))
        elements.append(Spacer(1, 8 * mm))

    line_items = getattr(invoice, "line_items_loaded", [])

    def _cell(text: str, align: str, *, bold: bool = False, white: bool = False, size: float = 9, color=None):
        ta_map = {"LEFT": TA_LEFT, "RIGHT": TA_RIGHT, "CENTER": TA_CENTER}
        return Paragraph(
            text,
            ParagraphStyle(
                "Cell",
                fontName=bold_font if bold else base_font,
                fontSize=size,
                leading=size + 2,
                alignment=ta_map[align],
                textColor=color or (colors.white if white else colors.HexColor("#0f172a")),
            ),
        )

    size_header_cols: tuple[int, int] | None = None

    if is_proforma:
        headers = [
            ("#", "CENTER"),
            (_label("description", language), "LEFT"),
            (_label("qty", language), "RIGHT"),
            (_label("final_payment", language), "RIGHT"),
            (_label("rate", language), "RIGHT"),
            (_label("total", language), "RIGHT"),
        ]
        col_widths_items = [10 * mm, 78 * mm, 20 * mm, 24 * mm, 18 * mm, 20 * mm]

        body_rows_raw = []
        for idx, line in enumerate(line_items, start=1):
            final_payment = line.final_payment_factor if line.final_payment_factor is not None else Decimal(1)
            body_rows_raw.append(
                [
                    (str(idx), "CENTER"),
                    (_rtl(line.description), "LEFT"),
                    (_format_decimal(line.quantity), "RIGHT"),
                    (_format_decimal(final_payment), "RIGHT"),
                    (f"{line.unit_price:.2f}", "RIGHT"),
                    (f"{line.line_total:.2f}", "RIGHT"),
                ]
            )
    else:
        headers = [
            ("#", "CENTER"),
            (_label("description", language), "LEFT"),
            (_label("size_lm", language), "CENTER"),
            ("", "CENTER"),
            (_label("qty", language), "RIGHT"),
            (_label("unit_price", language), "RIGHT"),
            (_label("vat", language), "RIGHT"),
            (_label("total", language), "RIGHT"),
        ]
        col_widths_items = [10 * mm, 64 * mm, 12 * mm, 12 * mm, 16 * mm, 22 * mm, 12 * mm, 22 * mm]
        size_header_cols = (2, 3)

        body_rows_raw = []
        for idx, line in enumerate(line_items, start=1):
            if line.width_mm is not None and line.height_mm is not None:
                size_cols = (_format_decimal(line.width_mm), _format_decimal(line.height_mm))
            elif line.length_mm is not None:
                size_cols = (_format_decimal(line.length_mm), "")
            else:
                size_cols = ("", "")
            body_rows_raw.append(
                [
                    (str(idx), "CENTER"),
                    (_rtl(line.description), "LEFT"),
                    (size_cols[0], "CENTER"),
                    (size_cols[1], "CENTER"),
                    (_format_decimal(line.quantity), "RIGHT"),
                    (f"{line.unit_price:.2f}", "RIGHT"),
                    (f"{line.vat_rate:.0f}%", "RIGHT"),
                    (f"{line.line_total:.2f}", "RIGHT"),
                ]
            )

    if is_arabic:
        headers = headers[::-1]
        col_widths_items = col_widths_items[::-1]
        body_rows_raw = [row[::-1] for row in body_rows_raw]
        if size_header_cols is not None:
            size_header_cols = (len(headers) - 1 - size_header_cols[1], len(headers) - 1 - size_header_cols[0])
        # The description column now sits second-to-last; align it for RTL reading.
        headers = [(text, "RIGHT" if align == "LEFT" else align) for text, align in headers]
        body_rows_raw = [
            [(text, "RIGHT" if align == "LEFT" else align) for text, align in row] for row in body_rows_raw
        ]

    table_data = [
        [_cell(text, align, bold=True, white=True) for text, align in headers],
        *[[_cell(text, align) for text, align in row] for row in body_rows_raw],
    ]

    items_table = Table(table_data, colWidths=col_widths_items)
    items_table_style = [
        ("BACKGROUND", (0, 0), (-1, 0), accent_color),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    if size_header_cols is not None:
        items_table_style.append(("SPAN", (size_header_cols[0], 0), (size_header_cols[1], 0)))
    if template == PdfTemplate.CLASSIC:
        items_table_style.append(("BOX", (0, 0), (-1, -1), 1, accent_color))
    items_table.setStyle(TableStyle(items_table_style))
    elements.append(items_table)
    elements.append(Spacer(1, 6 * mm))

    currency = invoice.currency
    if is_proforma:
        total_amount = invoice.subtotal - invoice.discount_total
        totals_rows = [
            (_label("subtotal", language), f"{currency} {invoice.subtotal:.2f}", False),
            (_label("discount", language), f"{currency} {invoice.discount_total:.2f}", False),
            (_label("total_amount", language), f"{currency} {total_amount:.2f}", False),
            (_label("vat_total", language), f"{currency} {invoice.vat_total:.2f}", False),
            (_label("payable_amount", language), f"{currency} {invoice.grand_total:.2f}", True),
        ]
    else:
        totals_rows = [
            (_label("subtotal", language), f"{currency} {invoice.subtotal:.2f}", False),
            (_label("discount", language), f"{currency} {invoice.discount_total:.2f}", False),
            (_label("vat_total", language), f"{currency} {invoice.vat_total:.2f}", False),
            (_label("grand_total", language), f"{currency} {invoice.grand_total:.2f}", True),
        ]
    label_align = "RIGHT" if is_arabic else "LEFT"
    value_align = "LEFT" if is_arabic else "RIGHT"
    totals_data = []
    for lbl, value, is_grand in totals_rows:
        label_cell = _cell(lbl, label_align, bold=is_grand, color=accent_color if is_grand else None)
        value_cell = _cell(value, value_align, bold=is_grand, color=accent_color if is_grand else None)
        totals_data.append([value_cell, label_cell] if is_arabic else [label_cell, value_cell])

    totals_h_align = "LEFT" if is_arabic else "RIGHT"
    totals_table = Table(totals_data, colWidths=[40 * mm, 40 * mm], hAlign=totals_h_align)
    grand_total_row = len(totals_data) - 1
    totals_table.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, grand_total_row), (-1, grand_total_row), 0.75, accent_color),
                ("BACKGROUND", (0, grand_total_row), (-1, grand_total_row), colors.HexColor("#f0fdfa")),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(totals_table)

    if invoice.notes:
        elements.append(Spacer(1, 8 * mm))
        elements.append(Paragraph(_label("notes", language), heading_style))
        elements.append(Paragraph(_rtl(invoice.notes).replace("\n", "<br/>"), normal))

    if invoice.terms:
        elements.append(Spacer(1, 6 * mm))
        elements.append(Paragraph(_label("terms", language), heading_style))
        elements.append(Paragraph(_rtl(invoice.terms).replace("\n", "<br/>"), normal))

    if is_proforma:
        footer_text = _proforma_footer_details(tenant, language)
        if footer_text:
            elements.append(Spacer(1, 8 * mm))
            elements.append(Paragraph(footer_text, normal))

    doc_type_options = tenant.branding_options.get(invoice.type.value, {})
    show_stamp = bool(doc_type_options.get("show_stamp")) and tenant.stamp_url
    show_signature = bool(doc_type_options.get("show_signature")) and tenant.signature_url
    if show_stamp or show_signature:
        signature_cell: list = []
        if show_signature:
            signature_image = _load_signature(tenant.signature_url)
            if signature_image is not None:
                signature_cell.append(signature_image)
            signature_cell.append(Paragraph(_label("authorized_signatory", language), muted_small))

        stamp_cell: list = []
        if show_stamp:
            stamp_image = _load_stamp(tenant.stamp_url)
            if stamp_image is not None:
                stamp_cell.append(stamp_image)

        if signature_cell or stamp_cell:
            branding_row = [stamp_cell, signature_cell] if is_arabic else [signature_cell, stamp_cell]
            branding_table = Table([branding_row], colWidths=[80 * mm, 80 * mm])
            branding_table.setStyle(
                TableStyle(
                    [
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                    ]
                )
            )
            elements.append(Spacer(1, 10 * mm))
            elements.append(branding_table)

    elements.append(Spacer(1, 14 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=4 * mm))
    elements.append(Paragraph(_label("thank_you", language), muted_small))

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


def _load_stamp(stamp_url: str | None) -> Image | None:
    if not stamp_url:
        return None
    try:
        response = httpx.get(stamp_url, timeout=5.0)
        response.raise_for_status()
        image = Image(io.BytesIO(response.content), width=25 * mm, height=25 * mm, kind="proportional")
        return image
    except Exception:
        return None


def _load_signature(signature_url: str | None) -> Image | None:
    if not signature_url:
        return None
    try:
        response = httpx.get(signature_url, timeout=5.0)
        response.raise_for_status()
        image = Image(io.BytesIO(response.content), width=35 * mm, height=18 * mm, kind="proportional")
        return image
    except Exception:
        return None


def _business_details(tenant: Tenant, language) -> str:
    lines = [f"<b>{_rtl(tenant.business_name, bold_font=True)}</b>"]
    if tenant.address:
        lines.append(_rtl(tenant.address))
    if tenant.trn:
        lines.append(f"{_label('trn', language)}: {tenant.trn}")
    return "<br/>".join(lines)


def _invoice_details(invoice: Invoice, language) -> str:
    number = invoice.invoice_number or invoice.draft_number
    lines = [
        f"<b>{_label('invoice_no', language)}:</b> {number}",
        f"<b>{_label('issue_date', language)}:</b> {invoice.issue_date.isoformat()}",
    ]
    if invoice.due_date:
        lines.append(f"<b>{_label('due_date', language)}:</b> {invoice.due_date.isoformat()}")
    if invoice.type == InvoiceType.PROFORMA:
        if invoice.lpo_no:
            lines.append(f"<b>{_label('lpo_no', language)}:</b> {_rtl(invoice.lpo_no)}")
        if invoice.project_villa_no:
            lines.append(f"<b>{_label('villa_no', language)}:</b> {_rtl(invoice.project_villa_no)}")
    lines.append(f"<b>{_label('status', language)}:</b> {_status_label(invoice.status.value, language)}")
    return "<br/>".join(lines)


def _proforma_footer_details(tenant: Tenant, language) -> str | None:
    lines: list[str] = []
    if tenant.cheque_payee_name:
        lines.append(f"{_label('make_cheques_payable', language)}: {_rtl(tenant.cheque_payee_name)}")
    if tenant.bank_name:
        lines.append(f"{_label('bank_name', language)}: {_rtl(tenant.bank_name)}")
    if tenant.bank_account_number:
        lines.append(f"{_label('bank_account', language)}: {tenant.bank_account_number}")
    if tenant.bank_iban:
        lines.append(f"{_label('iban', language)}: {tenant.bank_iban}")
    if tenant.contact_person or tenant.contact_phone:
        contact = ", ".join(
            part for part in (tenant.contact_person and _rtl(tenant.contact_person), tenant.contact_phone) if part
        )
        lines.append(f"{_label('contact', language)}: {contact}")
    if tenant.address:
        lines.append(_rtl(tenant.address))
    if not lines:
        return None
    lines.append(_label("thank_you", language))
    return "<br/>".join(lines)


def _customer_details(customer: Customer, language) -> str:
    lines = [f"<b>{_rtl(customer.name, bold_font=True)}</b>"]
    if customer.billing_address:
        lines.append(_rtl(customer.billing_address))
    if customer.trn:
        lines.append(f"{_label('trn', language)}: {customer.trn}")
    if customer.phone:
        lines.append(customer.phone)
    if customer.email:
        lines.append(customer.email)
    return "<br/>".join(lines)


def _format_decimal(value) -> str:
    normalized = value.normalize()
    return f"{normalized:f}"
