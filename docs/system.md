# NetraCare — System Architecture & Pipeline
## SIH 2026 | PS 26038

**Update (2026-09-22):** `docs/MATLAB_CONSOLIDATION_REPORT.md` has confirmed the actual repository structure this architecture maps onto. Section 6 (Retinal Structure/Evidence Layer) and Section 18 (System Boundaries) are updated with confirmed file paths and the resolved MATLAB integration mechanism. This document remains the canonical target architecture; the update notes below distinguish "target as designed" from "confirmed as currently wired."

## 1. System Goal

NetraCare is an assistive diabetic-retinopathy screening and referral-support system for Primary Health Centres.

The target system combines:

- fundus image acquisition/upload;
- safety-gated MATLAB retinal analysis;
- DR grading;
- explainability/evidence;
- human-in-the-loop decision support;
- FastAPI orchestration and persistence;
- PHC-scoped product workflow;
- Simulink/SimEvents operational simulation for district-scale capacity and rural connectivity.

The system is **not** to be represented as an autonomous diagnostic device or as clinically validated unless the required validation has actually been performed.

---

# 2. Target Architecture

```text
                         PHC / Healthcare Worker
                                  │
                                  ▼
                    ┌─────────────────────────┐
                    │ Next.js Frontend        │
                    │                         │
                    │ Patient workflow        │
                    │ Fundus upload/capture   │
                    │ Results + XAI            │
                    │ Reports                  │
                    └───────────┬─────────────┘
                                │ HTTP
                                ▼
                    ┌─────────────────────────┐
                    │ FastAPI Backend         │
                    │                         │
                    │ Auth / PHC isolation    │
                    │ Patient records         │
                    │ Screening records       │
                    │ MATLAB orchestration    │
                    │ Artifact delivery       │
                    └──────┬───────────┬──────┘
                           │           │
                           │           ▼
                           │    ┌───────────────┐
                           │    │ MongoDB       │
                           │    │ clinical data │
                           │    └───────────────┘
                           │
                           ▼
                ┌──────────────────────────┐
                │ MATLAB Clinical Engine   │
                │                          │
                │ 0. Fundus validation     │
                │ 1. Quality assessment    │
                │ 2. Enhancement            │
                │ 3. Retinal evidence       │
                │ 4. DR grading             │
                │ 5. Grad-CAM               │
                │ 6. Confidence             │
                │ 7. Decision gate          │
                └────────────┬─────────────┘
                             │
                             ▼
                    Stable AI JSON Contract


        Separate Operational / Digital-Twin System
        ───────────────────────────────────────────

Patient arrivals
      ↓
Acquisition
      ↓
Quality / Recapture
      ↓
Compression
      ↓
Network / Store-and-forward
      ↓
AI service
      ↓
Risk / Referral
      ↓
Specialist queue
      ↓
Specialist resource
      ↓
Completion / Metrics
```

---

# 3. Clinical Pipeline

## Step 0 — Input

Input:

- fundus photograph
- screening identifier
- optional patient/screening metadata

Output:

- validated image or rejection state

---

## Step 1 — Fundus Validation

Purpose:

Prevent obviously invalid/non-fundus images from reaching clinical inference.

Potential evidence:

- color/chromaticity
- border geometry
- retinal texture
- vascular structure

Decision:

```text
FUNDUS
NON_FUNDUS
UNCERTAIN
```

If invalid/uncertain according to the implemented gate:

```text
STOP → REJECT / HUMAN REVIEW / RECAPTURE
```

---

# 4. Image Quality Assessment

Measure:

- focus/sharpness
- blur
- brightness
- illumination uniformity
- contrast
- field of view
- resolution

Classify:

```text
GOOD
BORDERLINE
UNGRADABLE
```

---

# 5. Adaptive Enhancement

Only `BORDERLINE` images enter enhancement.

Potential processing:

```text
illumination normalization
        ↓
CLAHE
        ↓
denoising / edge-preserving filtering
        ↓
quality reassessment
```

Possible outcomes:

```text
acceptable → continue
still unacceptable → RECAPTURE
```

`GOOD` images should bypass unnecessary enhancement.

`UNGRADABLE` images should not be forced through enhancement if the quality policy says they must be recaptured.

---

# 6. Retinal Structure / Evidence Layer

**Implementation status (confirmed 2026-09-22):** every item below already exists as working MATLAB code at `model/matlab/`, pending a folder move to `matlab/segmentation/` and being wired into `runPipeline.m`. This section previously described target/aspirational evidence; it now describes evidence that is code-complete but not yet connected to the pipeline output in Section 11's contract. None of these functions has a prior Python/OpenCV equivalent — they were written new, directly in MATLAB, specifically to satisfy this section.

Target evidence:

### Anatomical

- vessel segmentation — `segmentVessels.m`
- optic disc localization — `detectOpticDisc.m`
- fovea localization — `locateFovea.m`

### Lesion candidates

