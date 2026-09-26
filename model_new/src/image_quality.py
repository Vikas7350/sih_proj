import argparse
import json
from pathlib import Path

import cv2
import numpy as np


# ============================================================
# Configuration
# ============================================================

MIN_WIDTH = 640
MIN_HEIGHT = 480

# Brightness thresholds
MIN_BRIGHTNESS = 35
MAX_BRIGHTNESS = 220

# Contrast threshold
MIN_CONTRAST = 25

# Blur threshold
# This is based on variance of Laplacian.
MIN_BLUR_SCORE = 3.0

# Minimum estimated fundus visibility
MIN_FUNDUS_VISIBILITY = 0.50


# ============================================================
# Load image
# ============================================================

def load_image(image_path):
    image = cv2.imread(
        str(image_path)
    )

    if image is None:
        raise ValueError(
            f"Unable to read image:\n{image_path}"
        )

    return image


# ============================================================
# Resolution
# ============================================================

def check_resolution(image):
    height, width = image.shape[:2]

    passed = (
        width >= MIN_WIDTH
        and height >= MIN_HEIGHT
    )

    return {
        "width": int(width),
        "height": int(height),
        "passed": bool(passed),
    }


# ============================================================
# Brightness
# ============================================================

def calculate_brightness(image):
    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    return float(
        np.mean(gray)
    )


def check_brightness(
    brightness,
):
    if brightness < MIN_BRIGHTNESS:

        return {
            "value": brightness,
            "passed": False,
            "status": "TOO_DARK",
        }

    if brightness > MAX_BRIGHTNESS:

        return {
            "value": brightness,
            "passed": False,
            "status": "TOO_BRIGHT",
        }

    return {
        "value": brightness,
        "passed": True,
        "status": "GOOD",
    }


# ============================================================
# Contrast
# ============================================================

def calculate_contrast(image):
    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    return float(
        np.std(gray)
    )


def check_contrast(
    contrast,
):
    return {
        "value": contrast,
        "passed": bool(
            contrast >= MIN_CONTRAST
        ),
        "status": (
            "GOOD"
            if contrast >= MIN_CONTRAST
            else "LOW"
        ),
    }


# ============================================================
# Blur / sharpness
# ============================================================

def calculate_blur_score(image):
    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    laplacian = cv2.Laplacian(
        gray,
        cv2.CV_64F,
    )

    return float(
        laplacian.var()
    )


def check_blur(
    blur_score,
):
    return {
        "value": blur_score,
        "passed": bool(
            blur_score >= MIN_BLUR_SCORE
        ),
        "status": (
            "SHARP"
            if blur_score >= MIN_BLUR_SCORE
            else "BLURRY"
        ),
    }


# ============================================================
# Fundus visibility
# ============================================================

def estimate_fundus_visibility(
    image,
):
    """
    Estimate how much of the image contains
    the circular retinal/fundus region.

    This is a heuristic quality check, not
    a retinal segmentation model.
    """

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY,
    )

    # Slight blur helps stabilize thresholding.
    gray_blur = cv2.GaussianBlur(
        gray,
        (9, 9),
        0,
    )

    # Estimate bright retinal region.
    threshold = np.percentile(
        gray_blur,
        20,
    )

    mask = (
        gray_blur > threshold
    ).astype(
        np.uint8
    ) * 255

    # Clean small regions.
    kernel = np.ones(
        (15, 15),
        np.uint8,
    )

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_CLOSE,
        kernel,
    )

    mask = cv2.morphologyEx(
        mask,
        cv2.MORPH_OPEN,
        kernel,
    )

    # Largest connected component.
    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE,
    )

    if not contours:
        return 0.0

    largest = max(
        contours,
        key=cv2.contourArea,
    )

    area = cv2.contourArea(
        largest
    )

    image_area = (
        image.shape[0]
        * image.shape[1]
    )

    visibility = (
        area / image_area
    )

    # Keep result between 0 and 1.
    visibility = max(
        0.0,
        min(1.0, visibility),
    )

    return float(
        visibility
    )


