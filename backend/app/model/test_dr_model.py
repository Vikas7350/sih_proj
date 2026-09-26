import torch

from src.model import create_model


device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("Device:", device)

model = create_model()

model = model.to(device)

model.eval()

# Fake fundus image
x = torch.randn(
    1,
    3,
    224,
    224,
    device=device,
)

with torch.no_grad():
    output = model(x)

print("Input :", x.shape)
print("Output:", output.shape)

assert output.shape == (1, 5)

print("MODEL TEST PASSED")