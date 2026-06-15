import io
from datetime import date as date_type

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.account import Account
from app.models.tenant import Tenant
from app.schemas.account import AccountStatementEntry


def render_account_statement_pdf(
    tenant: Tenant,
    account: Account,
    opening_balance,
    entries: list[AccountStatementEntry],
    closing_balance,
    date_from: date_type | None,
    date_to: date_type | None,
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=18 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title=f"{account.name} statement",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "StatementTitle",
        parent=styles["Title"],
        fontSize=20,
        textColor=colors.HexColor("#0f172a"),
    )
    heading_style = ParagraphStyle(
        "StatementHeading",
        parent=styles["Heading3"],
        textColor=colors.HexColor("#0f766e"),
    )
    normal = styles["Normal"]
    right = ParagraphStyle("Right", parent=normal, alignment=TA_RIGHT)

    elements: list = []
    elements.append(Paragraph(tenant.business_name, title_style))
    elements.append(Paragraph(f"Account statement &mdash; {account.name}", heading_style))

    if date_from or date_to:
        period = f"{date_from.isoformat() if date_from else 'Start'} to {date_to.isoformat() if date_to else 'Today'}"
        elements.append(Paragraph(f"Period: {period}", normal))

    elements.append(Spacer(1, 8 * mm))

    table_data = [["Date", "Description", f"In ({tenant.currency})", f"Out ({tenant.currency})", f"Balance ({tenant.currency})"]]
    table_data.append(["", "Opening balance", "", "", f"{opening_balance:.2f}"])
    for entry in entries:
        table_data.append(
            [
                entry.date.isoformat(),
                entry.description,
                f"{entry.amount_in:.2f}" if entry.amount_in else "",
                f"{entry.amount_out:.2f}" if entry.amount_out else "",
                f"{entry.balance:.2f}",
            ]
        )
    table_data.append(["", "Closing balance", "", "", f"{closing_balance:.2f}"])

    table = Table(table_data, colWidths=[24 * mm, 70 * mm, 28 * mm, 28 * mm, 30 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("LINEBELOW", (0, 1), (-1, 1), 0.5, colors.HexColor("#cbd5e1")),
                ("LINEABOVE", (0, -1), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ROWBACKGROUNDS", (0, 2), (-1, -2), [colors.white, colors.HexColor("#f8fafc")]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    elements.append(table)

    doc.build(elements)
    return buffer.getvalue()
