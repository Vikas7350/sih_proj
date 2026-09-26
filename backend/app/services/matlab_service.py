import os
import glob
import json
import uuid
import shutil
import tempfile
import subprocess
from typing import Dict, Any, Optional

from app.core.config import (
    MATLAB_EXECUTABLE,
    MATLAB_ROOT,
    MATLAB_TIMEOUT_SECONDS,
    HEATMAP_DIR,
    RETINAL_EVIDENCE_DIR,
    GRADE_DESCRIPTIONS,
)
from app.core.signed_url import sign_url
from app.core.logging import logger
from app.features.screenings.risk import map_grade_to_risk, get_poor_image_risk


class MatlabServiceError(Exception):
    """Base error for MATLAB service interactions."""
    pass


class MatlabExecutableNotFoundError(MatlabServiceError):
    """Raised when MATLAB binary cannot be located."""
    pass


class MatlabExecutionTimeoutError(MatlabServiceError):
    """Raised when MATLAB execution exceeds configured timeout."""
    pass


class MatlabExecutionError(MatlabServiceError):
    """Raised when MATLAB execution fails with non-zero exit code."""
    pass


class MatlabOutputError(MatlabServiceError):
    """Raised when MATLAB output cannot be retrieved or parsed."""
    pass


def resolve_matlab_executable() -> str:
    """Detect and validate the MATLAB executable path across Linux and Windows."""
    # 1. Configured via environment variable / config.py
    if MATLAB_EXECUTABLE and os.path.isfile(MATLAB_EXECUTABLE):
        return MATLAB_EXECUTABLE

    # 2. System PATH
    from_path = shutil.which("matlab")
    if from_path and os.path.isfile(from_path):
        return from_path

    # 3. Known standard Linux & Windows installation directories
    common_paths = [
        # Linux standard paths (AWS EC2 / Server)
        "/usr/local/MATLAB/R2026a/bin/matlab",
        "/usr/local/MATLAB/R2025b/bin/matlab",
        "/usr/local/MATLAB/R2025a/bin/matlab",
        "/usr/local/MATLAB/R2024b/bin/matlab",
        "/usr/local/MATLAB/R2024a/bin/matlab",
        "/usr/bin/matlab",
        "/opt/matlab/bin/matlab",
        # Windows standard paths
        r"C:\Program Files\MATLAB\R2026a\bin\matlab.exe",
        r"C:\Program Files\MATLAB\R2025b\bin\matlab.exe",
        r"C:\Program Files\MATLAB\R2025a\bin\matlab.exe",
        r"C:\Program Files\MATLAB\R2024b\bin\matlab.exe",
        r"C:\Program Files\MATLAB\R2024a\bin\matlab.exe",
    ]
    for p in common_paths:
        if os.path.isfile(p):
            return p

    # 4. Glob search across Linux and Windows
    glob_candidates = sorted(
        glob.glob("/usr/local/MATLAB/*/bin/matlab") + glob.glob(r"C:\Program Files\MATLAB\*\bin\matlab.exe"),
        reverse=True,
    )
    for p in glob_candidates:
        if os.path.isfile(p):
            return p

    raise MatlabExecutableNotFoundError(
        "MATLAB executable not found. Please set MATLAB_EXECUTABLE in backend/.env "
        "or ensure MATLAB is in system PATH."
    )


def resolve_matlab_root() -> str:
    """Validate that the MATLAB project root exists and contains runPipeline.m."""
    root = os.path.abspath(MATLAB_ROOT)
    pipeline_file = os.path.join(root, "runPipeline.m")
    if not os.path.isdir(root) or not os.path.isfile(pipeline_file):
        raise MatlabServiceError(
            f"MATLAB project root invalid or runPipeline.m missing at: {root}"
        )
    return root


