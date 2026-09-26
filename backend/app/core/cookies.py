"""Session cookie helpers (backend-issued httpOnly JWT, via the SPA origin)."""
from fastapi.responses import JSONResponse, Response

from app.core.config import (
    SESSION_COOKIE_NAME,
    COOKIE_SECURE,
    COOKIE_SAMESITE,
    SESSION_COOKIE_MAX_AGE,
)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_COOKIE_MAX_AGE,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def json_with_cookie(content: dict, token: str) -> JSONResponse:
    res = JSONResponse(content=content)
    set_session_cookie(res, token)
    return res