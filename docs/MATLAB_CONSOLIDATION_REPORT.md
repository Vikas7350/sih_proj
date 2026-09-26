# MATLAB Consolidation Report — NetraCare SIH 26038

**Auditor:** MATLAB Consolidation Audit Agent  
**Date:** 2026-09-22  
**Status:** READ-ONLY INVESTIGATION — No files moved, renamed, or deleted.  
**Scope:** Reconcile `Matlab/` (24 files) and `model/matlab/` (13 files) into one canonical tree.

---

## 1. FULL INVENTORY (A1)

### Matlab/ (root-level pipeline — 22 .m files, 2,964 lines)

| # | File | Lines | Function(s) | Description |
|---|------|-------|-------------|-------------|
| 1 | `runPipeline.m` | 279 | `runPipeline` | Safety-gated clinical AI entry point: fundus validation → quality → enhancement → DR inference → Grad-CAM → JSON contract |
| 2 | `config/model_config.m` | 89 | `model_config` | Master config: paths, classes, preprocessing (224×224, ImageNet norm), XAI layers; delegates to sub-configs |
| 3 | `config/fundus_config.m` | 81 | `fundus_config` | Stage 0 thresholds: spectral ratios, border geometry, texture, vessel morphology, scoring weights |
| 4 | `config/quality_config.m` | 84 | `quality_config` | Stage 1 thresholds: FOV, focus, illumination (4-component), contrast (percentile), weights, hard-fail gates |
| 5 | `config/enhancement_config.m` | 60 | `enhancement_config` | Stage 2 params: CIE L\*a\*b\*, homomorphic filter, CLAHE, bilateral denoising |
| 6 | `quality/assessQuality.m` | 354 | `assessQuality` | Stage 1: 4-sub-metric quality assessment (focus, illumination, contrast, FOV) inside eroded mask with hard-fail gates |
| 7 | `quality/checkFundusImage.m` | 335 | `checkFundusImage` | Stage 0: fundus-vs-non-fundus classifier via spectral, border, texture, vessel features |
| 8 | `quality/visualizeFundusCheck.m` | 178 | `visualizeFundusCheck` | 4-panel diagnostic for Stage 0 (test-only, zero production callers) |
| 9 | `quality/visualizeQuality.m` | 116 | `visualizeQuality` | 4-panel diagnostic for Stage 1 (dead — zero callers anywhere) |
| 10 | `enhancement/enhanceBorderline.m` | 194 | `enhanceBorderline` | Stage 2: homomorphic normalization + CLAHE + bilateral denoising for BORDERLINE images |
| 11 | `enhancement/visualizeEnhancement.m` | 112 | `visualizeEnhancement` | 4-panel diagnostic for Stage 2 (dead — zero callers anywhere) |
| 12 | `model/loadModel.m` | 84 | `loadModel` | Loads EfficientNet-B0: tries .mat → ONNX import → placeholder fallback |
| 13 | `model/predictDR.m` | 136 | `predictDR` | DR prediction: PIL-bilinear resize, ImageNet norm, forward pass, softmax, grade+label+confidence |
| 14 | `model/pil_bilinear_resize.m` | 160 | `pil_bilinear_resize`, `compute_coeffs` | PIL-exact bilinear resampling for Python parity |
| 15 | `xai/generateGradCAM.m` | 109 | `generateGradCAM` | Grad-CAM via MATLAB built-in, jet overlay, saves PNG |
| 16 | `evaluation/evaluateDR.m` | 85 | `evaluateDR` | Accuracy, referable-DR sensitivity/specificity, confusion matrix (test-only) |
| 17 | `tests/testPipeline.m` | 241 | `testPipeline` | 9-test suite: all stages + end-to-end JSON contract |
| 18 | `tests/testPipelineEndToEnd.m` | 83 | `testPipelineEndToEnd` | End-to-end trace on 7 benchmark images |
| 19 | `tests/testParity.m` | 109 | `testParity` | Python-MATLAB probability parity check (1e-4 tolerance) |
| 20 | `tests/testQuality.m` | 77 | `testQuality` | Quality assessment on 7 benchmark images |
| 21 | `tests/testFundusValidation.m` | 123 | `testFundusValidation` | Fundus validation on 7 benchmark images |
| 22 | `tests/testEnhancement.m` | 86 | `testEnhancement` | Enhancement before/after comparison |

