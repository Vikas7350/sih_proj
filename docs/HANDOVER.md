# Developer Handover Guide

Welcome to the **NetraCare / RentoAI** codebase. This document is written specifically for the incoming engineer taking over development, maintenance, or evaluation of the system.

---

## 1. Where to Start

Please read through the documentation in this recommended order before modifying code:
1. **[README.md](file:///c:/Users/ysyas/RentoAI/README.md):** Project overview, requirements, architecture, and quick start.
2. **[docs/HANDOVER.md](file:///c:/Users/ysyas/RentoAI/docs/HANDOVER.md):** (This document) Engineering invariants, current state, and prioritized roadmap.
3. **[docs/ARCHITECTURE.md](file:///c:/Users/ysyas/RentoAI/docs/ARCHITECTURE.md):** End-to-end component boundaries, JSON contract, and data lifecycles.
4. **[Matlab/README.md](file:///c:/Users/ysyas/RentoAI/Matlab/README.md):** Deep dive into the MATLAB scientific computing pipeline.
5. **[backend/README.md](file:///c:/Users/ysyas/RentoAI/backend/README.md):** FastAPI service architecture, subprocess execution, and storage signing.
6. **[frontend/README.md](file:///c:/Users/ysyas/RentoAI/frontend/README.md):** Next.js 15 UI, App Router, timeout proxy, and safety suppression logic.

---

## 2. What is Completed & Currently Working

The following components are implemented, integrated, and verified:
- [x] **Stage 0 Retinal Fundus Validation (`checkFundusImage.m`):** Multivariate heuristic checks (color ratio, circular aperture circularity, parenchyma smoothness, vessel presence) to block non-medical imagery.
- [x] **Stage 1 Image Quality Assessment (`assessQuality.m`):** Four-metric quality evaluation (Modified Laplacian focus, illumination histogram, Weber contrast, FOV completeness).
- [x] **Stage 2 Adaptive Enhancement (`enhanceBorderline.m`):** Rayleigh-distributed CLAHE applied to CIE $L^*$ channel for borderline-quality images.
- [x] **Stage 3 Deep Learning Inference (`predictDR.m`):** EfficientNet-B0 classification across ETDRS Grades 0 to 4.
- [x] **Preprocessing Parity (`pil_bilinear_resize.m`):** 22-bit fixed-point bilinear convolution matching Python Pillow with $< 10^{-4}$ probability delta against PyTorch.
- [x] **Explainable AI (`generateGradCAM.m`):** Grad-CAM heatmaps generated from feature layer `x_features_featu_469` and output layer `x_classifier_classif` with $\alpha = 0.30$ blending.
- [x] **FastAPI ↔ MATLAB Integration (`matlab_service.py`):** Subprocess batch invocation with isolated temporary UTF-8 JSON handoff.
- [x] **Secure Asset Storage:** HMAC-SHA256 time-limited signed URLs for uploads and heatmaps.
- [x] **Frontend Clinical Portal (Next.js 15):** Patient roster, screening creation wizard, 120s proxy timeout, and interactive side-by-side Grad-CAM inspector.
- [x] **Clinical Safety Suppression:** Automatic omission of Grade prediction and Grad-CAM for non-fundus or ungradable inputs.

---

## 3. Critical Invariants: What Must NOT Be Changed Unnecessarily

To preserve system stability, security, and numerical correctness, do **NOT** modify the following components without explicit team alignment:

1. **Pillow Preprocessing Parity (`pil_bilinear_resize.m`):**
   Do *not* replace this with MATLAB's native `imresize(..., 'bilinear')`. Native `imresize` uses continuous antialiasing kernels that introduce distribution shift relative to the PyTorch training pipeline.
2. **Grad-CAM Feature Layer (`x_features_featu_469`):**
   This layer is verified to contain the highest-level spatial semantic features before global pooling in the imported ONNX graph. Pointing Grad-CAM to intermediate layers will produce diffuse or uninformative activation maps.
3. **MATLAB → Backend JSON Contract:**
   The field names (`screening_id`, `stage`, `decision`, `action`, `fundus`, `quality`, `enhancement`, `prediction`, `confidence`, `xai`) are hard dependencies for both `matlab_service.py` and MongoDB schemas.
4. **Stage 0 Safety Gate & Rejection Logic:**
   Never bypass or comment out `checkFundusImage.m`. Passing non-fundus images to EfficientNet-B0 produces unpredictable, clinically invalid classifications.
5. **Frontend Non-Fundus Prediction Suppression:**
   In `frontend/lib/api/backendClient.ts` (`toPrediction`) and `frontend/app/dashboard/screening/[screeningId]/page.tsx`, predictions and Grad-CAM are intentionally suppressed if `isFundus === false` or `status === 'NON_FUNDUS'`. Do not display predictions on rejected images.
6. **HMAC Storage Signing Protocol:**
   Do not expose `backend/storage/` as an unauthenticated static mount. The signed URL mechanism (`sign_url` / `verify_signature`) is required to protect patient health data.

---

## 4. Current Environment & Verified Versions

- **Operating System:** Windows 11 Home / Pro (x64)
- **Python:** 3.14.3 (Virtual environment in `backend/venv`)
- **Node.js:** v24.21.0 (with npm 10.x)
- **MATLAB:** R2026a (`C:\Program Files\MATLAB\R2026a\bin\matlab.exe`)
- **Required MATLAB Toolboxes:**
  - Deep Learning Toolbox
  - Image Processing Toolbox
- **Database:** MongoDB Community Server 7.0+ (Port 27017)
- **Next.js:** 15.2.0 (Port 3000)
- **FastAPI:** 0.115+ / Uvicorn (Port 8000)

---

## 5. Prioritized Remaining Work

The following items should be tackled in order of priority:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Freeze & Tag Current Working Baseline                    │
│    Create git commit/tag representing verified baseline.    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Model Calibration (Post-Hoc Temperature Scaling)         │
│    Fit temperature parameter T on a validation set.         │
│    Update predictDR.m to emit calibrated probabilities.     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Formal Held-Out Model Evaluation                         │
│    Compute per-class sensitivity, specificity, and macro F1.│
│    Calculate Referable DR metrics (Grades 2-4 vs 0-1).      │
│    Ensure patient-level separation across splits.           │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Decision-Gate Systematic Boundary Testing                │
│    Stress-test Stage 0/1 heuristic thresholds on diverse   │
│    pathologies (e.g., severe cataracts, laser scars).       │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Simulink / SimEvents Integration                         │
│    Integrate discrete-event PHC patient flow simulation     │
│    developed by the co-developer on Person B workstream.    │
└─────────────────────────────────────────────────────────────┘
```

### Detailed Breakdown of Priority Tasks:

#### Priority 1: Freeze Current Baseline
Initialize Git (if not already done), verify `.gitignore`, and create a release commit or tag:
```powershell
git add .
git commit -m "docs: add complete RentoAI developer handover"
git tag -a v1.0.0-baseline -m "Working baseline with verified MATLAB-FastAPI-Next.js integration"
```

#### Priority 2: Post-Hoc Model Calibration
- **Current State:** Output confidence is uncalibrated raw softmax.
- **Action Required:**
  1. Extract uncalibrated validation set logits $z_i \in \mathbb{R}^5$ and ground truth labels $y_i$.
  2. Optimize temperature parameter $T > 0$ by minimizing Negative Log-Likelihood (NLL):
     $$\min_T -\sum_{i} \log \left( \frac{\exp(z_{i, y_i} / T)}{\sum_j \exp(z_{i, j} / T)} \right)$$
  3. Store $T$ in `Matlab/config/model_config.m`.
  4. In `Matlab/model/predictDR.m`, compute $p_{\text{calibrated}} = \text{softmax}(z / T)$.
  5. Set `"is_calibrated": true` in the output JSON.

#### Priority 3: Formal Held-Out Evaluation
- Evaluate performance on a clean, held-out dataset (e.g., EyePACS, Messidor-2, or DDR test split).
- Ensure patient-level split (images from the same patient must never appear in both train and test splits).
- Report:
  - Multi-class Confusion Matrix (Grades 0–4).
  - Quadratic Weighted Kappa ($\kappa$).
  - Referable DR Sensitivity and Specificity (Referable DR defined as Grade $\ge 2$ or macular edema).
  - ROC curves and PR curves.

#### Priority 4: Broader Stage 0 Validation
- Gather edge cases: high myopic fundus, extensive panretinal photocoagulation (PRP) laser scars, dense vitreous hemorrhage, and pediatric fundus.
- Tune heuristic weights if false-positive rejections occur on legitimate pathology.

---

## 6. How to Continue: Daily Development Commands

### Start Backend Services
```powershell
# In Terminal 1:
cd C:\Users\ysyas\RentoAI\backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --port 8000
```

### Start Frontend Application
```powershell
# In Terminal 2:
cd C:\Users\ysyas\RentoAI\frontend
npm.cmd run dev
```

### Run Automated Tests
```powershell
# MATLAB Test Suite:
matlab -batch "cd('C:\Users\ysyas\RentoAI\Matlab\tests'); results = testPipeline(); exit(any([results.failed]));"

# Backend Pytest Suite:
cd C:\Users\ysyas\RentoAI\backend
.\venv\Scripts\Activate.ps1
python -m pytest tests/test_api.py -v

# Frontend TypeScript Typecheck:
cd C:\Users\ysyas\RentoAI\frontend
npx.cmd tsc --noEmit
```
