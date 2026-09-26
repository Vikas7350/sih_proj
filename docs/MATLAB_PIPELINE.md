# MATLAB Scientific Computing Pipeline Specification

This document provides the in-depth mathematical, algorithmic, and engineering specification for the MATLAB R2026a retinal image processing and Explainable AI pipeline in `Matlab/`.

---

## 1. Pipeline Architecture Overview

The pipeline executes as a deterministic, multi-stage screening graph designed to ensure safety and clinical interpretability at each juncture:

```
                  ┌───────────────────────────────┐
                  │      Input Retinal Image      │
                  │ (Any resolution, RGB format)  │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │            STAGE 0            │
                  │   Fundus Image Validation     │
                  │   (checkFundusImage.m)        │
                  └──────────────┬────────────────┘
                                 │
                    Is Genuine Retinal Fundus?
                    ├── NON_FUNDUS / UNCERTAIN ──► [ REJECT ]
                    │                                 Decision: 'reject'
                    │                                 Action: 'REJECT'
                    │                                 Output: Safety alert JSON
                    │                                 Halt pipeline
                    └── FUNDUS
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │            STAGE 1            │
                  │    Image Quality Assessment   │
                  │      (assessQuality.m)        │
                  └──────────────┬────────────────┘
                                 │
                    Image Quality Status?
                    ├── UNGRADABLE / POOR ───────► [ RECAPTURE ]
                    │                                 Decision: 'recapture'
                    │                                 Action: 'RECAPTURE'
                    │                                 Output: Quality report JSON
                    │                                 Halt pipeline
                    │
                    ├── BORDERLINE ──────────────► ┌───────────────────────────────┐
                    │                              │            STAGE 2            │
                    │                              │  Adaptive CLAHE Enhancement   │
                    │                              │    (enhanceBorderline.m)      │
                    │                              └──────────────┬────────────────┘
                    │                                             │
                    │   Re-assess Image Quality                   │
                    │   ├── Restored to GOOD ◄────────────────────┘
                    │   └── Still UNGRADABLE ───► [ RECAPTURE ]
                    │
                    └── GOOD
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │            STAGE 3            │
                  │   Preprocessing Parity Layer  │
                  │    (pil_bilinear_resize.m)    │
                  │     224x224 RGB Float Tensor  │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │     EFFICIENTNET-B0 INFERENCE │
                  │        (predictDR.m)          │
                  │   ETDRS DR Grades 0, 1, 2, 3, 4│
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │    EXPLAINABLE AI: GRAD-CAM   │
                  │    Layer: x_features_featu_469│
                  │       (generateGradCAM.m)     │
                  └──────────────┬────────────────┘
                                 │
                                 ▼
                  ┌───────────────────────────────┐
                  │      JSON Output Generator    │
                  │  Written to stdout / temp JSON│
                  └───────────────────────────────┘
```

---

## 2. Stage 0: Retinal Fundus Validation (`checkFundusImage.m`)

### Objective & Safety Function
Stage 0 acts as a mandatory front-line safety filter to prevent arbitrary non-medical images (e.g., landscapes, skin lesions, documents, radiographs) from reaching the deep neural network.

### Multivariate Algorithmic Checks
A candidate image $I(x,y) \in \mathbb{R}^{H \times W \times 3}$ is subjected to four quantitative heuristic tests:

1. **Retinal Color Dominance:**
   - Retinal fundus imagery is characterized by an orange-red vascular parenchyma.
   - The red-to-green/blue ratio is calculated:
     $$\bar{R} = \frac{1}{|\Omega|} \sum_{(x,y) \in \Omega} I_R(x,y), \quad \bar{G} = \frac{1}{|\Omega|} \sum I_G(x,y), \quad \bar{B} = \frac{1}{|\Omega|} \sum I_B(x,y)$$
     $$r_{\text{color}} = \frac{\bar{R}}{\bar{G} + \bar{B} + \epsilon}$$
   - Fundus criterion: $r_{\text{color}} \ge 0.55$.

2. **Circular Field of View (FOV) Aperture:**
   - Fundus cameras project the retinal reflection through a circular or oval optical aperture surrounded by a dark border.
   - Stage 0 extracts the foreground mask $\Omega$ using Otsu intensity thresholding and evaluates aperture circularity:
     $$C = \frac{4 \pi \cdot \text{Area}(\Omega)}{\text{Perimeter}(\Omega)^2}$$
   - Circularity criterion: $C \ge 0.40$.

3. **Retinal Parenchyma Homogeneity:**
   - Evaluates the spatial smoothness of the retinal background, verifying that high frequencies are concentrated in vascular bifurcations rather than uniform text, grid lines, or high-frequency digital noise.