- microaneurysm candidates — `detectMicroaneurysms.m`
- exudate candidates — `detectExudates.m`
- hemorrhage candidates — `detectHemorrhages.m`
- neovascularization indicators — `analyzeNeovascularization.m` (self-documented in-code as a linear heuristic/research prototype — treat its output as the weakest-confidence evidence item until independently validated)

Orchestration: `runRetinalAnalysis.m` (single image) and `runRetinalBatch.m` (batch) already assemble these into one result struct; `runRetinalBatch.m` and the report-generation helper `createRetinalReport.m` currently have zero callers anywhere and may be unnecessary for the pipeline integration (they were likely a standalone testing/demo harness, not part of the intended runtime path) — confirm before deleting.

Outputs should include:

- masks
- coordinates/regions where applicable
- confidence/score where meaningful
- overlay images
- evidence metadata

Important distinction:

**Algorithmic candidate evidence is not equivalent to clinically confirmed pathology.**

---

# 7. DR Severity Grading

Five-class grading:

```text
0 → No DR
1 → Mild DR
2 → Moderate DR
3 → Severe DR
4 → Proliferative DR
```

Referable grouping required by the PS:

```text
0–1 → non-referable group
2–4 → referable group
```

The actual sensitivity/specificity must be measured on appropriate held-out data.

---

# 8. Explainability

The system should produce:

1. original fundus image;
2. Grad-CAM heatmap;
3. overlay;
4. retinal evidence overlays;
5. model/version metadata;
6. confidence information.

Grad-CAM should explain the model prediction; lesion/evidence modules provide separate algorithmic evidence.

Do not imply that a heatmap proves a clinical lesion.

---

# 9. Confidence and Uncertainty

Maintain separate fields:

```text
raw_confidence
calibrated_confidence
uncertainty_status
```

Raw softmax confidence is not automatically calibrated probability.

If no calibration dataset/method has been validated:

```text
calibrated_confidence = unavailable
```

Uncertain cases should be eligible for:

```text
HUMAN_REVIEW
```

---

# 10. Human-in-the-Loop Decision Gate

Target decision vocabulary:

```text
PROCEED
RECAPTURE
HUMAN_REVIEW
REFER
```

Example conceptual logic:

```text
invalid image
    → RECAPTURE

quality failure
    → RECAPTURE

uncertain model/evidence
    → HUMAN_REVIEW

referable grade/evidence
    → REFER

acceptable non-referable case
    → PROCEED / ROUTINE FOLLOW-UP
```

Exact thresholds must be documented and validated; they must not be invented to create desired demo outcomes.

---

# 11. AI Result Contract

The three workstreams communicate through one result contract.

**FROZEN 2026-09-23:** the canonical contract is the **NESTED shape** emitted
by `Matlab/runPipeline.m`, fixed at `docs/contract.md` (v1.0.0-frozen). The
flat top-level projection produced by
`_map_matlab_result_to_screening()` is a derived UI/database view, not an
alternative contract. See `docs/contract.md` for field presence per stage,
the decision/action/status matrix, and change-control rules.

The canonical shape (producer: `runPipeline.m`, verified at runtime):

```json
{
  "screening_id": "...",
  "pipeline_version": "...",
  "model_version": "...",
  "quality": {
    "status": "...",
    "focus": null,
    "blur": null,
    "brightness": null,
    "illumination": null,
    "contrast": null,
    "field_of_view": null,
    "resolution": null
  },
  "enhancement": {
    "applied": false,
    "status": "...",
    "output_path": null
  },
  "retinal_evidence": {
    "vessels": null,
    "optic_disc": null,
    "fovea": null,
    "microaneurysms": null,
    "exudates": null,
    "hemorrhages": null,
    "neovascularization": null
  },
  "grading": {
    "grade": null,
    "raw_confidence": null,
    "calibrated_confidence": null,
    "referable": null
  },
  "xai": {
    "gradcam_path": null,
    "overlay_path": null
  },
  "decision": {
    "status": null,
    "reason": null
  }
}
```

This is a conceptual contract. The existing backend schema must be inspected before finalizing field names.

---

# 12. Product Architecture

## Frontend

Responsibilities:

- authentication UI
- patient registration
- screening creation
- fundus upload
- quality result display
- image/result visualization
- Grad-CAM/evidence display
- referral/human-review status
- reports

## FastAPI

Responsibilities:

- authentication
- PHC isolation
- patient/screening CRUD
- MATLAB orchestration
- result validation
- persistence
- artifact delivery

## MongoDB

System-of-record for:

- patients
- screenings
- quality results
- grading metadata
- decisions
- pipeline/model versions
- relevant artifact metadata

FastAPI remains the authoritative writer.

---

# 13. Rural / Offline Architecture

Target prototype:

```text
Fundus Camera
     ↓
Local PHC device
     ↓
Local quality check
     ↓
Local inference (if deployment path is demonstrated)
     ↓
Local result storage
     ↓
Connectivity available
     ↓
Store-and-forward synchronization
     ↓
District / central system
```

