import re
import secrets
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, field_validator

from .schemas import UserCreate, OtpPurpose, CompleteProfileBody
from app.core.auth import get_current_user
from app.core.cookies import json_with_cookie, clear_session_cookie, set_session_cookie
from app.core.config import FRONTEND_ORIGIN, COOKIE_SECURE
from app.core.logging import logger
from .google import verify_google_id_token, build_google_auth_uri, exchange_code_for_tokens
from . import google as google_identity
from . import service as auth_service

router = APIRouter()

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class _EmailBody(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def _norm_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Please enter a valid email address")
        return v


class OtpBody(_EmailBody):
    purpose: OtpPurpose


class VerifyOtpBody(OtpBody):
    otp: str = Field(pattern=r"^\d{6}$")


class ResendOtpBody(OtpBody):
    pass


class LoginBody(_EmailBody):
    password: str = Field(min_length=1)


class ForgotPasswordBody(_EmailBody):
    pass


class ResetPasswordBody(_EmailBody):
    otp: str = Field(pattern=r"^\d{6}$")
    password: str = Field(min_length=8, max_length=100)


@router.post("/register", status_code=201)
def register_endpoint(data: UserCreate):
    return auth_service.register(data)


@router.post("/verify-otp")
def verify_otp_endpoint(data: VerifyOtpBody):
    return {"message": auth_service.verify_otp(data.email, data.otp, data.purpose)}


@router.post("/resend-otp")
def resend_otp_endpoint(data: ResendOtpBody):
    return {"message": auth_service.resend_otp(data.email, data.purpose)}


@router.post("/login")
def login_endpoint(data: LoginBody):
    result = auth_service.login(data.email, data.password)
    return json_with_cookie(result, result["access_token"])


@router.get("/oauth/google/login")
def google_login_redirect(request: Request, redirect: str = "/dashboard"):
    if not google_identity.GOOGLE_CLIENT_ID or not google_identity.GOOGLE_CLIENT_SECRET:
        raise HTTPException(503, "Google sign-in is not configured.")
    if not redirect.startswith("/") or redirect == "/":
        redirect = "/dashboard"
    # One-time state: nonce in an httpOnly cookie, nonce+landing page in the URL
    # param; the callback requires the nonces to match. Works through the Next.js
    # rewrite and across ports (localhost:3000 -> localhost:8000).
    nonce = secrets.token_urlsafe(16)
    state = f"{nonce}|{redirect}"
    res = RedirectResponse(build_google_auth_uri(state))
    res.set_cookie("oauth_state", nonce, httponly=True, samesite="lax", max_age=600, secure=COOKIE_SECURE)
    return res


@router.get("/oauth/google/callback")
def google_oauth_callback(request: Request, code: str = "", state: str = "", error: str = ""):
    login_error = f"{FRONTEND_ORIGIN}/login?error=google_failed"
    if error:
        return RedirectResponse(f"{FRONTEND_ORIGIN}/login?error=google_denied", status_code=303)
    cookie_state = request.cookies.get("oauth_state")
    sent_nonce = state.split("|")[0] if state else ""
    if not state or not cookie_state or not secrets.compare_digest(sent_nonce, cookie_state):
        raise HTTPException(400, "Invalid Google OAuth state.")
    parts = state.split("|")
    landing = parts[1] if len(parts) > 1 and parts[1].startswith("/") and parts[1] != "/" else "/dashboard"
    if not code:
        return RedirectResponse(login_error, status_code=303)

    try:
        tokens = exchange_code_for_tokens(code)
        claims = verify_google_id_token(tokens["id_token"])
    except (HTTPException, KeyError, TypeError) as e:
        logger.warning(f"google OAuth callback failed: {e!r}")
        return RedirectResponse(login_error, status_code=303)

    result = auth_service.google_login(claims["sub"], claims["email"], claims.get("name") or "")
    path = "/onboarding" if result["user"].get("needs_profile") else landing
    res = RedirectResponse(f"{FRONTEND_ORIGIN}{path}", status_code=303)
    set_session_cookie(res, result["access_token"])
    return res


@router.post("/complete-profile")
def complete_profile_endpoint(data: CompleteProfileBody, user: dict = Depends(get_current_user)):
    result = auth_service.complete_profile(user, data)
    return json_with_cookie(result, result["access_token"])


@router.post("/logout")
def logout_endpoint(user: dict = Depends(get_current_user)):
    res = JSONResponse({"message": "Logged out"})
    clear_session_cookie(res)
    return res


@router.post("/forgot-password")
def forgot_password_endpoint(data: ForgotPasswordBody):
    return {"message": auth_service.forgot_password(data.email)}


@router.post("/reset-password")
def reset_password_endpoint(data: ResetPasswordBody):
    return {"message": auth_service.reset_password(data.email, data.otp, data.password)}


@router.get("/me")
def me_endpoint(user: dict = Depends(get_current_user)):
    return user