4. **Retinal Blood Vessel Presence:**
   - Applies green-channel inverted bottom-hat filtering and Frangi vesselness approximation to detect tubular vascular arborizations.
   - Vessel density criterion: Vascular pixels must comprise $\ge 1.0\%$ of the active FOV.

### Decision States
- `FUNDUS`: All heuristic criteria satisfied. Pipeline advances to Stage 1.
- `NON_FUNDUS`: Immediate failure of color ratio, boundary, or vascular density. Pipeline halts with `decision = 'reject'`, `action = 'REJECT'`.
- `UNCERTAIN`: Marginal metrics (e.g., severely overexposed or highly cataractous fundus). Rejection gate enforced to preserve clinical safety.

> [!WARNING]
> Stage 0 thresholds are engineering heuristics tuned on benchmark datasets. Broader clinical validation on diverse patient populations and multi-vendor fundus cameras is required before autonomous deployment.

---

## 3. Stage 1: Image Quality Assessment (`assessQuality.m`)

### Quantitative Quality Metrics
Stage 1 quantifies four independent diagnostic dimensions:

1. **Focus & Sharpness:**
   - Quantified using the variance of the Modified Laplacian ($VoML$) computed across the green channel:
     $$\Delta_{\text{mod}} I_G = |2 I_G(x,y) - I_G(x-1,y) - I_G(x+1,y)| + |2 I_G(x,y) - I_G(x,y-1) - I_G(x,y+1)|$$
     $$S_{\text{focus}} = \frac{1}{|\Omega|} \sum_{(x,y) \in \Omega} (\Delta_{\text{mod}} I_G - \bar{\Delta})^2$$
   - Minimum acceptable focus threshold: $S_{\text{focus}} \ge 0.15$.

2. **Illumination Uniformity:**
   - Analyzes histogram luminance distribution within the active FOV. Rejects extreme underexposure (mean luminance $< 30$) or severe optical flash reflections / macular bleaching (saturation $> 15\%$).

3. **Retinal Contrast:**
   - Evaluates Michelson and Weber contrast between the optic disc, retinal blood vessels, and background parenchyma.
   - Acceptable contrast threshold: $C_{\text{contrast}} \ge 0.20$.

4. **Field of View (FOV) Completeness:**
   - Verifies that the optical aperture occupies $\ge 35\%$ of the total pixel array and is not excessively cropped or clipped.

### Quality Composite States
- `GOOD`: Composite score $\ge 0.70$. Proceeds directly to Stage 3 inference.
- `BORDERLINE`: Composite score $0.45 \le S < 0.70$. Triggers Stage 2 adaptive enhancement.
- `UNGRADABLE`: Composite score $< 0.45$. Halts pipeline; emits `RECAPTURE` recommendation.

---

## 4. Stage 2: Adaptive Enhancement (`enhanceBorderline.m`)

Stage 2 executes only when Stage 1 determines that an image is `BORDERLINE`.

### Mathematical Processing
1. **Color Space Conversion:**
   The RGB image is transformed into the perceptually uniform CIE $L^*a^*b^*$ color space. Chromatic channels ($a^*, b^*$) are preserved untouched to avoid distorting pathological color cues (e.g., differentiating red microaneurysms from yellow hard exudates).
2. **Rayleigh-Distributed CLAHE:**
   Contrast-Limited Adaptive Histogram Equalization is applied exclusively to the luminance channel ($L^*$):
   - Tile grid size: $8 \times 8$ blocks.
   - Contrast limit: $0.02$.
   - Distribution: Rayleigh distribution to mimic natural retinal luminance roll-off.
3. **Illumination Normalization:**
   Large-scale illumination gradients are estimated using a Gaussian low-pass kernel ($\sigma = 30$) and subtracted to flatten flash non-uniformities.
4. **Edge-Preserving Denoising:**
   A gentle bilateral filter is applied to prevent high-frequency noise amplification in darker retinal peripheral zones.

### Verification Gate
The enhanced image undergoes re-assessment by `assessQuality.m`. If the composite score improves to `GOOD`, the enhanced image is passed to Stage 3. If it remains `BORDERLINE` or `UNGRADABLE`, the enhancement is discarded and the pipeline emits `action = 'RECAPTURE'`.

---

## 5. Stage 3: EfficientNet-B0 Deep Learning Inference

### Model Topology & Weights
- **Backbone:** EfficientNet-B0 (Compound scaling coefficient $\phi = 0$).
- **Input Dimensions:** $224 \times 224 \times 3$ RGB.
- **Normalization:** ImageNet mean $\mu = [0.485, 0.456, 0.406]$ and standard deviation $\sigma = [0.229, 0.224, 0.225]$.
- **Target Disease Classes:**
  - Grade 0: `No DR`
  - Grade 1: `Mild DR`
  - Grade 2: `Moderate DR`
  - Grade 3: `Severe DR`
  - Grade 4: `Proliferative DR`

