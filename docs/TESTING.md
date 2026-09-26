# Testing & Quality Assurance Protocols

This document outlines the automated test suites, parity checks, regression harnesses, integration workflows, and manual test cases verified across the NetraCare / RentoAI codebase.

> [!IMPORTANT]
> **Clinical Disclaimer Regarding Testing:**
> A passing result in these test suites indicates technical correctness, numerical stability, interface compatibility, and adherence to software specifications. **"Tested successfully" does NOT mean "clinically validated".** These tests utilize synthetic patterns and small benchmark batches; they do NOT substitute for formal clinical trials or multi-center held-out validation.

---

## 1. Test Categorization Matrix

| Category | Scope | Test File(s) | Execution Command |
|---|---|---|---|
| **1. Functional Tests** | Stage 0 validation, Stage 1 quality, Stage 2 CLAHE, Stage 3 inference | `Matlab/tests/testFundusValidation.m`<br>`Matlab/tests/testQuality.m`<br>`Matlab/tests/testEnhancement.m` | MATLAB Command Window |
| **2. Parity Tests** | Pillow-vs-MATLAB fixed-point bilinear resize & PyTorch logits | `Matlab/tests/testParity.m` | `testParity()` in MATLAB |
| **3. Integration Tests** | Full pipeline end-to-end, temporary JSON handoff, backend subprocess | `Matlab/tests/testPipelineEndToEnd.m`<br>`backend/tests/test_api.py` | MATLAB & `pytest backend/tests` |
| **4. Regression Tests** | Blueprint JSON contract validation, schema stability | `Matlab/tests/testPipeline.m` | `testPipeline()` in MATLAB |
| **5. Manual UI Tests** | End-to-end browser screening workflow, Grad-CAM toggle, safety alerts | Next.js Frontend (`localhost:3000`) | Manual browser verification |

---

## 2. Category 1: Functional Tests (MATLAB)

### A. Stage 0 Retinal Fundus Validation (`testFundusValidation.m`)
- **Objective:** Verify that genuine fundus photographs pass with `status = 'FUNDUS'`, while non-medical images (e.g., watermelon, outdoor scenes, chest X-rays) are rejected with `status = 'NON_FUNDUS'` or `'UNCERTAIN'`.
- **Command:**
  ```matlab
  cd('C:\Users\ysyas\RentoAI\Matlab\tests');
  results = testFundusValidation();
  ```
- **Verified Invariants:**
  - `genuine_fundus.jpg` $\rightarrow$ `isFundus = true`, `confidence > 0.90`.
  - Synthetic non-fundus (uniform noise, inverted checkerboard) $\rightarrow$ `isFundus = false`, `action = 'REJECT'`.
  - Rejection gate halts pipeline before neural network evaluation.

### B. Stage 1 Image Quality Assessment (`testQuality.m`)
- **Objective:** Test sharpness, illumination, contrast, and aperture coverage.
- **Command:**
  ```matlab
  cd('C:\Users\ysyas\RentoAI\Matlab\tests');
  results = testQuality();
  ```
- **Verified Invariants:**
  - High-resolution in-focus fundus $\rightarrow$ `status = 'GOOD'`, `overallScore >= 0.70`.
  - Severely blurred / degraded image (`SCR-0003-degraded.jpg`) $\rightarrow$ `status = 'UNGRADABLE'`, `action = 'RECAPTURE'`.

### C. Stage 2 Adaptive Enhancement (`testEnhancement.m`)
- **Objective:** Validate that Rayleigh-distributed CLAHE on the CIE $L^*$ channel improves borderline focus without shifting chromatic hue.
- **Command:**
  ```matlab
  cd('C:\Users\ysyas\RentoAI\Matlab\tests');
  results = testEnhancement();
  ```
- **Verified Invariants:**
  - `before_focus < after_focus` on borderline input.
  - Image dimensions and 3-channel structure strictly preserved.

---

## 3. Category 2: Numerical Parity Tests (`testParity.m`)

### Objective & Methodology
When exporting models from PyTorch (`torchvision.transforms.Resize`) to MATLAB, standard `imresize` causes subtle pixel-level interpolation differences that shift output softmax probabilities.

NetraCare utilizes `pil_bilinear_resize.m` to reproduce the exact 22-bit fixed-point convolution from Python Pillow's `libImaging/Resample.c`.

