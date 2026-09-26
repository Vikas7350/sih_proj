# ML Model Integration Guide — RetinoCare DR Screening

## Purpose

This document explains how the backend and frontend teammates should integrate the completed Diabetic Retinopathy (DR) ML pipeline.

The ML pipeline is already working locally and provides:

1. Fundus image quality assessment
2. EfficientNet-B0 DR classification
3. DR grade 0–4
4. Confidence and class probabilities
5. Grad-CAM heatmap
6. Grad-CAM overlay
7. Structured JSON output

The backend/API layer should be the main integration point. The frontend should consume the backend API rather than directly importing Python ML code.

---

# 1. High-Level Architecture

```text
Next.js Frontend
       |
       | multipart/form-data
       | fundus image
       v
FastAPI Backend
       |
       v
ML Inference Layer
       |
       +--> Image Quality Check
       |
       +--> EfficientNet-B0
       |
       +--> DR Prediction
       |
       +--> Grad-CAM
       |
       v
Structured JSON
       |
       v
FastAPI Response
       |
       v
Next.js Result Page
```

## Important separation

Frontend:
- Upload image
- Show upload/progress state
- Display quality result
- Display DR grade/confidence
- Display Grad-CAM
- Display risk/referral UI
- Display report

Backend:
- Receive image
- Validate upload
- Call ML inference
- Store screening/result data
- Store generated Grad-CAM files
- Return API response

ML:
- Do not build UI
- Do not handle patient records
- Do not handle authentication
- Do not access MongoDB
- Only process the retinal image and return inference results

---

# 2. ML Entry Point

The main ML entry point is:

```text
src/inference.py
```

The backend should conceptually call:

```python
result = run_inference(image_path)
```

The backend should NOT directly manipulate:

```text
EfficientNet
model.py
gradcam.py
image_quality.py
```

Those are internal ML implementation details.

---

# 3. ML Pipeline Behavior

The pipeline executes in this order:

```text
Image
  |
  v
Image Quality Assessment
  |
  +---- INSUFFICIENT
  |          |
  |          v
  |       Stop
  |          |
  |          v
  |       Recapture
  |
  +---- SUITABLE
             |
             v
       EfficientNet-B0
             |
             v
        DR Grade 0–4
             |
             v
        Confidence
             |
             v
          Grad-CAM
             |
             v
        JSON result
```

## Quality gate behavior

If the image is insufficient:

- Do NOT run the DR classifier
- Do NOT generate Grad-CAM
- Return the quality warnings
- Frontend should ask the healthcare worker to recapture the image

---

# 4. DR Class Mapping

The model outputs five classes:

| Grade | Label |
|---:|---|
| 0 | No DR |
| 1 | Mild DR |
| 2 | Moderate DR |
| 3 | Severe DR |
| 4 | Proliferative DR |

The frontend should use the `grade` and `class` returned by the API rather than recreating the model's class mapping independently.

---

# 5. Recommended Backend API

Recommended endpoint:

```http
POST /api/v1/screenings/analyze
```

Request:

```text
Content-Type: multipart/form-data
```

Suggested fields:

```text
patient_id
eye
image
```

Example:

```text
patient_id = PAT-001
eye = right
image = fundus.jpg
```

The backend should save/create the screening record before or during processing according to the team's existing API design.

---

# 6. Backend → ML Call

Conceptually:

```python
from src.inference import run_inference

result = run_inference(
    image_path,
    generate_explanation=True
)
```

The ML layer returns a Python dictionary.

The backend should convert that dictionary into its API response schema.

Do not expose internal Windows filesystem paths directly to the browser.

For example, ML may internally produce:

```text
results/inference/abc_gradcam.jpg
```

The backend should expose a browser-accessible URL such as:

```text
/media/screenings/abc_gradcam.jpg
```

or whatever storage URL/path the backend team chooses.

---

# 7. Successful API Response

Recommended external API structure:

