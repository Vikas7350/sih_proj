# NetraCare — Model Selection + Parity Audit
## SIH 2026 | PS 26038 | Phase 1 (forensic, read-only)

Audit authority: the model-selection directive (Phase 1) issued 2026-09-23.
Scope: inventory every model candidate in the workspace, deeply inspect the
checkpoints, verify task/preprocessing/Grad-CAM/MATLAB compatibility, audit
the parity reference and runtime behavior, and select the canonical model.
Read-only phase: nothing modified; only temporary inspection scripts under
`C:\Users\Atharva\AppData\Local\Temp\opencode` were written.

---

## 1. Model inventory (complete)

| Artifact | Size | What it is | Used for |
|---|---|---|---|
| `model/checkpoints/best_model.pth` | 48,648,101 B | Trained 5-class DR checkpoint (dict) | **CANONICAL** |
| `model/nvidia_efficientnet-b0_210412.pth` | 21,452,055 B | ImageNet backbone checkpoint (raw state_dict) | Pretraining source, NOT a task model |
| `Matlab/model/netracare_efficientnet_b0.onnx` | expected ~16 MB | MATLAB runtime model | **MISSING** (Phase-2 export target) |
| `Matlab/model/*.mat` (dlnetwork) | expected ~17.5 MB | MATLAB runtime model | **MISSING** (Phase-2 export target) |

No ONNX, H5, Keras, TFLite, or other serialized model exists anywhere in the
repo. `*.onnx` is gitignored. The two `.pth` files are the ONLY model
artifacts in the workspace.

## 2. Candidate deep inspection (both loaded and examined)

### 2.1 `best_model.pth` (trained, canonical candidate)
- Checkpoint dict keys: `epoch=14`, `best_macro_f1=0.6664791037828073`,
  `class_names=['No DR','Mild DR','Moderate DR','Severe DR','Proliferative DR']`,
  `model_state_dict` (360 keys), `optimizer_state_dict`.
- State dict uses NVIDIA checkpoint naming: `stem.*`, `layers.X.blockY.*`,
  `features.*`, `classifier.fc.weight` `(5, 1280)`. Must be remapped with
  `remap_nvidia_to_torchvision()` before use (`model/src/model.py`).
- Trained on APTOS (5-class ICDR 0–4), softmax head, no separate referable
  head (referable = grade ≥ 2 derived downstream).
- Loadable and inference-verified with torch 2.13.0 / torchvision 0.28.0+cpu.

### 2.2 `nvidia_efficientnet-b0_210412.pth` (backbone, ImageNet)
- Raw state_dict, 360 keys, same NVIDIA naming, `classifier` is `(1000, 1280)`
  → ImageNet 1000-class. This is the pretraining backbone, NOT a DR classifier.
- Only relevant as provenance for the trained weights.

## 3. Classification task (verified)

- Task: multiclass softmax over 5 ICDR grades, order
  `[No DR, Mild DR, Moderate DR, Severe DR, Proliferative DR]`.
- Threshold: referable = grade ≥ 2 (there is no separate binary head).
- Confirmed in `model/src/model.py`, checkpoint `class_names`, and
  `Matlab/config/model_config.m`.

## 4. Preprocessing parity (Python ↔ MATLAB)

- Python (`model/src/predict.py`, `gradcam.py`): PIL RGB →
  `transforms.Resize((224,224))` (PIL `Image.BILINEAR`) → `ToTensor` [0,1] →
  normalize mean [0.485, 0.456, 0.406], std [0.229, 0.224, 0.225].
- MATLAB (`Matlab/model/predictDR.m`): `imread` → pil_bilinear_resize → single
  [0,1] → same ImageNet normalization.
- **Resize bit parity: CONFIRMED.** `pil_bilinear_resize.m` vs Pillow 12.3.0
  `Image.BILINEAR` on an identical randomly-generated 200×150×3 input:
  `max abs diff = 0` (0 / 150,528 pixels differ). An earlier "mismatch" was a
  byte-order bug in my own harness; a clean PNG-input test is exact.
- Consequence: preprocessing feeds the identical tensor to the network in
  Python and MATLAB once the same weights are loaded.

## 5. Performance evidence (reported vs reproducible)

Reported (README / `Matlab/model/model-metrics.md` sources):
- Validation n = 733; accuracy 0.8090; macro P 0.6588, R 0.6781, F1 0.6636;
  weighted F1 0.8134; per-class No DR F1 0.9707 (361), Mild 0.6279 (74),
  Moderate 0.7513 (200), Severe 0.4045 (39), Proliferative 0.5636 (59).
- Checkpoint is internally consistent with this family: embedded
  `best_macro_f1 = 0.6665` vs reported 0.6636 (epoch snapshot, small diff).

