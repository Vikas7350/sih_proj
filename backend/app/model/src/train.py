import csv
import json
import time
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from torch.amp import GradScaler, autocast

from dataset import create_dataloaders
from model import create_model


# ============================================================
# Configuration
# ============================================================

BATCH_SIZE = 16

# Total number of epochs
TOTAL_EPOCHS = 15

# First phase: train classifier only
FREEZE_EPOCHS = 3

# Learning rates
CLASSIFIER_LR = 1e-3
FINETUNE_LR = 1e-4

WEIGHT_DECAY = 1e-4

NUM_CLASSES = 5

CLASS_NAMES = [
    "No DR",
    "Mild DR",
    "Moderate DR",
    "Severe DR",
    "Proliferative DR",
]

CHECKPOINT_DIR = Path("checkpoints")
RESULTS_DIR = Path("results")

BEST_MODEL_PATH = CHECKPOINT_DIR / "best_model.pth"
LAST_MODEL_PATH = CHECKPOINT_DIR / "last_model.pth"

HISTORY_PATH = RESULTS_DIR / "training_history.json"
CONFUSION_MATRIX_PATH = RESULTS_DIR / "confusion_matrix.csv"
REPORT_PATH = RESULTS_DIR / "classification_report.txt"


# ============================================================
# Reproducibility
# ============================================================

SEED = 42


def set_seed(seed=SEED):

    torch.manual_seed(seed)

    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


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

        return device

    print("CUDA not available. Using CPU.")

    return torch.device("cpu")


# ============================================================
# Freeze / unfreeze
# ============================================================

def freeze_backbone(model):

    print()
    print("Freezing EfficientNet backbone...")

    for param in model.parameters():
        param.requires_grad = False

    # Train only classifier
    for param in model.classifier.parameters():
        param.requires_grad = True


def unfreeze_all(model):

    print()
    print("Unfreezing entire EfficientNet...")
    print("Starting full fine-tuning.")

    for param in model.parameters():
        param.requires_grad = True


# ============================================================
# Count trainable parameters
# ============================================================

def print_trainable_parameters(model):

    trainable = 0
    total = 0

    for param in model.parameters():

        num = param.numel()

        total += num

        if param.requires_grad:
            trainable += num

    print()
    print("Parameters")
    print("-----------------------------")
    print(f"Total     : {total:,}")
    print(f"Trainable : {trainable:,}")
    print(
        f"Frozen    : {total - trainable:,}"
    )


# ============================================================
# Train one epoch
# ============================================================

def train_one_epoch(
    model,
    loader,
    criterion,
    optimizer,
    scaler,
    device,
):

    model.train()

    running_loss = 0.0

    all_predictions = []
    all_labels = []

    start_time = time.time()

    for batch_index, (images, labels) in enumerate(loader):

        images = images.to(
            device,
            non_blocking=True,
        )

        labels = labels.to(
            device,
            non_blocking=True,
        )

        optimizer.zero_grad(
            set_to_none=True
        )

        # ----------------------------------------------------
        # Mixed precision
        # ----------------------------------------------------

        with autocast(
            device_type="cuda",
            enabled=(device.type == "cuda"),
        ):

            outputs = model(images)

            loss = criterion(
                outputs,
                labels,
            )

        # ----------------------------------------------------
        # Backward
        # ----------------------------------------------------

        scaler.scale(loss).backward()

        scaler.step(optimizer)

        scaler.update()

        # ----------------------------------------------------
        # Statistics
        # ----------------------------------------------------

        running_loss += (
            loss.item() * images.size(0)
        )

        predictions = torch.argmax(
            outputs,
            dim=1,
        )

        all_predictions.extend(
            predictions.detach()
            .cpu()
            .numpy()
        )

        all_labels.extend(
            labels.detach()
            .cpu()
            .numpy()
        )

        # ----------------------------------------------------
        # Progress
        # ----------------------------------------------------

        if (
            batch_index + 1
        ) % 25 == 0:

            print(
                f"  Batch "
                f"{batch_index + 1}/"
                f"{len(loader)} "
                f"Loss: {loss.item():.4f}"
            )

    epoch_loss = (
        running_loss / len(loader.dataset)
    )

    epoch_accuracy = accuracy_score(
        all_labels,
        all_predictions,
    )

    epoch_f1 = f1_score(
        all_labels,
        all_predictions,
        average="macro",
        zero_division=0,
    )

    elapsed = time.time() - start_time

    return {
        "loss": epoch_loss,
        "accuracy": epoch_accuracy,
        "macro_f1": epoch_f1,
        "time": elapsed,
    }


# ============================================================
# Validation
# ============================================================

