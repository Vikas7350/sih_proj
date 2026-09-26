"""Integration adapter for MATLAB retinal analysis and Python DR inference.

The EfficientNet implementation remains owned by ``inference.py``. MATLAB
outputs are supporting analysis and are never used to alter the DR grade.
"""

import argparse
import json
from pathlib import Path

from PIL import Image

from clinical_explanation import add_gradcam_evidence
from llm_explanation import generate_llm_explanation
from inference import get_device, load_model, predict_dr, generate_gradcam


def load_analysis(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def run_combined_inference(image_path: Path, analysis_path: Path | None = None):
    analysis = load_analysis(analysis_path) if analysis_path else None

    if analysis and analysis.get("status") == "INSUFFICIENT":
        return {
            "status": "INSUFFICIENT",
            "quality": analysis.get("quality", {}),
            "enhancement": analysis.get("enhancement", {}),
            "retinal_analysis": analysis.get("retinal_analysis", {}),
            "prediction": None,
            "gradcam": None,
        }

    model_image = image_path
    if analysis:
        enhanced_path = analysis.get("enhancement", {}).get("enhanced_image")
        if enhanced_path:
            model_image = Path(enhanced_path)

    if not model_image.exists():
        raise FileNotFoundError(f"Model image not found: {model_image}")

    device = get_device()
    model = load_model(device)
    image = Image.open(model_image).convert("RGB")
    prediction = predict_dr(model, image, device)
    gradcam = generate_gradcam(
        model=model,
        image=image,
        predicted_class=prediction["grade"],
        device=device,
        output_prefix=image_path.stem,
    )
    add_gradcam_evidence(prediction, gradcam)
    llm_explanation = generate_llm_explanation(prediction)

    return {
        "status": "SUCCESS",
        "image": str(image_path),
        "model_image": str(model_image),
        "quality": analysis.get("quality", {}) if analysis else {},
        "enhancement": analysis.get("enhancement", {}) if analysis else {},
        "retinal_analysis": analysis.get("retinal_analysis", {}) if analysis else {},
        "prediction": prediction,
        "gradcam": gradcam,
        "llm_explanation": llm_explanation,
    }


def main():
    parser = argparse.ArgumentParser(description="Combine MATLAB analysis with EfficientNet inference")
    parser.add_argument("--image", required=True, type=Path)
    parser.add_argument("--analysis-json", type=Path)
    parser.add_argument("--output-json", type=Path)
    args = parser.parse_args()

    result = run_combined_inference(args.image, args.analysis_json)
    serialized = json.dumps(result, indent=2)
    print(serialized)
    if args.output_json:
        args.output_json.parent.mkdir(parents=True, exist_ok=True)
        args.output_json.write_text(serialized + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()