NOT independently reproducible:
- `model/data/train.csv` is MISSING; `train_images/` contains only
  `synthetic_test.png`; `model/results/` has no metrics/confusion/report JSONs.
- Conclusion: reported metrics are consistent with the checkpoint but CANNOT
  be re-derived in this workspace. Flag for the record; not a selection
  criterion (no alternative trained model exists).

## 6. Python parity reference forensics

`Matlab/data/results/python_parity_reference.json` (7 entries SCR-0001..0007):
- `image_path` = `C:\Users\ysyas\RentoAI\backend\storage\uploads\...` →
  generated on a DIFFERENT machine, not this workspace.
- SCR-0005 and SCR-0006 logits/probabilities are byte-identical → internal
  anomaly; and the corresponding image files are MISSING locally.
- Local content mapping is OFFSET vs the reference: local `SCR-0002` content
  (md5 8ae…) produces the probability vector the reference attributes to
  SCR-0001; local `SCR-0003` (md5 5c59…) matches reference SCR-0002.
- Real-model inference on local files (best_model.pth):
  - raw+uploads SCR-0002 → `[0.5671, 0.0223, 0.0280, 0.1924, 0.1901]` = ref SCR-0001
  - raw+uploads SCR-0003 → `[0.3988, 0.0469, 0.0885, 0.1864, 0.2794]` = ref SCR-0002
  - raw SCR-0001 (md5 3eee…) → `[0.1402, ...]` matches NO reference entry
  - uploads/SCR-0004 → `[0.0021, 0.0032, 0.0341, 0.2811, 0.6796]` grade 4, matches NO entry
  - SCR-0055 → `[0.9494, ...]` No DR
- Content duplicates (md5): {0044,0049,0058,0045-0048}, {0004,0060,0064,0065},
  {0052,0059}, {0055,0063}, {0061,0069}. uploads/SCR-0001 == raw+uploads
  SCR-0003 (md5 5c59…); uploads/SCR-0001 != raw/SCR-0001 (3eee…).
- **Conclusion: the parity reference is NOT reproducible/trustworthy in this
  workspace** (foreign paths, missing images, filename offsets, duplicated
  logits). It cannot serve as MATLAB-parity ground truth; a fresh local
  reference must be generated in the parity phase.

## 7. Grad-CAM

- Python (`model/src/gradcam.py`): target layer `model.features[8][0]`
  (torchvision naming), i.e. the final conv block of EfficientNet-B0
  (1280 channels) before the classifier.
- MATLAB (`Matlab/xai/generateGradCAM.m`): `cfg.xai.*` placeholders
  `x_features_featu_469` / `x_classifier_classif` derived from the TO-BE
  IMPORTED ONNX layer names. These MUST be re-derived from the actual import
  (Phase 2), not trusted as literals.
- `gradCAM()` function exists in the installed Deep Learning Toolbox (verified).

## 8. MATLAB compatibility (environment verified)

- MATLAB R2026a Update 5 (`26.1.0.3346908`) at
  `C:\Program Files\MATLAB\R2026a\bin\matlab.exe`. Windows 11.
- Deep Learning Toolbox 26.1, Image Processing Toolbox 26.1, Statistics and
  Machine Learning Toolbox, Medical Imaging Toolbox, Parallel Computing
  Toolbox, GPU Coder, SimEvents, Simulink present in `ver`.
- `importNetworkFromONNX` = 2, `importONNXNetwork` = 2, `gradCAM` = 2 (present).
- `license('test')`: Image_Toolbox=1, Neural_Network_Toolbox=1,
  **Computer_Vision_Toolbox=0, Video_Toolbox=0** (CV shown in `ver` but not
  licensed → do not rely on CV-toolbox functions).

## 9. Gap analysis: stubs, placeholders, and doc inaccuracies

