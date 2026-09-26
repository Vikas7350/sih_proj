from pathlib import Path

import cv2
import numpy as np
import pandas as pd


DATA_DIR = Path("data/train_images")
CSV_PATH = Path("data/train.csv")


def blur_score(image):
    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    laplacian = cv2.Laplacian(
        gray,
        cv2.CV_64F
    )

    return float(
        laplacian.var()
    )


def main():

    df = pd.read_csv(
        CSV_PATH
    )

    scores = []

    print(
        f"Analyzing {len(df)} images..."
    )

    for i, row in df.iterrows():

        image_path = (
            DATA_DIR
            / f'{row["id_code"]}.png'
        )

        image = cv2.imread(
            str(image_path)
        )

        if image is None:
            continue

        score = blur_score(
            image
        )

        scores.append(
            {
                "id_code": row["id_code"],
                "diagnosis": row["diagnosis"],
                "blur_score": score,
            }
        )

        if (i + 1) % 500 == 0:

            print(
                f"Processed "
                f"{i + 1}/{len(df)}"
            )

    result = pd.DataFrame(
        scores
    )

    print()
    print("=" * 70)
    print("BLUR SCORE DISTRIBUTION")
    print("=" * 70)

    print()

    print(
        result["blur_score"].describe(
            percentiles=[
                0.01,
                0.05,
                0.10,
                0.25,
                0.50,
                0.75,
                0.90,
                0.95,
                0.99,
            ]
        )
    )

    print()
    print(
        "=" * 70
    )
    print(
        "BLUR SCORE BY DR CLASS"
    )
    print(
        "=" * 70
    )

    print()

    print(
        result.groupby(
            "diagnosis"
        )["blur_score"].describe()
    )

    output = (
        Path("results")
        / "dataset_quality_analysis.csv"
    )

    output.parent.mkdir(
        exist_ok=True
    )

    result.to_csv(
        output,
        index=False
    )

    print()
    print(
        "Saved:",
        output
    )


if __name__ == "__main__":
    main()