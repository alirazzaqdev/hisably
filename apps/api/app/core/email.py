"""Email delivery abstraction.

Phase 1 has no SMTP/email provider configured, so this prints to the server
log. Swap the body of these functions for a real provider (SES, Postmark,
Resend, ...) without touching call sites — and the auth module is structured
so a second OTP channel (WhatsApp/SMS) can be added the same way later.
"""

import logging

logger = logging.getLogger("hisably.email")


def send_otp_email(to_email: str, otp_code: str, purpose: str = "verify your account") -> None:
    logger.info("OTP email to %s (%s): code=%s", to_email, purpose, otp_code)
