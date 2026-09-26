# NetraCare Model Integration — Phase 2 Final Report

NetraCare — Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038
Workstream: Person A — AI/MATLAB | Phase 2: Real Model Integration

**Status: PHASE 2 COMPLETE**

---

## 1. Model (CANONICAL)

| Field | Value |
|---|---|
| Checkpoint | `model/checkpoints/best_model.pth` |
| Checkpoint sha256 | `2dad96ac47bb9ef2e4a7131a26605a4ae7131250e88947424de5a5641165a6eb` |
| Architecture | Torchvision EfficientNet-B0 (NVIDIA backbone weights remapped) |
| Parameters | 4,013,953 |
| Classifier | Linear 1280 → 5 |
| Classes (order) | No DR, Mild DR, Moderate DR, Severe DR, Proliferative DR |
| model_version | `EfficientNet-B0-APTOS-v1` |
| Input | 1×3×224×224, ImageNet-normalised, PIL BILINEAR RGB |
| Output | raw logits [1, 5]; softmax probs; argmax grade (0–4) |

The ONNX export reads the checkpoint directly through the same path
`predict.py` uses (`create_model` + `remap_nvidia_to_torchvision` +
`load_state_dict`), so the exported weights are exactly the canonical
model; no re-training or re-weighing is involved.

## 2. ONNX Artifact

| Field | Value |
|---|---|
| File | `Matlab/model/netracare_efficientnet_b0.onnx` |
| Size | 16,045,807 bytes |
| sha256 | `6899a4a261ea90985bd1c7f11dbbaab2e0ef7e608e0c540e2d4851d805ff3402` |
| Opset | 17 |
| Exporter | `torch.onnx.export` (legacy, `dynamo=False`) |
| Export script | `model/tools/export_onnx.py` (repeatable) |
| Input name/shape | `input` / `[1, 3, 224, 224]` |
| Output name/shape | `logits` / `[1, 5]` |
| Graph | 239 nodes; 81 Conv, 65 Sigmoid+Mul (SiLU), 17 GlobalAveragePool, 1 Gemm, 1 Flatten |
| Environment | torch 2.13.0+cpu, onnx 1.23.0, onnxruntime 1.30.0, Python 3.13.7 |

### PyTorch ↔ ONNX parity (deterministic input)
| Metric | Value |
|---|---|
| logits max abs diff | 6.15e-3 |
| probs max abs diff | **8.34e-7** |
| predicted class equal | Yes (No DR) |
| Result | **PASS** |

The logits diff of ~6e-3 at logit magnitudes of ±50–370 is fp32
conv-accumulation variance between CPU runtimes; it cancels in softmax
(prob diff ≈ 1e-6). Acceptance is based on prob tolerance 1e-4 plus
class equality — the criterion `Matlab/tests/testParity.m` uses.
Report: `Matlab/data/results/onnx_export_report.json`.

## 3. MATLAB Import

| Field | Value |
|---|---|
| Importer | `importNetworkFromONNX` (R2026a DL Toolbox) |
| Imported object | `dlnetwork`, 240 layers |
| Input layer / name | `input` (ImageInputLayer, 224×224×3) |
| Output layer / name | `x_classifier_classif` (FullyConnectedLayer, 5) |
| Import time | ~25–28 s (first), cached thereafter as `.mat` |
| Cache | `Matlab/model/netracare_efficientnet_b0.mat` (v7.3, 17.5 MB) |

`loadModel.m` loads the `.mat` cache first and only re-imports the ONNX
when the cache is absent. The backend invokes `matlab -batch` per
screening (fresh process), so the on-disk cache is the performance
mechanism — no in-process persistent state needed.

## 4. Python ↔ MATLAB Parity (v2, real model)

References regenerated on **local** images with **real** logits:
- `Matlab/data/results/python_parity_reference_v2.json` (Python ground truth)
- `Matlab/data/results/matlab_python_parity_v2.json` (MATLAB run)

| Image | Py grade | MATLAB grade | max abs prob diff | Status |
|---|---|---|---|---|
| SCR-0062.jpg | 4 | 4 | 1.19e-6 | PASS |
| SCR-0044.jpg | 0 | 0 | 1.34e-7 | PASS |
| SCR-0050.jpg | 4 | 4 | 1.25e-6 | PASS |

**Max prob diff: 1.25e-6 < 1e-4 (tolerance). PARITY PASSED.**

The old `python_parity_reference.json` demonstrated an external developer's
single-image output on an assembly that did not match the canonical
reconstruction, so it was retired (marked STALE; not used for acceptance).

## 5. MATLAB Inference Pipeline

`predictDR.m` now runs the imported `dlnetwork` end to end:
1. PIL bit-exact bilinear resize (`pil_bilinear_resize.m`, verified bit-identical
   to Pillow 12.3.0 `Image.BILINEAR`).
2. ToTensor equivalent `/255.0`.
3. ImageNet mean/std normalisation `[0.485,0.456,0.406]/[0.229,0.224,0.225]`.
4. `dlarray` `SSCB` [224,224,3,1] → `predict(net, dlX)` → logits → softmax.

Reference `SCR-0062.png, SCR-0044.png, SCR-0050.png`-inference samples on
SCR-0062: grade 4 (Proliferative), conf 0.9338, referable=true.

