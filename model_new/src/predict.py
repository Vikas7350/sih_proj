import argparse
from pathlib import Path

import torch
from PIL import Image
from torchvision import transforms

from model import create_model


# ============================================================
# Configuration
# ============================================================

CHECKPOINT_PATH = Path(
    "checkpoints/best_model.pth"
)

CLASS_NAMES = [
    "No DR",
    "Mild DR",
    "Moderate DR",
    "Severe DR",
    "Proliferative DR",
]


# ============================================================
# Device
# ============================================================

def get_device():

    if torch.cuda.is_available():

        device = torch.device("cuda")

        print(
            "Device:",
            device,
        )

        print(
            "GPU:",
            torch.cuda.get_device_name(0),
        )

    else:

        device = torch.device("cpu")

        print("Device: CPU")

    return device


# ============================================================
# Image preprocessing
# ============================================================

def get_transform():

    return transforms.Compose(
        [
            transforms.Resize(
                (224, 224)
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
# Load model
# ============================================================

def load_model(device):

    if not CHECKPOINT_PATH.exists():

        raise FileNotFoundError(
            f"Checkpoint not found:\n"
            f"{CHECKPOINT_PATH}"
        )

    print()
    print(
        "Loading:",
        CHECKPOINT_PATH,
    )

    model = create_model()

    checkpoint = torch.load(
        CHECKPOINT_PATH,
        map_location="cpu",
    )

    if "model_state_dict" in checkpoint:

        model.load_state_dict(
            checkpoint["model_state_dict"]
        )

        print(
            "Checkpoint epoch:",
            checkpoint.get("epoch"),
        )

        print(
            "Best Macro F1:",
            checkpoint.get(
                "best_macro_f1"
            ),
        )

    else:

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
# Prediction
# ============================================================

@torch.no_grad()
def predict(
    model,
    image,
    device,
):

    transform = get_transform()

    # --------------------------------------------------------
    # Convert image to RGB
    # --------------------------------------------------------

    image = image.convert("RGB")

    # --------------------------------------------------------
    # Preprocess
    # --------------------------------------------------------

    tensor = transform(
        image
    )

    # Add batch dimension
    tensor = tensor.unsqueeze(0)

    tensor = tensor.to(device)

    # --------------------------------------------------------
    # Model inference
    # --------------------------------------------------------

    logits = model(tensor)

    # --------------------------------------------------------
    # Convert logits to probabilities
    # --------------------------------------------------------

    probabilities = torch.softmax(
        logits,
        dim=1,
    )[0]

    predicted_class = torch.argmax(
        probabilities
    ).item()

    confidence = probabilities[
        predicted_class
    ].item()

    return (
        predicted_class,
        confidence,
        probabilities.cpu(),
    )


# ============================================================
# Main
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Diabetic Retinopathy "
            "EfficientNet-B0 inference"
        )
    )

    parser.add_argument(
        "--image",
        required=True,
        help="Path to fundus image",
    )

    args = parser.parse_args()

    image_path = Path(
        args.image
    )

    # --------------------------------------------------------
    # Validate image
    # --------------------------------------------------------

    if not image_path.exists():

        raise FileNotFoundError(
            f"Image not found:\n"
            f"{image_path}"
        )

    print()
    print("=" * 60)
    print("DIABETIC RETINOPATHY PREDICTION")
    print("=" * 60)

    print()
    print(
        "Image:",
        image_path,
    )

    # --------------------------------------------------------
    # Device
    # --------------------------------------------------------

    device = get_device()

    # --------------------------------------------------------
    # Load model
    # --------------------------------------------------------

    model = load_model(
        device
    )

    # --------------------------------------------------------
    # Load image
    # --------------------------------------------------------

    image = Image.open(
        image_path
    )

    print(
        "Image size:",
        image.size,
    )

    # --------------------------------------------------------
    # Predict
    # --------------------------------------------------------

    (
        predicted_class,
        confidence,
        probabilities,
    ) = predict(
        model,
        image,
        device,
    )

    # --------------------------------------------------------
    # Result
    # --------------------------------------------------------

    predicted_name = CLASS_NAMES[
        predicted_class
    ]

    print()
    print("=" * 60)
    print("PREDICTION")
    print("=" * 60)

    print()
    print(
        f"DR Grade   : "
        f"{predicted_class}"
    )

    print(
        f"Classification : "
        f"{predicted_name}"
    )

    print(
        f"Confidence : "
        f"{confidence * 100:.2f}%"
    )

    # --------------------------------------------------------
    # All probabilities
    # --------------------------------------------------------

    print()
    print(
        "Class probabilities"
    )

    print(
        "-----------------------------"
    )

    for index, name in enumerate(
        CLASS_NAMES
    ):

        probability = (
            probabilities[index].item()
        )

        print(
            f"{name:<20}"
            f"{probability * 100:>7.2f}%"
        )

    print()
    print("=" * 60)
    print("PREDICTION COMPLETE")
    print("=" * 60)


# ============================================================
# Entry point
# ============================================================

if __name__ == "__main__":
    main()