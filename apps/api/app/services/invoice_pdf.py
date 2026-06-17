import base64
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
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image as PILImage
from reportlab.platypus import HRFlowable, Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.models.enums import InvoiceType, PdfTemplate
from app.models.invoice import Invoice
from app.models.party import Customer
from app.models.tenant import Tenant
from app.repositories.invoices import effective_quotation_status

DEFAULT_ACCENT_COLORS = {
    PdfTemplate.MINIMAL: "#0f766e",
    PdfTemplate.CLASSIC: "#1e3a5f",
    PdfTemplate.BOLD: "#b91c1c",
}

# Languages that use right-to-left script layout
_RTL_LANGUAGES: frozenset[str] = frozenset({"ar", "ur", "he"})

LABELS: dict[str, dict[str, str]] = {
    "bill_to": {
        "en": "Bill To", "ar": "إلى", "ur": "وصول کنندہ",
        "de": "Rechnungsempfänger", "fr": "Facturer à", "es": "Facturar a",
        "it": "Intestatario", "pt": "Faturar a", "nl": "Factuuradres",
        "tr": "Fatura adresi", "pl": "Nabywca", "sv": "Faktureras till",
        "da": "Faktureres til", "no": "Faktureres til",
    },
    "ship_to": {
        "en": "Ship To", "ar": "الشحن إلى", "ur": "شپنگ ایڈریس",
        "de": "Lieferadresse", "fr": "Livrer à", "es": "Dirección de envío",
        "it": "Indirizzo consegna", "pt": "Endereço de entrega", "nl": "Verzendadres",
        "tr": "Teslimat adresi", "pl": "Adres dostawy", "sv": "Leveransadress",
    },
    "description": {
        "en": "Description", "ar": "الوصف", "ur": "تفصیل",
        "de": "Beschreibung", "fr": "Description", "es": "Descripción",
        "it": "Descrizione", "pt": "Descrição", "nl": "Omschrijving",
        "tr": "Açıklama", "pl": "Opis", "sv": "Beskrivning",
        "da": "Beskrivelse", "no": "Beskrivelse", "fi": "Kuvaus",
    },
    "qty": {
        "en": "Qty", "ar": "الكمية", "ur": "مقدار",
        "de": "Menge", "fr": "Qté", "es": "Cant.",
        "it": "Qtà", "pt": "Qtd.", "nl": "Aantal",
        "tr": "Miktar", "pl": "Ilość", "sv": "Antal",
        "da": "Antal", "no": "Antall", "fi": "Määrä",
    },
    "size_lm": {"en": "Size / LM", "ar": "القياس"},
    "unit_price": {
        "en": "Unit price", "ar": "سعر الوحدة", "ur": "یونٹ قیمت",
        "de": "Stückpreis", "fr": "Prix unitaire", "es": "Precio unitario",
        "it": "Prezzo unitario", "pt": "Preço unitário", "nl": "Eenheidsprijs",
        "tr": "Birim fiyat", "pl": "Cena jedn.", "sv": "Enhetspris",
        "da": "Enhedspris", "no": "Enhetspris", "fi": "Yksikköhinta",
    },
    "vat": {
        "en": "VAT", "ar": "ضريبة", "ur": "سیلز ٹیکس",
        "de": "MwSt.", "fr": "TVA", "es": "IVA",
        "it": "IVA", "pt": "IVA", "nl": "BTW",
        "tr": "KDV", "pl": "VAT", "sv": "Moms",
        "da": "Moms", "no": "Mva", "fi": "ALV",
        "el": "ΦΠΑ",
    },
    "total": {
        "en": "Total", "ar": "الإجمالي", "ur": "کل",
        "de": "Gesamt", "fr": "Total", "es": "Total",
        "it": "Totale", "pt": "Total", "nl": "Totaal",
        "tr": "Toplam", "pl": "Razem", "sv": "Totalt",
        "da": "I alt", "no": "Totalt", "fi": "Yhteensä",
    },
    "final_payment": {"en": "Advance / Final Payment", "ar": "دفعة مقدمة / نهائية"},
    "rate": {
        "en": "Rate", "ar": "السعر",
        "de": "Preis", "fr": "Prix", "es": "Precio",
        "it": "Prezzo", "pt": "Preço",
    },
    "subtotal": {
        "en": "Subtotal", "ar": "المجموع الفرعي", "ur": "ذیلی کل",
        "de": "Zwischensumme", "fr": "Sous-total", "es": "Subtotal",
        "it": "Subtotale", "pt": "Subtotal", "nl": "Subtotaal",
        "tr": "Ara toplam", "pl": "Suma cz.", "sv": "Delsumma",
        "da": "Subtotal", "no": "Delsum", "fi": "Välisumma",
    },
    "discount": {
        "en": "Discount", "ar": "الخصم", "ur": "چھوٹ",
        "de": "Rabatt", "fr": "Remise", "es": "Descuento",
        "it": "Sconto", "pt": "Desconto", "nl": "Korting",
        "tr": "İndirim", "pl": "Rabat", "sv": "Rabatt",
        "da": "Rabat", "no": "Rabatt", "fi": "Alennus",
    },
    "vat_total": {
        "en": "VAT total", "ar": "إجمالي الضريبة", "ur": "کل ٹیکس",
        "de": "MwSt. gesamt", "fr": "Total TVA", "es": "Total IVA",
        "it": "Totale IVA", "pt": "Total IVA", "nl": "Totaal BTW",
        "tr": "Toplam KDV", "pl": "Łączny VAT", "sv": "Total moms",
        "da": "Moms i alt", "no": "Mva totalt", "fi": "ALV yhteensä",
    },
    "grand_total": {
        "en": "Grand total", "ar": "الإجمالي الكلي", "ur": "کل رقم",
        "de": "Gesamtbetrag", "fr": "Total général", "es": "Total general",
        "it": "Totale generale", "pt": "Total geral", "nl": "Eindtotaal",
        "tr": "Genel toplam", "pl": "Łączna suma", "sv": "Totalsumma",
        "da": "I alt", "no": "Totalbeløp", "fi": "Loppusumma",
    },
    "total_amount": {
        "en": "Total Amount", "ar": "المبلغ الإجمالي",
        "de": "Gesamtbetrag", "fr": "Montant total", "es": "Importe total",
    },
    "payable_amount": {
        "en": "Payable Amount", "ar": "المبلغ المستحق",
        "de": "Zu zahlender Betrag", "fr": "Montant à payer", "es": "Importe a pagar",
    },
    "notes": {
        "en": "Notes", "ar": "ملاحظات", "ur": "نوٹس",
        "de": "Anmerkungen", "fr": "Notes", "es": "Notas",
        "it": "Note", "pt": "Notas", "nl": "Opmerkingen",
        "tr": "Notlar", "pl": "Uwagi", "sv": "Anteckningar",
        "da": "Bemærkninger", "no": "Merknader", "fi": "Huomiot",
    },
    "terms": {
        "en": "Terms & Conditions", "ar": "الشروط والأحكام", "ur": "شرائط",
        "de": "Allgemeine Geschäftsbedingungen", "fr": "Conditions générales",
        "es": "Términos y condiciones", "it": "Termini e condizioni",
        "pt": "Termos e condições", "nl": "Algemene voorwaarden",
        "tr": "Şartlar ve koşullar", "pl": "Warunki", "sv": "Villkor",
        "da": "Vilkår", "no": "Vilkår", "fi": "Ehdot",
    },
    "site_image": {
        "en": "Site image", "ar": "صورة الموقع",
        "de": "Standortbild", "fr": "Image du site", "es": "Imagen del sitio",
    },
    "site_image_before": {
        "en": "Before", "ar": "قبل",
        "de": "Vorher", "fr": "Avant", "es": "Antes",
        "it": "Prima", "pt": "Antes", "nl": "Voor",
        "tr": "Önce", "pl": "Przed", "sv": "Före",
    },
    "site_image_after": {
        "en": "After", "ar": "بعد",
        "de": "Nachher", "fr": "Après", "es": "Después",
        "it": "Dopo", "pt": "Depois", "nl": "Na",
        "tr": "Sonra", "pl": "Po", "sv": "Efter",
    },
    "email": {
        "en": "Email", "ar": "البريد الإلكتروني",
        "de": "E-Mail", "fr": "E-mail", "es": "Correo electrónico",
        "it": "E-mail", "pt": "E-mail", "nl": "E-mail",
        "tr": "E-posta", "pl": "E-mail", "sv": "E-post",
    },
    "phone": {
        "en": "Phone", "ar": "الهاتف",
        "de": "Telefon", "fr": "Téléphone", "es": "Teléfono",
        "it": "Telefono", "pt": "Telefone", "nl": "Telefoon",
        "tr": "Telefon", "pl": "Telefon", "sv": "Telefon",
    },
    "tax_invoice": {
        "en": "Tax Invoice", "ar": "فاتورة ضريبية", "ur": "ٹیکس انوائس",
        "de": "Steuerrechnung", "fr": "Facture de taxe", "es": "Factura fiscal",
        "it": "Fattura fiscale", "pt": "Fatura fiscal", "nl": "Belastingfactuur",
        "tr": "Vergi faturası", "pl": "Faktura VAT", "sv": "Skattefaktura",
        "da": "Skattefaktura", "no": "Skattefaktura", "fi": "Verolasku",
        "el": "Φορολογικό τιμολόγιο",
    },
    "invoice": {
        "en": "Invoice", "ar": "فاتورة", "ur": "انوائس",
        "de": "Rechnung", "fr": "Facture", "es": "Factura",
        "it": "Fattura", "pt": "Fatura", "nl": "Factuur",
        "tr": "Fatura", "pl": "Faktura", "sv": "Faktura",
        "da": "Faktura", "no": "Faktura", "fi": "Lasku",
        "el": "Τιμολόγιο",
    },
    "proforma_invoice": {
        "en": "Proforma Invoice", "ar": "فاتورة مبدئية", "ur": "پرو فارمہ انوائس",
        "de": "Proforma-Rechnung", "fr": "Facture pro forma", "es": "Factura pro forma",
        "it": "Fattura pro forma", "pt": "Fatura pro forma", "nl": "Pro-formafactuur",
        "tr": "Proforma fatura", "pl": "Faktura pro forma", "sv": "Proformafaktura",
    },
    "quotation": {
        "en": "Quotation", "ar": "عرض سعر", "ur": "کوٹیشن",
        "de": "Angebot", "fr": "Devis", "es": "Presupuesto",
        "it": "Preventivo", "pt": "Orçamento", "nl": "Offerte",
        "tr": "Teklif", "pl": "Oferta", "sv": "Offert",
        "da": "Tilbud", "no": "Tilbud", "fi": "Tarjous",
        "el": "Προσφορά",
    },
    "invoice_no": {
        "en": "Invoice #", "ar": "رقم الفاتورة", "ur": "انوائس #",
        "de": "Rechnung #", "fr": "Facture #", "es": "Factura #",
        "it": "Fattura #", "pt": "Fatura #", "nl": "Factuur #",
        "tr": "Fatura #", "pl": "Faktura #", "sv": "Faktura #",
        "da": "Faktura #", "no": "Faktura #", "fi": "Lasku #",
    },
    "quotation_no": {
        "en": "Quotation #", "ar": "رقم عرض السعر", "ur": "کوٹیشن #",
        "de": "Angebot #", "fr": "Devis #", "es": "Presupuesto #",
        "it": "Preventivo #", "pt": "Orçamento #", "nl": "Offerte #",
        "tr": "Teklif #", "pl": "Oferta #", "sv": "Offert #",
        "da": "Tilbud #", "no": "Tilbud #", "fi": "Tarjous #",
    },
    "issue_date": {
        "en": "Issue date", "ar": "تاريخ الإصدار", "ur": "جاری تاریخ",
        "de": "Ausstellungsdatum", "fr": "Date d'émission", "es": "Fecha de emisión",
        "it": "Data di emissione", "pt": "Data de emissão", "nl": "Factuurdatum",
        "tr": "Düzenleme tarihi", "pl": "Data wystawienia", "sv": "Utfärdningsdatum",
        "da": "Udstedelsesdato", "no": "Utstedelsesdato", "fi": "Päiväys",
    },
    "due_date": {
        "en": "Due date", "ar": "تاريخ الاستحقاق", "ur": "واجب الادا تاریخ",
        "de": "Fälligkeitsdatum", "fr": "Date d'échéance", "es": "Fecha de vencimiento",
        "it": "Data di scadenza", "pt": "Data de vencimento", "nl": "Vervaldatum",
        "tr": "Vade tarihi", "pl": "Termin płatności", "sv": "Förfallodatum",
        "da": "Forfaldsdato", "no": "Forfallsdato", "fi": "Eräpäivä",
    },
    "valid_until": {
        "en": "Valid until", "ar": "صالح حتى", "ur": "تک درست",
        "de": "Gültig bis", "fr": "Valable jusqu'au", "es": "Válido hasta",
        "it": "Valido fino al", "pt": "Válido até", "nl": "Geldig tot",
        "tr": "Geçerlilik tarihi", "pl": "Ważna do", "sv": "Giltig till",
        "da": "Gyldig til", "no": "Gyldig til", "fi": "Voimassa asti",
    },
    "status": {
        "en": "Status", "ar": "الحالة", "ur": "حیثیت",
        "de": "Status", "fr": "Statut", "es": "Estado",
        "it": "Stato", "pt": "Estado", "nl": "Status",
        "tr": "Durum", "pl": "Status", "sv": "Status",
        "da": "Status", "no": "Status", "fi": "Tila",
    },
    "thank_you": {
        "en": "Thank you for your business.", "ar": "شكراً لتعاملكم معنا.", "ur": "آپ کے اعتماد کا شکریہ۔",
        "de": "Vielen Dank für Ihr Vertrauen.", "fr": "Merci pour votre confiance.",
        "es": "Gracias por su confianza.", "it": "Grazie per la vostra fiducia.",
        "pt": "Obrigado pela sua confiança.", "nl": "Bedankt voor uw vertrouwen.",
        "tr": "Güveniniz için teşekkürler.", "pl": "Dziękujemy za zaufanie.",
        "sv": "Tack för ditt förtroende.", "da": "Tak for din tillid.",
        "no": "Takk for din tillit.", "fi": "Kiitos luottamuksestanne.",
        "el": "Ευχαριστούμε για την εμπιστοσύνη σας.",
    },
    "trn": {"en": "TRN", "ar": "الرقم الضريبي"},
    "lpo_no": {
        "en": "LPO #", "ar": "رقم أمر الشراء",
        "de": "Bestellnr.", "fr": "Bon de commande #",
    },
    "villa_no": {"en": "Villa / Project No", "ar": "رقم الفيلا / المشروع"},
    "make_cheques_payable": {"en": "Make all cheques payable to", "ar": "يتم سداد جميع الشيكات لـ"},
    "bank_name": {
        "en": "Bank Name", "ar": "اسم البنك",
        "de": "Bankname", "fr": "Nom de la banque", "es": "Nombre del banco",
    },
    "bank_account": {
        "en": "Account Number", "ar": "رقم الحساب",
        "de": "Kontonummer", "fr": "Numéro de compte", "es": "Número de cuenta",
    },
    "iban": {"en": "IBAN", "ar": "آيبان"},
    "contact": {
        "en": "Contact", "ar": "التواصل",
        "de": "Kontakt", "fr": "Contact", "es": "Contacto",
    },
    "authorized_signatory": {
        "en": "Authorized Signatory", "ar": "التوقيع المعتمد",
        "de": "Bevollmächtigte", "fr": "Signataire autorisé", "es": "Firmante autorizado",
    },
}

