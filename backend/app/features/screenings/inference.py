from typing import Dict
from app.services.dr_model_service import predict_dr_image, load_dr_model, get_device


def get_model():
    """Returns the cached canonical PyTorch model instance."""
    return load_dr_model()


def clear_model():
    """No-op for compatibility; model is managed by dr_model_service."""
    pass


def run_inference(image_path: str) -> Dict:
    """Run PyTorch DR inference on image path."""
    return predict_dr_image(image_path)