```json
{
  "status": "SUCCESS",

  "screening_id": "SCR-001",

  "quality": {
    "status": "SUITABLE",
    "quality_score": 58.42,

    "resolution": {
      "width": 1504,
      "height": 1000,
      "passed": true
    },

    "brightness": {
      "value": 45.98,
      "status": "GOOD",
      "passed": true
    },

    "contrast": {
      "value": 30.96,
      "status": "GOOD",
      "passed": true
    },

    "blur": {
      "score": 27.25,
      "status": "SHARP",
      "passed": true
    },

    "fundus_visibility": {
      "score": 0.7407,
      "status": "GOOD",
      "passed": true
    },

    "warnings": []
  },

  "prediction": {
    "grade": 3,
    "class": "Severe DR",
    "confidence": 0.983987,

    "probabilities": {
      "No DR": 0.000002,
      "Mild DR": 0.000190,
      "Moderate DR": 0.010195,
      "Severe DR": 0.983987,
      "Proliferative DR": 0.005626
    }
  },

  "gradcam": {
    "heatmap_url": "/media/screenings/abc_heatmap.jpg",
    "overlay_url": "/media/screenings/abc_gradcam.jpg"
  }
}
```

`screening_id` and public media URLs are backend-level additions.

---

# 8. Insufficient Image Response

When image quality fails:

```json
{
  "status": "INSUFFICIENT",

  "screening_id": "SCR-002",

  "quality": {
    "status": "INSUFFICIENT",

    "quality_score": 55.35,

    "warnings": [
      "Image appears blurry."
    ]
  },

  "prediction": null,

  "gradcam": null
}
```

The frontend should show:

```text
Image quality insufficient

Image appears blurry.

Please recapture the fundus image.
```

The frontend should NOT display:

```text
DR Grade: 0
Confidence: 0%
```

because the model did not perform DR classification.

---

# 9. Frontend Integration

The Next.js frontend should not run Python.

The frontend should call:

```text
POST /api/v1/screenings/analyze
```

Example frontend flow:

```text
1. Healthcare worker selects patient
2. Healthcare worker selects left/right eye
3. Fundus image is uploaded
4. Frontend sends image to backend
5. Backend calls ML inference
6. Backend returns JSON
7. Frontend displays result
```

Example TypeScript service:

```typescript
export async function analyzeFundusImage(
  image: File,
  patientId: string,
  eye: "left" | "right"
) {
  const formData = new FormData();

  formData.append("image", image);
  formData.append("patient_id", patientId);
  formData.append("eye", eye);

  const response = await fetch(
    "/api/v1/screenings/analyze",
    {
      method: "POST",
      body: formData,
    }
  );

  if (!response.ok) {
    throw new Error("Screening analysis failed");
  }

  return response.json();
}
```

Do NOT manually set:

```typescript
headers: {
  "Content-Type": "multipart/form-data"
}
```

when using `FormData`. The browser sets the correct multipart boundary automatically.

---

# 10. Frontend Result Mapping

The frontend should map the response like this:

```text
response.status
        |
        +---- INSUFFICIENT
        |         |
        |         v
        |    Quality warning
        |    Recapture button
        |
        +---- SUCCESS
                  |
                  +--> response.quality
                  |
                  +--> response.prediction
                  |
                  +--> response.gradcam
```

## Prediction UI

Use:

```text
prediction.grade
prediction.class
prediction.confidence
prediction.probabilities
```

Example:

```text
DR Grade: 3
Severe DR
Confidence: 98.40%
```

Confidence should be displayed as a percentage:

```typescript
const confidencePercent =
  prediction.confidence * 100;
```

---

# 11. Grad-CAM UI

The backend should expose browser-accessible URLs:

```json
{
  "gradcam": {
    "heatmap_url": "/media/screenings/abc_heatmap.jpg",
    "overlay_url": "/media/screenings/abc_gradcam.jpg"
  }
}
```

