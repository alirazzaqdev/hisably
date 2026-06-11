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


def send_otp_email(to_email: str, otp_code: str, purpose: str = "verify your account") -> None:
    settings = get_settings()

    if not (settings.smtp_host and settings.smtp_user and settings.smtp_password):
        logger.info("OTP email to %s (%s): code=%s", to_email, purpose, otp_code)
        return

    message = EmailMessage()
    message["Subject"] = f"Hisably code: {otp_code}"
    message["From"] = settings.smtp_from or settings.smtp_user
    message["To"] = to_email
    message.set_content(
        f"Your Hisably verification code is {otp_code}.\n\n"
        f"Use this code to {purpose}. This code expires shortly.\n\n"
        "If you didn't request this, you can ignore this email."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as server:
        server.starttls()
        server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(message)