def check_fundus_visibility(
    visibility,
):
    return {
        "value": visibility,
        "passed": bool(
            visibility >= MIN_FUNDUS_VISIBILITY
        ),
        "status": (
            "GOOD"
            if visibility >= MIN_FUNDUS_VISIBILITY
            else "INSUFFICIENT"
        ),
    }


# ============================================================
# Quality score
# ============================================================

def calculate_quality_score(
    resolution,
    brightness,
    contrast,
    blur,
    visibility,
):
    """
    Weighted heuristic score.

    This score is intended for MVP image-quality
    gating and must be calibrated before clinical use.
    """

    # --------------------------------------------------------
    # Resolution score
    # --------------------------------------------------------

    resolution_score = 100.0 if (
        resolution["passed"]
    ) else 40.0

    # --------------------------------------------------------
    # Brightness score
    # --------------------------------------------------------

    brightness_value = (
        brightness["value"]
    )

    if (
        MIN_BRIGHTNESS
        <= brightness_value
        <= MAX_BRIGHTNESS
    ):

        # Best around middle brightness.
        distance = abs(
            brightness_value - 128
        )

        brightness_score = max(
            0.0,
            100.0
            - (
                distance
                / 128.0
                * 40.0
            ),
        )

    else:

        brightness_score = 25.0

    # --------------------------------------------------------
    # Contrast score
    # --------------------------------------------------------

    contrast_value = (
        contrast["value"]
    )

    contrast_score = min(
        100.0,
        (
            contrast_value
            / 60.0
        )
        * 100.0,
    )

    if not contrast["passed"]:
        contrast_score *= 0.5

    # --------------------------------------------------------
    # Blur score
    # --------------------------------------------------------

    blur_value = (
        blur["value"]
    )

    blur_score = min(
        100.0,
        (
            blur_value
            / 200.0
        )
        * 100.0,
    )

    if not blur["passed"]:
        blur_score *= 0.5

    # --------------------------------------------------------
    # Fundus visibility score
    # --------------------------------------------------------

    visibility_score = min(
        100.0,
        visibility["value"]
        * 100.0,
    )

    # --------------------------------------------------------
    # Weighted final score
    # --------------------------------------------------------

    score = (
        resolution_score * 0.15
        + brightness_score * 0.20
        + contrast_score * 0.20
        + blur_score * 0.25
        + visibility_score * 0.20
    )

    return float(
        round(
            score,
            2,
        )
    )


# ============================================================
# Warnings
# ============================================================

def generate_warnings(
    resolution,
    brightness,
    contrast,
    blur,
    visibility,
):
    warnings = []

    if not resolution["passed"]:

        warnings.append(
            "Image resolution is too low."
        )

    if brightness["status"] == "TOO_DARK":

        warnings.append(
            "Image is too dark."
        )

    elif brightness["status"] == "TOO_BRIGHT":

        warnings.append(
            "Image is overexposed."
        )

    if not contrast["passed"]:

        warnings.append(
            "Image contrast is too low."
        )

    if not blur["passed"]:

        warnings.append(
            "Image appears blurry."
        )

    if not visibility["passed"]:

        warnings.append(
            "Fundus region is not clearly visible."
        )

    return warnings


# ============================================================
# Overall assessment
# ============================================================