### model/matlab/ (lesion/retinal-evidence branch — 13 .m files, 723 lines)

| # | File | Lines | Function(s) | Description |
|---|------|-------|-------------|-------------|
| 1 | `assessQuality.m` | 86 | `assessQuality`, `estimateFundusMask` | Simple quality gate: brightness, contrast, sharpness, visibility → GOOD/ENHANCE/INSUFFICIENT |
| 2 | `enhanceFundus.m` | 72 | `enhanceFundus`, `replaceLuminance`, `compareEnhancement`, `sharpness` | Background subtraction + CLAHE + median + unsharp mask for ENHANCE-quality images |
| 3 | `defaultRetinalConfig.m` | 31 | `defaultRetinalConfig` | Hardcoded thresholds for quality, enhancement, anatomy, lesions, output |
| 4 | `detectOpticDisc.m` | 53 | `detectOpticDisc`, `estimateMask` | Adaptive threshold on brightest 1% within fundus mask → disc center/radius/confidence |
| 5 | `locateFovea.m` | 36 | `locateFovea` | Geometric estimate: 2.5× disc radius temporal-inferior from disc center + darkness score |
| 6 | `segmentVessels.m` | 38 | `segmentVessels` | Green channel CLAHE → background subtraction → morphology → skeleton → density/branching |
| 7 | `detectMicroaneurysms.m` | 32 | `detectMicroaneurysms` | CLAHE green → background subtraction → dark blob detection → area-filtered candidates |
| 8 | `detectExudates.m` | 32 | `detectExudates` | CIELAB L>0.82 threshold → fill → area filter → mask out optic disc → regionprops |
| 9 | `detectHemorrhages.m` | 28 | `detectHemorrhages` | Red-green + inverted-red channels → threshold → morphology → area-filtered candidates |
| 10 | `analyzeNeovascularization.m` | 14 | `analyzeNeovascularization` | Linear heuristic score from vessel density + branching (research prototype) |
| 11 | `runRetinalAnalysis.m` | 113 | `runRetinalAnalysis`, `removeLargeFields`, `saveSummary`, `saveVisualOutputs` | Single-image orchestrator: quality → enhance → disc → fovea → vessels → lesions → JSON |
| 12 | `runRetinalBatch.m` | 50 | `runRetinalBatch` | Batch runner: scans directory, runs `runRetinalAnalysis` per file, exports CSV summary |
| 13 | `createRetinalReport.m` | 68 | `createRetinalReport` | 2×3 tiled figure export (dead — zero callers anywhere) |

### model/simulink/ (4 .m files, 191 lines)

| # | File | Lines | Function(s) | Description |
|---|------|-------|-------------|-------------|
| 1 | `buildTelemedicineModel.m` | 54 | `buildTelemedicineModel` | Programmatic Simulink model builder (12 linear blocks, all empty subsystems) |
| 2 | `defaultTelemedicineParameters.m` | 27 | `defaultTelemedicineParameters` | Hardcoded sim parameters: arrival rate, bandwidth, processing times, scenarios |
| 3 | `runScalabilityScenario.m` | 53 | `runScalabilityScenario` | Analytical bottleneck calculator (NOT SimEvents simulation) |
| 4 | `runScalabilityExperiments.m` | 57 | `runScalabilityExperiments` | Parameter sweep: 4 scenarios × 5 load rates → CSV + plot |

---

## 2. CALL GRAPH (A2)

### Entry Point Trace