### Parity Protocol
`Matlab/tests/testParity.m` loads the PyTorch reference predictions stored in `Matlab/data/results/python_parity_reference.json` (generated across benchmark images `SCR-0001` through `SCR-0006`) and compares them directly against MATLAB's output:
```matlab
cd('C:\Users\ysyas\RentoAI\Matlab\tests');
parityResults = testParity();
```
- **Tolerance Threshold:** Maximum absolute probability difference $|\hat{p}_{\text{matlab}} - p_{\text{pytorch}}| \le 10^{-3}$ ($0.1\%$).
- **Observed Result:** Maximum delta across all 5 classes is $< 10^{-4}$ ($0.01\%$). **Parity Verified.**

---

## 4. Category 3: Integration Tests (FastAPI & Subprocess Bridge)

### A. Subprocess Pipeline Execution (`testPipelineEndToEnd.m`)
- **Objective:** Verify execution of `runPipeline.m`, JSON serialization, and Grad-CAM overlay disk writing.
- **Command:**
  ```matlab
  cd('C:\Users\ysyas\RentoAI\Matlab\tests');
  testPipelineEndToEnd();
  ```

### B. Backend REST API Suite (`backend/tests/test_api.py`)
- **Objective:** Verify HTTP status codes, rate limiting, authentication headers, patient creation, image upload, and screening retrieval.
- **Prerequisites:** MongoDB running on `localhost:27017`.
- **Command:**
  ```powershell
  cd C:\Users\ysyas\RentoAI\backend
  .\venv\Scripts\Activate.ps1
  python -m pytest tests/test_api.py -v
  ```
- **Key Assertions:**
  - `POST /api/screenings` creates `pending` screening.
  - `POST /api/screenings/{id}/image` accepts valid JPEG/PNG and rejects corrupted binaries.
  - `GET /health` returns `{"status": "ok", "db": "connected"}`.
  - Storage paths outside allowed directories return HTTP 404 (Path Traversal Protection).

---

## 5. Category 4: Regression Tests (`testPipeline.m`)

- **Objective:** Validates all configuration keys, stage transitions, JSON contract fields, and error handling.
- **Command:**
  ```matlab
  cd('C:\Users\ysyas\RentoAI\Matlab\tests');
  testPipeline();
  ```
- **Verified Contract Fields:**
  - `stage`, `decision`, `action`
  - `fundus` (`isFundus`, `confidence`, `status`, `reasons`)
  - `quality` (`status`, `score`, `checks`, `scores`, `reasons`)
  - `enhancement` (`applied`, `improved`, `method`)
  - `prediction` (`grade`, `label`, `probabilities`)
  - `confidence` (`raw`, `calibrated`, `is_calibrated`)
  - `xai` (`method`, `feature_layer`, `reduction_layer`, `alpha`, `gradcam_path`)

---

## 6. Category 5: Manual Frontend Verification Workflow

Perform these verification steps in the browser to validate end-to-end integration:

### Test Case A: Genuine Fundus Reaching Grade & Grad-CAM
1. Navigate to `http://localhost:3000/dashboard/screening/new`.
2. Select an existing patient (e.g., `PAT-0042`) and select `Right Eye`.
3. Upload `backend/storage/uploads/SCR-0043.jpg` (Genuine Fundus).
4. Click **"Start Screening Analysis"**.
5. Observe modal progress: *Uploading* $\rightarrow$ *Stage 0* $\rightarrow$ *Stage 1* $\rightarrow$ *Stage 2/3*.
6. Verify Result Page:
   - Stage 0 displays **VERIFIED (Fundus: Yes)**.
   - Stage 1 displays **GOOD QUALITY**.
   - Stage 3 displays **Predicted Grade & Label** with **Raw Softmax Confidence**.
   - **Grad-CAM Saliency Map** renders in Side-by-Side viewer.
   - Clinical disclaimer is visible.

### Test Case B: Non-Fundus Safety Rejection Gate
1. Navigate to `http://localhost:3000/dashboard/screening/new`.
2. Upload a non-retinal image (e.g., `download.jpg` or a landscape photograph).
3. Click **"Start Screening Analysis"**.
4. Verify Result Page:
   - Red banner displays: **"Safety Check: Retinal Fundus Validation Rejected"**.
   - Specific failure reasons listed (e.g., *Color ratio insufficient*, *Vessels not detected*).
   - **Stage 3 DR Inference and Grad-CAM are completely suppressed and absent from view.**
   - Prompt to **"Upload Another Image"** is displayed.
