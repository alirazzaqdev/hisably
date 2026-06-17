"""Email delivery.

Priority:
  1. Resend (RESEND_API_KEY set) — reliable transactional email, free tier.
  2. SMTP (SMTP_HOST + SMTP_USER + SMTP_PASSWORD set) — any SMTP provider.
  3. Dev fallback — logs to stdout so local dev still works without credentials.

In production, if neither Resend nor SMTP is configured a WARNING is logged
every time an email would have been sent, so the gap is visible in Vercel logs.
"""
from __future__ import annotations

import json
import logging
import smtplib
from email.message import EmailMessage
from datetime import date as _date

import httpx

from app.core.config import get_settings

logger = logging.getLogger("hisably.email")

ACCENT = "#0F766E"


# ── HTML templates ────────────────────────────────────────────────────────────

def _base_html(body_html: str) -> str:
    year = _date.today().year
    return f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:12px;overflow:hidden;">
  <tr><td style="background:{ACCENT};padding:24px 32px;">
    <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:.02em;">Hisably</span>
  </td></tr>
  <tr><td style="padding:32px;">{body_html}</td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #E4E4E7;">
    <p style="margin:0;color:#A1A1AA;font-size:12px;">&copy; {year} Hisably. All rights reserved.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""


def _otp_html(code: str, purpose: str) -> str:
    return _base_html(f"""
<p style="margin:0 0 16px;color:#18181B;font-size:16px;line-height:24px;">Use the code below to {purpose}:</p>
<div style="margin:0 0 16px;text-align:center;">
  <span style="display:inline-block;padding:12px 24px;border-radius:8px;background:#F0FDFA;
               color:{ACCENT};font-size:28px;font-weight:700;letter-spacing:.3em;font-family:'Courier New',monospace;">
    {code}
  </span>
</div>
<p style="margin:0;color:#71717A;font-size:14px;line-height:20px;">
  This code expires shortly. If you didn't request this, you can safely ignore this email.
</p>""")


def _quotation_expired_html(number: str, customer: str, due: str) -> str:
    return _base_html(f"""
<p style="margin:0 0 16px;color:#18181B;font-size:16px;line-height:24px;">
  Quotation <strong>{number}</strong> for <strong>{customer}</strong> expired on {due} without a response.
</p>
<p style="margin:0;color:#71717A;font-size:14px;line-height:20px;">
  You can renew it with a new validity date from the Quotations page if the customer is still interested.
</p>""")


def _quotation_expiring_soon_html(number: str, customer: str, due: str) -> str:
    return _base_html(f"""
<p style="margin:0 0 16px;color:#18181B;font-size:16px;line-height:24px;">
  Quotation <strong>{number}</strong> for <strong>{customer}</strong> expires on <strong>{due}</strong>
  — that's in 2 days. Please follow up or it will auto-expire.
</p>
<p style="margin:0;color:#71717A;font-size:14px;line-height:20px;">
  Log in to Hisably to approve, reject, or renew the quotation.
</p>""")


def _invoice_overdue_html(number: str, customer: str, due: str, balance: str, currency: str) -> str:
    return _base_html(f"""
<p style="margin:0 0 16px;color:#18181B;font-size:16px;line-height:24px;">
  <strong>{number}</strong> for <strong>{customer}</strong> was due on {due} and has an outstanding
  balance of <strong>{currency} {balance}</strong>.
</p>
<p style="margin:0;color:#71717A;font-size:14px;line-height:20px;">
  Log in to Hisably to record a payment or follow up with the customer.
</p>""")


# ── Delivery ──────────────────────────────────────────────────────────────────

def _send(to: str, subject: str, html: str, text: str) -> None:
    """Try Resend first, then SMTP, then log."""
    settings = get_settings()

    if settings.resend_api_key:
        _send_resend(settings.resend_api_key, settings.email_from, to, subject, html, text)
        return

    if settings.smtp_host and settings.smtp_user and settings.smtp_password:
        _send_smtp(settings, to, subject, html, text)
        return

    logger.warning(
        "EMAIL NOT SENT — no provider configured (set RESEND_API_KEY or SMTP_HOST/USER/PASSWORD). "
        "To: %s | Subject: %s",
        to, subject,
    )


def _send_resend(api_key: str, from_addr: str, to: str, subject: str, html: str, text: str) -> None:
    payload = json.dumps({"from": from_addr, "to": [to], "subject": subject, "html": html, "text": text})
    resp = httpx.post(
        "https://api.resend.com/emails",
        content=payload.encode(),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        timeout=15,
    )
    if resp.status_code >= 400:
        logger.error("Resend API error %s: %s", resp.status_code, resp.text[:500])
        raise RuntimeError(f"Resend delivery failed ({resp.status_code}): {resp.text[:200]}")
    logger.info("Email sent via Resend to %s | %s", to, subject)


def _send_smtp(settings, to: str, subject: str, html: str, text: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.email_from
    msg["To"] = to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as srv:
        srv.starttls()
        srv.login(settings.smtp_user, settings.smtp_password)
        srv.send_message(msg)
    logger.info("Email sent via SMTP to %s | %s", to, subject)


# ── Public API ────────────────────────────────────────────────────────────────

def send_otp_email(to: str, code: str, purpose: str = "verify your account") -> None:
    _send(
        to=to,
        subject=f"Hisably code: {code}",
        html=_otp_html(code, purpose),
        text=f"Your Hisably verification code is {code}.\nUse it to {purpose}.\nExpires shortly.",
    )


def send_quotation_expired_email(to: str, number: str, customer: str, due: str) -> None:
    _send(
        to=to,
        subject=f"Quotation {number} has expired",
        html=_quotation_expired_html(number, customer, due),
        text=f"Quotation {number} for {customer} expired on {due} without a response.",
    )


def send_quotation_expiring_soon_email(to: str, number: str, customer: str, due: str) -> None:
    _send(
        to=to,
        subject=f"Quotation {number} expires in 2 days",
        html=_quotation_expiring_soon_html(number, customer, due),
        text=f"Quotation {number} for {customer} expires on {due} — please follow up.",
    )


def send_invoice_overdue_email(to: str, number: str, customer: str, due: str, balance: str, currency: str) -> None:
    _send(
        to=to,
        subject=f"Invoice {number} is overdue — {currency} {balance} outstanding",
        html=_invoice_overdue_html(number, customer, due, balance, currency),
        text=f"Invoice {number} for {customer} was due {due}. Outstanding: {currency} {balance}.",
    )