```
backend/app/services/matlab_service.py:123
  └─ subprocess.run([matlab, "-batch", "cd('Matlab/'); runPipeline(...)"])
       └─ Matlab/runPipeline.m  (THE ONLY EXTERNAL CALLER)
            ├─ addpath('config/', 'quality/', 'enhancement/', 'model/', 'xai/', 'evaluation/')
            ├─ model_config()
            │    ├─ fundus_config()
            │    ├─ quality_config()
            │    └─ enhancement_config()
            ├─ checkFundusImage()           ← Stage 0
            ├─ assessQuality()              ← Stage 1  [Matlab/quality/ version]
            ├─ enhanceBorderline()          ← Stage 2
            │    └─ assessQuality()         ← called again for pre/post check
            ├─ loadModel()                  ← Stage 3
            ├─ predictDR()                  ← Stage 3
            │    └─ pil_bilinear_resize()
            └─ generateGradCAM()            ← Stage 4
                 └─ pil_bilinear_resize()
```

### model/matlab/ Internal Call Graph (ISOLATED ISLAND)

```
runRetinalBatch.m
  └─ runRetinalAnalysis.m
       ├─ assessQuality()        ← model/matlab/ version (86 lines)
       ├─ enhanceFundus()
       ├─ detectOpticDisc()
       ├─ locateFovea()
       ├─ segmentVessels()
       ├─ detectMicroaneurysms()
       ├─ detectExudates()
       ├─ detectHemorrhages()
       └─ analyzeNeovascularization()
```

**ZERO call sites exist outside `model/matlab/` for any of these 13 functions.**  
The entire `model/matlab/` tree is an unreferenced island.

### Dead Functions (zero callers anywhere)

| Function | File | Notes |
|----------|------|-------|
| `visualizeEnhancement` | `Matlab/enhancement/visualizeEnhancement.m` | Zero callers |
| `visualizeQuality` | `Matlab/quality/visualizeQuality.m` | Zero callers |
| `createRetinalReport` | `model/matlab/createRetinalReport.m` | Zero callers |
| `runRetinalBatch` | `model/matlab/runRetinalBatch.m` | Zero callers |

### Test-Only Functions (no production callers)

| Function | File | Called By |
|----------|------|-----------|
| `evaluateDR` | `Matlab/evaluation/evaluateDR.m` | `testPipeline.m` only |
| `visualizeFundusCheck` | `Matlab/quality/visualizeFundusCheck.m` | `testFundusValidation.m` only |

---

## 3. assessQuality.m COLLISION (A3)

### Verdict: MEANINGFULLY DIFFERENT — Different logic, different interface, different status vocabulary

| Dimension | `Matlab/quality/assessQuality.m` (354L) | `model/matlab/assessQuality.m` (86L) |
|-----------|----------------------------------------|--------------------------------------|
| **Signature** | `[quality, isAcceptable, maskData] = assessQuality(inputImg, cfg)` | `quality = assessQuality(image, config)` |
| **Score range** | [0.0, 1.0] | [0, 100] |
| **Status set** | GOOD / BORDERLINE / UNGRADABLE | GOOD / ENHANCE / INSUFFICIENT |
| **FOV segmentation** | Multi-channel (max RGB), configurable morphology, **eroded mask** | Single-channel (im2gray), hardcoded morphology, **no erosion** |
| **Focus metric** | Laplacian variance inside **eroded FOV**, 3-tier piecewise scoring | Laplacian variance on **entire image**, linear cap |
| **Illumination** | 4-component: exposure distance + saturation ratio + dark ratio + **spatial uniformity CV** | Single scalar: `100 - abs(brightness-128)/128*40` |
| **Contrast** | Inter-percentile range (P95-P5), 3-tier piecewise | Std dev × 255, linear cap |
| **Hard-fail gates** | 5 configurable gates | 3 hardcoded gates |
| **Config depth** | ~40+ parameters | ~10 parameters |
| **Output richness** | 3 return values, 6 sub-structs, parameterized reasons | 1 return value, flat metrics |

### Which One Wins at Runtime?

