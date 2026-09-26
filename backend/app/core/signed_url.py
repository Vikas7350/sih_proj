import hmac
import hashlib
import time

from app.core.config import AUTH_SECRET

# Signature lifetime in seconds.
# ponytail: long expiry keeps persisted URLs working without re-sign-on-read.
# Shorten (and re-sign on every read) if we must revoke access quickly.
SIG_TTL = 7 * 24 * 3600


def sign_url(kind: str, filename: str) -> str:
    """Return a signed /storage/{kind}/{filename} URL (works in <img> tags)."""
    exp = int(time.time()) + SIG_TTL
    sig = _sig(kind, filename, exp)
    return f"/storage/{kind}/{filename}?exp={exp}&sig={sig}"


def verify_signature(kind: str, filename: str, exp: str, sig: str) -> bool:
    try:
        exp_i = int(exp)
    except (TypeError, ValueError):
        return False
    if exp_i < int(time.time()):
        return False
    return hmac.compare_digest(_sig(kind, filename, exp_i), sig)


def _sig(kind: str, filename: str, exp: int) -> str:
    msg = f"{kind}/{filename}:{exp}".encode()
    return hmac.new(AUTH_SECRET.encode(), msg, hashlib.sha256).hexdigest()[:16]
