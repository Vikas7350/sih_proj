import secrets
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.security import hash_password, verify_password
from .schemas import OtpPurpose
from .email import send_email, build_otp_email_html

OTP_EXPIRATION_MINUTES = 10
MAX_OTP_ATTEMPTS = 5
RESEND_COOLDOWN_SECONDS = 60

_PURPOSE_ALIASES = {
    OtpPurpose.email_verification: OtpPurpose.register,
    OtpPurpose.password_reset: OtpPurpose.reset_password,
}


def _canonical(purpose: OtpPurpose) -> OtpPurpose:
    return _PURPOSE_ALIASES.get(purpose, purpose)


def generate_otp() -> str:
    return f"{secrets.randbelow(1000000):06d}"


def create_and_send_otp(email: str, purpose: OtpPurpose) -> None:
    db = get_db()
    purpose = _canonical(purpose)
    otp = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRATION_MINUTES)

    db.otps.delete_many({"email": email, "purpose": purpose.value})
    db.otps.insert_one({
        "email": email,
        "otp_hash": hash_password(otp),
        "purpose": purpose.value,
        "expires_at": expires_at,
        "attempts": 0,
        "last_sent_at": datetime.now(timezone.utc),
    })

    send_email(
        to=email,
        subject=(
            "Verify your email address - NetraCare PHC"
            if purpose == OtpPurpose.register
            else "Reset your password - NetraCare PHC"
        ),
        html=build_otp_email_html(otp, purpose.value),
        otp_for_dev_only=otp,
    )


def verify_otp(email: str, code: str, purpose: OtpPurpose) -> bool:
    db = get_db()
    purpose = _canonical(purpose)
    record = db.otps.find_one({"email": email, "purpose": purpose.value})
    if not record:
        return False

    if record["attempts"] + 1 > MAX_OTP_ATTEMPTS:
        db.otps.delete_one({"_id": record["_id"]})
        return False

    now = datetime.now(timezone.utc)
    expires_at = record["expires_at"]
    expired = expires_at.tzinfo is None and now.replace(tzinfo=None) > expires_at or (
        expires_at.tzinfo is not None and now > expires_at
    )

    if expired:
        db.otps.delete_one({"_id": record["_id"]})
        return False

    if verify_password(code, record["otp_hash"]):
        db.otps.delete_one({"_id": record["_id"]})
        return True

    db.otps.update_one({"_id": record["_id"]}, {"$inc": {"attempts": 1}})
    return False