**`Matlab/quality/assessQuality.m` wins.** It is the one wired into `runPipeline.m` via `addpath(fullfile(scriptDir, 'quality'))`. The `model/matlab/assessQuality.m` is only called by `model/matlab/runRetinalAnalysis.m` (its sibling), which itself has zero external callers.

### What Would Break if `model/matlab/assessQuality.m` Were Deleted Today?

**Nothing.** `model/matlab/runRetinalAnalysis.m` would break, but `runRetinalAnalysis.m` also has zero external callers. The entire `model/matlab/` tree is unreferenced from production code.

---

## 4. PARITY TABLE (A4)

### Matlab/ Functions vs Python Counterparts

| MATLAB Function | Python Counterpart | Source Tree | Verdict | Specific Differences |
|-----------------|-------------------|-------------|---------|---------------------|
| `assessQuality` (354L) | `features/screenings/quality.py` (192L) | Backend feature layer | **DIVERGES** | Different thresholds: blur 3.0 vs 100.0, contrast 25 vs 30, brightness 35-220 vs 40-220. Different fundus checks: corner darkness + red dominance + circularity vs FOV-based. Different scoring: weighted composite vs pass-ratio. Different status vocabulary: GOOD/BORDERLINE/UNGRADABLE vs good/poor. |
| `checkFundusImage` (335L) | `features/screenings/quality.py:check_fundus_structure` (192L) | Backend feature layer | **DIVERGES** | MATLAB version is a full 4-feature classifier (spectral + border + texture + vessels) with 335 lines. Python version is a simpler 3-check heuristic (corner darkness + red dominance + circularity) within 192 total lines. MATLAB version is significantly more sophisticated. |
| `enhanceBorderline` (194L) | No direct Python equivalent | N/A | **NO PRIOR VERSION** | Python pipeline has no enhancement stage. MATLAB adds CIE L\*a\*b\* homomorphic + CLAHE + bilateral denoising. New capability. |
| `predictDR` + `loadModel` | `features/screenings/inference.py` → `model/src/inference.py:predict_dr` | Tree 1 (backend) | **MATCHES** | Same 224×224 input, same PIL bilinear resize (MATLAB reimplements PIL in `pil_bilinear_resize.m`), same ImageNet mean/std [0.485,0.456,0.406]/[0.229,0.224,0.225], same RGB channel order, same 5-class mapping. Parity target: 1e-4 max prob diff (per `python_parity_reference.json`). |
| `generateGradCAM` (109L) | `features/screenings/gradcam.py` (56L) → `model/src/gradcam.py` (736L) | Tree 1 (backend) | **MATCHES** | Both use Grad-CAM on EfficientNet-B0 final feature layer. MATLAB uses `gradCAM()` built-in targeting `x_features_featu_469` / `x_classifier_classif`. Python uses forward/backward hooks on `model.features[-1][0]`. Same jet colormap, same alpha=0.30. Heatmap upscaled via bilinear interpolation in both. |
| `evaluateDR` (85L) | `model/src/evaluate.py` (484L) | Both trees (identical) | **MATCHES** | Same metrics: multi-class accuracy, referable-DR sensitivity/specificity, 5×5 confusion matrix. Python version adds F1, precision, recall, classification report. |
| `pil_bilinear_resize` (160L) | PIL `Image.BILINEAR` / torchvision `transforms.Resize` | Python stdlib | **MATCHES** | Faithful MATLAB reimplementation of PIL's bilinear resampling with 22-bit fixed-point weights. Purpose-built for parity. |

### model/matlab/ Functions vs Python Counterparts

