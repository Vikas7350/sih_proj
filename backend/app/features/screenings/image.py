import os
import io
import base64
from PIL import Image
from app.core.config import UPLOAD_DIR, HEATMAP_DIR
from app.core.signed_url import sign_url


def generate_safe_filename(screening_id: str, original_filename: str) -> str:
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png"]:
        ext = ".jpg"
    return f"{screening_id}{ext}"


def save_image(file_bytes: bytes, filename: str) -> str:
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(file_bytes)
    return filepath


def get_image_url(filename: str) -> str:
    return sign_url("uploads", filename)


def validate_image(file_bytes: bytes, content_type: str) -> bool:
    if content_type not in ["image/jpeg", "image/jpg", "image/png"]:
        return False
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img.verify()
        return True
    except Exception:
        return False


def save_heatmap(heatmap_b64: str, screening_id: str) -> str:
    """Save a base64 heatmap PNG returned by the model service and return its
    signed URL."""
    if not heatmap_b64:
        return None
    raw = base64.b64decode(heatmap_b64)
    os.makedirs(HEATMAP_DIR, exist_ok=True)
    filename = f"{screening_id}.png"
    with open(os.path.join(HEATMAP_DIR, filename), "wb") as f:
        f.write(raw)
    return sign_url("heatmaps", filename)