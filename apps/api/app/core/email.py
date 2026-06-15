"""Email delivery abstraction.

Sends OTP emails over SMTP (e.g. Gmail) when SMTP_HOST/SMTP_USER/SMTP_PASSWORD
are configured. Falls back to logging the OTP when SMTP isn't configured, so
local development still works without credentials.
"""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("hisably.email")

ACCENT_COLOR = "#0F766E"


def _otp_email_html(otp_code: str, purpose: str) -> str:
    return f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#F4F4F5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:{ACCENT_COLOR};padding:24px 32px;">
                <span style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:0.02em;">Hisably</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#18181B;font-size:16px;line-height:24px;">
                  Use the code below to {purpose}:
                </p>
                <div style="margin:0 0 16px;text-align:center;">
                  <span style="display:inline-block;padding:12px 24px;border-radius:8px;background:#F0FDFA;color:{ACCENT_COLOR};font-size:28px;font-weight:700;letter-spacing:0.3em;font-family:'Courier New',monospace;">
                    {otp_code}
                  </span>
                </div>
                <p style="margin:0;color:#71717A;font-size:14px;line-height:20px;">
                  This code expires shortly. If you didn't request this, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #E4E4E7;">
                <p style="margin:0;color:#A1A1AA;font-size:12px;">
                  &copy; {{year}} Hisably. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def _quotation_expired_email_html(quotation_number: str, customer_name: str, due_date: str) -> str:
    return f"""\
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#F4F4F5;font-family:Segoe UI,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:480px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:{ACCENT_COLOR};padding:24px 32px;">
                <span style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:0.02em;">Hisably</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#18181B;font-size:16px;line-height:24px;">
                  Quotation <strong>{quotation_number}</strong> for <strong>{customer_name}</strong> expired on
                  {due_date} without a response.
                </p>
                <p style="margin:0;color:#71717A;font-size:14px;line-height:20px;">
                  You can renew it with a new validity date from the Quotations page if the customer is still
                  interested.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px;border-top:1px solid #E4E4E7;">
                <p style="margin:0;color:#A1A1AA;font-size:12px;">
                  &copy; {{year}} Hisably. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def send_quotation_expired_email(to_email: str, quotation_number: str, customer_name: str, due_date: str) -> None:
    settings = get_settings()

    if not (settings.smtp_host and settings.smtp_user and settings.smtp_password):
        logger.info("Quotation expired email to %s: %s (%s) due %s", to_email, quotation_number, customer_name, due_date)
        return

    from datetime import date

    message = EmailMessage()
    message["Subject"] = f"Quotation {quotation_number} expired"
    message["From"] = settings.smtp_from or settings.smtp_user
    message["To"] = to_email
    message.set_content(
        f"Quotation {quotation_number} for {customer_name} expired on {due_date} without a response.\n\n"
        "You can renew it with a new validity date from the Quotations page if the customer is still interested."
    )
    message.add_alternative(
        _quotation_expired_email_html(quotation_number, customer_name, due_date).replace(
            "{year}", str(date.today().year)
        ),
        subtype="html",
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)


def send_otp_email(to_email: str, otp_code: str, purpose: str = "verify your account") -> None:
    settings = get_settings()

    if not (settings.smtp_host and settings.smtp_user and settings.smtp_password):
        logger.info("OTP email to %s (%s): code=%s", to_email, purpose, otp_code)
        return

    from datetime import date

    message = EmailMessage()
    message["Subject"] = f"Hisably code: {otp_code}"
    message["From"] = settings.smtp_from or settings.smtp_user
    message["To"] = to_email
    message.set_content(
        f"Your Hisably verification code is {otp_code}.\n\n"
        f"Use this code to {purpose}. This code expires shortly.\n\n"
        "If you didn't request this, you can ignore this email."
    )
    message.add_alternative(
        _otp_email_html(otp_code, purpose).replace("{year}", str(date.today().year)),
        subtype="html",
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)