The system must explicitly label what is:

- demonstrated;
- simulated;
- planned.

---

# 14. Simulink / SimEvents Digital-Twin Pipeline

SimEvents represents operational entities, not neural-network internals.

```text
ENTITY: SCREENING CASE
        │
        ▼
Patient Arrival
        │
        ▼
Image Acquisition
        │
        ▼
Quality Gate
   ┌────┼───────────┐
   │    │           │
 Good Borderline  Ungradable
   │    │           │
   │ Enhancement   Recapture
   │    │
   │ Recheck
   │    │
   └────┴───────────→
        │
        ▼
Compression
        │
        ▼
Network / Bandwidth
        │
        ▼
AI Service
        │
        ▼
Risk / Referral
        │
        ▼
Specialist Queue
        │
        ▼
Specialist Resource
        │
        ▼
Completion
```

---

# 15. SimEvents Parameters

The model should be parameterized, not hard-coded.

Potential parameters:

```text
patient arrival rate
number of PHCs
acquisition capacity
image size
compression ratio
network bandwidth
network latency
packet loss
retry behavior
AI service time/capacity
specialist count
specialist service time
queue capacity
recapture probability
simulation duration
random seed
```

Actual names/defaults must come from the inspected implementation.

---

# 16. Simulation Metrics

Collect actual event-simulation metrics:

```text
arrivals
completed
rejected
recaptured
throughput
end-to-end latency
queue length
maximum queue
specialist waiting time
specialist utilization
AI utilization
network utilization
retransmissions
failed transmissions
referral volume
```

A metric should be called a simulation result only when it comes from an executed model or clearly documented post-processing of actual simulation output.

---

# 17. PS 26038 Coverage

| PS requirement | System component | Evidence |
|---|---|---|
| Quality assessment | MATLAB | quality scores + gate |
| Enhancement | MATLAB | before/after + recheck |
| Retinal structures | MATLAB | masks/overlays + metrics |
| DR grading 0–4 | MATLAB model | confusion matrix + per-class metrics |
| Referable DR | grading/evaluation | sensitivity + specificity |
| Grad-CAM | MATLAB XAI | heatmap + overlay |
| Lesion/evidence | retinal evidence | evidence overlays |
| Confidence | calibration | raw + calibrated if available |
| Human-in-loop | decision gate | review/recapture route |
| Annotated report | FastAPI/UI | report artifact |
| Simulink workflow | SimEvents | executable model + outputs |
| 100k+ scale | scenarios | capacity/scenario evidence |
| Rural connectivity | simulation + offline prototype | scenario + local workflow |
| Benchmark validation | evaluation | protocol + measured results |

---

# 18. System Boundaries

### MATLAB owns

Clinical image-processing and analysis logic.

**Confirmed canonical location: a single unified `matlab/` tree** (consolidation of today's `Matlab/` root pipeline and `model/matlab/` retinal-evidence branch — see `docs/MATLAB_CONSOLIDATION_REPORT.md` §7 for the exact proposed layout). Until that consolidation is executed, the entry point remains `Matlab/runPipeline.m` and the retinal-evidence branch remains at `model/matlab/`, disconnected (Section 6, above).

### SimEvents owns

Operational flow/resource simulation.

**Confirmed status:** no working SimEvents model exists yet. `model/simulink/` contains a Simulink model builder (`buildTelemedicineModel.m`, 12 empty linear-block subsystems) and analytical bottleneck calculators (`runScalabilityScenario.m`, `runScalabilityExperiments.m`) that compute equations, not discrete-event simulation output — confirmed by the absence of any `sim()` call in that code. This section's ownership statement is the target; it is not yet met.

### FastAPI owns

Application orchestration and database authority.

**Confirmed integration mechanism: `backend/app/services/matlab_service.py` invokes `Matlab/runPipeline.m` via a `matlab -batch` subprocess call.** This is settled — not a design choice still to be made, superseding any earlier language elsewhere suggesting MATLAB Engine API as an alternative. Open verification items (timeout value, error propagation, which of the three coexisting inference pathways in `backend/` is actually live in `features/screenings/routes.py` today) remain — see `implementation_plan.md` §4.1.

### Frontend owns

User interaction and result visualization.

### MongoDB owns

Persisted application records.

### OpenCode owns

Code generation assistance.

### MATLAB/Simulink execution owns

Runtime truth for MATLAB/Simulink behavior.

---

# 19. Non-Negotiable Engineering Principle

```text
DOCUMENTATION ≠ IMPLEMENTATION
CODE ≠ VERIFIED IMPLEMENTATION
DIAGRAM ≠ SIMULATION
MODEL FILE ≠ VALIDATED MODEL
SOFTMAX ≠ CALIBRATED PROBABILITY
DEMO OUTPUT ≠ CLINICAL VALIDATION
```

Every final claim must be traceable to an executed artifact, test, metric, or clearly documented assumption.