The frontend can then use:

```tsx
<img
  src={result.gradcam.overlay_url}
  alt="Grad-CAM explanation overlay"
/>
```

Recommended UI:

```text
Original Fundus Image
        |
        |       Grad-CAM Overlay
        v               v

     [ IMAGE ]       [ IMAGE ]
```

The Grad-CAM is an AI explanation visualization. It should not be presented as a definitive lesion segmentation.

---

# 12. Risk/Referral Logic

The ML model's direct output is:

```text
Grade
Class
Confidence
```

The project's frontend also has risk/referral UI.

Do not silently assume that the ML model itself is returning a clinically validated referral decision.

If the backend team implements referral logic, keep it as a separate application/business-logic layer.

Example conceptual mapping for the existing MVP:

```text
Grade 0 → Low risk
Grade 1 → Monitor
Grade 2 → Higher monitoring/referral consideration
Grade 3 → High risk / specialist referral
Grade 4 → Urgent specialist evaluation
```

This mapping should be reviewed by the project/clinical requirements before being presented as medical guidance.

---

# 13. Quality Result UI

Recommended frontend card:

```text
IMAGE QUALITY

Status: ✓ SUITABLE

Resolution       ✓ Good
Brightness       ✓ Good
Contrast         ✓ Good
Sharpness        ✓ Good
Fundus visibility ✓ Good
```

For insufficient quality:

```text
IMAGE QUALITY

Status: ✕

Image appears blurry.

Please upload/recapture another image.
```

The `quality_score` can be shown, but the individual quality checks are more informative for the MVP.

---

# 14. Backend Storage

The backend should decide where to store:

```text
Original fundus image
Grad-CAM heatmap
Grad-CAM overlay
Screening result
```

A possible structure:

```text
media/
└── screenings/
    └── SCR-001/
        ├── original.jpg
        ├── heatmap.jpg
        └── gradcam.jpg
```

The database can store references/URLs instead of large image binaries.

---

# 15. Important Performance Consideration

Do NOT recreate/load the EfficientNet model for every API request.

Bad:

```text
Request
  ↓
create_model()
  ↓
load checkpoint
  ↓
inference
```

Preferred:

```text
FastAPI startup
      ↓
Load EfficientNet once
      ↓
Keep model in memory/GPU
      ↓
Request
      ↓
Inference
```

The backend integration should therefore eventually initialize the ML model once and reuse it.

The current `src/inference.py` is designed as a working integration/reference pipeline; production API code may refactor model loading so the checkpoint is not loaded for every request.

---

# 16. Error Handling

The backend should handle:

### Invalid image

```text
400 Bad Request
```

### Missing image

```text
400 Bad Request
```

### Image processing failure

```text
422 Unprocessable Entity
```

### ML/inference failure

```text
500 Internal Server Error
```

### Successful insufficient-quality image

This is NOT a server error.

Return a normal successful API response containing:

```json
{
  "status": "INSUFFICIENT",
  "prediction": null
}
```

The image was processed correctly; it simply failed the quality gate.

---

# 17. Frontend Loading State

The existing frontend workflow can show:

```text
Uploading retinal image...
        ↓
Checking image quality...
        ↓
Running AI screening...
        ↓
Generating explanation...
        ↓
Result ready
```

The backend may return one final response rather than streaming these exact stages.

The frontend loading UI can therefore be implemented as a visual progress sequence while waiting for the API response.

---

# 18. Security

The frontend should never receive:

```text
Model checkpoint
NVIDIA source code
Python source
GPU information
Internal filesystem paths
```

Only return the data required by the application.

The backend should also validate:

- File type
- File size
- Image decoding
- Patient/screening authorization
- Eye selection
- Authentication/session

---

# 19. Model Metrics

Current held-out validation results:

```text
Samples:       733
Accuracy:      0.8090
Macro F1:      0.6636
Weighted F1:   0.8134
Precision:     0.6588
Recall:        0.6781
```