def run_matlab_pipeline(image_abs_path: str, screening_id: str) -> Dict[str, Any]:
    """Execute the MATLAB runPipeline.m entrypoint, ingest Grad-CAM, and return
    both complete original matlab_result and frontend-compatible fields.

    Args:
        image_abs_path: Absolute filesystem path to the uploaded image.
        screening_id: Unique screening identifier string.

    Returns:
        Dictionary with mapped status, prediction, risk, explanation,
        image_quality, and complete matlab_result.
    """
    if not image_abs_path or not os.path.isfile(image_abs_path):
        raise FileNotFoundError(f"Screening image file not found: {image_abs_path}")

    matlab_exe = resolve_matlab_executable()
    matlab_root = resolve_matlab_root()

    temp_out = os.path.join(
        tempfile.gettempdir(), f"netracare_matlab_{screening_id}_{uuid.uuid4().hex}.json"
    )

    matlab_root_fwd = matlab_root.replace("\\", "/")
    image_path_fwd = os.path.abspath(image_abs_path).replace("\\", "/")
    temp_out_fwd = temp_out.replace("\\", "/")

    # MATLAB command that runs the pipeline and outputs to a temporary JSON file
    batch_cmd = (
        f"cd('{matlab_root_fwd}'); "
        f"try, "
        f"[jsonStr, ~] = runPipeline('{image_path_fwd}', '{screening_id}'); "
        f"fid = fopen('{temp_out_fwd}', 'w', 'n', 'UTF-8'); "
        f"if fid == -1, error('Failed to open output JSON file'); end; "
        f"fwrite(fid, jsonStr, 'char'); "
        f"fclose(fid); "
        f"catch ME, "
        f"disp(['MATLAB_PIPELINE_ERROR: ' ME.identifier ' - ' ME.message]); "
        f"close all force; exit(1); "
        f"end; "
        f"close all force; exit(0);"
    )

    logger.info(f"Invoking MATLAB pipeline for screening {screening_id} with image {image_abs_path}")
    logger.debug(f"MATLAB Executable: {matlab_exe}")
    logger.debug(f"MATLAB Root: {matlab_root}")

    import concurrent.futures

    def _run_pytorch():
        try:
            from app.services.dr_model_service import run_full_dr_inference
            return run_full_dr_inference(image_abs_path, screening_id)
        except Exception as exc:
            logger.error(f"Concurrent PyTorch DR inference failed for {screening_id}: {exc}")
            return None

    def _run_matlab():
        cmd = [matlab_exe, "-batch", batch_cmd]
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=MATLAB_TIMEOUT_SECONDS,
        )

    # Launch PyTorch DR inference & MATLAB pipeline concurrently in thread pool
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        pytorch_future = executor.submit(_run_pytorch)
        matlab_future = executor.submit(_run_matlab)

        try:
            proc = matlab_future.result()
        except subprocess.TimeoutExpired as exc:
            logger.error(
                f"MATLAB pipeline timed out after {MATLAB_TIMEOUT_SECONDS}s for screening {screening_id}"
            )
            if os.path.exists(temp_out):
                try:
                    os.remove(temp_out)
                except Exception:
                    pass
            raise MatlabExecutionTimeoutError(
                f"MATLAB execution timed out after {MATLAB_TIMEOUT_SECONDS} seconds."
            ) from exc
        except Exception as exc:
            logger.error(f"Failed to spawn MATLAB process: {exc}")
            raise MatlabServiceError(f"Failed to spawn MATLAB process: {exc}") from exc

        pytorch_res = pytorch_future.result()

    if proc.returncode != 0:
        err_msg = proc.stderr.strip() or proc.stdout.strip() or f"Exit code {proc.returncode}"
        logger.error(f"MATLAB execution error for {screening_id}: {err_msg}")
        if os.path.exists(temp_out):
            try:
                os.remove(temp_out)
            except Exception:
                pass
        raise MatlabExecutionError(f"MATLAB pipeline failed: {err_msg}")

    if not os.path.exists(temp_out):
        logger.error(f"MATLAB output JSON not found at: {temp_out}")
        raise MatlabOutputError(
            f"MATLAB finished with code 0 but output JSON was not written to: {temp_out}"
        )

    try:
        with open(temp_out, "r", encoding="utf-8") as f:
            matlab_result = json.load(f)
    except Exception as exc:
        logger.error(f"Failed to parse MATLAB output JSON: {exc}")
        raise MatlabOutputError(f"Malformed JSON returned by MATLAB: {exc}") from exc
    finally:
        try:
            os.remove(temp_out)
        except Exception:
            pass

    # Ingest Grad-CAM and Retinal Evidence images
    heatmap_url = _ingest_gradcam(matlab_result, screening_id)
    explanation = {"heatmap_url": heatmap_url} if heatmap_url else None
    _ingest_retinal_evidence(matlab_result, screening_id)

    # Map decision, status, and PyTorch DR prediction
    mapped = _map_matlab_result_to_screening(
        matlab_result,
        explanation,
        image_abs_path=image_abs_path,
        screening_id=screening_id,
        precomputed_pytorch_res=pytorch_res,
    )
    return mapped


