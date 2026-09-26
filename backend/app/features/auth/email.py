import json
import os
import urllib.request
from email.utils import parseaddr

from fastapi import HTTPException

from app.core.logging import logger

_BUILD = """
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #18181b; margin-bottom: 8px;">{title}</h2>
      <p style="color: #71717a; font-size: 14px; margin-bottom: 24px;">{subtitle}</p>
      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #4f46e5;">{otp}</span>
      </div>
      <p style="color: #a1a1aa; font-size: 12px;">This code is valid for 10 minutes. If you did not request this email, please ignore it.</p>
    </div>
"""


def build_otp_email_html(otp: str, purpose: str) -> str:
    if purpose == "reset_password":
        title, subtitle = "Reset Your Password", "Use the code below to reset your password."
    else:
        title, subtitle = "Verify Your Email", "Use the verification code below to verify your email address."
    return _BUILD.format(title=title, subtitle=subtitle, otp=otp)


def send_email(to: str, subject: str, html: str, otp_for_dev_only: str = "") -> bool:
    """Send an email via the Brevo REST API (HTTPS, no SMTP port needed).

    - When BREVO_API_KEY is configured (v3 API key starting with xkeysib-), sends via Brevo REST API.
    - When Brevo is unconfigured, or an SMTP key (xsmtpsib-) is passed instead of a REST API key,
      or SMTP_DISABLED=1, the OTP is logged to the terminal in development as a dev aid.
    """
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        fallback = os.getenv("EMAIL_SERVER_PASSWORD", "")
        if fallback.startswith("xkeysib-"):
            api_key = fallback

    from_addr = os.getenv("EMAIL_FROM") or "noreply@hackathonstarter.com"
    envelope_from = parseaddr(from_addr)[1] or from_addr

    is_smtp_key = bool(api_key and api_key.startswith("xsmtpsib-"))
    is_valid_api_key = bool(api_key and not is_smtp_key)

    smtp_disabled = os.getenv("SMTP_DISABLED") == "1"

    if smtp_disabled or not is_valid_api_key:
        if is_smtp_key:
            logger.warning(
                "Brevo API key starts with 'xsmtpsib-', which is an SMTP password. "
                "The Brevo REST API requires a v3 API Key starting with 'xkeysib-' (Brevo Dashboard -> API Keys). "
                "Falling back to terminal OTP logging for development."
            )
        else:
            logger.warning("BREVO_API_KEY is not configured. Falling back to terminal OTP logging for development.")

        if os.getenv("NODE_ENV") != "production":
            _log_dev(to, subject, otp_for_dev_only)
            return False
        else:
            raise HTTPException(
                status_code=502,
                detail=(
                    "Brevo API key is missing or invalid (SMTP key 'xsmtpsib-' cannot be used for REST API). "
                    "Please configure BREVO_API_KEY with a v3 API key starting with 'xkeysib-' in backend/.env."
                ),
            )

    body = json.dumps({
        "sender": {"name": parseaddr(from_addr)[0] or "NetraCare", "email": envelope_from},
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
        "textContent": html.replace("<[^>]*>", ""),
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=body,
        headers={
            "Content-Type": "application/json",
            "api-key": api_key,
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if resp.status >= 300:
                raise RuntimeError(f"Brevo API returned HTTP {resp.status}: {resp.read().decode()}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email via Brevo API to {to}: {e}")
        raise HTTPException(
            status_code=502,
            detail=(
                "Failed to send the OTP email. Check backend Brevo settings "
                "(BREVO_API_KEY must be a valid 'xkeysib-...' API key & sender email verified in Brevo)."
            ),
        ) from e


def _log_dev(to: str, subject: str, otp: str) -> None:
    logger.info("=" * 49)
    logger.info(f"[DEV EMAIL FALLBACK - BREVO UNCONFIGURED] To: {to}")
    logger.info(f"[DEV EMAIL FALLBACK - BREVO UNCONFIGURED] Subject: {subject}")
    if otp:
        logger.info(f"[DEV EMAIL FALLBACK - BREVO UNCONFIGURED] OTP CODE: {otp}")
    logger.info("=" * 49)