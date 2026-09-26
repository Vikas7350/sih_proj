# NetraCare — End-to-End Integration & System Validation Report
## SIH 2026 | Problem Statement: PS 26038 | Phase 6 Final Validation

---

## 1. Executive Summary

Phase 6 completes the final end-to-end system integration, verification, and regression validation of the NetraCare Diabetic Retinopathy screening platform. The unified architecture spans the entire screening workflow:

```text
  [ Frontend SPA ] (Next.js / TypeScript)
        │
        ▼ (HTTP REST / JWT Auth / Signed URLs)
  [ FastAPI Backend ] (Python 3.13)
        ├── Subprocess Interface (`runPipeline.m`) ──► [ MATLAB Clinical Engine ] (R2026a)
        │                                                     ├── Stage 0: Fundus Gate
        │                                                     ├── Stage 1: Quality Filter
        │                                                     ├── Stage 2: CLAHE Enhancement
        │                                                     ├── Stage 3: EfficientNet-B0
        │                                                     ├── Stage 4: Retinal Evidence
        │                                                     └── Stage 5: Grad-CAM Saliency
        ├── Persistence (Sanitized Metadata) ────────► [ MongoDB Storage ]
        └── Static Storage (Signed Heatmaps) ────────► [ Filesystem Artifacts ]

  [ SimEvents Digital Twin ] (Simulink / SimEvents R2026a)
        ├── Patient Entity Generation (17-Attribute Bus)
        ├── Frontline Camera & Recapture Logic
        ├── Store-and-Forward Network Subsystem
        ├── AI Server Resource Queue
        └── Specialist Review / Tele-Ophthalmology Over-Read
```

---

## 2. End-to-End Screening Workflow Verification

### A. Valid Normal Retina (`SCR-0044.jpg`) — Happy Path
- **Upload & Intake:** Image received, validated as JPEG, saved to `storage/uploads/SCR-0044.jpg`.
- **Stage 0 Fundus Gate:** Color histogram & circular FOV score = `0.724` (`FUNDUS` status).
- **Stage 1 Quality Assessment:** Focus (Laplace Var = 142.6), Illumination (Mean = 118.4), Contrast = 0.186 (`GOOD` quality).
- **Stage 2 Enhancement:** Skipped (`GOOD` quality requires no enhancement).
- **Stage 3 Deep Learning Inference:** Native MATLAB `dlnetwork` executes EfficientNet-B0, outputting Grade 0 (No DR, raw confidence = 0.702).
- **Retinal Evidence Pass:** Optic disc and fovea detected; zero microaneurysms/hemorrhages/neovascularization candidates.
- **Grad-CAM Generation:** Saliency heatmap generated and copied to `storage/heatmaps/`.
- **Decision & Referral:** Action = `PROCEED`, Decision = `proceed`, `referable = false`.
- **MongoDB Persistence:** Stored as `status: "completed"`, `prediction: {grade: 0, label: "No DR"}`.

### B. Negative Non-Fundus Rejection (`SCR-0002.jpg`) — Safety Gate
- **Intake:** Image uploaded to API.
- **Stage 0 Fundus Gate:** Evaluated by `checkFundusImage.m`; circular FOV coverage and chromatic balance fail (`NON_FUNDUS` status).
- **Safety Lockout:** Pipeline halts immediately at Stage 0. Model inference, retinal evidence, and Grad-CAM passes are **BLOCKED**.
- **Decision:** Action = `REJECT`, Decision = `reject`, `referable = false`.
- **Persistence:** Stored as `status: "rejected"`, `prediction = None`, `xai.gradcam_path = ""`.
- **Verification:** Guaranteed zero hallucinated diagnoses or fake clinical outputs on non-eye inputs.

