import sys
from pathlib import Path

import torch

# Path to NVIDIA's ConvNets directory
NVIDIA_REPO = Path(
    r"C:\Github\sih_2k26\DeepLearningExamples\PyTorch\Classification\ConvNets"
)

sys.path.insert(0, str(NVIDIA_REPO))

from image_classification.models.efficientnet import efficientnet_b0


CHECKPOINT = Path(
    r"C:\Github\sih_2k26\model\nvidia_efficientnet-b0_210412.pth"
)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

print("Device:", device)

# Build EfficientNet-B0 with 5 DR classes
model = efficientnet_b0(
    num_classes=5
)

print("Model created.")

# Load NVIDIA pretrained checkpoint
checkpoint = torch.load(
    CHECKPOINT,
    map_location="cpu"
)

print("Checkpoint loaded.")
print("Checkpoint type:", type(checkpoint))

# The checkpoint contains the original 1000-class classifier.
# We want to load only the compatible backbone weights.
model_state = model.state_dict()

compatible_weights = {
    key: value
    for key, value in checkpoint.items()
    if key in model_state
    and model_state[key].shape == value.shape
}

print(
    f"Compatible weights: {len(compatible_weights)} / "
    f"{len(checkpoint)}"
)

missing, unexpected = model.load_state_dict(
    compatible_weights,
    strict=False
)

print("Missing keys:", len(missing))
print("Unexpected keys:", len(unexpected))

# Move model to GPU
model = model.to(device)
model.eval()

# Test with a fake fundus image
dummy_image = torch.randn(
    1, 3, 224, 224,
    device=device
)

with torch.no_grad():
    output = model(dummy_image)

print("Input shape:", dummy_image.shape)
print("Output shape:", output.shape)
print("Output:", output)

print("\nSUCCESS!")