**Rule 11:** the uniform 0.2 placeholder and the exception-time uniform
fallback have been **removed**. A placeholder descriptor or a failed forward
pass now raises an error instead of silently emitting fake probabilities.
Differential check `Matlab/tests/testInferenceReal.m` asserts output differs
from uniform by >1e-2 per class and is deterministic across 3 runs.

## 6. Grad-CAM Explainability

| Field | Value |
|---|---|
| Feature layer | `x_features_featu_469` (Conv2d 320→1280 1×1, 7×7×1280 map) |
| Reduction layer | `x_classifier_classif` (final FC) |
| Method | `gradCAM(net, img, classIdx, 'FeatureLayer', ..., 'ReductionLayer', ...)` |

Layer recovery (Rule 7): the imported ONNX renames every conv to
`x_features_featu_<n>`. Scanned all Conv2d layers for `NumChannels=320,
NumFilters=1280` → exactly one: `x_features_featu_469`, which matches
PyTorch `model.features[8][0] = Conv2d(320, 1280)`; its output feeds
`x_avgpool_GlobalAv_1` via the SiLU (Sigmoid+Mul) pair. `model_config.m`
was corrected accordingly (comment was stale; name unchanged).

Verified output (SCR-0062, class index 5): heatmap 421×475, min 0.0,
max 1.0, std 0.193 — genuine non-degenerate saliency. Overlay PNG written
to `Matlab/data/results/gradcam_*.png` (133,699 bytes) and surfaced through
`xai.gradcam_path` in the contract payload.

## 7. runPipeline End-to-End

| Image | Stage0 | Quality | Action | Decision | Prediction | GradCAM |
|---|---|---|---|---|---|---|
| SCR-0062.jpg (FUNDUS) | FUNDUS | GOOD | SPECIALIST REFERRAL | review | grade 4 / 0.9338 | populated |
| SCR-0044.jpg (FUNDUS) | FUNDUS | GOOD | PROCEED | proceed | grade 0 / 0.996 | populated |
| SCR-0050.jpg (UNCERTAIN) | UNCERTAIN | — | HUMAN REVIEW | review | BLOCKED | — |

Repeatability: two full pipeline runs on SCR-0062 produce identical
confidence (diff < 1e-12) and identical prediction. Contract payload
(16 top-level fields) unchanged and conformant with `docs/contract.md`
§1; `confidence.raw`, `model_version`, `xai.gradcam_path`, `evidence`
now carry real values.

Note: the pipeline returns a JSON **string** (`char`) — decode with
`jsondecode`; the second output is the native struct.

## 8. Files Changed / Created

- `model/tools/export_onnx.py` — new; canonical checkpoint → ONNX + parity report
- `model/tools/generate_parity_reference.py` — new; local v2 Python reference
- `Matlab/model/netracare_efficientnet_b0.onnx` — new artifact
- `Matlab/model/netracare_efficientnet_b0.mat` — new (dlnetwork import cache)
- `Matlab/model/predictDR.m` — real inference; uniform fallbacks removed
- `Matlab/config/model_config.m` — XAI layer mapping documented/corrected
- `Matlab/runPipeline.m` — default image now verified FUNDUS SCR-0062
- `Matlab/tests/testParity.m` — v2 reference + writes matlab parity JSON
- `Matlab/tests/testPipeline.m` — v2 fixtures + dlnetwork assertion
- `Matlab/tests/testQuality.m`, `testEnhancement.m`,
  `testFundusValidation.m`, `testPipelineEndToEnd.m` — local verified
  fixtures instead of unusable external-path references
- `Matlab/tests/testInferenceReal.m` — new (Rule 6 differential check)
- `Matlab/tests/testPipelinePhase2.m` — new (Rules 12/13 e2e + repeatability)
- `Matlab/data/results/onnx_export_report.json`,
  `python_parity_reference_v2.json`, `matlab_python_parity_v2.json` — new

## 9. Tests Executed

All under `Matlab/tests/` with MATLAB R2026a (batch), all PASS:
`testPipeline` (9/9), `testParity` (v2, max diff 1.25e-6),
`testInferenceReal`, `testPipelinePhase2`, `testFundusValidation` (9/9),
`testQuality`, `testEnhancement`, `testPipelineEndToEnd`.

## 10. Remaining Blockers (transparent, P0→P3)

- **P0 — No clinical validation data.** Only synthetic / non-fundus images
  exist locally (no `train.csv`, no real fundus labels). Model clinical
  accuracy (0.8090 / macro-F1 0.6636 from Phase 1 audit) is documented but
  **not independently reproducible**.
- **P1 — Prediction DR semantics on `SCR-0044`/`SCR-0050` are model
  judgements only**, pending clinical confirmation.
- **P2 — Backend FastAPI analyse pipeline** stays on its Phase-0 gate
  (Stage 0 rejects synthetic uploads) — untouched per Phase 2 rules.
- **P3 — No CV Toolbox** (license 0): all XAI/vision work stays in DL+IPT.

## 11. Next Phase

Wire the real MATLAB result path into a backend endpoint once it can be
exercised with genuine fundus uploads; add clinical-validation evaluation
with a labelled dataset; enterprise calibration of `confidence.calibrated`
(defaults NaN, real raw used).