def assess_image_quality(
    image_path,
):
    image = load_image(
        image_path
    )

    # --------------------------------------------------------
    # Individual checks
    # --------------------------------------------------------

    resolution = check_resolution(
        image
    )

    brightness = check_brightness(
        calculate_brightness(
            image
        )
    )

    contrast = check_contrast(
        calculate_contrast(
            image
        )
    )

    blur = check_blur(
        calculate_blur_score(
            image
        )
    )

    fundus_visibility = (
        estimate_fundus_visibility(
            image
        )
    )

    visibility = (
        check_fundus_visibility(
            fundus_visibility
        )
    )

    # --------------------------------------------------------
    # Warnings
    # --------------------------------------------------------

    warnings = generate_warnings(
        resolution,
        brightness,
        contrast,
        blur,
        visibility,
    )

    # --------------------------------------------------------
    # Quality score
    # --------------------------------------------------------

    quality_score = (
        calculate_quality_score(
            resolution,
            brightness,
            contrast,
            blur,
            visibility,
        )
    )

    # --------------------------------------------------------
    # Overall status
    # --------------------------------------------------------

    # A failed fundamental quality check
    # should reject the image.
    suitable = (
        resolution["passed"]
        and brightness["passed"]
        and contrast["passed"]
        and blur["passed"]
        and visibility["passed"]
    )

    status = (
        "SUITABLE"
        if suitable
        else "INSUFFICIENT"
    )

    # --------------------------------------------------------
    # Result
    # --------------------------------------------------------

    result = {
        "status": status,
        "quality_score": quality_score,

        "resolution": {
            "width": resolution["width"],
            "height": resolution["height"],
            "passed": resolution["passed"],
        },

        "brightness": {
            "value": round(
                brightness["value"],
                2,
            ),
            "status": brightness["status"],
            "passed": brightness["passed"],
        },

        "contrast": {
            "value": round(
                contrast["value"],
                2,
            ),
            "status": contrast["status"],
            "passed": contrast["passed"],
        },

        "blur": {
            "score": round(
                blur["value"],
                2,
            ),
            "status": blur["status"],
            "passed": blur["passed"],
        },

        "fundus_visibility": {
            "score": round(
                visibility["value"],
                4,
            ),
            "status": visibility["status"],
            "passed": visibility["passed"],
        },

        "warnings": warnings,
    }

    return result


# ============================================================
# Pretty print
# ============================================================

def print_result(
    result,
):
    print()
    print("=" * 70)
    print(
        "FUNDUS IMAGE QUALITY ASSESSMENT"
    )
    print("=" * 70)

    print()

    print(
        "Status       :",
        result["status"],
    )

    print(
        "Quality Score:",
        f'{result["quality_score"]:.2f}/100',
    )

    print()

    resolution = result[
        "resolution"
    ]

    print(
        "Resolution   :",
        f'{resolution["width"]}x'
        f'{resolution["height"]}',
        "✓"
        if resolution["passed"]
        else "✗",
    )

    brightness = result[
        "brightness"
    ]

    print(
        "Brightness   :",
        f'{brightness["value"]:.2f}',
        f'({brightness["status"]})',
    )

    contrast = result[
        "contrast"
    ]

    print(
        "Contrast     :",
        f'{contrast["value"]:.2f}',
        f'({contrast["status"]})',
    )

    blur = result[
        "blur"
    ]

    print(
        "Blur score   :",
        f'{blur["score"]:.2f}',
        f'({blur["status"]})',
    )

    visibility = result[
        "fundus_visibility"
    ]

    print(
        "Fundus       :",
        f'{visibility["score"]:.2f}',
        f'({visibility["status"]})',
    )

    print()

    print(
        "Warnings:"
    )

    if result["warnings"]:

        for warning in result[
            "warnings"
        ]:

            print(
                "  -",
                warning,
            )

    else:

        print(
            "  None"
        )

    print()
    print("=" * 70)


# ============================================================
# CLI
# ============================================================

def main():

    parser = argparse.ArgumentParser(
        description=(
            "Fundus image quality "
            "assessment"
        )
    )

    parser.add_argument(
        "--image",
        required=True,
        help="Path to fundus image",
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Print JSON output",
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

    result = assess_image_quality(
        image_path
    )

    if args.json:

        print(
            json.dumps(
                result,
                indent=2,
            )
        )

    else:

        print_result(
            result
        )


if __name__ == "__main__":
    main()