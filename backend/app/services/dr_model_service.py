"""Canonical Production PyTorch DR Model Service.

Loads the 5-class EfficientNet-B0 trained model (best_model.pth) once into memory on CPU
and handles DR grade prediction and PyTorch Grad-CAM heatmap generation.
"""

import os
import sys
import gc
from functools import lru_cache
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
import numpy as np
from PIL import Image

from app.core.config import GRADE_LABELS, GRADE_DESCRIPTIONS, HEATMAP_DIR
from app.core.signed_url import sign_url
from app.core.logging import logger

# Paths to model_new sources and checkpoint
MODEL_NEW_DIR = Path(__file__).resolve().parents[3] / "model_new"
MODEL_SRC_DIR = MODEL_NEW_DIR / "src"
NVIDIA_CONVNETS_DIR = (
    MODEL_NEW_DIR / "DeepLearningExamples" / "PyTorch" / "Classification" / "ConvNets"
)
CHECKPOINT_PATH = MODEL_NEW_DIR / "checkpoints" / "best_model.pth"

# Ensure model_new packages are importable
for path_str in [str(MODEL_SRC_DIR), str(NVIDIA_CONVNETS_DIR)]:
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

import torch
from torchvision import transforms

# Set single-threaded execution for CPU safety
torch.set_num_threads(1)


def get_device() -> torch.device:
    """Returns CPU device as mandated for this deployment."""
    return torch.device("cpu")


def get_transform() -> transforms.Compose:
    """Returns standard ImageNet preprocessing transform (224x224)."""
    return transforms.Compose(
        [
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225],
            ),
        ]
    )


@lru_cache(maxsize=1)
def load_dr_model():
    """Load the trained 5-class EfficientNet-B0 model once and keep in memory on CPU."""
    if not CHECKPOINT_PATH.exists():
        raise FileNotFoundError(f"DR model checkpoint not found at: {CHECKPOINT_PATH}")

    from model import create_model

    logger.info(f"Loading PyTorch DR model from {CHECKPOINT_PATH}")
    model = create_model()
    device = get_device()
    model = model.to(device)
    model.eval()
    logger.info("Trained PyTorch DR Model loaded successfully and cached.")
    return model


def predict_dr_image(image_input: Any) -> Dict[str, Any]:
    """Execute forward pass of EfficientNet-B0 on a PIL Image or image file path.

    Returns:
        Dict with grade (0-4), label, raw confidence (uncalibrated softmax),
        and per-class probabilities.
    """
    if isinstance(image_input, (str, Path)):
        if not os.path.exists(image_input):
            raise FileNotFoundError(f"Image file not found: {image_input}")
        image = Image.open(image_input).convert("RGB")
    elif isinstance(image_input, Image.Image):
        image = image_input.convert("RGB")
    else:
        raise ValueError("Invalid image input type. Expected file path or PIL Image.")

    model = load_dr_model()
    device = get_device()
    transform = get_transform()

    input_tensor = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        output = model(input_tensor)
        probabilities = torch.softmax(output, dim=1)[0].cpu().numpy()

    predicted_class = int(np.argmax(probabilities))
    raw_confidence = float(probabilities[predicted_class])

    prob_dict = {}
    for idx, class_name in enumerate(
        ["No DR", "Mild DR", "Moderate DR", "Severe DR", "Proliferative DR"]
    ):
        prob_dict[class_name] = float(probabilities[idx])

    return {
        "grade": predicted_class,
        "label": GRADE_LABELS.get(predicted_class, f"Grade {predicted_class}"),
        "description": GRADE_DESCRIPTIONS.get(predicted_class, "Consult specialist."),
        "confidence": round(raw_confidence, 4),
        "calibrated_confidence": None,  # Explicitly uncalibrated softmax
        "probabilities": {k: round(v, 4) for k, v in prob_dict.items()},
    }


def generate_gradcam_overlay(
    image_input: Any, screening_id: str, target_grade: int
) -> Optional[str]:
    """Generate PyTorch Grad-CAM overlay image and save to backend storage.

    Returns:
        Signed URL to the generated heatmap image, or None if failed.
    """
    try:
        from gradcam import GradCAM, create_heatmap, create_overlay

        if isinstance(image_input, (str, Path)):
            image = Image.open(image_input).convert("RGB")
        elif isinstance(image_input, Image.Image):
            image = image_input.convert("RGB")
        else:
            return None

        width, height = image.size
        model = load_dr_model()
        device = get_device()
        transform = get_transform()

        input_tensor = transform(image).unsqueeze(0).to(device)
        input_tensor.requires_grad_()

        # Target layer: features.conv
        target_layer = model.features.conv
        gradcam = GradCAM(model=model, target_layer=target_layer)

        try:
            cam = gradcam.generate(input_tensor, target_grade)
        finally:
            gradcam.close()

        heatmap = create_heatmap(cam, width, height)
        overlay = create_overlay(image, heatmap, alpha=0.35)

        os.makedirs(HEATMAP_DIR, exist_ok=True)
        target_filename = f"{screening_id}.png"
        target_path = os.path.join(HEATMAP_DIR, target_filename)

        Image.fromarray(overlay).save(target_path)
        signed_url = sign_url("heatmaps", target_filename)

        # Free memory
        del cam, heatmap, overlay, image, input_tensor
        gc.collect()

        return signed_url
    except Exception as exc:
        logger.error(f"PyTorch Grad-CAM generation failed for {screening_id}: {exc}")
        return None


def run_full_dr_inference(image_abs_path: str, screening_id: str) -> Dict[str, Any]:
    """Complete PyTorch DR inference + Grad-CAM generation.

    Args:
        image_abs_path: Path to the image (original or Stage 2 enhanced).
        screening_id: Screening ID for Grad-CAM naming.

    Returns:
        Dict with prediction and explanation (heatmap_url).
    """
    prediction = predict_dr_image(image_abs_path)
    heatmap_url = generate_gradcam_overlay(
        image_abs_path, screening_id, prediction["grade"]
    )

    explanation = {"heatmap_url": heatmap_url} if heatmap_url else None
    return {
        "prediction": prediction,
        "explanation": explanation,
    }