@torch.no_grad()
def validate(
    model,
    loader,
    criterion,
    device,
):

    model.eval()

    running_loss = 0.0

    all_predictions = []
    all_labels = []

    for images, labels in loader:

        images = images.to(
            device,
            non_blocking=True,
        )

        labels = labels.to(
            device,
            non_blocking=True,
        )

        with autocast(
            device_type="cuda",
            enabled=(device.type == "cuda"),
        ):

            outputs = model(images)

            loss = criterion(
                outputs,
                labels,
            )

        running_loss += (
            loss.item() * images.size(0)
        )

        predictions = torch.argmax(
            outputs,
            dim=1,
        )

        all_predictions.extend(
            predictions.cpu().numpy()
        )

        all_labels.extend(
            labels.cpu().numpy()
        )

    validation_loss = (
        running_loss / len(loader.dataset)
    )

    accuracy = accuracy_score(
        all_labels,
        all_predictions,
    )

    macro_f1 = f1_score(
        all_labels,
        all_predictions,
        average="macro",
        zero_division=0,
    )

    macro_precision = precision_score(
        all_labels,
        all_predictions,
        average="macro",
        zero_division=0,
    )

    macro_recall = recall_score(
        all_labels,
        all_predictions,
        average="macro",
        zero_division=0,
    )

    return {
        "loss": validation_loss,
        "accuracy": accuracy,
        "macro_f1": macro_f1,
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "labels": all_labels,
        "predictions": all_predictions,
    }


# ============================================================
# Save confusion matrix
# ============================================================

def save_confusion_matrix(
    labels,
    predictions,
):

    matrix = confusion_matrix(
        labels,
        predictions,
        labels=list(range(NUM_CLASSES)),
    )

    with open(
        CONFUSION_MATRIX_PATH,
        "w",
        newline="",
    ) as file:

        writer = csv.writer(file)

        writer.writerow(
            ["Actual / Predicted"]
            + CLASS_NAMES
        )

        for index, row in enumerate(matrix):

            writer.writerow(
                [CLASS_NAMES[index]]
                + row.tolist()
            )


# ============================================================
# Save classification report
# ============================================================

def save_classification_report(
    labels,
    predictions,
):

    report = classification_report(
        labels,
        predictions,
        labels=list(range(NUM_CLASSES)),
        target_names=CLASS_NAMES,
        digits=4,
        zero_division=0,
    )

    with open(
        REPORT_PATH,
        "w",
        encoding="utf-8",
    ) as file:

        file.write(report)


# ============================================================
# Main training
# ============================================================

