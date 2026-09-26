"""Server-side Google sign-in (OAuth authorization-code flow, no browser lib).

The frontend redirects the browser to Google; Google bounces the user back to
our redirect_uri with a one-time authorization code. This module exchanges the
code for tokens and verifies the id_token's signature against Google's JWKS
plus the audience (our GOOGLE_CLIENT_ID). Works with third-party cookies and
FedCM fully blocked, and is the path Google supports now that GSI is deprecated.
"""
import json
import time
import urllib.request
from urllib.parse import urlencode

from fastapi import HTTPException
from jose import jwt, jwk

from app.core.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
)
from app.core.logging import logger

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"

# ponytail: single-flight-ish in-process cache; Google keys rotate rarely.
_jwks_cache: dict = {}
_jwks_cached_at: float = 0.0
_JWKS_TTL_SECONDS = 3600


def _fetch_jwks() -> dict:
    global _jwks_cache, _jwks_cached_at
    if _jwks_cache and time.time() - _jwks_cached_at < _JWKS_TTL_SECONDS:
        return _jwks_cache
    with urllib.request.urlopen(GOOGLE_JWKS_URL, timeout=10) as resp:
        _jwks_cache = json.loads(resp.read().decode("utf-8"))
    _jwks_cached_at = time.time()
    return _jwks_cache


def build_google_auth_uri(state: str) -> str:
    """URL to send the browser to for the Google consent/pick-account screen."""
    params = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "prompt": "select_account",
        "state": state,
    })
    return f"{GOOGLE_AUTH_URL}?{params}"


def exchange_code_for_tokens(code: str) -> dict:
    """One-time authorization code -> {id_token, access_token, ...}."""
    body = urlencode({
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }).encode("utf-8")
    req = urllib.request.Request(GOOGLE_TOKEN_URL, data=body)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        raise HTTPException(400, "Google sign-in failed: could not exchange authorization code.")


def verify_google_id_token(id_token: str) -> dict:
    """Verify an id_token and return its claims (sub, email, email_verified, name)."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google sign-in is not configured (GOOGLE_CLIENT_ID missing).")

    try:
        unverified = jwt.get_unverified_claims(id_token)
        unverified_header = jwt.get_unverified_header(id_token)
        kid = unverified_header.get("kid")
        key = _find_key(kid, unverified_header.get("alg", "RS256"))
        if key is None:
            raise HTTPException(400, "Google sign-in failed: unknown signing key.")

        claims = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=GOOGLE_CLIENT_ID,
            options={"verify_at_hash": False},
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Google sign-in failed: invalid token ({e!r}).")

    if claims.get("iss") != "https://accounts.google.com":
        raise HTTPException(400, "Google sign-in failed: unexpected token issuer.")
    if not claims.get("sub") or not claims.get("email") or not claims.get("email_verified", False):
        raise HTTPException(400, "Google sign-in failed: token is missing required claims.")
    return claims


def _find_key(kid, alg):
    if alg != "RS256" or not kid:
        return None
    keys = _fetch_jwks().get("keys", [])
    for k in keys:
        if k.get("kid") == kid:
            return jwk.construct(k)
    return None