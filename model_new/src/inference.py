import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torchvision import transforms

from model import create_model
from image_quality import assess_image_quality
from clinical_explanation import (
    add_gradcam_evidence,
    build_clinical_explanation,
)
from llm_explanation import generate_llm_explanation


# ============================================================
# Configuration
# ============================================================

CHECKPOINT_PATH = (
    Path(__file__).resolve().parents[1]
    / "checkpoints"
    / "best_model.pth"
)

OUTPUT_DIR = Path(
    "results/inference"
)

CLASS_NAMES = [
    "No DR",
    "Mild DR",
    "Moderate DR",
    "Severe DR",
    "Proliferative DR",
]

IMAGE_SIZE = 224


# ============================================================
# Device
# ============================================================

def get_device():

    if torch.cuda.is_available():

        device = torch.device("cuda")

        print(
            "Device:",
            device
        )

        print(
            "GPU:",
            torch.cuda.get_device_name(0)
        )

    else:

        device = torch.device("cpu")

        print(
            "Device: CPU"
        )

    return device


# ============================================================
# Image preprocessing
# ============================================================

def get_transform():

    return transforms.Compose(
        [
            transforms.Resize(
                (IMAGE_SIZE, IMAGE_SIZE)
            ),

            transforms.ToTensor(),

            transforms.Normalize(
                mean=[
                    0.485,
                    0.456,
                    0.406,
                ],
                std=[
                    0.229,
                    0.224,
                    0.225,
                ],
            ),
        ]
    )


# ============================================================
# Load trained model
# ============================================================

def load_model(device):

    if not CHECKPOINT_PATH.exists():

        raise FileNotFoundError(
            f"Checkpoint not found:\n"
            f"{CHECKPOINT_PATH}"
        )

    print()
    print(
        "Loading model:",
        CHECKPOINT_PATH
    )

    model = create_model()

    checkpoint = torch.load(
        CHECKPOINT_PATH,
        map_location="cpu",
    )

    # Your training code stores the model
    # state dictionary inside model_state_dict.
    if "model_state_dict" in checkpoint:

        model.load_state_dict(
            checkpoint[
                "model_state_dict"
            ]
        )

        print(
            "Checkpoint epoch:",
            checkpoint.get("epoch")
        )

        print(
            "Best Macro F1:",
            checkpoint.get(
                "best_macro_f1"
            )
        )

    else:

        # Also support a plain state_dict.
        model.load_state_dict(
            checkpoint
        )

    model = model.to(device)

    model.eval()

    print(
        "Model loaded successfully."
    )

    return model


# ============================================================
# DR prediction
# ============================================================

def predict_dr(
    model,
    image,
    device,
):

    transform = get_transform()

    input_tensor = transform(
        image
    )

    input_tensor = (
        input_tensor
        .unsqueeze(0)
        .to(device)
    )

    with torch.no_grad():

        output = model(
            input_tensor
        )

        probabilities = (
            torch.softmax(
                output,
                dim=1,
            )
        )

    probabilities_np = (
        probabilities[
            0
        ]
        .cpu()
        .numpy()
    )

    predicted_class = int(
        np.argmax(
            probabilities_np
        )
    )

    confidence = float(
        probabilities_np[
            predicted_class
        ]
    )

    probability_dict = {}

    for index, class_name in enumerate(
        CLASS_NAMES
    ):

        probability_dict[
            class_name
        ] = float(
            probabilities_np[
                index
            ]
        )

    return {
        "grade": predicted_class,
        "class": CLASS_NAMES[
            predicted_class
        ],
        "confidence": confidence,
        "probabilities": probability_dict,
        "clinical_explanation": build_clinical_explanation(
            predicted_class=predicted_class,
            probabilities=probabilities_np.tolist(),
            class_names=CLASS_NAMES,
        ),
    }


# ============================================================
# Grad-CAM
# ============================================================

