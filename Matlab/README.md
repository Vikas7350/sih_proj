# NetraCare MATLAB Clinical AI Workstream

> **Person A Handover & Engineering Handbook**  
> *Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038*

This directory contains the complete clinical AI screening engine for NetraCare, developed in MATLAB R2026a. It implements a sequential, safety-gated pipeline that validates retinal morphological characteristics, assesses scan physical quality, adaptively enhances borderline imagery, predicts Diabetic Retinopathy (DR) severity grades using an imported EfficientNet-B0 convolutional neural network, and produces Explainable AI (Grad-CAM) saliency attribution maps.

---

## MATLAB Workstream Responsibilities

1. **Input-Domain Safety Gate (Stage 0):** Prevent non-retinal photographs (faces, food, flat graphics, blurry camera caps) from reaching deep learning models.
2. **Scan Quality Triage (Stage 1):** Quantify physical scan diagnostic adequacy across focus, illumination, contrast, and field-of-view (FOV).
3. **Adaptive Repair (Stage 2):** Enhance borderline quality scans without hallucinating vascular lesions or altering retinal pigmentation.
4. **Clinical DR Grading (Stage 3):** Infer International Clinical Diabetic Retinopathy (ICDR) grades (0 to 4) using verified EfficientNet-B0 weights.
5. **Explainability (XAI):** Generate visual Grad-CAM heatmaps highlighting anatomical features influencing the classification.
6. **Standardized Contract Output:** Return complete screening records strictly complying with the SIH 26038 Blueprint Section 10 JSON specification.

---

## Pipeline Architecture & Safety State Machine

```text
                           [ INPUT IMAGE ]
                                  │
                                  ▼
      ┌────────────────────────────────────────────────────────┐
      │       STAGE 0: FUNDUS IMAGE VALIDATION GATE            │
      │       (checkFundusImage.m - Spectral/Geometry/Texture) │
      └────────────────────────────────────────────────────────┘
                    │                              │
      [isFundus == true]                 [isFundus == false]
                    │                              │
                    ▼                              ▼
      ┌───────────────────────────┐  ┌───────────────────────────────┐
      │ STAGE 1: QUALITY SCORING  │  │ REJECTION SAFETY GATE         │
      │ (assessQuality.m)         │  │ Action: 'REJECT' / 'HUMAN_REV'│
      └───────────────────────────┘  │ DR Prediction: BLOCKED        │
         │          │           │    │ Grad-CAM Heatmap: SUPPRESSED  │
         │ GOOD     │BORDERLINE │UNG.└───────────────────────────────┘
         │          │           │
         │          ▼           ▼
         │  ┌─────────────────┐ ┌────────────────────────────────────┐
         │  │ STAGE 2: CLAHE  │ │ QUALITY RECAPTURE GATE             │
         │  │ (enhanceBorder.)│ │ Action: 'RECAPTURE'                │
         │  └─────────────────┘ │ DR Prediction: BLOCKED             │
         │          │           │ Grad-CAM Heatmap: SUPPRESSED       │
         │    [Re-assess Q]     └────────────────────────────────────┘
         │    Pass / Fail
         │     │        └── Fail (Still UNGRADABLE) ──> RECAPTURE
         ▼     ▼ Pass
      ┌────────────────────────────────────────────────────────┐
      │       STAGE 3: DEEP LEARNING DR INFERENCE              │
      │       (predictDR.m - EfficientNet-B0 224x224)          │
      └────────────────────────────────────────────────────────┘
                    │
                    ▼
      ┌────────────────────────────────────────────────────────┐
      │       EXPLAINABLE AI: GRAD-CAM ATTRIBUTION MAP         │
      │       (generateGradCAM.m - Layer x_features_featu_469) │
      └────────────────────────────────────────────────────────┘
                    │
                    ▼
      ┌────────────────────────────────────────────────────────┐
      │       BLUEPRINT SECTION 10 STANDARDIZED JSON           │
      │       (jsonencode(resultStruct) -> stdout / file)      │
      └────────────────────────────────────────────────────────┘
```

