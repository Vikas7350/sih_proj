# System Architecture & Technical Specifications

This document provides the complete, authoritative architecture specification for the NetraCare / RentoAI diabetic retinopathy screening system, covering system topology, component interactions, decision boundaries, data contracts, and asset lifecycles.

---

## 1. End-to-End System Topology

The platform is designed as a three-tier distributed architecture spanning an interactive web portal, an asynchronous REST API backend, and an isolated scientific computing inference engine:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PRESENTATION TIER (Next.js)                        │
│                                                                             │
│  - App Router Architecture (React 19 / Next.js 15.2.0)                      │
│  - Responsive Clinical Portal (Clinician Dashboard, Screening Wizard, XAI)  │
│  - Port: 3000                                                               │
│  - Proxy Timeout: 120,000ms (experimental.proxyTimeout in next.config.ts)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                        HTTP / REST    │  /api/backend/* (Proxy Rewrites)
                        Port 8000      │  /storage/*     (Signed Image Streaming)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           APPLICATION TIER (FastAPI)                        │
│                                                                             │
│  - Asynchronous RESTful Web Service (Uvicorn / Python 3.14)                 │
│  - Domain Modules: Auth, Patients, Screenings, Reports, Storage             │
│  - Rate Limiting (Sliding Window) & HMAC-SHA256 URL Signing                 │
│  - Subprocess Coordinator for MATLAB Execution Lifecycle                    │
└──────────────────────┬───────────────────────────────┬──────────────────────┘
                       │                               │
       Subprocess      │ Batch CLI Invocation          │ PyMongo Native Driver
       Execution       ▼                               ▼ Port 27017
┌──────────────────────────────┐        ┌─────────────────────────────────────┐
│     INFERENCE TIER (MATLAB)  │        │          PERSISTENCE TIER           │
│                              │        │                                     │
│  - MATLAB R2026a Engine      │        │  - MongoDB Database (dr_screening)  │
│  - Stage 0: Fundus Validator │        │  - Collections:                     │
│  - Stage 1: Quality Grader   │        │      * users                        │
│  - Stage 2: CLAHE Enhancer   │        │      * patients                     │
│  - Stage 3: EfficientNet-B0  │        │      * screenings                   │
│  - XAI: Grad-CAM Overlay     │        │      * phc_profiles                 │
└──────────────────────────────┘        └─────────────────────────────────────┘
```

---

## 2. Component Boundaries & Interfaces

### A. Frontend ↔ Backend Boundary
- **Proxy Rewrites:** All requests from the browser target `http://localhost:3000/api/backend/:path*`, which Next.js forwards internally to `http://127.0.0.1:8000/api/:path*`.
- **State & Identity:** Session state is maintained via the `dr_token` HTTP-only cookie, generated upon login or Google OAuth completion.
- **Multipart Ingestion:** High-resolution fundus images are uploaded via `POST /api/screenings/{id}/image` directly to the backend upload buffer before inference is triggered.

### B. Backend ↔ MATLAB Subprocess Boundary
FastAPI coordinates MATLAB as an isolated batch child process:
1. **Invocation:**
   ```powershell
   matlab.exe -batch "cd('<MATLAB_ROOT>'); [jsonStr, ~] = runPipeline('<IMAGE_PATH>', '<SCREENING_ID>'); ..."
   ```
2. **Handoff Medium:** Rather than piping through standard output (which risks truncation or encoding corruption from MATLAB command-window banners), MATLAB writes its output directly to a temporary UTF-8 JSON file in the operating system's temporary directory (`%TEMP%\netracare_matlab_<screening_id>_<uuid>.json`).
3. **Synchronization & Ingestion:** FastAPI blocks asynchronously on the subprocess with a configurable timeout (`MATLAB_TIMEOUT_SECONDS = 180`). Upon process completion (exit code 0), FastAPI parses the temporary JSON file, removes it from disk, copies the generated Grad-CAM heatmap, and updates MongoDB.

---

## 3. Screening Lifecycle & Multi-Stage Decision Gates

The core clinical logic is partitioned into four sequential decision stages:

```
[ Input Fundus Image ]
          │
          ▼
┌─────────────────────────────────┐
│            STAGE 0              │
│   Fundus Image Validation       │
└──────────────┬──────────────────┘
               │
      Is valid fundus?
      ├── NO / UNCERTAIN ──► [ GATE REJECTION ]
      │                         Action: REJECT
      │                         Status: rejected
      │                         Deep Learning Blocked (No Grade, No Grad-CAM)
      └── YES
          │
          ▼
┌─────────────────────────────────┐
│            STAGE 1              │
│    Image Quality Assessment     │
└──────────────┬──────────────────┘
               │
      Quality Grade?
      ├── UNGRADABLE / POOR ──► [ GATE RECAPTURE ]
      │                            Action: RECAPTURE
      │                            Status: quality_failed
      │                            Inference Blocked (Follow-up scan required)
      │
      ├── BORDERLINE ─────────► ┌─────────────────────────────────┐
      │                         │            STAGE 2              │
      │                         │  Adaptive CLAHE Enhancement     │
      │                         └────────────────┬────────────────┘
      │                                          │ (Image contrast restored)
      └── GOOD ◄─────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────┐
│            STAGE 3              │
│  EfficientNet-B0 DR Inference   │
│  & Explainable AI (Grad-CAM)    │
└──────────────┬──────────────────┘
               │
               ▼
┌─────────────────────────────────┐
│       CLINICAL REPORT           │
│  - Grade 0–4 Prediction         │
│  - Raw Softmax Confidence       │
│  - Saliency Heatmap Overlay     │
│  - Structured Recommendations   │
└─────────────────────────────────┘
```

### Stage Decision Logic Matrix

| Stage | Evaluator | Metrics Evaluated | Failure State | Action | Next Step |
|---|---|---|---|---|---|
| **0. Validation** | `checkFundusImage.m` | Color ratio ($R/(G+B)$), circular aperture circularity, boundary contrast, vessel density | `NON_FUNDUS` / `UNCERTAIN` | `REJECT` | Immediate halt. Do NOT run CNN or Grad-CAM. |
| **1. Quality** | `assessQuality.m` | Focus (modified Laplacian), Illumination (mean luminance), Contrast (Weber contrast), FOV visibility | `UNGRADABLE` / `POOR` | `RECAPTURE` | Immediate halt. Do NOT run CNN. Request clinician re-take. |
| **2. Enhancement** | `enhanceBorderline.m` | Triggered only if Stage 1 is `BORDERLINE`. Rayleigh-distributed CLAHE applied to CIE $L^*$ channel. | Post-enhancement still ungradable | `RECAPTURE` | If enhancement fails to restore quality, request recapture. |
| **3. Inference** | `predictDR.m` | EfficientNet-B0 forward pass on Pillow-parity $224 \times 224$ tensor | Execution error | `SYSTEM_ERROR` | Generates Grade (0–4), raw softmax confidence, and Grad-CAM map. |

---

## 4. Complete JSON Data Contract (MATLAB → Backend)

The following JSON schema defines the contract generated by `runPipeline.m` and parsed by `backend/app/services/matlab_service.py`:

```json
{
  "screening_id": "SCR-0043",
  "stage": "STAGE_3_DR_INFERENCE",
  "decision": "review",
  "action": "SPECIALIST REFERRAL",
  "fundus": {
    "isFundus": true,
    "confidence": 0.9878,
    "score": 0.9878,
    "reasons": [],
    "status": "FUNDUS",
    "method": "multivariate_heuristic"
  },
  "quality": {
    "status": "GOOD",
    "score": 0.8908,
    "checks": {
      "focus": true,
      "illumination": true,
      "contrast": true,
      "resolution": true
    },
    "scores": {
      "focus": 0.884,
      "illumination": 0.912,
      "contrast": 0.876,
      "field_of_view": 0.891
    },
    "reasons": []
  },
  "enhancement": {
    "applied": false,
    "improved": false,
    "method": "RAYLEIGH_CLAHE",
    "before_focus": null,
    "after_focus": null
  },
  "prediction": {
    "grade": 3,
    "label": "Severe DR",
    "probabilities": {
      "grade_0": 0.0121,
      "grade_1": 0.0452,
      "grade_2": 0.2613,
      "grade_3": 0.6814,
      "grade_4": 0.0000
    }
  },
  "confidence": {
    "raw": 0.6814,
    "calibrated": null,
    "is_calibrated": false,
    "method": "RAW_SOFTMAX"
  },
  "xai": {
    "method": "Grad-CAM",
    "feature_layer": "x_features_featu_469",
    "reduction_layer": "x_classifier_classif",
    "alpha": 0.30,
    "gradcam_path": "C:/Users/ysyas/RentoAI/Matlab/deployment/output/gradcam_SCR-0043.png"
  },
  "reasons": []
}
```

---

## 5. Asset Lifecycle & Storage Security

Uploaded retinal images and generated visual heatmaps are managed according to strict privacy and data preservation protocols:

```
[ Upload Fundus File ]
          │
          │ POST /api/screenings/{id}/image
          ▼
backend/storage/uploads/{id}.jpg  (Original Image Preserved)
          │
          │ Subprocess invocation (runPipeline.m)
          ▼
Matlab/deployment/output/gradcam_{id}.png (Raw Heatmap)
          │
          │ Ingested by matlab_service.py
          ▼
backend/storage/heatmaps/{id}.png  (Persistent Heatmap Store)
          │
          │ Signed URL Generator (sign_url("heatmaps", "{id}.png"))
          ▼
/storage/heatmaps/{id}.png?exp=1790000000&sig=a8f3...
          │
          │ Streamed via FileResponse with Auth / Signature Validation
          ▼
[ Next.js GradcamViewer Component ]
```

### Protection Mechanisms
1. **Path Traversal Prevention:** Storage paths are resolved using strict `is_relative_to` path sanitization. Any request containing directory traversal tokens (`../`) is rejected with HTTP 404.
2. **Signed Token Validation:** Images cannot be scraped anonymously. Requests must provide either a valid user session token or an HMAC-SHA256 signature containing an unexpired timestamp.
3. **MongoDB Document Size Limiter:** Raw pixel masks generated during MATLAB processing (`fovMask`, `vesselMask`) are stripped via `_sanitize_for_storage()` before writing to MongoDB, ensuring document sizes remain well under the 16MB BSON limit while preserving all scalar metrics and diagnosis details.
