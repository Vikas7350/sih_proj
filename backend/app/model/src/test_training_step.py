import torch
import torch.nn as nn

from dataset import create_dataloaders
from model import create_model


def main():

    # --------------------------------------------------
    # Device
    # --------------------------------------------------

    device = torch.device(
        "cuda" if torch.cuda.is_available() else "cpu"
    )

    print("Device:", device)

    if torch.cuda.is_available():
        print(
            "GPU:",
            torch.cuda.get_device_name(0)
        )

    # --------------------------------------------------
    # Dataset
    # --------------------------------------------------

    (
        train_loader,
        val_loader,
        class_weights,
        train_df,
        val_df,
    ) = create_dataloaders(
        batch_size=16,
        num_workers=0,
    )

    # --------------------------------------------------
    # Model
    # --------------------------------------------------

    model = create_model()

    model = model.to(device)

    # --------------------------------------------------
    # Loss
    # --------------------------------------------------

    class_weights = class_weights.to(device)

    criterion = nn.CrossEntropyLoss(
        weight=class_weights
    )

    # --------------------------------------------------
    # Optimizer
    # --------------------------------------------------

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=1e-4,
        weight_decay=1e-4,
    )

    model.train()

    # --------------------------------------------------
    # One batch
    # --------------------------------------------------

    images, labels = next(
        iter(train_loader)
    )

    images = images.to(
        device,
        non_blocking=True,
    )

    labels = labels.to(
        device,
        non_blocking=True,
    )

    print()
    print("Input:", images.shape)
    print("Labels:", labels.shape)

    # --------------------------------------------------
    # Forward
    # --------------------------------------------------

    optimizer.zero_grad(
        set_to_none=True
    )

    outputs = model(images)

    print(
        "Output:",
        outputs.shape
    )

    # --------------------------------------------------
    # Loss
    # --------------------------------------------------

    loss = criterion(
        outputs,
        labels,
    )

    print(
        "Loss:",
        loss.item()
    )

    # --------------------------------------------------
    # Backward
    # --------------------------------------------------

    loss.backward()

    print(
        "Backward pass: OK"
    )

    # --------------------------------------------------
    # Optimizer step
    # --------------------------------------------------

    optimizer.step()

    print(
        "Optimizer step: OK"
    )

    # --------------------------------------------------
    # GPU memory
    # --------------------------------------------------

    if torch.cuda.is_available():

        memory = (
            torch.cuda.max_memory_allocated()
            / 1024**3
        )

        print(
            f"Peak GPU memory: {memory:.2f} GB"
        )

    print()
    print("==============================")
    print("TRAINING STEP TEST PASSED")
    print("==============================")


if __name__ == "__main__":
    main()