---

## Folder Structure

```text
Matlab/
├── runPipeline.m             # Primary entrypoint called by FastAPI subprocess
├── config/
│   ├── model_config.m        # Central config (paths, ImageNet norm, XAI layers, class names)
│   ├── fundus_config.m       # Stage 0 spectral, border, parenchyma & vessel thresholds
│   ├── quality_config.m      # Stage 1 focus, illumination, contrast & FOV thresholds
│   └── enhancement_config.m  # Stage 2 homomorphic illumination, CLAHE & bilateral settings
├── quality/
│   ├── checkFundusImage.m    # Stage 0 algorithm implementation
│   ├── assessQuality.m       # Stage 1 algorithm implementation
│   ├── visualizeFundusCheck.m# Diagnostic visualizer for Stage 0 validation
│   └── visualizeQuality.m    # Diagnostic visualizer for Stage 1 quality metrics
├── enhancement/
│   ├── enhanceBorderline.m   # Stage 2 algorithm implementation
│   └── visualizeEnhancement.m# Diagnostic visualizer showing before/after enhancement
├── model/
│   ├── loadModel.m           # Model loader importing netracare_efficientnet_b0.mat/.onnx
│   ├── predictDR.m           # Executes forward pass and produces softmax probabilities
│   ├── pil_bilinear_resize.m # Bit-accurate replication of Python Pillow BILINEAR resize
│   ├── netracare_efficientnet_b0.mat  # Pre-imported MATLAB dlnetwork object (17.5 MB)
│   └── netracare_efficientnet_b0.onnx # Verified ONNX format network graph (16.0 MB)
├── xai/
│   └── generateGradCAM.m     # Computes Grad-CAM activations from x_features_featu_469
├── calibration/
│   └── README.md             # Planned confidence calibration module (Placeholder)
├── evaluation/
│   └── evaluateDR.m          # Prototype evaluation metrics routine
├── deployment/
│   └── README.md             # Deployment packaging roadmap (MPS / Docker)
├── data/
│   ├── raw/                  # Placeholder for raw input images
│   ├── processed/            # Placeholder for processed arrays
│   └── results/              # python_parity_reference.json and generated Grad-CAM files
└── tests/
    ├── testParity.m          # Rigorous numerical parity test against PyTorch outputs
    ├── testPipeline.m        # Stage-by-stage functional unit tests
    └── testPipelineEndToEnd.m# Full 7-image trace testing gating rules
```

---

## `runPipeline.m` — Primary Entrypoint Specification

### Syntax
```matlab
resultJSON = runPipeline()
resultJSON = runPipeline(imageInput)
[resultJSON, resultStruct] = runPipeline(imageInput, screeningId)
```

### Parameters
- `imageInput` *(Optional)*: Absolute filesystem path string (`char` or `string`) or uint8/double image matrix (`HxWx3`). If omitted, defaults to canonical test image `SCR-0003.jpg`.
- `screeningId` *(Optional)*: Unique screening identification string (e.g., `'SCR-0048'`). Defaults to `'SCREENING-DEMO-001'`.

### Outputs
- `resultJSON`: Validated UTF-8 JSON string strictly formatted per Blueprint Section 10.
- `resultStruct`: MATLAB struct containing all clinical metrics and sub-structs.

---

## Detailed Stage Specifications

### Stage 0: Fundus Image Validation (`checkFundusImage.m`)

Validates whether an input image possesses the physical and optical characteristics of a genuine human retinal fundus photograph.

#### 1. Spectral Chromaticity (Melanin & Hemoglobin Optics)
- **Red/Green Ratio:** Melanin and vascular beds reflect heavily in red and moderately in green:
  $$1.20 \le \frac{\text{Mean}(R)}{\text{Mean}(G)} \le 3.20$$
- **Green/Blue Ratio:** Xanthophyll in macula and RPE melanin strongly absorb blue light:
  $$\frac{\text{Mean}(G)}{\text{Mean}(B)} \ge 1.35$$
