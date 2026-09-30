import json
import os
import smtplib
import urllib.request
from email.message import EmailMessage
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


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "***"
    parts = email.split("@", 1)
    name, domain = parts[0], parts[1]
    if len(name) <= 2:
        masked_name = name[0] + "*"
    else:
        masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
    return f"{masked_name}@{domain}"


def _send_smtp(to_addr: str, subject: str, html_content: str, host: str, port: int, user: str, password: str, from_addr: str) -> bool:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(html_content.replace("<[^>]*>", ""), subtype="plain")
    msg.add_alternative(html_content, subtype="html")

    logger.info(f"[auth-email] Attempting SMTP connection to {host}:{port} for { _mask_email(to_addr) }")
    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()

        if user and password:
            logger.info(f"[auth-email] Authenticating SMTP user {_mask_email(user)}")
            server.login(user, password)
            logger.info("[auth-email] SMTP authentication successful")

        server.send_message(msg)
        server.quit()
        logger.info(f"[auth-email] Mail send succeeded via SMTP to {_mask_email(to_addr)}")
        return True
    except Exception as e:
        logger.error(f"[auth-email] Mail send failed via SMTP to {_mask_email(to_addr)}: {e}")
        raise HTTPException(
            status_code=502,
            detail=f"Failed to send email via SMTP ({host}:{port}). Check email server configuration."
        ) from e


def send_email(to: str, subject: str, html: str, otp_for_dev_only: str = "") -> bool:
    """Send an email via SMTP (if configured) or Brevo REST API (if BREVO_API_KEY set)."""
    smtp_disabled = os.getenv("SMTP_DISABLED") == "1"

    from_addr = os.getenv("EMAIL_FROM") or "noreply@hackathonstarter.com"
    envelope_from = parseaddr(from_addr)[1] or from_addr

    api_key = os.getenv("BREVO_API_KEY", "")
    smtp_host = os.getenv("EMAIL_SERVER_HOST", "")
    smtp_port_str = os.getenv("EMAIL_SERVER_PORT", "587")
    smtp_user = os.getenv("EMAIL_SERVER_USER", "")
    smtp_pass = os.getenv("EMAIL_SERVER_PASSWORD", "")

    # Fall back to Brevo SMTP if xsmtpsib- password is in BREVO_API_KEY or EMAIL_SERVER_PASSWORD
    if not smtp_pass and api_key.startswith("xsmtpsib-"):
        smtp_pass = api_key
    if not api_key and smtp_pass.startswith("xkeysib-"):
        api_key = smtp_pass

    if not smtp_host and (smtp_pass.startswith("xsmtpsib-") or (smtp_user and smtp_pass)):
        smtp_host = "smtp-relay.brevo.com"

    try:
        smtp_port = int(smtp_port_str)
    except ValueError:
        smtp_port = 587

    is_smtp_configured = bool(smtp_host and smtp_pass)
    is_valid_rest_key = bool(api_key and api_key.startswith("xkeysib-"))

    if not smtp_disabled and is_smtp_configured:
        return _send_smtp(
            to_addr=to,
            subject=subject,
            html_content=html,
            host=smtp_host,
            port=smtp_port,
            user=smtp_user or envelope_from,
            password=smtp_pass,
            from_addr=from_addr,
        )

    if not smtp_disabled and is_valid_rest_key:
        logger.info(f"[auth-email] Attempting Brevo REST API send to {_mask_email(to)}")
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
                    raise RuntimeError(f"Brevo API returned HTTP {resp.status}")
            logger.info(f"[auth-email] Brevo REST API send succeeded to {_mask_email(to)}")
            return True
        except Exception as e:
            logger.error(f"[auth-email] Brevo REST API send failed to {_mask_email(to)}: {e}")
            raise HTTPException(
                status_code=502,
                detail="Failed to send email via Brevo REST API. Check BREVO_API_KEY settings."
            ) from e

    if smtp_disabled:
        logger.warning("[auth-email] SMTP_DISABLED=1. Terminal OTP logging active.")
    else:
        logger.warning("[auth-email] Neither SMTP credentials nor Brevo REST API key (xkeysib-) configured.")

    if os.getenv("NODE_ENV") != "production":
        _log_dev(to, subject, otp_for_dev_only)
        return False
    else:
        raise HTTPException(
            status_code=502,
            detail=(
                "Email delivery service is unconfigured or disabled. "
                "Please configure EMAIL_SERVER_* or BREVO_API_KEY in environment settings."
            ),
        )


def _log_dev(to: str, subject: str, otp: str) -> None:
    logger.info("=" * 49)
    logger.info(f"[DEV EMAIL FALLBACK - BREVO UNCONFIGURED] To: {_mask_email(to)}")
    logger.info(f"[DEV EMAIL FALLBACK - BREVO UNCONFIGURED] Subject: {subject}")
    if otp:
        logger.info(f"[DEV EMAIL FALLBACK - BREVO UNCONFIGURED] OTP CODE: {otp}")
    logger.info("=" * 49)