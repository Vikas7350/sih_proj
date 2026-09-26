import json
from pathlib import Path

import torch
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

from dataset import create_dataloaders
from model import create_model


# ============================================================
# Configuration
# ============================================================

BATCH_SIZE = 16
NUM_CLASSES = 5

CLASS_NAMES = [
    "No DR",
    "Mild DR",
    "Moderate DR",
    "Severe DR",
    "Proliferative DR",
]

CHECKPOINT_PATH = Path(
    "checkpoints/best_model.pth"
)

RESULTS_DIR = Path("results")

BEST_REPORT_PATH = (
    RESULTS_DIR / "best_model_classification_report.txt"
)

BEST_CONFUSION_PATH = (
    RESULTS_DIR / "best_model_confusion_matrix.csv"
)

BEST_METRICS_PATH = (
    RESULTS_DIR / "best_model_metrics.json"
)


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
# Load best checkpoint
# ============================================================

def load_best_model(device):

    if not CHECKPOINT_PATH.exists():

        raise FileNotFoundError(
            f"Checkpoint not found:\n"
            f"{CHECKPOINT_PATH}"
        )

    print()
    print("Loading best checkpoint:")
    print(CHECKPOINT_PATH)

    model = create_model(
        checkpoint_path=CHECKPOINT_PATH
    )

    model = model.to(device)

    model.eval()

    print("Best model loaded successfully.")

    return model


# ============================================================
# Evaluate
# ============================================================

@torch.no_grad()
def evaluate(
    model,
    val_loader,
    device,
):

    all_labels = []
    all_predictions = []

    total_samples = 0
    correct_samples = 0

    print()
    print("Running validation inference...")
    print()

    for batch_index, (images, labels) in enumerate(
        val_loader
    ):

        images = images.to(
            device,
            non_blocking=True,
        )

        labels = labels.to(
            device,
            non_blocking=True,
        )

        # ----------------------------------------------------
        # Forward pass
        # ----------------------------------------------------

        outputs = model(images)

        predictions = torch.argmax(
            outputs,
            dim=1,
        )

        # ----------------------------------------------------
        # Statistics
        # ----------------------------------------------------

        correct_samples += (
            predictions == labels
        ).sum().item()

        total_samples += labels.size(0)

        all_predictions.extend(
            predictions.cpu().numpy()
        )

        all_labels.extend(
            labels.cpu().numpy()
        )

        if (
            batch_index + 1
        ) % 10 == 0:

            print(
                f"  Batch "
                f"{batch_index + 1}/"
                f"{len(val_loader)}"
            )

    # ========================================================
    # Metrics
    # ========================================================

    accuracy = accuracy_score(
        all_labels,
        all_predictions,
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

    macro_f1 = f1_score(
        all_labels,
        all_predictions,
        average="macro",
        zero_division=0,
    )

    weighted_f1 = f1_score(
        all_labels,
        all_predictions,
        average="weighted",
        zero_division=0,
    )

    matrix = confusion_matrix(
        all_labels,
        all_predictions,
        labels=list(range(NUM_CLASSES)),
    )

    report = classification_report(
        all_labels,
        all_predictions,
        labels=list(range(NUM_CLASSES)),
        target_names=CLASS_NAMES,
        digits=4,
        zero_division=0,
    )

    return {
        "accuracy": accuracy,
        "macro_precision": macro_precision,
        "macro_recall": macro_recall,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "total_samples": total_samples,
        "correct_samples": correct_samples,
        "confusion_matrix": matrix,
        "classification_report": report,
        "labels": all_labels,
        "predictions": all_predictions,
    }


# ============================================================
# Save results
# ============================================================

def save_results(metrics):

    RESULTS_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    # --------------------------------------------------------
    # Classification report
    # --------------------------------------------------------

    with open(
        BEST_REPORT_PATH,
        "w",
        encoding="utf-8",
    ) as file:

        file.write(
            metrics["classification_report"]
        )

    # --------------------------------------------------------
    # Confusion matrix
    # --------------------------------------------------------

    matrix = metrics[
        "confusion_matrix"
    ]

    with open(
        BEST_CONFUSION_PATH,
        "w",
        encoding="utf-8",
    ) as file:

        file.write(
            "Actual / Predicted,"
            + ",".join(CLASS_NAMES)
            + "\n"
        )

        for index, row in enumerate(matrix):

            file.write(
                CLASS_NAMES[index]
                + ","
                + ",".join(
                    str(value)
                    for value in row
                )
                + "\n"
            )

    # --------------------------------------------------------
    # JSON metrics
    # --------------------------------------------------------

    json_metrics = {
        "accuracy": metrics["accuracy"],
        "macro_precision": metrics[
            "macro_precision"
        ],
        "macro_recall": metrics[
            "macro_recall"
        ],
        "macro_f1": metrics[
            "macro_f1"
        ],
        "weighted_f1": metrics[
            "weighted_f1"
        ],
        "total_samples": metrics[
            "total_samples"
        ],
        "correct_samples": metrics[
            "correct_samples"
        ],
    }

    with open(
        BEST_METRICS_PATH,
        "w",
        encoding="utf-8",
    ) as file:

        json.dump(
            json_metrics,
            file,
            indent=4,
        )


# ============================================================
# Main
# ============================================================

def main():

    print("=" * 70)
    print("BEST MODEL EVALUATION")
    print("=" * 70)

    # --------------------------------------------------------
    # Device
    # --------------------------------------------------------

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

    model = load_best_model(
        device
    )

    # --------------------------------------------------------
    # Evaluation
    # --------------------------------------------------------

    metrics = evaluate(
        model,
        val_loader,
        device,
    )

    # --------------------------------------------------------
    # Print results
    # --------------------------------------------------------

    print()
    print("=" * 70)
    print("BEST MODEL RESULTS")
    print("=" * 70)

    print()
    print(
        f"Samples   : "
        f"{metrics['total_samples']}"
    )

    print(
        f"Correct   : "
        f"{metrics['correct_samples']}"
    )

    print()
    print(
        f"Accuracy  : "
        f"{metrics['accuracy']:.4f}"
    )

    print(
        f"Precision : "
        f"{metrics['macro_precision']:.4f}"
    )

    print(
        f"Recall    : "
        f"{metrics['macro_recall']:.4f}"
    )

    print(
        f"Macro F1  : "
        f"{metrics['macro_f1']:.4f}"
    )

    print(
        f"Weighted F1: "
        f"{metrics['weighted_f1']:.4f}"
    )

    print()
    print("Classification Report")
    print("-----------------------------")
    print(
        metrics["classification_report"]
    )

    print()
    print("Confusion Matrix")
    print("-----------------------------")

    print(
        metrics["confusion_matrix"]
    )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    save_results(metrics)

    print()
    print("Results saved:")
    print(
        f"  Report     : "
        f"{BEST_REPORT_PATH}"
    )

    print(
        f"  Confusion  : "
        f"{BEST_CONFUSION_PATH}"
    )

    print(
        f"  Metrics    : "
        f"{BEST_METRICS_PATH}"
    )

    print()
    print("=" * 70)
    print("EVALUATION COMPLETE")
    print("=" * 70)


if __name__ == "__main__":
    main()