- **Red/Blue Ratio:** Overall red reflectance dominance:
  $$\frac{\text{Mean}(R)}{\text{Mean}(B)} \ge 1.80$$
- **Saturation & Hue:** Minimum HSV saturation $\ge 0.20$ to reject monochrome grayscale imagery; orange-red retinal hue fraction $\ge 0.50$.

#### 2. Aperture & Border Geometry
- **Border Mean Intensity:** Mean intensity in a 4% outer boundary margin must be $< 120.0$ (rejects light backgrounds or white page cutouts).
- **Aperture Solidity & Circularity:** Circular camera mask requires circularity $\ge 0.65$ and solidity $\ge 0.85$. If area ratio $> 0.90$, image is processed as a full-frame rectangular sensor crop.

#### 3. Retinal Parenchyma Texture
- **Local Standard Deviation:** Evaluated on green channel using $5 \times 5$ sliding window.
- **Smoothness Criteria:** Living parenchyma is cellularly smooth: fraction with $\text{Std} < 4.0$ must exceed $40\%$. Rejects coarse granular surfaces (wood, fabric) where median local std $> 7.0$, and featureless flat synthetic graphics where median local std $< 0.15$.

#### 4. Vascular Dendritic Network
- **Morphological Line Filtering:** 11-pixel linear structuring elements oriented across $0^\circ, 30^\circ, \dots, 150^\circ$.
- **Vessel Continuity:** Top-hat response 90th percentile $\ge 3.0$; connected component branch length $\ge 25$ pixels; total long vessel pixel count $\ge 80$.

#### 5. Scoring Weights & Decision Bounds
$$\text{Score} = 0.30 \cdot S_{\text{color}} + 0.25 \cdot S_{\text{border}} + 0.25 \cdot S_{\text{parenchyma}} + 0.20 \cdot S_{\text{vessels}}$$
- $\text{Score} \ge 0.75$ and all hard checks pass: `status = 'FUNDUS'`, `isFundus = true`.
- $\text{Score} < 0.35$ or fails hard criteria: `status = 'NON_FUNDUS'`, `action = 'REJECT'`, `isFundus = false`.
- $0.35 \le \text{Score} < 0.75$: `status = 'UNCERTAIN'`, `action = 'REJECT / HUMAN REVIEW'`, `isFundus = false`.

> [!NOTE]
> Stage 0 thresholds are initial engineering baseline parameters established for the SIH 2026 prototype. They require ongoing clinical validation against diverse ethnic ocular pigmentation profiles.

---

### Stage 1: Retinal Image Quality Assessment (`assessQuality.m`)

Evaluates diagnostic adequacy within the eroded retinal Field of View (FOV) mask across 4 physical criteria:

1. **Focus Metric ($w=0.30$):** Laplacian variance on Green channel inside FOV:
   - $\text{LapVar} \ge 15.0 \implies \text{GOOD}$
   - $3.0 \le \text{LapVar} < 15.0 \implies \text{BORDERLINE}$
   - $\text{LapVar} < 3.0 \implies \text{BLURRY / UNGRADABLE}$
2. **Illumination Metric ($w=0.25$):**
   - Adequate mean brightness in $[55.0, 165.0]$ (optimal mid-range: $115.0$).
   - Saturated clipped pixels ($I \ge 250$) must be $\le 5\%$.
   - Underexposed shadow pixels ($I \le 15$) must be $\le 5\%$.
   - Spatial uniformity across $3 \times 3$ grid blocks: Coefficient of Variation $< 0.35$.
3. **Contrast Dynamic Range ($w=0.25$):**
   - Inter-percentile range $(P_{95} - P_5) \ge 60.0 \implies \text{GOOD}$.
   - $(P_{95} - P_5) < 30.0 \implies \text{LOW CONTRAST / UNGRADABLE}$.
