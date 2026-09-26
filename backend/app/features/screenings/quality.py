import cv2
import numpy as np
from typing import Dict, List, Tuple


MIN_WIDTH = 512
MIN_HEIGHT = 512
BLUR_THRESHOLD = 100.0
BRIGHTNESS_MIN = 40
BRIGHTNESS_MAX = 220
CONTRAST_THRESHOLD = 30.0

# Fundus-plausibility heuristics (see check_fundus_structure)
FUNDUS_CORNER_BRIGHTNESS_MAX = 60.0   # corners darker than this => plausible aperture vignette
FUNDUS_RED_DOMINANCE_MARGIN = 25.0    # mean R must exceed mean G and B by this much
FUNDUS_MIN_CIRCULARITY = 0.70         # contour area / min-enclosing-circle area floor
FUNDUS_MIN_ASPECT_RATIO = 0.40        # largest-region bounding-box aspect floor
FUNDUS_CORNER_PATCH_FRACTION = 0.15   # corner sample size as a fraction of the smallest side
FUNDUS_MAX_FAILED_SUBCHECKS = 1       # overall fails when more than this many sub-checks fail


def check_resolution(img) -> Tuple[bool, str]:
    h, w = img.shape[:2]
    if w < MIN_WIDTH or h < MIN_HEIGHT:
        return False, f"Resolution too low ({w}x{h}, min {MIN_WIDTH}x{MIN_HEIGHT})"
    return True, ""


def check_blur(img) -> Tuple[bool, str]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    if laplacian_var < BLUR_THRESHOLD:
        return False, "Image appears blurry"
    return True, ""


def check_brightness(img) -> Tuple[bool, str]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    mean_brightness = np.mean(gray)
    if mean_brightness < BRIGHTNESS_MIN:
        return False, "Image is too dark"
    if mean_brightness > BRIGHTNESS_MAX:
        return False, "Image is too bright"
    return True, ""


def check_contrast(img) -> Tuple[bool, str]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    contrast = np.std(gray)
    if contrast < CONTRAST_THRESHOLD:
        return False, "Low contrast"
    return True, ""


def _check_corner_darkness(img) -> Tuple[bool, str]:
    """Fundus photos have near-black corners from the camera's circular aperture."""
    h, w = img.shape[:2]
    p = max(8, int(min(h, w) * FUNDUS_CORNER_PATCH_FRACTION))
    corners = [
        img[0:p, 0:p],
        img[0:p, w - p:w],
        img[h - p:h, 0:p],
        img[h - p:h, w - p:w],
    ]
    brightness = max(float(np.mean(cv2.cvtColor(c, cv2.COLOR_BGR2GRAY))) for c in corners)
    if brightness > FUNDUS_CORNER_BRIGHTNESS_MAX:
        return False, "corners are bright (no circular aperture vignette)"
    return True, ""


def _check_color_dominance(img) -> Tuple[bool, str]:
    """Fundus photos are red/orange dominant."""
    b, g, r = (float(v) for v in cv2.mean(img)[:3])
    if r > g + FUNDUS_RED_DOMINANCE_MARGIN and r > b + FUNDUS_RED_DOMINANCE_MARGIN:
        return True, ""
    return False, "image is not red/orange dominant"


def _check_circularity(img) -> Tuple[bool, str]:
    """The illuminated region of a fundus photo is roughly circular/oval."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return False, "no distinct illuminated region found"
    largest = max(contours, key=cv2.contourArea)
    area = cv2.contourArea(largest)
    _, radius = cv2.minEnclosingCircle(largest)
    circle_area = np.pi * radius * radius
    _, _, w, h = cv2.boundingRect(largest)
    aspect = min(w, h) / max(w, h)
    if (
        circle_area > 0
        and area / circle_area >= FUNDUS_MIN_CIRCULARITY
        and aspect >= FUNDUS_MIN_ASPECT_RATIO
    ):
        return True, ""
    return False, "illuminated region is not circular/oval"


def check_fundus_structure(image) -> dict:
    """
    Rule-based plausibility check for whether an image could depict a retinal
    fundus photograph. Returns {"passed": bool, "reason": str | None}.

    This is a heuristic plausibility check, NOT a certified fundus classifier:
    it can have false positives and false negatives.
    """
    sub_checks = (
        _check_corner_darkness(image),
        _check_color_dominance(image),
        _check_circularity(image),
    )
    failed = [reason for ok, reason in sub_checks if not ok]
    passed = len(failed) <= FUNDUS_MAX_FAILED_SUBCHECKS
    reason = "; ".join(failed) if failed and not passed else None
    return {"passed": passed, "reason": reason}


def assess_image_quality(image_path: str) -> Dict:
    img = cv2.imread(image_path)
    if img is None:
        return {
            "status": "poor",
            "score": 0.0,
            "checks": {
                "resolution": False,
                "brightness": False,
                "contrast": False,
                "blur": False,
                "fundus_visibility": False,
                "fundus_structure": False,
            },
            "issues": ["Unable to read image file"],
            "action": "recapture",
        }

    checks = {}
    issues = []

    res_ok, res_msg = check_resolution(img)
    checks["resolution"] = res_ok
    if not res_ok:
        issues.append(res_msg)

    blur_ok, blur_msg = check_blur(img)
    checks["blur"] = blur_ok
    if not blur_ok:
        issues.append(blur_msg)

    bright_ok, bright_msg = check_brightness(img)
    checks["brightness"] = bright_ok
    if not bright_ok:
        issues.append(bright_msg)

    contrast_ok, contrast_msg = check_contrast(img)
    checks["contrast"] = contrast_ok
    if not contrast_ok:
        issues.append(contrast_msg)

    fundus = check_fundus_structure(img)
    checks["fundus_structure"] = fundus["passed"]
    if not fundus["passed"]:
        issues.append("Image does not appear to be a retinal fundus photograph")

    passed = sum(checks.values())
    total = len(checks)
    score = round(passed / total, 2)

    if score >= 0.75:
        status = "good"
        action = None
    else:
        status = "poor"
        action = "recapture"

    if not fundus["passed"]:
        status = "poor"
        action = "recapture"

    # Fundus visibility: heuristic — if resolution, brightness, and blur pass,
    # the retinal fundus is likely visible.  Full CNN-based detection is done by
    # the AI model upstream.
    checks["fundus_visibility"] = checks.get("resolution", False) and checks.get("brightness", False) and checks.get("blur", False)

    return {
        "status": status,
        "score": score,
        "checks": checks,
        "issues": issues,
        "action": action,
    }