Per-class F1:

```text
No DR             0.9707
Mild DR           0.6279
Moderate DR       0.7513
Severe DR         0.4045
Proliferative DR  0.5636
```

These are validation metrics, not guarantees of real-world clinical performance.

---

# 20. Important Medical Limitation

This is an AI screening/decision-support MVP.

It is NOT a replacement for an ophthalmologist or a clinically validated autonomous diagnostic device.

The model has been evaluated on the available APTOS validation split and may behave differently on:

- Different cameras
- Different image resolutions
- Different populations
- Different PHCs
- Poor acquisition conditions
- Images outside the training distribution

The image quality thresholds are engineering thresholds for the MVP and are not clinically validated.

---

# 21. What Each Teammate Needs

## Backend/API teammate

Needs:

```text
checkpoints/best_model.pth
src/inference.py
src/model.py
src/image_quality.py
src/gradcam.py
requirements.txt
```

Responsibilities:

```text
FastAPI endpoint
      ↓
Receive image
      ↓
Save temporary image
      ↓
Call ML inference
      ↓
Store result/files
      ↓
Return API JSON
```

## Frontend teammate

Does NOT need the Python model.

They only need the API contract:

```text
POST /api/v1/screenings/analyze
```

and the response fields:

```text
status
quality
prediction
gradcam
```

## ML teammate

Owns:

```text
Dataset
Training
Evaluation
Checkpoint
Inference
Grad-CAM
Image quality
```

---

# 22. Integration Checklist

## Backend

- [ ] Copy/locate ML module
- [ ] Install Python dependencies
- [ ] Verify `best_model.pth`
- [ ] Verify NVIDIA EfficientNet source dependency
- [ ] Create image upload endpoint
- [ ] Call `run_inference()`
- [ ] Store original image
- [ ] Store Grad-CAM outputs
- [ ] Convert internal paths to public URLs
- [ ] Return stable JSON schema
- [ ] Load model once rather than per request
- [ ] Add authentication/authorization
- [ ] Add file validation

## Frontend

- [ ] Upload fundus image
- [ ] Send multipart request
- [ ] Display loading state
- [ ] Handle `SUCCESS`
- [ ] Handle `INSUFFICIENT`
- [ ] Display quality checks
- [ ] Display DR grade
- [ ] Display confidence
- [ ] Display class probabilities if desired
- [ ] Display original fundus
- [ ] Display Grad-CAM overlay
- [ ] Add recapture workflow
- [ ] Connect result to screening history
- [ ] Connect result to report generation

---

# 23. Final Integration Contract

The cleanest division of responsibility is:

```text
                    FRONTEND
                       |
                       | image
                       v
                    BACKEND
                       |
                       | image_path
                       v
                 ML INFERENCE
                       |
           ┌───────────┴───────────┐
           |                       |
      Quality Gate            DR Model
           |                       |
           |                       v
           |                  Prediction
           |                       |
           |                       v
           |                    Grad-CAM
           |                       |
           └───────────┬───────────┘
                       |
                       v
                     JSON
                       |
                       v
                    BACKEND
                       |
                       v
                   FRONTEND
```

The backend is the boundary between the application and the ML implementation.

---

# 24. Final ML Handoff

The ML pipeline is considered ready for integration when these commands work:

```powershell
python src/image_quality.py --image "..."
```

```powershell
python src/predict.py --image "..."
```

```powershell
python src/gradcam.py --image "..."
```

```powershell
python src/inference.py --image "..." --json
```

The complete inference test should demonstrate:

```text
Good image
    ↓
Quality = SUITABLE
    ↓
DR prediction
    ↓
Grad-CAM
    ↓
JSON

Bad/blurry image
    ↓
Quality = INSUFFICIENT
    ↓
No DR inference
    ↓
No Grad-CAM
    ↓
Recapture response
```

This is the expected ML-to-application integration behavior.
