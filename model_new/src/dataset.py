from pathlib import Path

import pandas as pd
import torch
from PIL import Image
from sklearn.model_selection import train_test_split
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms


# ============================================================
# Configuration
# ============================================================

DATA_DIR = Path("data")

CSV_PATH = DATA_DIR / "train.csv"
IMAGE_DIR = DATA_DIR / "train_images"

IMAGE_SIZE = 224

NUM_CLASSES = 5

CLASS_NAMES = {
    0: "No DR",
    1: "Mild DR",
    2: "Moderate DR",
    3: "Severe DR",
    4: "Proliferative DR",
}


# ============================================================
# Transforms
# ============================================================

TRAIN_TRANSFORM = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),

    transforms.RandomHorizontalFlip(p=0.5),

    transforms.RandomRotation(
        degrees=10
    ),

    transforms.ColorJitter(
        brightness=0.15,
        contrast=0.15,
        saturation=0.10,
        hue=0.02,
    ),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


VAL_TRANSFORM = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


# ============================================================
# Dataset
# ============================================================

class APTOSDataset(Dataset):

    def __init__(
        self,
        dataframe,
        image_dir,
        transform=None,
    ):

        self.df = dataframe.reset_index(drop=True)

        self.image_dir = Path(image_dir)

        self.transform = transform

    def __len__(self):

        return len(self.df)

    def __getitem__(self, index):

        row = self.df.iloc[index]

        image_id = row["id_code"]

        label = int(row["diagnosis"])

        image_path = self.image_dir / f"{image_id}.png"

        if not image_path.exists():

            raise FileNotFoundError(
                f"Image not found: {image_path}"
            )

        image = Image.open(image_path).convert("RGB")

        if self.transform is not None:

            image = self.transform(image)

        return image, label


# ============================================================
# Load and split APTOS
# ============================================================

def create_datasets(
    validation_size=0.20,
    random_state=42,
):

    if not CSV_PATH.exists():

        raise FileNotFoundError(
            f"CSV not found: {CSV_PATH}"
        )

    if not IMAGE_DIR.exists():

        raise FileNotFoundError(
            f"Image directory not found: {IMAGE_DIR}"
        )

    df = pd.read_csv(CSV_PATH)

    # --------------------------------------------------------
    # Validate columns
    # --------------------------------------------------------

    required_columns = {
        "id_code",
        "diagnosis",
    }

    missing_columns = required_columns - set(df.columns)

    if missing_columns:

        raise ValueError(
            f"Missing columns: {missing_columns}"
        )

    # --------------------------------------------------------
    # Validate labels
    # --------------------------------------------------------

    labels = set(df["diagnosis"].unique())

    invalid_labels = labels - set(range(NUM_CLASSES))

    if invalid_labels:

        raise ValueError(
            f"Invalid diagnosis labels: {invalid_labels}"
        )

    # --------------------------------------------------------
    # Verify images
    # --------------------------------------------------------

    missing_images = []

    for image_id in df["id_code"]:

        image_path = IMAGE_DIR / f"{image_id}.png"

        if not image_path.exists():

            missing_images.append(image_id)

    if missing_images:

        raise FileNotFoundError(
            f"{len(missing_images)} images are missing."
        )

    # --------------------------------------------------------
    # Stratified split
    # --------------------------------------------------------

    train_df, val_df = train_test_split(
        df,
        test_size=validation_size,
        random_state=random_state,
        stratify=df["diagnosis"],
    )

    print()
    print("Dataset")
    print("-----------------------------")
    print(f"Total images      : {len(df)}")
    print(f"Training images   : {len(train_df)}")
    print(f"Validation images : {len(val_df)}")

    print()
    print("Training distribution:")
    print(
        train_df["diagnosis"]
        .value_counts()
        .sort_index()
    )

    print()
    print("Validation distribution:")
    print(
        val_df["diagnosis"]
        .value_counts()
        .sort_index()
    )

    # --------------------------------------------------------
    # Create datasets
    # --------------------------------------------------------

    train_dataset = APTOSDataset(
        train_df,
        IMAGE_DIR,
        transform=TRAIN_TRANSFORM,
    )

    val_dataset = APTOSDataset(
        val_df,
        IMAGE_DIR,
        transform=VAL_TRANSFORM,
    )

    return train_dataset, val_dataset, train_df, val_df


# ============================================================
# Class weights
# ============================================================

def calculate_class_weights(train_df):

    counts = (
        train_df["diagnosis"]
        .value_counts()
        .sort_index()
    )

    total = len(train_df)

    weights = []

    for class_id in range(NUM_CLASSES):

        count = counts.get(class_id, 0)

        if count == 0:

            raise ValueError(
                f"Class {class_id} has zero training samples."
            )

        weight = total / (
            NUM_CLASSES * count
        )

        weights.append(weight)

    return torch.tensor(
        weights,
        dtype=torch.float32,
    )


# ============================================================
# DataLoaders
# ============================================================

def create_dataloaders(
    batch_size=16,
    num_workers=0,
):

    (
        train_dataset,
        val_dataset,
        train_df,
        val_df,
    ) = create_datasets()

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=torch.cuda.is_available(),
    )

    class_weights = calculate_class_weights(
        train_df
    )

    return (
        train_loader,
        val_loader,
        class_weights,
        train_df,
        val_df,
    )