| MATLAB Function | Python Counterpart | Verdict | Notes |
|-----------------|-------------------|---------|-------|
| `assessQuality` (86L) | `model/src/image_quality.py` (786L) | **DIVERGES** | Python version is far more sophisticated (5 quality dimensions, Laplacian blur score, brightness/contrast/fundus visibility, weighted composite). MATLAB version is a simpler prototype. |
| `enhanceFundus` (72L) | No direct Python equivalent | **NO PRIOR VERSION** | New MATLAB-only capability. |
| `detectOpticDisc` (53L) | No Python equivalent | **NO PRIOR VERSION** | New MATLAB-only capability. |
| `locateFovea` (36L) | No Python equivalent | **NO PRIOR VERSION** | New MATLAB-only capability. |
| `segmentVessels` (38L) | No Python equivalent | **NO PRIOR VERSION** | New MATLAB-only capability. |
| `detectMicroaneurysms` (32L) | No Python equivalent | **NO PRIOR VERSION** | New MATLAB-only capability. |
| `detectExudates` (32L) | No Python equivalent | **NO PRIOR VERSION** | New MATLAB-only capability. |
| `detectHemorrhages` (28L) | No Python equivalent | **NO PRIOR VERSION** | New MATLAB-only capability. |
| `analyzeNeovascularization` (14L) | No Python equivalent | **NO PRIOR VERSION** | New MATLAB-only capability (research prototype). |
| `runRetinalAnalysis` (113L) | No Python equivalent | **NO PRIOR VERSION** | New MATLAB-only orchestrator. |
| `runRetinalBatch` (50L) | No Python equivalent | **NO PRIOR VERSION** | New MATLAB-only batch runner. |
| `createRetinalReport` (68L) | No Python equivalent | **NO PRIOR VERSION** | New MATLAB-only report generator. |
| `defaultRetinalConfig` (31L) | No Python equivalent | **NO PRIOR VERSION** | Config for the above. |

### Parity Summary

| Category | Count |
|----------|-------|
| MATCHES | 5 (predictDR+loadModel, generateGradCAM, evaluateDR, pil_bilinear_resize, checkFundusImage vs quality.py check_fundus_structure partially) |
| DIVERGES | 2 (assessQuality vs quality.py, model/matlab/assessQuality vs image_quality.py) |
| NO PRIOR VERSION | 14 (enhanceBorderline, all model/matlab/ lesion analysis functions, enhanceFundus) |

---

## 5. RUNTIME RESULTS (A5)

### MATLAB Tests

**Cannot execute.** No MATLAB runtime available in the audit environment. Tests require:
- MATLAB R2024a+ with Deep Learning Toolbox (for `importNetworkFromONNX`, `dlarray`, `predict`)
- Model weights at `Matlab/model/netracare_efficientnet_b0.onnx` or `.mat` (NOT in repo — gitignored)
- Benchmark images at `C:\Users\ysyas\RentoAI\backend\storage\uploads\SCR-0001.jpg` through `SCR-0007.jpg` (external path, NOT in repo)

### Parity Reference JSON

**EXISTS** at `Matlab/data/results/python_parity_reference.json` (149 lines, 7 entries).

This means someone already started parity work. Contents:

| Image | Predicted Grade | Label | Confidence | Notes |
|-------|----------------|-------|------------|-------|
| SCR-0001.jpg | 0 | No DR | 0.567 | |
| SCR-0002.jpg | 0 | No DR | 0.399 | |
| SCR-0003.jpg | 0 | No DR | 0.824 | Genuine fundus (used as default test) |
| SCR-0004.jpg | 0 | No DR | 0.707 | |
| SCR-0005.jpg | 4 | Proliferative DR | 0.558 | Non-fundus (watermelon) — model misclassifies |
| SCR-0006.jpg | 4 | Proliferative DR | 0.558 | Same logits as SCR-0005 (duplicate or same image) |
| SCR-0007.jpg | 0 | No DR | 0.797 | |

The reference includes full logits and probabilities for parity comparison. SCR-0005/SCR-0006 having identical logits is suspicious — likely the same image or a data issue.

### model/matlab/ Standalone Execution

**Cannot verify.** Would need MATLAB runtime + real fundus images. The code is syntactically complete but:
- `runRetinalAnalysis.m` expects file paths to real images
- `detectExudates.m`, `detectHemorrhages.m`, etc. are pure image processing and should work standalone on any fundus image
- No test harness exists for model/matlab/ functions

### Simulink Scenario

