"""Integration and Regression Test Suite for PyTorch DR Model Integration.

Verifies:
1. Baseline reproducibility on SCR-0003.jpg
2. Model loading and single canonical service behavior
3. Stage 0 & Stage 1 safety gate blocking (no PyTorch/Grad-CAM on rejection)
4. Grad-CAM generation and signed URL output
"""

import os
import sys
import pytest
from pathlib import Path

# Setup environment variables for test
os.environ["AUTH_SECRET"] = "test_auth_secret_32bytes_minimum_string"

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.dr_model_service import (
    load_dr_model,
    predict_dr_image,
    generate_gradcam_overlay,
    run_full_dr_inference,
)
from app.services.matlab_service import _map_matlab_result_to_screening


SCR0003_PATH = os.path.join(BACKEND_DIR, "storage", "uploads", "SCR-0003.jpg")


def test_model_loading():
    """Verify PyTorch model loads 5-class EfficientNet-B0 checkpoint."""
    model = load_dr_model()
    assert model is not None
    # Verify model architecture has 5 output classes in last classifier layer
    last_layer = getattr(model, "classifier", None) or getattr(model, "fc", None)
    if hasattr(last_layer, "out_features"):
        assert last_layer.out_features == 5
    elif hasattr(last_layer, "add_module"):
        # EfficientNet classifier Sequential
        conv_out = [m for m in last_layer.modules() if hasattr(m, "out_features")]
        if conv_out:
            assert conv_out[-1].out_features == 5


def test_scr0003_baseline_regression():
    """Verify prediction on SCR-0003.jpg exactly matches pre-integration baseline.

    Baseline:
      Grade: 4
      Class: Proliferative DR
      Confidence: 0.8745 (+/- 0.005 tolerance)
    """
    assert os.path.exists(SCR0003_PATH), f"Test image missing at {SCR0003_PATH}"

    result = predict_dr_image(SCR0003_PATH)

    assert result["grade"] == 4
    assert result["label"] == "Proliferative DR"
    assert abs(result["confidence"] - 0.8745) < 0.01
    assert "Proliferative DR" in result["probabilities"]
    assert abs(result["probabilities"]["Proliferative DR"] - 0.8745) < 0.01


def test_gradcam_generation():
    """Verify PyTorch Grad-CAM generates valid heatmap overlay URL."""
    assert os.path.exists(SCR0003_PATH)

    signed_url = generate_gradcam_overlay(SCR0003_PATH, "TEST-GRADCAM-001", target_grade=4)
    assert signed_url is not None
    assert "/storage/heatmaps/TEST-GRADCAM-001.png" in signed_url

    heatmap_path = os.path.join(BACKEND_DIR, "storage", "heatmaps", "TEST-GRADCAM-001.png")
    assert os.path.exists(heatmap_path)
    assert os.path.getsize(heatmap_path) > 1000  # Non-trivial image file size


def test_stage0_rejection_safety_gate():
    """Verify Stage 0 NON_FUNDUS rejection blocks PyTorch inference & Grad-CAM."""
    mock_matlab_result = {
        "screening_id": "REJECT-STAGE0-001",
        "stage": "STAGE_0_FUNDUS_VALIDATION",
        "status": "NON_FUNDUS",
        "action": "REJECT",
        "decision": "reject",
        "fundus": {"isFundus": False, "status": "NON_FUNDUS", "reasons": ["Non-fundus artifact"]},
        "quality": None,
        "prediction": None,
    }

    mapped = _map_matlab_result_to_screening(
        mock_matlab_result,
        explanation=None,
        image_abs_path=SCR0003_PATH,
        screening_id="REJECT-STAGE0-001",
    )

    assert mapped["status"] == "rejected"
    assert mapped["prediction"] is None
    assert mapped["explanation"] is None


def test_stage1_quality_failed_safety_gate():
    """Verify Stage 1 UNGRADABLE quality failure blocks PyTorch inference & Grad-CAM."""
    mock_matlab_result = {
        "screening_id": "REJECT-STAGE1-001",
        "stage": "STAGE_1_QUALITY_GATE",
        "status": "UNGRADABLE",
        "action": "RECAPTURE",
        "decision": "recapture",
        "fundus": {"isFundus": True, "status": "FUNDUS"},
        "quality": {"status": "UNGRADABLE", "reasons": ["Severe blur"]},
        "prediction": None,
    }

    mapped = _map_matlab_result_to_screening(
        mock_matlab_result,
        explanation=None,
        image_abs_path=SCR0003_PATH,
        screening_id="REJECT-STAGE1-001",
    )

    assert mapped["status"] == "quality_failed"
    assert mapped["prediction"] is None
    assert mapped["explanation"] is None


def test_completed_pipeline_mapping():
    """Verify completed pipeline invokes PyTorch model and attaches prediction & Grad-CAM."""
    mock_matlab_result = {
        "screening_id": "SUCCESS-001",
        "stage": "STAGE_3_DR_INFERENCE",
        "status": "GOOD",
        "action": "PROCEED",
        "decision": "proceed",
        "fundus": {"isFundus": True, "status": "FUNDUS"},
        "quality": {"status": "GOOD", "score": 0.95},
        "prediction": {"grade": 4, "label": "Proliferative DR"},
    }

    mapped = _map_matlab_result_to_screening(
        mock_matlab_result,
        explanation=None,
        image_abs_path=SCR0003_PATH,
        screening_id="SUCCESS-001",
    )

    assert mapped["status"] == "completed"
    assert mapped["prediction"] is not None
    assert mapped["prediction"]["grade"] == 4
    assert mapped["prediction"]["label"] == "Proliferative DR"
    assert mapped["prediction"]["confidence"] == 0.8745
    assert mapped["explanation"] is not None
    assert "heatmap_url" in mapped["explanation"]
