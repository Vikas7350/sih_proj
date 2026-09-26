import argparse
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image

from torchvision import transforms

from model import create_model


# ============================================================
# Configuration
# ============================================================

CHECKPOINT_PATH = Path(
    "checkpoints/best_model.pth"
)

OUTPUT_DIR = Path(
    "results/gradcam"
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

        print("Device:", device)
        print(
            "GPU:",
            torch.cuda.get_device_name(0)
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
        "Loading checkpoint:",
        CHECKPOINT_PATH
    )

    model = create_model(
        checkpoint_path=CHECKPOINT_PATH
    )

    model = model.to(device)

    model.eval()

    print(
        "Model loaded successfully."
    )

    return model


# ============================================================
# Grad-CAM
# ============================================================

class GradCAM:

    def __init__(
        self,
        model,
        target_layer,
    ):

        self.model = model

        self.target_layer = (
            target_layer
        )

        self.activations = None
        self.gradients = None

        # ----------------------------------------------------
        # Forward hook
        # ----------------------------------------------------

        self.forward_handle = (
            self.target_layer.register_forward_hook(
                self._save_activation
            )
        )

        # ----------------------------------------------------
        # Backward hook
        # ----------------------------------------------------

        self.backward_handle = (
            self.target_layer.register_full_backward_hook(
                self._save_gradient
            )
        )

    def _save_activation(
        self,
        module,
        input,
        output,
    ):

        self.activations = output

    def _save_gradient(
        self,
        module,
        grad_input,
        grad_output,
    ):

        self.gradients = (
            grad_output[0]
        )

    def generate(
        self,
        input_tensor,
        target_class,
    ):

        # ----------------------------------------------------
        # Clear previous data
        # ----------------------------------------------------

        self.activations = None
        self.gradients = None

        # ----------------------------------------------------
        # Enable gradients
        # ----------------------------------------------------

        self.model.zero_grad(
            set_to_none=True
        )

        # ----------------------------------------------------
        # Forward pass
        # ----------------------------------------------------

        output = self.model(
            input_tensor
        )

        # ----------------------------------------------------
        # Select target class
        # ----------------------------------------------------

        target_score = output[
            0,
            target_class
        ]

        # ----------------------------------------------------
        # Backward pass
        # ----------------------------------------------------

        target_score.backward()

        # ----------------------------------------------------
        # Validate hooks
        # ----------------------------------------------------

        if self.activations is None:

            raise RuntimeError(
                "Grad-CAM activation "
                "was not captured."
            )

        if self.gradients is None:

            raise RuntimeError(
                "Grad-CAM gradients "
                "were not captured."
            )

        # ----------------------------------------------------
        # Remove batch dimension
        # ----------------------------------------------------

        activations = (
            self.activations[0]
        )

        gradients = (
            self.gradients[0]
        )

        # ----------------------------------------------------
        # Global average pooling
        # ----------------------------------------------------

        weights = gradients.mean(
            dim=(1, 2)
        )

        # ----------------------------------------------------
        # Weighted feature maps
        # ----------------------------------------------------

        cam = torch.sum(
            weights[:, None, None]
            * activations,
            dim=0,
        )

        # ----------------------------------------------------
        # ReLU
        # ----------------------------------------------------

        cam = F.relu(cam)

        # ----------------------------------------------------
        # Normalize
        # ----------------------------------------------------

        cam -= cam.min()

        max_value = cam.max()

        if max_value > 0:

            cam /= max_value

        # ----------------------------------------------------
        # Convert to NumPy
        # ----------------------------------------------------

        cam = cam.detach().cpu().numpy()

        return cam

    def close(self):

        self.forward_handle.remove()

        self.backward_handle.remove()


# ============================================================
# Create heatmap
# ============================================================

def create_heatmap(
    cam,
    width,
    height,
):

    # Resize Grad-CAM to original image
    cam = cv2.resize(
        cam,
        (width, height),
        interpolation=cv2.INTER_LINEAR,
    )

    # Convert 0-1 → 0-255
    cam_uint8 = np.uint8(
        cam * 255
    )

    # OpenCV heatmap
    heatmap = cv2.applyColorMap(
        cam_uint8,
        cv2.COLORMAP_JET,
    )

    # OpenCV uses BGR
    heatmap = cv2.cvtColor(
        heatmap,
        cv2.COLOR_BGR2RGB,
    )

    return heatmap


# ============================================================
# Overlay heatmap
# ============================================================

def create_overlay(
    original,
    heatmap,
    alpha=0.40,
):

    original_np = np.array(
        original
    )

    overlay = (
        original_np * (1 - alpha)
        + heatmap * alpha
    )

    overlay = np.clip(
        overlay,
        0,
        255,
    ).astype(
        np.uint8
    )

    return overlay


# ============================================================
# Main Grad-CAM inference
# ============================================================

def run_gradcam(
    model,
    image,
    device,
):

    transform = get_transform()

    # --------------------------------------------------------
    # Original image
    # --------------------------------------------------------

    image = image.convert(
        "RGB"
    )

    original_width, original_height = (
        image.size
    )

    # --------------------------------------------------------
    # Preprocess
    # --------------------------------------------------------

    input_tensor = transform(
        image
    )

    input_tensor = (
        input_tensor
        .unsqueeze(0)
        .to(device)
    )

    # --------------------------------------------------------
    # IMPORTANT:
    # Grad-CAM requires gradients.
    # --------------------------------------------------------

    input_tensor.requires_grad_()

    # --------------------------------------------------------
    # Target layer: last Conv2d in the
    # feature extractor (features[-1][0]
    # is the final MBConv's depthwise block)
    # --------------------------------------------------------

    target_layer = (
        model.features[-1][0]
    )

    gradcam = GradCAM(
        model=model,
        target_layer=target_layer,
    )

    try:

        # ----------------------------------------------------
        # First forward pass to determine prediction
        # ----------------------------------------------------

        model.zero_grad(
            set_to_none=True
        )

        output = model(
            input_tensor
        )

        probabilities = torch.softmax(
            output,
            dim=1,
        )

        predicted_class = (
            torch.argmax(
                probabilities,
                dim=1,
            ).item()
        )

        confidence = (
            probabilities[
                0,
                predicted_class
            ].item()
        )

        # ----------------------------------------------------
        # Generate Grad-CAM
        # ----------------------------------------------------

        cam = gradcam.generate(
            input_tensor,
            predicted_class,
        )

    finally:

        gradcam.close()

    # --------------------------------------------------------
    # Create heatmap
    # --------------------------------------------------------

    heatmap = create_heatmap(
        cam,
        original_width,
        original_height,
    )

    # --------------------------------------------------------
    # Create overlay
    # --------------------------------------------------------

    overlay = create_overlay(
        image,
        heatmap,
        alpha=0.40,
    )

    return (
        predicted_class,
        confidence,
        probabilities[
            0
        ].detach().cpu().numpy(),
        heatmap,
        overlay,
    )


# ============================================================
# Save results
# ============================================================

def save_results(
    image_path,
    heatmap,
    overlay,
):

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    stem = image_path.stem

    heatmap_path = (
        OUTPUT_DIR
        / f"{stem}_heatmap.jpg"
    )

    overlay_path = (
        OUTPUT_DIR
        / f"{stem}_gradcam.jpg"
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

    return (
        heatmap_path,
        overlay_path,
    )


# ============================================================
# Main
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "EfficientNet-B0 "
            "Grad-CAM for DR"
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

    if not image_path.exists():

        raise FileNotFoundError(
            f"Image not found:\n"
            f"{image_path}"
        )

    print()
    print("=" * 70)
    print(
        "DIABETIC RETINOPATHY "
        "GRAD-CAM"
    )
    print("=" * 70)

    print()
    print(
        "Image:",
        image_path
    )

    # --------------------------------------------------------
    # Device
    # --------------------------------------------------------

    device = get_device()

    # --------------------------------------------------------
    # Model
    # --------------------------------------------------------

    model = load_model(
        device
    )

    # --------------------------------------------------------
    # Image
    # --------------------------------------------------------

    image = Image.open(
        image_path
    )

    print(
        "Image size:",
        image.size
    )

    # --------------------------------------------------------
    # Grad-CAM
    # --------------------------------------------------------

    (
        predicted_class,
        confidence,
        probabilities,
        heatmap,
        overlay,
    ) = run_gradcam(
        model,
        image,
        device,
    )

    # --------------------------------------------------------
    # Print prediction
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("PREDICTION")
    print("=" * 70)

    print()

    print(
        "DR Grade:",
        predicted_class
    )

    print(
        "Classification:",
        CLASS_NAMES[
            predicted_class
        ]
    )

    print(
        f"Confidence: "
        f"{confidence * 100:.2f}%"
    )

    print()
    print(
        "Class probabilities:"
    )

    print(
        "-----------------------------"
    )

    for index, name in enumerate(
        CLASS_NAMES
    ):

        print(
            f"{name:<20}"
            f"{probabilities[index] * 100:>7.2f}%"
        )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    (
        heatmap_path,
        overlay_path,
    ) = save_results(
        image_path,
        heatmap,
        overlay,
    )

    print()
    print("=" * 70)
    print("GRAD-CAM RESULTS")
    print("=" * 70)

    print()
    print(
        "Heatmap:",
        heatmap_path
    )

    print(
        "Overlay:",
        overlay_path
    )

    print()
    print("=" * 70)
    print(
        "GRAD-CAM COMPLETE"
    )
    print("=" * 70)


if __name__ == "__main__":
    main()