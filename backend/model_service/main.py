"""Standalone DR model service. Runs on its OWN Render instance (separate
512Mi budget) so torch + EfficientNet + GradCAM never share memory with the
backend API. Exposes POST /predict — receives image bytes, returns prediction
+ heatmap PNG.

Kept intentionally dependency-light: no MongoDB, no backend auth. It imports
the existing model + gradcam logic from ../app/model/src.
"""
import os
import sys
import traceback
from pathlib import Path

# Thread-pinning BEFORE torch import (single-thread reduces per-process RAM)
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")

BACKEND_DIR = Path(__file__).resolve().parents[1]
MODEL_SRC = BACKEND_DIR / "app" / "model" / "src"
sys.path.insert(0, str(MODEL_SRC))
sys.path.insert(0, str(BACKEND_DIR))

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import numpy as np
from contextlib import asynccontextmanager

# Model + device are loaded ONCE at startup (lifespan), NOT per-request. The
# first /predict would otherwise import torch (192MB) + load the model (203MB)
# + run GradCAM all at once, spiking past the 512Mi free-tier ceiling and being
# OOM-killed. Preloading at startup also fails the deploy loudly if it won't fit.
_model = None
_device = None


class PredictRequest(BaseModel):
    image_b64: str
    screening_id: str = ""


def _load_model():
    global _model, _device
    from app.services.dr_model_service import load_dr_model, get_device
    _device = get_device()
    _model = load_dr_model()
    _warm_up(_model)


def _warm_up(model):
    """Run a dummy forward+backward at startup so torch allocates its thread
    pools and memory graph while the fresh 512Mi instance still has headroom,
    instead of spiking (and OOM-crashing) on the first real request."""
    try:
        import torch
        x = torch.zeros(1, 3, 224, 224).to(_device)
        with torch.no_grad():
            model(x)
        x.requires_grad_()
        out = model(x)
        out.sum().backward()
        del out, x
        import gc
        gc.collect()
    except Exception:
        # Warm-up is best-effort; never block startup on it.
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_model()
    yield


app = FastAPI(title="NetraCare Model Service", lifespan=lifespan)


def get_model():
    return _model, _device


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _model is not None}


@app.post("/predict")
def predict(req: PredictRequest):
    import base64
    import io
    import torch
    from PIL import Image
    from inference import get_transform

    try:
        raw = base64.b64decode(req.image_b64)
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        width, height = image.size
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    model, device = get_model()

    # ---- CNN inference ----
    transform = get_transform()
    input_tensor = transform(image).unsqueeze(0).to(device)
    with torch.no_grad():
        output = model(input_tensor)
    probs = torch.softmax(output, dim=1)
    probs_np = probs[0].cpu().numpy()
    grade = int(np.argmax(probs_np))
    # Free inference temporaries BEFORE GradCAM so the two don't stack in RAM.
    del output, probs, input_tensor

    from app.core.config import GRADE_LABELS
    prediction = {
        "grade": grade,
        "label": GRADE_LABELS[grade],
        "confidence": round(float(probs_np[grade]), 2),
        "probabilities": {
            cls: round(float(p), 2)
            for cls, p in zip(
                ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"],
                probs_np,
            )
        },
    }
    del probs_np

    # ---- GradCAM heatmap ----
    # ponytail: GradCAM needs ~120MB on top of the cached model, right at the
    # 512Mi free-tier ceiling. Preloading the model at startup (lifespan) means
    # the 192MB torch import + 203MB model load happen once, not per request, so
    # each request only sees forward + GradCAM. Set MODEL_SERVICE_GEN_HEATMAP=0
    # to run prediction-only if a specific instance still OOMs.
    gradcam_error = None
    heatmap_b64 = None
    if os.getenv("MODEL_SERVICE_GEN_HEATMAP", "1") == "1":
        import gc
        from gradcam import GradCAM

        try:
            gc_input = transform(image).unsqueeze(0).to(device)
            gc_input.requires_grad_()
            target_layer = model.features[-1][0]

            gc_inst = GradCAM(model=model, target_layer=target_layer)
            try:
                cam = gc_inst.generate(gc_input, grade)
            finally:
                gc_inst.close()
            del gc_input

            # Heatmap as PNG (pure numpy/PIL, no cv2)
            cam_np = cam  # (H,W) float 0-1
            cam_img = Image.fromarray((np.clip(cam_np, 0, 1) * 255).astype(np.uint8)).resize(
                (width, height), Image.BILINEAR
            )
            heat_rgb = _jet(np.array(cam_img))
            orig_np = np.array(image.resize((width, height))).astype(np.float32)
            overlay = np.clip(orig_np * 0.6 + heat_rgb * 255 * 0.4, 0, 255).astype(np.uint8)

            buf = io.BytesIO()
            Image.fromarray(overlay).save(buf, format="PNG")
            heatmap_b64 = base64.b64encode(buf.getvalue()).decode()

            del cam, cam_img, heat_rgb, orig_np, overlay
            gc.collect()
        except Exception as gradcam_exc:
            traceback.print_exc()
            heatmap_b64 = None
            gradcam_error = str(gradcam_exc)

    return {
        "status": "completed",
        "prediction": prediction,
        "explanation": None,
        "heatmap_b64": heatmap_b64,
        "gradcam_error": gradcam_error,
    }


def _jet(gray):
    """Blue->Cyan->Green->Yellow->Red (jet) colormap in RGB, no cv2."""
    v = gray.astype(np.float32) / 255.0
    r = np.clip(1.5 - abs(4 * v - 3), 0, 1)
    g = np.clip(1.5 - abs(4 * v - 2), 0, 1)
    b = np.clip(1.5 - abs(4 * v - 1), 0, 1)
    return np.stack([r, g, b], axis=2)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"error": str(exc)})