def generate_gradcam(
    model,
    image,
    predicted_class,
    device,
    output_prefix,
):

    """
    Generate Grad-CAM using the same
    target layer as src/gradcam.py.

    Target layer:
        model.features.conv
    """

    # Import here to avoid unnecessary
    # initialization when only prediction
    # functionality is needed.
    from gradcam import GradCAM
    from gradcam import create_heatmap
    from gradcam import create_overlay

    transform = get_transform()

    input_tensor = transform(
        image
    )

    input_tensor = (
        input_tensor
        .unsqueeze(0)
        .to(device)
    )

    input_tensor.requires_grad_()

    target_layer = (
        model.features.conv
    )

    gradcam = GradCAM(
        model=model,
        target_layer=target_layer,
    )

    try:

        cam = gradcam.generate(
            input_tensor,
            predicted_class,
        )

    finally:

        gradcam.close()

    width, height = image.size

    heatmap = create_heatmap(
        cam,
        width,
        height,
    )

    overlay = create_overlay(
        image,
        heatmap,
        alpha=0.30,
    )

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    heatmap_path = (
        OUTPUT_DIR
        / f"{output_prefix}_heatmap.jpg"
    )

    overlay_path = (
        OUTPUT_DIR
        / f"{output_prefix}_gradcam.jpg"
    )

    Image.fromarray(
        heatmap
    ).save(
        heatmap_path,
        quality=95,
    )

    Image.fromarray(
        overlay
    ).save(
        overlay_path,
        quality=95,
    )

    return {
        "heatmap": str(
            heatmap_path
        ),
        "overlay": str(
            overlay_path
        ),
        "active_area_fraction": round(
            float(np.mean(cam > 0.5)),
            6,
        ),
        "activation_mean": round(
            float(np.mean(cam)),
            6,
        ),
        "activation_peak": round(
            float(np.max(cam)),
            6,
        ),
    }


# ============================================================
# Complete inference pipeline
# ============================================================

def run_inference(
    image_path,
    generate_explanation=True,
    language="english",
):

    image_path = Path(
        image_path
    )

    if not image_path.exists():

        raise FileNotFoundError(
            f"Image not found:\n"
            f"{image_path}"
        )

    print()
    print("=" * 70)
    print(
        "DIABETIC RETINOPATHY "
        "INFERENCE PIPELINE"
    )
    print("=" * 70)

    print()
    print(
        "Image:",
        image_path
    )

    # --------------------------------------------------------
    # Step 1: Image quality
    # --------------------------------------------------------

    print()
    print(
        "[1/3] Checking image quality..."
    )

    quality = assess_image_quality(
        image_path
    )

    print(
        "Quality status:",
        quality["status"]
    )

    print(
        "Quality score:",
        quality["quality_score"]
    )

    if quality["warnings"]:

        for warning in quality[
            "warnings"
        ]:

            print(
                "Warning:",
                warning
            )

    # --------------------------------------------------------
    # QUALITY GATE
    # --------------------------------------------------------

    if quality["status"] != "SUITABLE":

        print()
        print(
            "IMAGE REJECTED BY "
            "QUALITY GATE"
        )

        print(
            "DR model will NOT be executed."
        )

        return {
            "status": "INSUFFICIENT",

            "quality": quality,

            "prediction": None,

            "gradcam": None,
        }

    # --------------------------------------------------------
    # Step 2: Load model
    # --------------------------------------------------------

    print()
    print(
        "[2/3] Running DR model..."
    )

    device = get_device()

    model = load_model(
        device
    )

    image = Image.open(
        image_path
    ).convert(
        "RGB"
    )

    prediction = predict_dr(
        model,
        image,
        device,
    )

    print()
    print(
        "DR Grade:",
        prediction["grade"]
    )

    print(
        "Classification:",
        prediction["class"]
    )

    print(
        f'Confidence: '
        f'{prediction["confidence"] * 100:.2f}%'
    )

    # --------------------------------------------------------
    # Step 3: Grad-CAM
    # --------------------------------------------------------

    gradcam = None

    if generate_explanation:

        print()
        print(
            "[3/3] Generating Grad-CAM..."
        )

        gradcam = generate_gradcam(
            model=model,
            image=image,
            predicted_class=prediction[
                "grade"
            ],
            device=device,
            output_prefix=image_path.stem,
        )

        print(
            "Heatmap:",
            gradcam["heatmap"]
        )

        print(
            "Overlay:",
            gradcam["overlay"]
        )

        add_gradcam_evidence(
            prediction,
            gradcam,
        )

    llm_explanation = generate_llm_explanation(
        prediction,
        language=language,
    )

    # --------------------------------------------------------
    # Final result
    # --------------------------------------------------------

    result = {
        "status": "SUCCESS",

        "image": str(
            image_path
        ),

        "quality": quality,

        "prediction": prediction,

        "gradcam": gradcam,

        "llm_explanation": llm_explanation,
    }

    return result