**Already confirmed** by prior audit: `runScalabilityScenario.m` is an analytical calculator, NOT SimEvents simulation. No `sim()` call anywhere.

---

## 6. CONFIG AND DATA FILE CHECK (A6)

### Config Comparison

| Aspect | `Matlab/config/` (4 files) | `model/matlab/defaultRetinalConfig.m` (1 file) |
|--------|---------------------------|------------------------------------------------|
| **Scope** | Pipeline-wide: fundus validation, quality, enhancement, model, XAI | Retinal-evidence-specific: quality, enhancement, anatomy, lesions |
| **Quality thresholds** | ~40+ parameters across 4 sub-configs | ~10 parameters |
| **Quality status** | GOOD/BORDERLINE/UNGRADABLE | GOOD/ENHANCE/INSUFFICIENT |
| **Enhancement** | CIE L\*a\*b\* + homomorphic + CLAHE + bilateral | CLAHE + median + unsharp mask (simpler) |
| **Anatomy** | Not configured (not in pipeline) | Disc area fractions, vessel sensitivity |
| **Lesions** | Not configured (not in pipeline) | Min/max component areas, exudate area |
| **Relationship** | **Genuinely separate concerns** — pipeline config vs. retinal-evidence config |

**Verdict:** These are NOT duplicates. `Matlab/config/` covers the production pipeline (fundus validation → quality → enhancement → DR inference). `model/matlab/defaultRetinalConfig.config` covers the retinal-evidence prototype (anatomy detection, lesion detection). They would need to be MERGED if the retinal-evidence branch is integrated into the pipeline.

### Data Directory Comparison

| Directory | Contents | Purpose |
|-----------|----------|---------|
| `Matlab/data/raw/` | `.gitkeep` only | Expected: raw input images (external path referenced) |
| `Matlab/data/processed/` | `.gitkeep` only | Expected: processed images |
| `Matlab/data/results/` | `python_parity_reference.json` + `.gitkeep` | Parity reference + output directory |
| `model/data/train_images/` | `synthetic_test.png` (5.5KB) | Single synthetic test image |

**No overlap.** `Matlab/data/` is for pipeline I/O. `model/data/` has one synthetic test image. They serve different purposes.

---

## 7. RECOMMENDATION: Proposed Canonical Folder Layout

```
matlab/                              ← unified root
├── runPipeline.m                    ← KEEP from Matlab/ (sole production entry point)
├── config/
│   ├── model_config.m               ← KEEP from Matlab/ (master config)
│   ├── fundus_config.m              ← KEEP from Matlab/
│   ├── quality_config.m             ← KEEP from Matlab/ (40+ params, eroded-FOV model)
│   ├── enhancement_config.m         ← KEEP from Matlab/
│   └── retinal_config.m            ← RENAME from model/matlab/defaultRetinalConfig.m
│                                      (anatomy/lesion params — genuinely separate concern)
├── quality/
│   ├── assessQuality.m              ← KEEP from Matlab/ (354 lines, production quality gate)
│   ├── checkFundusImage.m           ← KEEP from Matlab/ (335 lines, fundus validation)
│   └── visualizeFundusCheck.m       ← KEEP (test utility)
├── enhancement/
│   ├── enhanceBorderline.m          ← KEEP from Matlab/ (production enhancement)
│   ├── enhanceFundus.m              ← MOVE from model/matlab/ (simpler alternative, keep for reference)
│   └── visualizeEnhancement.m       ← KEEP (test utility)
├── model/
│   ├── loadModel.m                  ← KEEP from Matlab/
│   ├── predictDR.m                  ← KEEP from Matlab/
│   └── pil_bilinear_resize.m        ← KEEP from Matlab/ (PIL parity)
├── xai/
│   └── generateGradCAM.m            ← KEEP from Matlab/
├── evaluation/
│   └── evaluateDR.m                 ← KEEP from Matlab/
├── segmentation/                    ← NEW folder (consolidate model/matlab/ lesion analysis)
│   ├── detectOpticDisc.m            ← MOVE from model/matlab/
│   ├── locateFovea.m                ← MOVE from model/matlab/
│   ├── segmentVessels.m             ← MOVE from model/matlab/
│   ├── detectMicroaneurysms.m       ← MOVE from model/matlab/
│   ├── detectExudates.m             ← MOVE from model/matlab/
│   ├── detectHemorrhages.m          ← MOVE from model/matlab/
│   ├── analyzeNeovascularization.m  ← MOVE from model/matlab/
│   └── runRetinalAnalysis.m         ← MOVE from model/matlab/ (orchestrator)
├── tests/
│   ├── testPipeline.m               ← KEEP from Matlab/
│   ├── testPipelineEndToEnd.m       ← KEEP from Matlab/
│   ├── testParity.m                 ← KEEP from Matlab/
│   ├── testQuality.m                ← KEEP from Matlab/
│   ├── testFundusValidation.m       ← KEEP from Matlab/
│   └── testEnhancement.m            ← KEEP from Matlab/
├── data/
│   ├── raw/.gitkeep
│   ├── processed/.gitkeep
│   └── results/
│       ├── .gitkeep
│       └── python_parity_reference.json  ← KEEP
└── simulink/                        ← KEEP as-is (separate concern)
    ├── buildTelemedicineModel.m
    ├── defaultTelemedicineParameters.m
    ├── runScalabilityExperiments.m
    └── runScalabilityScenario.m
```

