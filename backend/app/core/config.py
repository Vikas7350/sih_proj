import os
import sys
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "dr_screening")
_default_cors = os.getenv("CORS_ORIGINS", "http://localhost:3999")
CORS_ORIGINS = [origin.strip() for origin in _default_cors.split(",") if origin.strip()]
MAX_UPLOAD_SIZE_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "10"))
AUTH_SECRET = os.getenv("AUTH_SECRET", "")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", CORS_ORIGINS[0] if CORS_ORIGINS else "http://localhost:3999")
# Route Google's redirect through the Next.js proxy so the session cookie is
# set on the frontend origin (localhost:3999 in dev), not on the backend (:8000).
# Must match the Authorized redirect URI in Google Cloud Console exactly.
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    f"{FRONTEND_ORIGIN}/api/backend/auth/oauth/google/callback",
)

# LLM layer (optional): Gemini via REST. Falls back to a deterministic template
# when no key is set or the API call fails.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("AI_API_KEY") or os.getenv("LLM_API_KEY") or ""
LLM_MODEL = os.getenv("LLM_MODEL", "gemini-3.5-flash")

# Standalone model service (separate Render instance) that runs torch inference.
MODEL_SERVICE_URL = os.getenv("MODEL_SERVICE_URL", "http://localhost:8100").rstrip("/")

# Session cookie (backend-issued httpOnly token, proxied through the SPA origin)
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "dr_token")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "lax")
SESSION_COOKIE_MAX_AGE = int(os.getenv("SESSION_COOKIE_MAX_AGE", str(60 * 60 * 24)))  # 24h

# --- Fail-fast validation ---
_missing = []
if not AUTH_SECRET:
    _missing.append("AUTH_SECRET")
if _missing:
    print(f"FATAL: Required environment variable(s) missing: {', '.join(_missing)}", file=sys.stderr)
    sys.exit(1)

# MATLAB Pipeline Integration
MATLAB_EXECUTABLE = os.getenv("MATLAB_EXECUTABLE", "")
_default_matlab_root = os.path.abspath(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "..", "Matlab")
)
MATLAB_ROOT = os.getenv("MATLAB_ROOT", _default_matlab_root)
# Real fundus inference (loadModel + predictDR + Grad-CAM + retinal evidence)
# measures ~90-150s in `matlab -batch`; an 180s budget left <50% headroom and
# produced spurious 504s on this machine. 300s keeps safety without flakiness.
MATLAB_TIMEOUT_SECONDS = int(os.getenv("MATLAB_TIMEOUT_SECONDS", "300"))

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage", "uploads")
HEATMAP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage", "heatmaps")
RETINAL_EVIDENCE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage", "retinal_evidence")
RETINAL_EVIDENCE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "storage", "retinal_evidence")

GRADE_LABELS = {
    0: "No DR",
    1: "Mild DR",
    2: "Moderate DR",
    3: "Severe DR",
    4: "Proliferative DR",
}

GRADE_DESCRIPTIONS = {
    0: "No observable signs of diabetic retinopathy in this fundus image.",
    1: "Mild non-proliferative diabetic retinopathy with microaneurysms.",
    2: "Presence of microaneurysms and early retinal dot hemorrhages.",
    3: "Multiple intraretinal hemorrhages and cotton wool spots detected.",
    4: "Advanced proliferative diabetic retinopathy with neovascularization.",
}