def _ingest_retinal_evidence(matlab_result: Dict[str, Any], screening_id: str) -> None:
    """Copy intermediate MATLAB retinal evidence image artifacts to backend storage
    and replace raw filesystem paths with valid signed URLs."""
    evidence = matlab_result.get("evidence")
    if not isinstance(evidence, dict) or not evidence.get("retinal_analysis"):
        return

    os.makedirs(RETINAL_EVIDENCE_DIR, exist_ok=True)
    ra = evidence["retinal_analysis"]
    matlab_evidence_dir = os.path.join(MATLAB_ROOT, "data", "results", "retinal_evidence")

    # Image mapping definitions: (subdict_key, filename_stem)
    image_mappings = [
        ("microaneurysm", "microaneurysm_candidates.png"),
        ("exudates", "exudate_candidates.png"),
        ("hemorrhage", "hemorrhage_candidates.png"),
        ("vessels", "vessel_mask.png"),
    ]

    for key, filename in image_mappings:
        sub_dict = ra.get(key)
        if isinstance(sub_dict, dict):
            src_path = sub_dict.get("mask_image")
            if not src_path or not os.path.isfile(src_path):
                candidate_src = os.path.join(matlab_evidence_dir, filename)
                if os.path.isfile(candidate_src):
                    src_path = candidate_src

            if src_path and os.path.isfile(src_path):
                target_filename = f"{screening_id}_{filename}"
                target_path = os.path.join(RETINAL_EVIDENCE_DIR, target_filename)
                try:
                    shutil.copyfile(src_path, target_path)
                    url = sign_url("retinal_evidence", target_filename)
                    sub_dict["mask_image"] = url
                    sub_dict["mask_url"] = url
                except Exception as exc:
                    logger.error(f"Failed to copy retinal evidence image {src_path}: {exc}")

    # Process overlays (retinal_analysis_overlay.png, anatomy_overlay.png)
    overlay_mappings = [
        ("retinal_analysis_overlay_image", "retinal_analysis_overlay.png"),
        ("anatomy_overlay_image", "anatomy_overlay.png"),
    ]

    for field_name, filename in overlay_mappings:
        src_path = os.path.join(matlab_evidence_dir, filename)
        if os.path.isfile(src_path):
            target_filename = f"{screening_id}_{filename}"
            target_path = os.path.join(RETINAL_EVIDENCE_DIR, target_filename)
            try:
                shutil.copyfile(src_path, target_path)
                url = sign_url("retinal_evidence", target_filename)
                ra[field_name] = url
                ra[f"{field_name}_url"] = url
            except Exception as exc:
                logger.error(f"Failed to copy overlay image {src_path}: {exc}")


def ensure_evidence_urls(evidence: Any, screening_id: str) -> Any:
    """Ensure all mask_image and overlay fields in evidence are converted to signed URLs."""
    if not isinstance(evidence, dict) or not evidence.get("retinal_analysis"):
        return evidence

    os.makedirs(RETINAL_EVIDENCE_DIR, exist_ok=True)
    ra = evidence["retinal_analysis"]
    matlab_evidence_dir = os.path.join(MATLAB_ROOT, "data", "results", "retinal_evidence")

    image_mappings = [
        ("microaneurysm", "microaneurysm_candidates.png"),
        ("exudates", "exudate_candidates.png"),
        ("hemorrhage", "hemorrhage_candidates.png"),
        ("vessels", "vessel_mask.png"),
    ]

    for key, filename in image_mappings:
        sub_dict = ra.get(key)
        if isinstance(sub_dict, dict):
            mask_img = sub_dict.get("mask_image") or sub_dict.get("mask_url")
            if isinstance(mask_img, str) and mask_img.startswith("/storage/"):
                sub_dict["mask_url"] = mask_img
                continue

            target_filename = f"{screening_id}_{filename}"
            target_path = os.path.join(RETINAL_EVIDENCE_DIR, target_filename)
            if not os.path.isfile(target_path):
                src = mask_img if (mask_img and os.path.isfile(mask_img)) else os.path.join(matlab_evidence_dir, filename)
                if os.path.isfile(src):
                    try:
                        shutil.copyfile(src, target_path)
                    except Exception:
                        pass

            if os.path.isfile(target_path):
                url = sign_url("retinal_evidence", target_filename)
                sub_dict["mask_image"] = url
                sub_dict["mask_url"] = url
            else:
                sub_dict["mask_image"] = None
                sub_dict["mask_url"] = None

    overlay_mappings = [
        ("retinal_analysis_overlay_image", "retinal_analysis_overlay.png"),
        ("anatomy_overlay_image", "anatomy_overlay.png"),
    ]

    for field_name, filename in overlay_mappings:
        overlay_val = ra.get(field_name) or ra.get(f"{field_name}_url")
        if isinstance(overlay_val, str) and overlay_val.startswith("/storage/"):
            ra[field_name] = overlay_val
            ra[f"{field_name}_url"] = overlay_val
            continue

        target_filename = f"{screening_id}_{filename}"
        target_path = os.path.join(RETINAL_EVIDENCE_DIR, target_filename)
        if not os.path.isfile(target_path):
            src = os.path.join(matlab_evidence_dir, filename)
            if os.path.isfile(src):
                try:
                    shutil.copyfile(src, target_path)
                except Exception:
                    pass

        if os.path.isfile(target_path):
            url = sign_url("retinal_evidence", target_filename)
            ra[field_name] = url
            ra[f"{field_name}_url"] = url
        else:
            ra[field_name] = None
            ra[f"{field_name}_url"] = None

    return evidence