STATUS_LABELS: dict[str, dict[str, str]] = {
    "draft": {"en": "Draft", "ar": "مسودة", "de": "Entwurf", "fr": "Brouillon"},
    "sent": {"en": "Sent", "ar": "مرسلة", "de": "Gesendet", "fr": "Envoyée"},
    "partially_paid": {"en": "Partially Paid", "ar": "مدفوعة جزئياً", "de": "Teilweise bezahlt", "fr": "Partiellement payée"},
    "paid": {"en": "Paid", "ar": "مدفوعة", "de": "Bezahlt", "fr": "Payée"},
    "overdue": {"en": "Overdue", "ar": "متأخرة", "de": "Überfällig", "fr": "En retard"},
    "void": {"en": "Void", "ar": "ملغاة", "de": "Storniert", "fr": "Annulée"},
    "pending": {"en": "Pending", "ar": "قيد الانتظار", "de": "Ausstehend", "fr": "En attente"},
    "approved": {"en": "Approved", "ar": "معتمد", "de": "Genehmigt", "fr": "Approuvé"},
    "rejected": {"en": "Rejected", "ar": "مرفوض", "de": "Abgelehnt", "fr": "Rejeté"},
    "expired": {"en": "Expired", "ar": "منتهي الصلاحية", "de": "Abgelaufen", "fr": "Expiré"},
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


def _lang_str(language) -> str:
    return language.value if hasattr(language, "value") else str(language)


def _is_rtl(language) -> bool:
    return _lang_str(language) in _RTL_LANGUAGES


def _get_label_text(key: str, lang: str) -> str:
    entry = LABELS.get(key, {})
    return entry.get(lang) or entry.get("en", key)


def _label(key: str, language, language_secondary=None) -> str:
    lang = _lang_str(language)

    # Legacy: old "bilingual" invoices stored en+ar combined
    if lang == "bilingual":
        en = _get_label_text(key, "en")
        ar = _get_label_text(key, "ar")
        return _rtl(f"{en} / {ar}")

    primary = _get_label_text(key, lang)

    if language_secondary and language_secondary != lang:
        secondary = _get_label_text(key, language_secondary)
        if secondary and secondary != primary:
            needs_rtl = lang in _RTL_LANGUAGES or language_secondary in _RTL_LANGUAGES
            combined = f"{primary} / {secondary}"
            return _rtl(combined) if needs_rtl else combined

    return _rtl(primary) if lang in _RTL_LANGUAGES else primary


def _status_label(status_value: str, language, language_secondary=None) -> str:
    lang = _lang_str(language)
    entry = STATUS_LABELS.get(status_value, {})
    fallback = status_value.replace("_", " ").title()
    primary = entry.get(lang) or entry.get("en", fallback)

    if lang == "bilingual":
        en = entry.get("en", fallback)
        ar = entry.get("ar", fallback)
        return _rtl(f"{en} / {ar}")

    if language_secondary and language_secondary != lang:
        secondary = entry.get(language_secondary) or entry.get("en", fallback)
        if secondary and secondary != primary:
            needs_rtl = lang in _RTL_LANGUAGES or language_secondary in _RTL_LANGUAGES
            combined = f"{primary} / {secondary}"
            return _rtl(combined) if needs_rtl else combined

    return _rtl(primary) if lang in _RTL_LANGUAGES else primary


def _line_description(line, language, language_secondary=None) -> str:
    lang = _lang_str(language)
    primary = line.description or ""
    secondary_ar = getattr(line, "description_ar", None)

    # Legacy bilingual
    if lang == "bilingual":
        if secondary_ar:
            return f"{_xml_escape(primary)}<br/>{_rtl(secondary_ar)}"
        return _xml_escape(primary)

    is_primary_rtl = lang in _RTL_LANGUAGES
    if is_primary_rtl:
        return _rtl(secondary_ar or primary)

    primary_text = _xml_escape(primary)
    if language_secondary and language_secondary in _RTL_LANGUAGES and secondary_ar:
        return f"{primary_text}<br/>{_rtl(secondary_ar)}"
    return primary_text


def render_invoice_pdf(invoice: Invoice, tenant: Tenant, customer: Customer | None) -> bytes:
    _register_fonts()

    template = invoice.pdf_template
    accent_color = colors.HexColor(invoice.accent_color or DEFAULT_ACCENT_COLORS.get(template, "#0f766e"))
    language = invoice.language
    language_secondary = getattr(invoice, "language_secondary", None) or None
    is_arabic = _is_rtl(language)
    is_proforma = invoice.type == InvoiceType.PROFORMA
    is_quotation = invoice.type == InvoiceType.QUOTATION
    is_tax_invoice = invoice.type == InvoiceType.TAX_INVOICE

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
    site_label_style = ParagraphStyle(
        "SiteLabel",
        parent=normal,
        fontSize=10,
        fontName=bold_font,
        textColor=colors.HexColor("#0f172a"),
        alignment=TA_CENTER,
    )

    if is_quotation:
        label = _label("quotation", language, language_secondary)
    elif is_proforma:
        label = _label("proforma_invoice", language, language_secondary)
    elif tenant.vat_registered:
        label = _label("tax_invoice", language, language_secondary)
    else:
        label = _label("invoice", language, language_secondary)
    if not is_quotation and invoice.status.value == "void":
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
    business_info_cell = Paragraph(_business_details(tenant, language, language_secondary), detail_normal if not is_arabic else detail_right)
    invoice_info_cell = Paragraph(_invoice_details(invoice, language, language_secondary), detail_right if not is_arabic else detail_normal)

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
            _customer_details(customer, language, language_secondary) if customer is not None else None
        )
        if bill_to_text:
            elements.append(Paragraph(_label("bill_to", language, language_secondary), heading_style))
            elements.append(Paragraph(bill_to_text, normal))
            elements.append(Spacer(1, 4 * mm))
        if invoice.ship_to_address and invoice.ship_to_address != invoice.bill_to_address:
            elements.append(Paragraph(_label("ship_to", language, language_secondary), heading_style))
            elements.append(Paragraph(_rtl(invoice.ship_to_address).replace("\n", "<br/>"), normal))
            elements.append(Spacer(1, 4 * mm))
        elements.append(Spacer(1, 4 * mm))
    elif customer is not None:
        elements.append(Paragraph(_label("bill_to", language, language_secondary), heading_style))
        elements.append(Paragraph(_customer_details(customer, language, language_secondary), normal))
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
            (_label("description", language, language_secondary), "LEFT"),
            (_label("qty", language, language_secondary), "RIGHT"),
            (_label("final_payment", language, language_secondary), "RIGHT"),
            (_label("rate", language, language_secondary), "RIGHT"),
            (_label("total", language, language_secondary), "RIGHT"),
        ]
        col_widths_items = [10 * mm, 78 * mm, 20 * mm, 24 * mm, 18 * mm, 20 * mm]

        body_rows_raw = []
        for idx, line in enumerate(line_items, start=1):
            final_payment = line.final_payment_factor if line.final_payment_factor is not None else Decimal(1)
            body_rows_raw.append(
                [
                    (str(idx), "CENTER"),
                    (_line_description(line, language, language_secondary), "LEFT"),
                    (_format_decimal(line.quantity), "RIGHT"),
                    (_format_decimal(final_payment), "RIGHT"),
                    (f"{line.unit_price:.2f}", "RIGHT"),
                    (f"{line.line_total:.2f}", "RIGHT"),
                ]
            )
    else:
        headers = [
            ("#", "CENTER"),
            (_label("description", language, language_secondary), "LEFT"),
            (_label("size_lm", language, language_secondary), "CENTER"),
            ("", "CENTER"),
            (_label("qty", language, language_secondary), "RIGHT"),
            (_label("unit_price", language, language_secondary), "RIGHT"),
            (_label("vat", language, language_secondary), "RIGHT"),
            (_label("total", language, language_secondary), "RIGHT"),
        ]
        col_widths_items = [10 * mm, 64 * mm, 12 * mm, 12 * mm, 16 * mm, 22 * mm, 12 * mm, 22 * mm]
        size_header_cols = (2, 3)

        body_rows_raw = []
        for idx, line in enumerate(line_items, start=1):
            line_unit = getattr(line, "unit", None) or "pcs"
            if line.width_mm is not None and line.height_mm is not None:
                size_cols = (_format_decimal(line.width_mm), _format_decimal(line.height_mm))
                qty_display = _format_decimal(line.quantity)
            elif line.length_mm is not None:
                size_cols = (_format_decimal(line.length_mm), "")
                qty_display = _format_decimal(line.quantity)
            elif line_unit in ("kg", "hour"):
                size_cols = ("", "")
                suffix = "kg" if line_unit == "kg" else "hr"
                qty_display = f"{_format_decimal(line.quantity)} {suffix}"
            else:
                size_cols = ("", "")
                qty_display = _format_decimal(line.quantity)
            body_rows_raw.append(
                [
                    (str(idx), "CENTER"),
                    (_line_description(line, language, language_secondary), "LEFT"),
                    (size_cols[0], "CENTER"),
                    (size_cols[1], "CENTER"),
                    (qty_display, "RIGHT"),
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
            (_label("subtotal", language, language_secondary), f"{currency} {invoice.subtotal:.2f}", False),
            (_label("discount", language, language_secondary), f"{currency} {invoice.discount_total:.2f}", False),
            (_label("total_amount", language, language_secondary), f"{currency} {total_amount:.2f}", False),
            (_label("vat_total", language, language_secondary), f"{currency} {invoice.vat_total:.2f}", False),
            (_label("payable_amount", language, language_secondary), f"{currency} {invoice.grand_total:.2f}", True),
        ]
    else:
        totals_rows = [
            (_label("subtotal", language, language_secondary), f"{currency} {invoice.subtotal:.2f}", False),
            (_label("discount", language, language_secondary), f"{currency} {invoice.discount_total:.2f}", False),
            (_label("vat_total", language, language_secondary), f"{currency} {invoice.vat_total:.2f}", False),
            (_label("grand_total", language, language_secondary), f"{currency} {invoice.grand_total:.2f}", True),
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
        elements.append(Paragraph(_label("notes", language, language_secondary), heading_style))
        elements.append(Paragraph(_rtl(invoice.notes).replace("\n", "<br/>"), normal))

    if invoice.terms:
        elements.append(Spacer(1, 6 * mm))
        elements.append(Paragraph(_label("terms", language, language_secondary), heading_style))
        elements.append(Paragraph(_rtl(invoice.terms).replace("\n", "<br/>"), normal))

    if is_proforma:
        before_image = _load_site_image(invoice.site_image_url)
        after_image = _load_site_image(invoice.site_image_after_url)
        if before_image is not None or after_image is not None:
            site_section: list = [
                Spacer(1, 6 * mm),
                Paragraph(_label("site_image", language, language_secondary), heading_style),
            ]
            before_cell = [Paragraph(_label("site_image_before", language, language_secondary), site_label_style), Spacer(1, 2 * mm), before_image] if before_image else []
            after_cell = [Paragraph(_label("site_image_after", language, language_secondary), site_label_style), Spacer(1, 2 * mm), after_image] if after_image else []
            if before_cell and after_cell:
                images_row = [after_cell, before_cell] if is_arabic else [before_cell, after_cell]
                images_table = Table([images_row], colWidths=[85 * mm, 85 * mm])
                images_table.setStyle(
                    TableStyle([
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                    ])
                )
                site_section.append(images_table)
            elif before_cell:
                site_section.extend(before_cell)
            elif after_cell:
                site_section.extend(after_cell)
            elements.append(KeepTogether(site_section))
    else:
        site_image = _load_site_image(invoice.site_image_url)
        if site_image is not None:
            elements.append(Spacer(1, 6 * mm))
            elements.append(Paragraph(_label("site_image", language, language_secondary), heading_style))
            elements.append(site_image)

    if is_tax_invoice:
        footer_text = _bank_details_footer(tenant, language, language_secondary)
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
            signature_cell.append(Paragraph(_label("authorized_signatory", language, language_secondary), muted_small))

        stamp_cell: list = []
        if show_stamp:
            stamp_image = _load_stamp(tenant.stamp_url)
            if stamp_image is not None:
                stamp_cell.append(stamp_image)

        if signature_cell or stamp_cell:
            # Stamp sits centered, signature (with caption) sits at the bottom-right.
            branding_row = [[], stamp_cell, signature_cell]
            branding_table = Table([branding_row], colWidths=[53 * mm, 54 * mm, 53 * mm])
            branding_table.setStyle(
                TableStyle(
                    [
                        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
                        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                    ]
                )
            )
            elements.append(Spacer(1, 10 * mm))
            elements.append(branding_table)

    if is_proforma or is_tax_invoice:
        contact_footer = _contact_footer(tenant, language, language_secondary)
        if contact_footer:
            elements.append(Spacer(1, 6 * mm))
            elements.append(Paragraph(contact_footer, muted_small))

    elements.append(Spacer(1, 14 * mm))
    elements.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e2e8f0"), spaceAfter=4 * mm))
    elements.append(Paragraph(_label("thank_you", language, language_secondary), muted_small))

    on_page = _watermark_drawer(tenant)
    if on_page is not None:
        doc.build(elements, onFirstPage=on_page, onLaterPages=on_page)
    else:
        doc.build(elements)
    return buffer.getvalue()


def _load_image_bytes(url: str) -> bytes | None:
    if url.startswith("data:"):
        try:
            _, encoded = url.split(",", 1)
            return base64.b64decode(encoded)
        except Exception:
            return None
    try:
        response = httpx.get(url, timeout=5.0)
        response.raise_for_status()
        return response.content
    except Exception:
        return None


def _load_logo(logo_url: str | None) -> Image | None:
    if not logo_url:
        return None
    data = _load_image_bytes(logo_url)
    if data is None:
        return None
    try:
        return Image(io.BytesIO(data), width=25 * mm, height=25 * mm, kind="proportional")
    except Exception:
        return None


def _watermark_drawer(tenant: Tenant):
    if not tenant.logo_url:
        return None
    data = _load_image_bytes(tenant.logo_url)
    if data is None:
        return None

    def draw(canvas, doc) -> None:
        try:
            reader = ImageReader(io.BytesIO(data))
            img_width, img_height = reader.getSize()
            size = 100 * mm
            ratio = min(size / img_width, size / img_height)
            width, height = img_width * ratio, img_height * ratio
            page_width, page_height = A4
            x = (page_width - width) / 2
            y = (page_height - height) / 2
            canvas.saveState()
            canvas.setFillAlpha(0.06)
            canvas.drawImage(reader, x, y, width=width, height=height, mask="auto", preserveAspectRatio=True)
            canvas.restoreState()
        except Exception:
            pass

    return draw


def _load_stamp(stamp_url: str | None) -> Image | None:
    if not stamp_url:
        return None
    data = _load_image_bytes(stamp_url)
    if data is None:
        return None
    try:
        return Image(io.BytesIO(data), width=25 * mm, height=25 * mm, kind="proportional")
    except Exception:
        return None


def _load_signature(signature_url: str | None) -> Image | None:
    if not signature_url:
        return None
    data = _load_image_bytes(signature_url)
    if data is None:
        return None
    try:
        return Image(io.BytesIO(data), width=35 * mm, height=18 * mm, kind="proportional")
    except Exception:
        return None


_SITE_IMAGE_MAX_W = 80 * mm
_SITE_IMAGE_MAX_H = 80 * mm


def _load_site_image(site_image_url: str | None) -> Image | None:
    if not site_image_url:
        return None
    data = _load_image_bytes(site_image_url)
    if data is None:
        return None
    try:
        pil_img = PILImage.open(io.BytesIO(data))
        if pil_img.mode not in ("RGB", "L"):
            pil_img = pil_img.convert("RGB")
        img_w, img_h = pil_img.size
        scale = min(_SITE_IMAGE_MAX_W / img_w, _SITE_IMAGE_MAX_H / img_h)
        draw_w = img_w * scale
        draw_h = img_h * scale
        out_buf = io.BytesIO()
        pil_img.save(out_buf, format="JPEG", quality=85)
        out_buf.seek(0)
        return Image(out_buf, width=draw_w, height=draw_h)
    except Exception:
        return None


def _business_details(tenant: Tenant, language, language_secondary=None) -> str:
    lines = [f"<b>{_rtl(tenant.business_name, bold_font=True)}</b>"]
    if tenant.address:
        lines.append(_rtl(tenant.address))
    if tenant.trn:
        lines.append(f"{_label('trn', language, language_secondary)}: {tenant.trn}")
    return "<br/>".join(lines)


def _invoice_details(invoice: Invoice, language, language_secondary=None) -> str:
    number = invoice.invoice_number or invoice.draft_number
    is_quotation = invoice.type == InvoiceType.QUOTATION
    number_label = "quotation_no" if is_quotation else "invoice_no"
    lines = [
        f"<b>{_label(number_label, language, language_secondary)}:</b> {number}",
        f"<b>{_label('issue_date', language, language_secondary)}:</b> {invoice.issue_date.isoformat()}",
    ]
    if invoice.due_date:
        due_label = "valid_until" if is_quotation else "due_date"
        lines.append(f"<b>{_label(due_label, language, language_secondary)}:</b> {invoice.due_date.isoformat()}")
    if invoice.type == InvoiceType.PROFORMA:
        if invoice.lpo_no:
            lines.append(f"<b>{_label('lpo_no', language, language_secondary)}:</b> {_rtl(invoice.lpo_no)}")
        if invoice.project_villa_no:
            lines.append(f"<b>{_label('villa_no', language, language_secondary)}:</b> {_rtl(invoice.project_villa_no)}")
    if is_quotation:
        status_value = effective_quotation_status(invoice)
        status_label_value = status_value.value if status_value else "draft"
    else:
        status_label_value = invoice.status.value
    lines.append(f"<b>{_label('status', language, language_secondary)}:</b> {_status_label(status_label_value, language, language_secondary)}")
    return "<br/>".join(lines)


def _bank_details_footer(tenant: Tenant, language, language_secondary=None) -> str | None:
    lines: list[str] = []
    if tenant.cheque_payee_name:
        lines.append(f"{_label('make_cheques_payable', language, language_secondary)}: {_rtl(tenant.cheque_payee_name)}")
    if tenant.bank_name:
        lines.append(f"{_label('bank_name', language, language_secondary)}: {_rtl(tenant.bank_name)}")
    if tenant.bank_account_number:
        lines.append(f"{_label('bank_account', language, language_secondary)}: {tenant.bank_account_number}")
    if tenant.bank_iban:
        lines.append(f"{_label('iban', language, language_secondary)}: {tenant.bank_iban}")
    if tenant.contact_person or tenant.contact_phone:
        contact = ", ".join(
            part for part in (tenant.contact_person and _rtl(tenant.contact_person), tenant.contact_phone) if part
        )
        lines.append(f"{_label('contact', language, language_secondary)}: {contact}")
    if tenant.address:
        lines.append(_rtl(tenant.address))
    if not lines:
        return None
    lines.append(_label("thank_you", language, language_secondary))
    return "<br/>".join(lines)


def _contact_footer(tenant: Tenant, language, language_secondary=None) -> str | None:
    parts: list[str] = []
    if tenant.business_name:
        parts.append(f"<b>{_rtl(tenant.business_name, bold_font=True)}</b>")
    contact_bits: list[str] = []
    if tenant.contact_email:
        contact_bits.append(f"{_label('email', language, language_secondary)}: {tenant.contact_email}")
    if tenant.contact_phone:
        contact_bits.append(f"{_label('phone', language, language_secondary)}: {tenant.contact_phone}")
    if contact_bits:
        parts.append(" | ".join(contact_bits))
    if not parts:
        return None
    return "<br/>".join(parts)


def _customer_details(customer: Customer, language, language_secondary=None) -> str:
    value = language.value if hasattr(language, "value") else language
    name_ar = getattr(customer, "name_ar", None)
    is_rtl_primary = value in _RTL_LANGUAGES
    if is_rtl_primary and name_ar:
        lines = [f"<b>{_rtl(name_ar, bold_font=True)}</b>"]
    elif value == "bilingual" and name_ar:
        lines = [f"<b>{_rtl(customer.name, bold_font=True)}</b>", f"<b>{_rtl(name_ar, bold_font=True)}</b>"]
    elif language_secondary in _RTL_LANGUAGES and name_ar:
        lines = [f"<b>{_rtl(customer.name, bold_font=True)}</b>", f"<b>{_rtl(name_ar, bold_font=True)}</b>"]
    else:
        lines = [f"<b>{_rtl(customer.name, bold_font=True)}</b>"]
    if customer.billing_address:
        lines.append(_rtl(customer.billing_address))
    if customer.trn:
        lines.append(f"{_label('trn', language, language_secondary)}: {customer.trn}")
    if customer.phone:
        lines.append(customer.phone)
    if customer.email:
        lines.append(customer.email)
    return "<br/>".join(lines)


def _format_decimal(value) -> str:
    normalized = value.normalize()
    return f"{normalized:f}"