4. **Field of View Coverage ($w=0.20$):**
   - Retinal tissue coverage $\ge 50\% \implies \text{GOOD}$.
   - $< 25\% \implies \text{RESTRICTED APERTURE / UNGRADABLE}$.

#### Decision Bounds:
- Overall Score $\ge 0.65 \implies \text{GOOD}$ (Proceed directly to CNN).
- $0.40 \le \text{Overall Score} < 0.65 \implies \text{BORDERLINE}$ (Route to Stage 2 Enhancement).
- Overall Score $< 0.40$ or any Hard Fail $\implies \text{UNGRADABLE}$ (Action: `RECAPTURE`).

---

### Stage 2: Adaptive Borderline Enhancement (`enhanceBorderline.m`)

Strictly applied only to scans categorized as `BORDERLINE`. Never applied to `GOOD` or `UNGRADABLE` scans.

1. **CIE L\*a\*b\* Color Space Processing:** Enhances only the luminance channel ($L^*$), strictly preserving natural $a^*$ and $b^*$ chromaticity (prevents artificial vascular discoloration).
2. **Homomorphic Illumination Correction:** High-pass Gaussian filter ($\sigma = 35.0$) extracts and normalizes uneven flash gradients:
   $$I_{\text{corrected}} = 0.55 \cdot I_{\text{homomorphic}} + 0.45 \cdot I_{\text{original}}$$
3. **Rayleigh-Distributed CLAHE:**
   - MATLAB `adapthisteq` applied to normalized $L^*$ with Rayleigh distribution ($\alpha = 0.40$).
   - Conservative clip limit: $0.015$ (prevents noise over-amplification in uniform areas).
   - $8 \times 8$ contextual tile grid.
4. **Edge-Preserving Bilateral Denoising:**
   - MATLAB `imbilatfilt` with spatial standard deviation $\sigma_s = 2.0$ and degree of smoothing $0.04$.
   - Smooths background sensor noise while preserving sharp borders of microaneurysms and exudates.
5. **Mandatory Safety Re-Assessment:** Quality is re-evaluated post-enhancement. If the enhanced scan achieves acceptable quality, it enters Stage 3. If it remains `UNGRADABLE`, inference is blocked and action is set to `RECAPTURE`.

---

### Stage 3: Deep Learning DR Inference (`predictDR.m`)

- **Architecture:** EfficientNet-B0 convolutional neural network.
- **Weights File:** `Matlab/model/netracare_efficientnet_b0.mat` (17.5 MB imported `dlnetwork`).
- **Input Dimensions:** $224 \times 224 \times 3$, RGB order.
- **Normalization:** ImageNet standard: $\mu = [0.485, 0.456, 0.406]$, $\sigma = [0.229, 0.224, 0.225]$.
- **Class Definitions (ICDR / ETDRS):**
  - `0`: No DR (Routine follow-up; Action: `PROCEED`, Decision: `proceed`)
  - `1`: Mild DR (Early clinical follow-up; Action: `PROCEED`, Decision: `proceed`)
  - `2`: Moderate DR (Ophthalmology referral; Action: `SPECIALIST REFERRAL`, Decision: `review`)
  - `3`: Severe DR (Urgent specialist referral; Action: `SPECIALIST REFERRAL`, Decision: `review`)
  - `4`: Proliferative DR (Immediate vitreo-retina referral; Action: `SPECIALIST REFERRAL`, Decision: `review`)
- **Referral Threshold:** Grades $\ge 2$ trigger `referable = true` and `SPECIALIST REFERRAL`.

---

### Preprocessing Parity (`pil_bilinear_resize.m`)

> [!IMPORTANT]
> **Why Standard MATLAB `imresize` is Forbidden for Inference:**
> Standard MATLAB `imresize(..., 'bilinear')` uses anti-aliasing area averaging when downsampling. PyTorch's `torchvision.transforms.Resize` uses Python Pillow's bilinear filter, which samples point-wise using fixed-point triangle convolution without anti-aliasing.
> Using `imresize` introduces subtle numerical distribution shifts that alter logits.
> `pil_bilinear_resize.m` implements the exact 22-bit fixed-point convolution algorithm from Pillow's C library (`libImaging/Resample.c`), achieving **numerical parity ($< 10^{-4}$ probability delta) with PyTorch**.