# ============================================================
# Main CLI
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Complete DR inference "
            "pipeline"
        )
    )

    parser.add_argument(
        "--image",
        required=True,
        help="Path to fundus image",
    )

    parser.add_argument(
        "--no-gradcam",
        action="store_true",
        help="Skip Grad-CAM generation",
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Print final result as JSON",
    )

    parser.add_argument(
        "--language",
        choices=[
            "english",
            "hindi",
            "bilingual",
        ],
        default="english",
        help="Language for the human-readable explanation",
    )

    args = parser.parse_args()

    if args.language in [
        "hindi",
        "bilingual",
    ] and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(
            encoding="utf-8"
        )

    result = run_inference(
        args.image,
        generate_explanation=(
            not args.no_gradcam
        ),
        language=args.language,
    )

    print()
    print("=" * 70)
    print(
        "FINAL RESULT"
    )
    print("=" * 70)

    print()

    if result["status"] == "INSUFFICIENT":

        print(
            "Status: INSUFFICIENT IMAGE QUALITY"
        )

        print(
            "Recommendation:"
        )

        print(
            "Recapture the fundus image."
        )

    else:

        prediction = result[
            "prediction"
        ]

        print(
            "Status: SUCCESS"
        )

        print(
            "DR Grade:",
            prediction["grade"]
        )

        print(
            "Classification:",
            prediction["class"]
        )

        print(
            f'Confidence: '
            f'{prediction["confidence"] * 100:.2f}%'
        )

        explanation = prediction[
            "clinical_explanation"
        ]

        explanations = [
            ("English", explanation),
        ]
        if args.language in ["hindi", "bilingual"]:
            explanations = [
                ("Hindi", explanation["hindi"]),
            ]
        if args.language == "bilingual":
            explanations.insert(
                0,
                ("English", explanation),
            )

        for language_name, localized in explanations:
            print()
            print(
                f"{language_name} explanation:"
            )
            print(
                "Mode:",
                localized["mode"]
            )
            print(
                "Medical meaning:",
                localized["medical_meaning"]
            )
            print(
                "Why this category:",
                localized["why_this_category"]
            )
            print(
                "Recommended action:",
                localized["recommended_action"]
            )
            print(
                "Urgency:",
                localized["urgency"]
            )
            print(
                "Note:",
                localized["disclaimer"]
            )

        llm_explanation = result[
            "llm_explanation"
        ]
        print()
        print(
            "LLM explanation status:",
            llm_explanation["status"]
        )
        if llm_explanation["text"]:
            print(
                "LLM explanation:",
                llm_explanation["text"]
            )
        else:
            print(
                "LLM fallback:"
                " deterministic clinical explanation"
            )

    # --------------------------------------------------------
    # JSON output
    # --------------------------------------------------------

    if args.json:

        print()
        print(
            json.dumps(
                result,
                indent=2,
                ensure_ascii=False,
            )
        )

    print()
    print("=" * 70)


if __name__ == "__main__":
    main()