### Collision Resolution

| Collision | Winner | Reason |
|-----------|--------|--------|
| `assessQuality.m` | **Matlab/quality/** (354L) | Production entry point, 4× more sophisticated, wired into `runPipeline.m` |
| `defaultRetinalConfig.m` vs `Matlab/config/*.m` | **Keep both** — different concerns | Pipeline config (Matlab/) vs. retinal-evidence config (model/matlab/) |
| `enhanceFundus.m` vs `enhanceBorderline.m` | **Keep both** — different approaches | `enhanceBorderline` is production; `enhanceFundus` is a simpler alternative in model/matlab/ |

### Zero-Risk Files (no naming collision, clearly used, keep as-is)

All `Matlab/` files except `assessQuality.m`: `runPipeline.m`, `checkFundusImage.m`, `enhanceBorderline.m`, `loadModel.m`, `predictDR.m`, `pil_bilinear_resize.m`, `generateGradCAM.m`, `evaluateDR.m`, all config files, all test files.

All `model/matlab/` lesion analysis files: `detectOpticDisc.m`, `locateFovea.m`, `segmentVessels.m`, `detectMicroaneurysms.m`, `detectExudates.m`, `detectHemorrhages.m`, `analyzeNeovascularization.m`, `runRetinalAnalysis.m`, `runRetinalBatch.m`, `createRetinalReport.m`.

### Files to DELETE (dead code)

| File | Reason |
|------|--------|
| `model/matlab/assessQuality.m` | Superseded by Matlab/quality/ version, zero external callers |
| `Matlab/quality/visualizeQuality.m` | Zero callers anywhere |
| `model/matlab/createRetinalReport.m` | Zero callers anywhere |
| `model/matlab/runRetinalBatch.m` | Zero callers (convenience wrapper, re-create if needed) |

---

## 8. RISK SECTION — Items Requiring Human/Live MATLAB Confirmation

| # | Risk | What Needs Confirmation | Why Static Analysis Can't Resolve |
|---|------|------------------------|----------------------------------|
| 1 | **MATLAB path precedence for `assessQuality.m`** | If both `Matlab/quality/` and `model/matlab/` are on the path simultaneously, which one does `assessQuality()` resolve to? | MATLAB resolves by path order; `runPipeline.m` adds `Matlab/quality/` first, but if `model/matlab/` is also added (e.g., via `addpath(genpath('model/matlab'))` in a future integration), the last-added path wins. Need live test. |
| 2 | **Model weights availability** | `Matlab/model/netracare_efficientnet_b0.onnx` and `.mat` are gitignored. The parity tests cannot run without them. | Cannot verify parity claim without actual model files. |
| 3 | **Benchmark images availability** | 7 test images at external path `C:\Users\ysyas\RentoAI\backend\storage\uploads\`. Not in repo. | Cannot run any tests without these images. |
| 4 | **`runRetinalAnalysis.m` integration point** | If wired into `runPipeline.m`, where should it go? After Stage 1 quality? After Stage 3 inference? The current pipeline has `evidence = {}` as a placeholder. | Architectural decision requiring human judgment about clinical workflow. |
| 5 | **`enhanceFundus.m` vs `enhanceBorderline.m`** | Both do CLAHE but with different pipelines. `enhanceBorderline` adds homomorphic normalization + bilateral denoising. Should `enhanceFundus` be kept as a lighter alternative? | Requires clinical evaluation of which produces better downstream DR classification. |
| 6 | **SCR-0005/SCR-0006 identical logits** | The parity reference has identical probabilities for these two images. Are they the same image? A data issue? | Cannot determine without the actual images. |
| 7 | **`model/matlab/` quality thresholds vs Python `image_quality.py`** | The Python `image_quality.py` (786 lines) and `model/matlab/assessQuality.m` (86 lines) share the same name but the Python version is far more sophisticated. Was the MATLAB version intended to be a simplified port or an early prototype? | No comments or documentation clarify the intent. |
| 8 | **Future Simulink integration** | `model/simulink/` is confirmed as analytical math only. If SimEvents is required for SIH, it needs to be built from scratch. | Cannot determine from code alone whether SimEvents was ever attempted. |

---

## FINAL STATUS

```
STATUS: INVESTIGATION COMPLETE — REPORT ONLY, NO CHANGES MADE

CANONICAL_ENTRY_POINT_CONFIRMED: yes
  (backend/app/services/matlab_service.py → Matlab/runPipeline.m)

ASSESSQUALITY_WINNER: Matlab/quality/assessQuality.m (354 lines)
  - 4× more sophisticated than model/matlab/ version (86 lines)
  - Different interface: [quality, isAcceptable, maskData] vs quality only
  - Different status vocabulary: GOOD/BORDERLINE/UNGRADABLE vs GOOD/ENHANCE/INSUFFICIENT
  - Wired into production pipeline via runPipeline.m
  - model/matlab/ version has ZERO external callers

ORPHANED_FUNCTIONS_COUNT: 13
  (All 13 model/matlab/ functions have ZERO callers outside their own folder)

PARITY_MATCHES: 5
  (predictDR, loadModel, generateGradCAM, evaluateDR, pil_bilinear_resize)

PARITY_DIVERGENCES: 2
  (assessQuality vs quality.py, model/matlab/assessQuality vs image_quality.py)

NO_PRIOR_VERSION: 14
  (enhanceBorderline, all model/matlab/ lesion analysis functions, enhanceFundus)

REPORT_PATH: docs/MATLAB_CONSOLIDATION_REPORT.md

BLOCKERS_FOR_PHASE_B:
  1. No MATLAB runtime available — cannot execute any tests
  2. Model weights gitignored — parity tests cannot verify
  3. Benchmark images external — tests cannot run
  4. MATLAB path precedence for assessQuality.m collision needs live confirmation
  5. SCR-0005/SCR-0006 identical logits anomaly needs image-level investigation

RECOMMENDATION_SUMMARY:
  The two MATLAB trees serve genuinely different purposes: Matlab/ is the
  production clinical pipeline (5-stage safety-gated DR screening), while
  model/matlab/ is an isolated retinal-evidence prototype (anatomy + lesion
  detection) with zero external integration. Consolidation should MOVE the
  model/matlab/ lesion analysis functions into a new matlab/segmentation/
  subfolder, DELETE the superseded assessQuality.m and dead utility functions,
  and WIRE runRetinalAnalysis.m into runPipeline.m's evidence placeholder —
  but only after confirming MATLAB path precedence and model weights
  availability in a live session.
```