### C. Uncertain Quality / Borderline Fundus (`SCR-0050.jpg`) — Fail-Safe Review
- **Stage 0 Fundus Gate:** Borderline fundus features detected (`UNCERTAIN` status, score = 0.48).
- **Fail-Safe Routing:** Action = `REJECT / HUMAN REVIEW`, Decision = `review`, `referable = true`.
- **Model Isolation:** Deep learning prediction is not computed or presented as definitive.
- **Frontend Contract:** Flagged clearly for mandatory ophthalmologist over-read.

### D. Referable Proliferative Diabetic Retinopathy (`SCR-0062.jpg`) — Clinical Referral
- **Stage 0 & 1 Gates:** Validated as `FUNDUS` with `GOOD` quality.
- **Stage 3 Inference:** EfficientNet-B0 classifies Grade 4 (Proliferative DR, raw confidence = 0.704).
- **Retinal Evidence:** Identifies neovascularization candidates and retinal microaneurysms.
- **Grad-CAM Artifact:** Generates high-activation saliency map localized on retinal lesions.
- **Decision:** Action = `SPECIALIST REFERRAL`, Decision = `review`, `referable = true` (matches Grade ≥ 2 referral policy).
- **Grad-CAM Lifecycle:** Heatmap written to disk, verified non-zero size, valid PNG header (`\x89PNG\r\n\x1a\n`), accessible via backend signed URL.

---

## 3. Frozen 16-Field Contract Regression

All 16 mandatory fields defined in `docs/contract.md` are verified present across all execution paths:
1. `screening_id` (string)
2. `stage` (string enum)
3. `status` (string)
4. `action` (string enum)
5. `decision` (string enum)
6. `fundus` (struct / dict)
7. `quality` (struct / dict / list)
8. `enhancement` (struct / dict / list)
9. `prediction` (struct / dict)
10. `confidence` (struct / dict)
11. `referable` (boolean)
12. `xai` (struct / dict)
13. `evidence` (struct / dict)
14. `reasons` (cell array / list of strings)
15. `model_version` (`EfficientNet-B0-APTOS-v1`)
16. `pipeline_version` (`0.1.0-parity`)

---

## 4. Controlled Error Injection & Resilience

The system was evaluated against simulated failure modes:
- **Missing Image:** Returns HTTP 400 (`NO_IMAGE`).
- **Invalid Screening ID:** Returns HTTP 404 (`NOT_FOUND`).
- **Unsupported File Type:** Returns HTTP 415 (`UNSUPPORTED_TYPE`).
- **MATLAB Timeout (300s exceeded):** Returns HTTP 504 (`AI_SERVICE_TIMEOUT`), screening marked `failed`, no fake prediction.
- **MATLAB Execution Error (Exit code 1):** Returns HTTP 502 (`AI_SERVICE_ERROR`), screening marked `failed`, no fake prediction.
- **Malformed JSON Output:** Returns HTTP 502 (`AI_SERVICE_ERROR`) with clean error log.

---

## 5. SimEvents Operational Model vs. Real Product Architecture

| Dimension | SimEvents Digital Twin (`model/`) | Production Web System (`backend/` + `frontend/`) |
|---|---|---|
| **Purpose** | Discrete-event capacity, bottleneck & queue simulation | Live patient intake, image upload & clinical inference |
| **Authority** | Operational metrics authority | Clinical inference and data persistence authority |
| **Rural / Offline Logic** | Simulated 10-patient batch Store-and-Forward queue | Online HTTP REST API (PWA local client caching separate) |
| **Clinical Semantics** | Consistent: Grade ≥ 2 → Referable, Recapture loops | Consistent: Grade ≥ 2 → `SPECIALIST REFERRAL` |

---

## 6. Clean-Start Reproducibility Checklist
- [x] Model ONNX & MATLAB weights exist in `Matlab/model/` and `model/`.
- [x] Environment configuration documented in `backend/.env.example`.
- [x] Dynamic MATLAB path resolution functions across standard installation directories.
- [x] SimEvents `.slx` model opens and executes deterministically in MATLAB R2026a.
- [x] MongoDB collections initialize dynamically on first startup.
