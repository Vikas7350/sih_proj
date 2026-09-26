import os
import time
from pathlib import Path
from contextlib import asynccontextmanager

# ponytail: Render free tier has a 512Mi RAM cap; torch/OpenMP/MKL thread
# pools default to (#cores) threads and can push inference OOM. Pin single
# thread BEFORE torch gets imported by the feature routers below so native
# libs allocate the smaller pool. Revisit if switching to a paid instance.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse

from app.core.config import CORS_ORIGINS, UPLOAD_DIR, HEATMAP_DIR, RETINAL_EVIDENCE_DIR
from app.core.database import connect_db, close_db, get_db
from app.core.logging import logger
from app.core.rate_limiter import general_limiter
from app.core.signed_url import verify_signature
from app.core.auth import get_current_user, security
from app.features import patients, screenings, phc, reports, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    connect_db()
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(HEATMAP_DIR, exist_ok=True)
    os.makedirs(RETINAL_EVIDENCE_DIR, exist_ok=True)
    logger.info("DR Screening API started")
    yield
    close_db()
    logger.info("DR Screening API stopped")


app = FastAPI(title="NetraCare DR Screening API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.middleware("http")
async def rate_limit_and_log(request: Request, call_next):
    if request.url.path.startswith("/api/"):
        try:
            general_limiter.check(request)
        except HTTPException as e:
            # HTTPException raised in a middleware bypasses FastAPI's exception
            # handlers (they only wrap the router), so render the 429 here
            # instead of letting the global handler turn it into a 500.
            logger.warning(f"Rate limited {request.client.host if request.client else 'unknown'}: {e.detail}")
            return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    start = time.time()
    response = await call_next(request)
    elapsed = round((time.time() - start) * 1000, 1)
    logger.info(f"{request.method} {request.url.path} -> {response.status_code} ({elapsed}ms)")
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {request.method} {request.url.path} - {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}},
    )


app.include_router(patients.router, prefix="/api/patients", tags=["patients"])
app.include_router(screenings.router, prefix="/api/screenings", tags=["screenings"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(phc.router, prefix="/api/phc", tags=["phc"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])


# ponytail: file reads are auth-gated but not owner-scoped (any PHI an
# authenticated role can read is readable by any of them). Upstream:
# scope access per screening owner.
def _serve_storage(base_dir: str, filename: str):
    root = Path(base_dir).resolve()
    target = (root / filename).resolve()
    if not target.is_relative_to(root) or not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(target)


async def _require_storage_access(
    kind: str, filename: str, request: Request, exp: str = "", sig: str = ""
):
    if verify_signature(kind, filename, exp, sig):
        return
    try:
        creds = await security(request)
        get_current_user(request, creds)
    except HTTPException:
        raise HTTPException(
            status_code=401,
            detail={"code": "FORBIDDEN", "message": "Missing or invalid signed URL or token"},
        )


@app.get("/storage/uploads/{filename}")
async def get_upload(
    filename: str, request: Request, exp: str = "", sig: str = ""
):
    await _require_storage_access("uploads", filename, request, exp, sig)
    return _serve_storage(UPLOAD_DIR, filename)


@app.get("/storage/heatmaps/{filename}")
async def get_heatmap(
    filename: str, request: Request, exp: str = "", sig: str = ""
):
    await _require_storage_access("heatmaps", filename, request, exp, sig)
    return _serve_storage(HEATMAP_DIR, filename)


@app.get("/storage/retinal_evidence/{filename}")
async def get_retinal_evidence(
    filename: str, request: Request, exp: str = "", sig: str = ""
):
    await _require_storage_access("retinal_evidence", filename, request, exp, sig)
    return _serve_storage(RETINAL_EVIDENCE_DIR, filename)


@app.get("/health")
def health_check():
    db_ok = False
    try:
        get_db().command("ping")
        db_ok = True
    except Exception:
        pass
    status = "ok" if db_ok else "degraded"
    return {"status": status, "db": "connected" if db_ok else "unavailable"}


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("app.main:app", host=host, port=port, reload=False)