def main():

    set_seed()

    CHECKPOINT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    RESULTS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    device = get_device()

    # --------------------------------------------------------
    # Dataset
    # --------------------------------------------------------

    (
        train_loader,
        val_loader,
        class_weights,
        train_df,
        val_df,
    ) = create_dataloaders(
        batch_size=BATCH_SIZE,
        num_workers=0,
    )

    # --------------------------------------------------------
    # Model
    # --------------------------------------------------------

    model = create_model()

    model = model.to(device)

    # --------------------------------------------------------
    # Loss
    # --------------------------------------------------------

    class_weights = class_weights.to(device)

    criterion = nn.CrossEntropyLoss(
        weight=class_weights
    )

    # --------------------------------------------------------
    # Phase 1
    #
    # Freeze backbone
    # Train classifier only
    # --------------------------------------------------------

    freeze_backbone(model)

    print_trainable_parameters(model)

    optimizer = torch.optim.AdamW(
        filter(
            lambda p: p.requires_grad,
            model.parameters(),
        ),
        lr=CLASSIFIER_LR,
        weight_decay=WEIGHT_DECAY,
    )

    # --------------------------------------------------------
    # AMP scaler
    # --------------------------------------------------------

    scaler = GradScaler(
        "cuda",
        enabled=(device.type == "cuda"),
    )

    # --------------------------------------------------------
    # Training history
    # --------------------------------------------------------

    history = []

    best_macro_f1 = -1.0

    # --------------------------------------------------------
    # Training loop
    # --------------------------------------------------------

    for epoch in range(
        1,
        TOTAL_EPOCHS + 1,
    ):

        print()
        print("=" * 70)
        print(
            f"EPOCH {epoch}/{TOTAL_EPOCHS}"
        )
        print("=" * 70)

        # ----------------------------------------------------
        # Switch from classifier training to fine-tuning
        # ----------------------------------------------------

        if epoch == FREEZE_EPOCHS + 1:

            unfreeze_all(model)

            print_trainable_parameters(
                model
            )

            optimizer = torch.optim.AdamW(
                model.parameters(),
                lr=FINETUNE_LR,
                weight_decay=WEIGHT_DECAY,
            )

        # ----------------------------------------------------
        # Train
        # ----------------------------------------------------

        train_metrics = train_one_epoch(
            model,
            train_loader,
            criterion,
            optimizer,
            scaler,
            device,
        )

        # ----------------------------------------------------
        # Validate
        # ----------------------------------------------------

        val_metrics = validate(
            model,
            val_loader,
            criterion,
            device,
        )

        # ----------------------------------------------------
        # Print results
        # ----------------------------------------------------

        print()
        print("Training")
        print("-----------------------------")
        print(
            f"Loss      : "
            f"{train_metrics['loss']:.4f}"
        )

        print(
            f"Accuracy  : "
            f"{train_metrics['accuracy']:.4f}"
        )

        print(
            f"Macro F1  : "
            f"{train_metrics['macro_f1']:.4f}"
        )

        print()
        print("Validation")
        print("-----------------------------")

        print(
            f"Loss      : "
            f"{val_metrics['loss']:.4f}"
        )

        print(
            f"Accuracy  : "
            f"{val_metrics['accuracy']:.4f}"
        )

        print(
            f"Macro F1  : "
            f"{val_metrics['macro_f1']:.4f}"
        )

        print(
            f"Precision : "
            f"{val_metrics['macro_precision']:.4f}"
        )

        print(
            f"Recall    : "
            f"{val_metrics['macro_recall']:.4f}"
        )

        # ----------------------------------------------------
        # Store history
        # ----------------------------------------------------

        epoch_record = {
            "epoch": epoch,
            "train_loss": train_metrics["loss"],
            "train_accuracy": train_metrics[
                "accuracy"
            ],
            "train_macro_f1": train_metrics[
                "macro_f1"
            ],
            "val_loss": val_metrics["loss"],
            "val_accuracy": val_metrics[
                "accuracy"
            ],
            "val_macro_f1": val_metrics[
                "macro_f1"
            ],
            "val_macro_precision": val_metrics[
                "macro_precision"
            ],
            "val_macro_recall": val_metrics[
                "macro_recall"
            ],
        }

        history.append(
            epoch_record
        )

        # ----------------------------------------------------
        # Save best model
        #
        # We use Macro-F1 because the APTOS dataset
        # is imbalanced.
        # ----------------------------------------------------

        current_f1 = val_metrics[
            "macro_f1"
        ]

        if current_f1 > best_macro_f1:

            best_macro_f1 = current_f1

            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict":
                        model.state_dict(),
                    "optimizer_state_dict":
                        optimizer.state_dict(),
                    "best_macro_f1":
                        best_macro_f1,
                    "class_names":
                        CLASS_NAMES,
                },
                BEST_MODEL_PATH,
            )

            print()
            print(
                "★ New best model saved!"
            )

            print(
                f"  Macro F1: "
                f"{best_macro_f1:.4f}"
            )

        # ----------------------------------------------------
        # Save last model
        # ----------------------------------------------------

        torch.save(
            {
                "epoch": epoch,
                "model_state_dict":
                    model.state_dict(),
                "optimizer_state_dict":
                    optimizer.state_dict(),
                "best_macro_f1":
                    best_macro_f1,
                "class_names":
                    CLASS_NAMES,
            },
            LAST_MODEL_PATH,
        )

        # ----------------------------------------------------
        # Save history
        # ----------------------------------------------------

        with open(
            HISTORY_PATH,
            "w",
            encoding="utf-8",
        ) as file:

            json.dump(
                history,
                file,
                indent=4,
            )

        # ----------------------------------------------------
        # Save latest validation report
        # ----------------------------------------------------

        save_confusion_matrix(
            val_metrics["labels"],
            val_metrics["predictions"],
        )

        save_classification_report(
            val_metrics["labels"],
            val_metrics["predictions"],
        )

    # ========================================================
    # Training complete
    # ========================================================

    print()
    print("=" * 70)
    print("TRAINING COMPLETE")
    print("=" * 70)

    print()
    print(
        f"Best validation Macro F1: "
        f"{best_macro_f1:.4f}"
    )

    print()
    print("Saved:")
    print(
        f"  Best model : "
        f"{BEST_MODEL_PATH}"
    )

    print(
        f"  Last model : "
        f"{LAST_MODEL_PATH}"
    )

    print(
        f"  History    : "
        f"{HISTORY_PATH}"
    )

    print(
        f"  Confusion  : "
        f"{CONFUSION_MATRIX_PATH}"
    )

    print(
        f"  Report     : "
        f"{REPORT_PATH}"
    )


if __name__ == "__main__":
    main()