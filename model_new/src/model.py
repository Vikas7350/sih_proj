import sys
from pathlib import Path

import torch

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]

NVIDIA_ROOT = (
    REPOSITORY_ROOT
    / "DeepLearningExamples"
    / "PyTorch"
    / "Classification"
    / "ConvNets"
)

DR_CHECKPOINT_PATH = (
    Path(__file__).resolve().parents[1]
    / "checkpoints"
    / "best_model.pth"
)

NUM_CLASSES = 5

sys.path.insert(0, str(NVIDIA_ROOT))

from image_classification.models.efficientnet import (
    EfficientNet,
    effnet_b0_layers,
)


def create_model():

    model = EfficientNet(
        arch=effnet_b0_layers,
        dropout=0.2,
        num_classes=NUM_CLASSES,
    )

    print("EfficientNet-B0 created with 5 classes.")

    if not DR_CHECKPOINT_PATH.exists():
        raise FileNotFoundError(
            f"DR checkpoint not found:\n{DR_CHECKPOINT_PATH}"
        )

    checkpoint = torch.load(
        DR_CHECKPOINT_PATH,
        map_location="cpu",
    )

    if "model_state_dict" in checkpoint:
        state_dict = checkpoint["model_state_dict"]
    else:
        state_dict = checkpoint

    result = model.load_state_dict(
        state_dict,
        strict=True,
    )

    if result.missing_keys or result.unexpected_keys:
        raise RuntimeError(
            "DR checkpoint did not load correctly.\n"
            f"Missing keys: {result.missing_keys}\n"
            f"Unexpected keys: {result.unexpected_keys}"
        )

    print()
    print("=" * 60)
    print("TRAINED DR MODEL LOADED SUCCESSFULLY")
    print("=" * 60)
    print()
    print("Model        : EfficientNet-B0")
    print("Classes      : 5")
    print("Checkpoint   : best_model.pth")

    if "epoch" in checkpoint:
        print("Epoch        :", checkpoint["epoch"])

    if "best_macro_f1" in checkpoint:
        print("Best Macro F1:", checkpoint["best_macro_f1"])

    if "class_names" in checkpoint:
        print("Classes      :", checkpoint["class_names"])

    return model