| Item | Status |
|---|---|
| Deep inference in MATLAB | **PLACEHOLDER**: `predictDR.m` emits a uniform softmax (confidence.raw=0.2 per class) until `netracare_efficientnet_b0.onnx` / `.mat` exists |
| Model files `Matlab/model/*.onnx`, `*.mat` | MISSING (gitignore'd) — Phase-2 export targets |
| `Matlab/config/model_config.m` XAI layer names | Placeholder names, re-derive after ONNX import |
| `python_parity_reference.json` | Foreign origin; unusable as ground truth (see §6) |
| Docs claiming `model/matlab/` has "zero external callers" | **STALE/WRONG**: `Matlab/runPipeline.m` calls it via local `runRetinalEvidence` (L244→350, addpath + onCleanup rmpath) |
| `model/matlab/assessQuality.m` (no fov, own cfg) vs `Matlab/quality/assessQuality.m` (pipeline cfg) | Duplicate; runPipeline resolves to `Matlab/quality/assessQuality.m`. Do not delete |
| Backend tests `backend/app/model/*` | Stale: fail at collection (wrong checkpoint path, `image_classification`/`dataset` import errors). Use `--ignore=app/model` |

## 10. Risk + versioning

- `model_version` = `EfficientNet-B0-APTOS-v1`; `pipeline_version` =
  `0.1.0-parity` (from `model_config.m`, emitted in every result).
- Risk: no artifact links the checkpoint to a specific APTOS train/val split,
  so the reported numbers cannot be re-run; acceptable because it is the only
  trained DR model and is inference-consistent.
- Risk: CV Toolbox unlicensed; keep the pipeline to IPT + DL Toolbox functions
  (already the case).

## 11. Parity data (to be regenerated)

- Current reference unusable (§6). Phase-3 parity MUST generate a fresh
  Python reference on this machine (`model/src/predict.py` against local
  SCR images plus 1–3 real fundus images) and compare against MATLAB
  `runPipeline`-level logits. Only images passing the fundus gate
  (e.g. SCR-0062, SCR-0044) are meaningful end-to-end inputs.

## 12. Runtime verification (direct observations, R2026a)

- `runPipeline` on `uploads/SCR-0062.jpg` (passes fundus gate): 4.4 s,
  `status=GOOD`, `prediction=No DR`, `confidence.raw=0.2` (placeholder),
  `referable=false`, `xai.gradcam_path=""` (no model → no heatmap; honest per
  contract §5), top-level keys exactly the 16 contract fields.
- `runPipeline` on `uploads/SCR-0003.jpg` (the reference "default"):
  `status=NON_FUNDUS` rejected at Stage 0 — the default benchmark image does
  NOT pass the fundus gate, so deep inference is never reached on it.
- Fundus gate behavior: PASS FUNDUS = SCR-0062, SCR-0044; REJECT NON_FUNDUS =
  SCR-0001, 0002, 0004, 0055, 0066; UNCERTAIN = SCR-0050.
- Backend pytest (with `--ignore=app/model`): 52 passed, 12 failed in 521 s.
  The analyze-endpoint failures (`assert 'completed' == 'rejected'`) are
  consistent with the Stage-0 gate rejecting the synthetic test uploads —
  deep inference never ran because no imported model exists.

## 13. Decision backup

- If ONNX export of `best_model.pth` fails on ops (SqueezeExcitation,
  fused BN, torch export version), fall back is: export to ONNX opset from a
  freshly constructed `NetraCareModel` loaded via `remap_nvidia_to_torchvision`
  (this is already the code path that inference uses). Layer-naming for XAI is
  recovered from the import dump, NOT from `model_config.m` literals.

## 14. Changed-mind protocol

- Switch canonical model only if a code-corrupted checkpoint or an
  alternative trained 5-class checkpoint (never found in inventory) is
  produced. Any switch requires re-running the deep inspection of §2 and the
  runtime verification of §12 against the new artifact.

## 15. Conclusion

### CANONICAL MODEL
```
model/checkpoints/best_model.pth
EfficientNet-B0 | 5-class DR (ICDR 0-4) | softmax
Load (Python):
    from model.src.model import NetraCareModel, remap_nvidia_to_torchvision
    m = NetraCareModel()
    m.load_state_dict(remap_nvidia_to_torchvision(ckpt["model_state_dict"]))
Reference implementation of preprocessing+inference:
    model/src/predict.py, model/src/gradcam.py
Task head order: [No DR, Mild, Moderate, Severe, Proliferative]
Referable threshold: grade >= 2
```
Export target for Phase 2: `Matlab/model/netracare_efficientnet_b0.onnx`
(+ optional `.mat` dlnetwork), verified logit-parity against `best_model.pth`.

### Blockers
- **P0** ONNX model absent → MATLAB deep inference is a placeholder (uniform
  softmax). Export + import is the next (Phase-2) work; nothing downstream
  (backend completed-screening path, Grad-CAM, parity) is real without it.
- **P1** Parity reference unusable (foreign paths, missing files, filename
  offsets, duplicated logits) → regenerate on this machine in Phase 3.
- **P1** MATLAB Grad-CAM layer names in `model_config.m` are guesses; must be
  re-derived from the actual ONNX import.
- **P1** Reported metrics not independently reproducible (train.csv / results
  missing); documented, not blocking.
- **P2** CV Toolbox license=0; stale `backend/app/model` tests; most benchmark
  images are synthetic and fail the fundus gate (use SCR-0062 / SCR-0044 as
  FUNDUS fixtures).

Model audit complete (read-only).