---

### Explainable AI — Grad-CAM (`generateGradCAM.m`)

- **Feature Layer:** `x_features_featu_469` (final $1 \times 1$ pointwise convolutional feature layer before global pooling in the imported EfficientNet-B0 network).
- **Reduction / Output Layer:** `x_classifier_classif`.
- **Colormap:** Standard `jet` colormap overlayed onto the original fundus scan at $\alpha = 0.30$.
- **Output File:** Deterministically written to `Matlab/data/results/gradcam_<hash>.png`.

---

## Confidence Calibration & Clinical Evaluation Status

### Calibration Status: ⚠️ NOT IMPLEMENTED / PLANNED
- Softmax outputs generated by deep convolutional neural networks tend to be overconfident.
- Post-hoc calibration (Temperature Scaling, Platt Scaling, ECE optimization) has **NOT yet been fitted or validated** for this model.
- All confidence figures reported by the model are **RAW SOFTMAX CONFIDENCE**.

### Evaluation Status: ⚠️ REMAINING WORK
- The model has been verified for numerical parity and pipeline integration against development reference images.
- Formal multi-class evaluation on an independent, held-out clinical screening dataset (reporting per-class sensitivity, specificity, quadratic weighted kappa, and macro F1) is required before clinical deployment.

---

## FastAPI <-> MATLAB Standardized JSON Contract

The output produced by `runPipeline.m` strictly complies with the following JSON schema:

```json
{
  "screening_id": "SCR-0048",
  "stage": "STAGE_3_DR_INFERENCE",
  "status": "GOOD",
  "action": "SPECIALIST REFERRAL",
  "decision": "review",
  "fundus": {
    "isFundus": true,
    "confidence": 0.9251,
    "status": "FUNDUS",
    "score": 0.9251,
    "reasons": ["All retinal morphological and optical characteristics verified"],
    "method": "Multiscale Morphological & Spectral Validity Screening"
  },
  "quality": {
    "status": "GOOD",
    "scores": {
      "focus": 0.7376,
      "illumination": 0.9457,
      "contrast": 0.74,
      "FOV": 0.9204,
      "overall": 0.8268
    },
    "reasons": ["Image quality is sufficient for clinical AI evaluation"]
  },
  "enhancement": {
    "applied": false,
    "improved": false,
    "method": "None (diagnostic quality scan bypassed enhancement)"
  },
  "prediction": {
    "grade": 4,
    "label": "Proliferative DR"
  },
  "confidence": {
    "raw": 0.5407,
    "calibrated": []
  },
  "referable": true,
  "xai": {
    "gradcam_path": "C:\\Users\\ysyas\\RentoAI\\Matlab\\data\\results\\gradcam_9518eff6.png"
  },
  "evidence": [],
  "reasons": ["Screening completed with Proliferative DR classification"],
  "model_version": "EfficientNet-B0-APTOS-v1",
  "pipeline_version": "0.1.0-parity"
}
```

---

## Verification & Testing Commands

Execute these commands in the MATLAB R2026a command window from the `Matlab/` directory:

```matlab
% 1. Run full unit and regression test suite
testPipeline

% 2. Verify numerical parity against Python reference predictions (< 1e-4 delta)
testParity

% 3. Run complete 7-image trace testing fundus gating and rejection
testPipelineEndToEnd

% 4. Test a specific fundus scan directly
[jsonOut, res] = runPipeline('C:\Users\ysyas\RentoAI\backend\storage\uploads\SCR-0003.jpg', 'SCR-DEMO-01');
disp(jsonOut);

% 5. Test Stage 0 validation independently
cfg = model_config();
fundusRes = checkFundusImage('C:\Users\ysyas\RentoAI\backend\storage\uploads\SCR-0003.jpg', cfg);
disp(fundusRes);
```