def _ingest_gradcam(matlab_result: Dict[str, Any], screening_id: str) -> Optional[str]:
    """Copy the MATLAB-generated Grad-CAM heatmap to backend storage and return
    its signed URL."""
    gradcam_path = (matlab_result.get("xai") or {}).get("gradcam_path")
    if not gradcam_path or not os.path.isfile(gradcam_path):
        logger.info(f"No Grad-CAM file found or produced for screening {screening_id}")
        return None

    os.makedirs(HEATMAP_DIR, exist_ok=True)
    target_filename = f"{screening_id}.png"
    target_path = os.path.join(HEATMAP_DIR, target_filename)

    try:
        shutil.copyfile(gradcam_path, target_path)
        signed_url = sign_url("heatmaps", target_filename)
        logger.info(f"Ingested Grad-CAM for {screening_id} to {target_path} -> {signed_url}")
        return signed_url
    except Exception as exc:
        logger.error(f"Failed to copy Grad-CAM file {gradcam_path} to {target_path}: {exc}")
        return None


def _map_matlab_result_to_screening(
    matlab_result: Dict[str, Any],
    explanation: Optional[Dict[str, Any]],
    image_abs_path: str = "",
    screening_id: str = "",
    precomputed_pytorch_res: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Map MATLAB pipeline result into MongoDB and frontend compatible fields."""
    decision = str(matlab_result.get("decision", "")).lower()
    action = str(matlab_result.get("action", "")).upper()
    stage = matlab_result.get("stage", "")
    fundus = matlab_result.get("fundus") or {}
    is_fundus = bool(fundus.get("isFundus", False))
    quality = matlab_result.get("quality")
    if isinstance(quality, dict):
        q_status = str(quality.get("status") or "").upper()
    else:
        q_status = str(quality or "").upper()

    # Determine status. Action vocabulary comes from runPipeline.m and
    # docs/contract.md: REJECT, "REJECT / HUMAN REVIEW", RECAPTURE,
    # SPECIALIST REFERRAL, PROCEED.
    if decision == "reject" or action == "REJECT" or not is_fundus:
        # Stage-0 gate: NON_FUNDUS is a hard reject; UNCERTAIN never reaches
        # inference either, but is surfaced to a specialist for review.
        status = "pending" if (decision == "review" and not is_fundus) else "rejected"
    elif action == "RECAPTURE" or q_status in ("POOR", "UNGRADABLE"):
        status = "quality_failed"
    elif action in ("REJECT / HUMAN REVIEW", "HUMAN_REVIEW"):
        status = "pending"
    elif action in ("PROCEED", "SPECIALIST REFERRAL") or decision == "proceed":
        status = "completed"
    else:
        status = "failed"

    # PyTorch DR Inference & Grad-CAM (Only invoked on completed status after Stage 0 & Stage 1 safety gates pass)
    prediction = None
    if status == "completed":
        try:
            if precomputed_pytorch_res and precomputed_pytorch_res.get("prediction"):
                pytorch_res = precomputed_pytorch_res
            else:
                from app.services.dr_model_service import run_full_dr_inference
                pytorch_res = run_full_dr_inference(image_abs_path, screening_id)
            prediction = pytorch_res.get("prediction")
            explanation = pytorch_res.get("explanation")
        except Exception as exc:
            logger.error(f"PyTorch DR inference failed for screening {screening_id}: {exc}")
            # Fallback to MATLAB prediction if available
            pred_dict = matlab_result.get("prediction") or {}
            grade_raw = pred_dict.get("grade")
            if grade_raw is not None and not isinstance(grade_raw, list):
                try:
                    grade = int(grade_raw)
                    label = pred_dict.get("label", f"Grade {grade}")
                    conf_dict = matlab_result.get("confidence") or {}
                    raw_conf = conf_dict.get("raw", 0.0)

                    prediction = {
                        "grade": grade,
                        "label": label,
                        "description": GRADE_DESCRIPTIONS.get(grade, "Consult specialist."),
                        "confidence": raw_conf,
                        "calibrated_confidence": None,
                    }
                except (ValueError, TypeError):
                    prediction = None

    # Risk mapping
    if status == "completed" and prediction:
        risk = map_grade_to_risk(prediction["grade"])
    elif status == "quality_failed":
        risk = get_poor_image_risk()
    elif status == "rejected":
        risk = {
            "level": "recapture",
            "label": "REJECT",
            "description": "Image rejected by safety validation (non-fundus or severe artifact).",
            "recommendation": "Recapture valid retinal image",
            "action_required": "Ensure camera is aligned with patient retina and recapture",
            "follow_up_timeframe": "Immediate",
        }
    elif status == "pending":
        risk = {
            "level": "monitor",
            "label": "HUMAN REVIEW",
            "description": "Screening flagged for specialist review.",
            "recommendation": "Ophthalmologist review required",
            "action_required": "Schedule clinical assessment with eye specialist",
            "follow_up_timeframe": "ASAP",
        }
    else:
        risk = None

    # Image Quality summary for frontend
    q_score = (
        round(quality.get("score", 0.0), 3)
        if isinstance(quality, dict) and quality.get("score") is not None
        else (1.0 if is_fundus else 0.0)
    )
    q_checks = quality.get("checks", {}) if isinstance(quality, dict) else {}
    if not isinstance(q_checks, dict):
        q_checks = {}
    image_quality = {
        "status": "good" if q_status in ("GOOD", "ACCEPTABLE") else "poor",
        "score": q_score,
        "checks": {
            "resolution": bool(q_checks.get("resolution", True)) if is_fundus else False,
            "blur": bool(q_checks.get("focus", True)) if is_fundus else False,
            "brightness": bool(q_checks.get("illumination", True)) if is_fundus else False,
            "contrast": bool(q_checks.get("contrast", True)) if is_fundus else False,
            "fundus_structure": is_fundus,
            "fundus_visibility": is_fundus,
        },
        "issues": matlab_result.get("reasons") or [],
        "action": matlab_result.get("action"),
    }

    sanitized_matlab = _sanitize_for_storage(matlab_result)
    return {
        "status": status,
        "prediction": prediction,
        "risk": risk,
        "explanation": explanation,
        "image_quality": image_quality,
        # Complete preservation of original MATLAB data (minus raw pixel masks)
        "matlab_result": sanitized_matlab,
        "stage": stage,
        "decision": decision,
        "action": action,
        "fundus": _sanitize_for_storage(fundus),
        "quality": _sanitize_for_storage(quality),
        "enhancement": _sanitize_for_storage(matlab_result.get("enhancement")) if isinstance(matlab_result.get("enhancement"), dict) else None,
        "evidence": _sanitize_for_storage(matlab_result.get("evidence")),
        "reasons": matlab_result.get("reasons"),
    }


def _sanitize_for_storage(data: Any) -> Any:
    """Recursively strip raw 2D pixel image arrays (e.g. fovMask, vesselMask)
    from MATLAB results so they fit comfortably within MongoDB's 16MB document
    limit while preserving all metrics, scores, and clinical metadata."""
    if isinstance(data, dict):
        clean = {}
        for k, v in data.items():
            if k in ("fovMask", "vesselMask", "rawMask", "maskMatrix"):
                continue
            clean[k] = _sanitize_for_storage(v)
        return clean
    elif isinstance(data, list):
        if len(data) > 100 and all(isinstance(x, list) for x in data[:5]):
            return None
        return [_sanitize_for_storage(x) for x in data]
    return data