### Preprocessing Parity (`pil_bilinear_resize.m`)
Standard MATLAB `imresize(..., 'bilinear')` utilizes continuous antialiasing filtering which diverges mathematically from the Python `torchvision.transforms` / Pillow implementation.

To eliminate distribution shift between Python PyTorch training and MATLAB production inference, NetraCare includes `Matlab/model/pil_bilinear_resize.m`:
- Implements exact 22-bit fixed-point arithmetic matching Python Pillow's `libImaging/Resample.c`.
- **Verified Parity:** Maximum absolute probability difference between PyTorch and MATLAB across all 5 classes is $< 10^{-4}$ ($0.01\%$), ensuring true cross-platform reproducibility.

---

## 6. Explainable AI: Grad-CAM Saliency Maps

NetraCare integrates Gradient-weighted Class Activation Mapping (Grad-CAM) to explain the model's diagnostic focus:

```
[ Input Tensor (224x224x3) ]
             │
             ▼
[ EfficientNet-B0 Backbone ]
             │
             ├── Activations A^k ──► [ Feature Layer: x_features_featu_469 ]
             │
             ▼
[ Output Layer: x_classifier_classif ]
             │
             ├── Predicted Grade Class Score y^c
             ▼
[ Backward Gradient Computation ]
  ∂y^c / ∂A^k
             │
             ▼
[ Global Average Pooling of Gradients ]
  α_k^c = (1/Z) ∑_i ∑_j (∂y^c / ∂A_{i,j}^k)
             │
             ▼
[ Weighted Combination & ReLU ]
  L_GradCAM^c = ReLU( ∑_k α_k^c A^k )
             │
             ▼
[ Interpolation to 224x224 & Jet Colormap ]
             │
             ▼
[ Alpha Blending on Original Fundus (alpha = 0.30) ]
             │
             ▼
[ Written to Matlab/deployment/output/gradcam_<id>.png ]
```

### Deterministic Saliency Verification
The Grad-CAM generation is fully deterministic. For a fixed input image, the gradient backpropagation produces bit-identical heatmap arrays across successive runs.

---

## 7. Model Confidence & Calibration Status

> [!IMPORTANT]
> **Current Status: RAW SOFTMAX / UNCALIBRATED.**
> - The confidence value returned by `predictDR.m` is the raw maximum softmax probability:
>   $$\text{Confidence}_{\text{raw}} = \max_c \left( \frac{\exp(z_c)}{\sum_j \exp(z_j)} \right)$$
> - Neural networks trained with cross-entropy loss are notoriously overconfident (Guo et al., 2017).
> - **Post-hoc calibration (such as Temperature Scaling or Matrix Scaling) is NOT yet fitted or validated.**
> - The confidence field in the JSON contract explicitly returns:
>   ```json
>   "confidence": {
>     "raw": 0.6814,
>     "calibrated": null,
>     "is_calibrated": false,
>     "method": "RAW_SOFTMAX"
>   }
>   ```
> - Developers must NOT present this confidence as a calibrated probability to clinical users.

---

## 8. Verification & Execution Commands

### Full Pipeline End-to-End Test
```matlab
% In MATLAB Command Window:
cd('C:\Users\ysyas\RentoAI\Matlab');
[jsonResult, outStruct] = runPipeline('C:\Users\ysyas\RentoAI\frontend\public\test-images\genuine_fundus.jpg', 'TEST-001');
disp(jsonResult);
```

### Stage 0 Isolated Validation Test
```matlab
cd('C:\Users\ysyas\RentoAI\Matlab');
addpath(genpath('.'));
img = imread('C:\Users\ysyas\RentoAI\frontend\public\test-images\genuine_fundus.jpg');
[isFundus, status, conf, reasons] = checkFundusImage(img);
fprintf('isFundus: %d, Status: %s, Confidence: %.4f\n', isFundus, status, conf);
```

### Stage 1 Quality Assessment Test
```matlab
[qStatus, qScore, qChecks, qScores, qReasons] = assessQuality(img);
fprintf('Quality: %s, Score: %.4f\n', qStatus, qScore);
```

### Pillow Preprocessing Parity Test
```matlab
cd('C:\Users\ysyas\RentoAI\Matlab\tests');
test_pillow_parity;
```

### Grad-CAM Saliency Test
```matlab
cd('C:\Users\ysyas\RentoAI\Matlab\tests');
test_gradcam_deterministic;
```
