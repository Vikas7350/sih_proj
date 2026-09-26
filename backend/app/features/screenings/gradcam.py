from typing import Optional
from app.services.dr_model_service import generate_gradcam_overlay, predict_dr_image


def generate_gradcam(image_path: str, screening_id: str) -> Optional[str]:
    """Generate PyTorch Grad-CAM overlay using canonical dr_model_service."""
    pred = predict_dr_image(image_path)
    return generate_gradcam_overlay(image_path, screening_id, pred["grade"])
