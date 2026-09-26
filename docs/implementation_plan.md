# NetraCare — Implementation Plan
## SIH 2026 | PS 26038 | Explainable AI for Diabetic Retinopathy Screening

**Working method:** OpenCode/Vibe Coding → local code generation → MATLAB/Simulink execution → debugging → verification → evidence capture.

**Important:** This document is a planning baseline, not a claim that every component already exists or works. The repository/runtime is the source of truth. Existing documentation and audits are treated as evidence to verify, not as assumptions.

**Update (2026-09-22):** `docs/MATLAB_CONSOLIDATION_REPORT.md` has completed a full static audit of `Matlab/` and `model/matlab/`. Section 3 below is updated with confirmed findings in place of "the forensic audit indicates." The MATLAB integration mechanism (Phase 4.1) is now settled by evidence, not a choice to be made. See the updated sections for specifics.

---

## 1. Objective

Build a demonstrable, integrated NetraCare prototype for PS 26038 that combines:

1. Existing PHC product shell:
   - Next.js frontend
   - FastAPI backend
   - MongoDB persistence
   - authentication and PHC isolation

2. MATLAB clinical-analysis pipeline:
   - fundus validation
   - image-quality assessment
   - adaptive enhancement
   - retinal structure/anatomical analysis
   - lesion-candidate evidence
   - DR grading 0–4
   - Grad-CAM
   - confidence/uncertainty
   - human-review decision gate
   - structured result contract

3. Simulink/SimEvents operational model:
   - patient arrivals
   - image acquisition
   - quality rejection/recapture
   - compression
   - network/bandwidth/latency/loss
   - AI service
   - referral/risk routing
   - specialist queue
   - specialist resources
   - throughput/latency/utilization/bottleneck metrics
   - district-scale workload, including 100,000+ annual screening scenarios

4. Integration:
   - one stable AI JSON contract
   - FastAPI remains the database authority
   - frontend displays clinically relevant evidence
   - MATLAB remains the clinical-analysis reference implementation
   - Simulink remains a separate operational/digital-twin model

---

## 2. What We Are NOT Doing

- We are not rewriting the existing product from scratch.
- We are not replacing the existing authentication/database architecture unnecessarily.
- We are not claiming clinical validation that has not been measured.
- We are not claiming >90% sensitivity or >85% specificity before measurement.
- We are not treating raw softmax confidence as calibrated probability.
- We are not executing the real CNN inside every SimEvents entity.
- We are not replacing a failed discrete-event simulation with analytical equations and calling it a simulation.
- We are not assuming filenames, paths, MATLAB releases, SimEvents library paths, block names, parameters, or model weights.
- We are not letting generated code overwrite existing work without first inspecting the target.
- We are not merging all three workstreams through ad-hoc interfaces; the shared boundary is the AI/result JSON contract.

---

## 3. Existing System — Verified Starting Point

The forensic material indicates three major workstreams already exist:

### Person 1 — MATLAB / Clinical AI

The primary MATLAB pipeline is centered around `Matlab/runPipeline.m` and has safety-gated stages for:

`INPUT → fundus validation → quality → optional enhancement → DR inference → Grad-CAM → JSON result`

**CONFIRMED (not just "indicated") by full call-graph trace:** `backend/app/services/matlab_service.py` is the sole caller into this pipeline, via a `matlab -batch` subprocess. Every function `runPipeline.m` reaches has been enumerated — see `docs/MATLAB_CONSOLIDATION_REPORT.md` §2.

**The second retinal-analysis implementation is confirmed, not just suspected, to be a fully disconnected island.** It lives at `model/matlab/` (13 functions: vessel segmentation, optic-disc/fovea localization, microaneurysm/exudate/hemorrhage candidates, neovascularization heuristic). A repository-wide grep found **zero call sites outside `model/matlab/` itself** for any of these 13 functions. This is not a duplication problem to "reconcile" — the two trees do not overlap in function. The only actual naming collision is `assessQuality.m`, which exists in both trees with different logic; `Matlab/quality/assessQuality.m` (354 lines) is confirmed as the one actually reachable from `runPipeline.m` and is now the canonical implementation. The `model/matlab/` version is superseded and has no external callers to break if removed.

**Model artifacts — partially resolved.** The Python-side trained weights are confirmed present in the repository tree: `model/checkpoints/best_model.pth` and `model/nvidia_efficientnet-b0_210412.pth`. The earlier "model artifacts missing" concern is cleared for Python. It is **not** cleared for MATLAB: `Matlab/model/loadModel.m` expects a converted `.onnx` or `.mat` file that is gitignored and was not visible to the repository-tree audit — whether this conversion has actually been run, and where its output lives locally, remains unverified and is a genuine P0 blocker for MATLAB-side inference specifically (not for the pipeline structure, which is fully traced and ready to execute once this one artifact is confirmed).

**Retinal-evidence integration is now a defined task, not an open investigation:** move `model/matlab/`'s 8 functionally useful files (`detectOpticDisc.m`, `locateFovea.m`, `segmentVessels.m`, `detectMicroaneurysms.m`, `detectExudates.m`, `detectHemorrhages.m`, `analyzeNeovascularization.m`, `runRetinalAnalysis.m`) into a new `matlab/segmentation/` folder and call `runRetinalAnalysis()` from `runPipeline.m` to populate the currently-empty `evidence` field. The one open design question — call it after Stage 1 (quality) or after Stage 3 (DR inference) — needs a human decision; it cannot be resolved by further code inspection. See `docs/MATLAB_CONSOLIDATION_REPORT.md` §7–8 for the full proposed folder layout and remaining risks before this move is executed.

### Person 2 — Simulink / SimEvents

The forensic audit reports:

- one Simulink model exists;
- the top-level workflow is largely a visual scaffold;
- named subsystems are pass-through shells;
- no verified SimEvents entity/queue/server infrastructure exists;
- existing scalability scripts calculate analytical estimates rather than producing genuine SimEvents simulation results.

**CONFIRMED, not just reported:** `model/simulink/buildTelemedicineModel.m` builds exactly 12 linear blocks, all empty subsystems. `model/simulink/runScalabilityScenario.m` contains no `sim()` call anywhere — it is a pure analytical bottleneck calculator, not a discrete-event simulation, verified by direct code reading. `model/simulink/defaultTelemedicineParameters.m` holds the arrival-rate/bandwidth/processing-time parameters as hardcoded values ready to be consumed by a real model once one exists.

Therefore the operational simulation is a major implementation workstream, not a cosmetic modification. This has not changed with the consolidation audit — it independently confirms the earlier finding rather than revising it.

### Person 3 — Product / Integration

The product shell already contains:

- Next.js frontend
- FastAPI backend
- MongoDB
- authentication
- PHC-scoped data handling
- patient/screening workflows
- model inference/Grad-CAM integration in the existing Python architecture
- MATLAB subprocess/integration code — **CONFIRMED as `backend/app/services/matlab_service.py` (357 lines), the sole caller into `Matlab/runPipeline.m`**

**RESOLVED:** the earlier "documentation/version discrepancies around the exact current MATLAB integration structure" is no longer open. The mechanism is `matlab -batch` subprocess, not MATLAB Engine API — there is no Engine API code anywhere in the repository. What remains genuinely unverified (see Phase 4.1 below) is `matlab_service.py`'s timeout behavior, error propagation, and — separately — which of the three coexisting inference pathways in `backend/` (`app/model/` direct PyTorch, `app/services/matlab_service.py`, standalone `model_service/`) is actually invoked by `features/screenings/routes.py` today. That last question is still open and matters: it determines whether MATLAB is live in the current request path or built but not yet switched on.

---

## 4. Implementation Strategy

### Phase 0 — Freeze and Audit

**Goal:** establish a known baseline before generated code touches anything.

Tasks:

- inspect repository tree;
- identify actual current branch/commit;
- identify actual frontend/backend/MATLAB/Simulink files;
- identify model weights and their actual locations;
- inspect MATLAB release and installed toolboxes;
- verify SimEvents availability/license;
- run existing tests where possible;
- run existing MATLAB pipeline on a known test image if available;
- load existing Simulink model;
- inspect actual block graph;
- run the current simulation only if it is safe and already executable;
- record all failures.

Outputs:

- `audit.md`
- baseline logs/results
- list of files that are safe to modify
- list of blockers

**No feature implementation begins until this phase is recorded.**

---

# Phase 1 — Freeze the Shared Contract

**FROZEN 2026-09-23 (STEP A of the implementation pass):** the shared AI
result contract is settled as the **NESTED shape** emitted by
`Matlab/runPipeline.m`, fixed at `docs/contract.md` v1.0.0-frozen and
mirrored in `system.md` §11. The field list below is satisfied by that
nested object; the flat top-level fields in
`_map_matlab_result_to_screening()` (status, prediction, risk, image_quality,
stage, decision, action, fundus, quality, enhancement) are a **derived
projection** for the UI/database, not a second contract.

Create and freeze (DONE for the canonical shape):

- `system.md` — updated §11 to reference the frozen contract
- `implementation_plan.md` — this section
- AI/result JSON schema — `docs/contract.md`
- stage/status vocabulary — `docs/contract.md` §2/§3
- error/uncertainty semantics — `docs/contract.md` §4
- model/pipeline version fields — `docs/contract.md` §7

Core result fields cover:

```text
screening_id
quality
enhancement
retinal_evidence
grade
raw_confidence
calibrated_confidence
referable
decision
gradcam
model_version
pipeline_version
processing_metadata
```

The exact schema must be reconciled with the existing backend/frontend contract before implementation.

---

# Phase 2 — Person 1: MATLAB Clinical Engine

## 2.1 Quality Gate

Implement/verify:

- focus/sharpness
- blur
- brightness/illumination
- contrast
- resolution
- field of view
- fundus validity

Decision states:

```text
GOOD / GRADABLE
BORDERLINE
UNGRADABLE
NON_FUNDUS / INVALID
```

The gate must prevent inference on rejected images.

## 2.2 Borderline Enhancement

For borderline images only:

- illumination normalization
- CLAHE
- denoising/edge-preserving filtering
- re-run quality assessment

Do not enhance already-good images unnecessarily.

## 2.3 Retinal Evidence

**UPDATE: this code already exists, fully written, in `model/matlab/`. This phase is now INTEGRATION, not implementation-from-scratch:**

- vessel segmentation — `segmentVessels.m` (38 lines, exists)
- optic disc localization — `detectOpticDisc.m` (53 lines, exists)
- fovea/anatomical localization — `locateFovea.m` (36 lines, exists)
- microaneurysm candidates — `detectMicroaneurysms.m` (32 lines, exists)
- exudate candidates — `detectExudates.m` (32 lines, exists)
- hemorrhage candidates — `detectHemorrhages.m` (28 lines, exists)
- neovascularization indicators — `analyzeNeovascularization.m` (14 lines, exists, self-labeled as a research heuristic in-code)

None of these has a prior Python/OpenCV equivalent — they are new capability written directly for MATLAB, so there is no parity check to run against them the way there is for the DR classifier (2.4).

Actual remaining tasks for this phase:

1. Move these 8 files (plus their orchestrator `runRetinalAnalysis.m`) from `model/matlab/` into `matlab/segmentation/` per the layout in `docs/MATLAB_CONSOLIDATION_REPORT.md` §7.
2. Decide and implement where in `runPipeline.m` to call `runRetinalAnalysis()` — after Stage 1 (quality) or after Stage 3 (DR inference). This is a human decision, not something further code-reading resolves.
3. Test each function standing alone against real fundus images (no MATLAB runtime was available to confirm these execute correctly — they are untested, only read).
4. Validate against ground truth where it exists: DRIVE for `segmentVessels.m`, IDRiD lesion annotations for the exudate/hemorrhage/microaneurysm detectors.
5. Merge `model/matlab/defaultRetinalConfig.m`'s parameters into the unified `matlab/config/` folder as a new `retinal_config.m` — this is a genuinely separate config concern from the pipeline-level configs already there, not a duplicate to eliminate.

Each evidence item must have a clear distinction between:

- detected candidate
- validated clinical finding
- heuristic/algorithmic evidence

Do not represent heuristic candidates as clinically confirmed lesions.

## 2.4 DR Classification

Verify exact Python model preprocessing:

- resize
- crop rules if any
- channel order
- normalization
- model architecture
- class mapping
- output interpretation

Then implement/import the MATLAB-compatible inference path.

Run parity testing on a fixed image set before changing application integration.

## 2.5 Grad-CAM

Generate:

- heatmap
- overlay
- metadata identifying target class/layer/model version

Perform visual sanity checks.

## 2.6 Calibration

If a held-out calibration set is available:

- calibrate raw probabilities;
- retain raw and calibrated values separately;
- report calibration method and validation split.

If calibration data is unavailable, explicitly report:

`calibrated_confidence = unavailable`

rather than inventing calibrated values.

## 2.7 Decision Gate

Produce a human-in-the-loop outcome such as:

```text
PROCEED
HUMAN_REVIEW
RECAPTURE
REFER
```

The decision must use documented quality/confidence/evidence rules.

---

# Phase 3 — Person 2: Simulink / SimEvents

## 3.1 Exploration First

Before generating the model:

- inspect actual SimEvents library;
- identify available Entity Generator/Queue/Server/etc.;
- inspect actual block parameters;
- identify existing model/scenario files;
- reuse existing parameters where appropriate.

OpenCode should generate scripts/model-building code based on those discoveries.

## 3.2 Genuine Discrete-Event Model

Represent entities as screening cases.

Target flow:

```text
Patient Arrival
  ↓
PHC Registration / Acquisition
  ↓
Image Quality Gate
  ├── Good ──────────────┐
  ├── Borderline → Enhance → Recheck
  └── Ungradable → Recapture
  ↓
Compression
  ↓
Network / Store-and-Forward
  ↓
AI Service
  ↓
Risk / Referral Routing
  ↓
Specialist Queue
  ↓
Specialist Resource
  ↓
Completion
```

The model must use actual discrete-event semantics, not merely signal pass-through.

## 3.3 Network Model

Parameterize, where supported:

- bandwidth
- latency
- packet-loss probability
- retransmission behavior
- compressed image size
- store-and-forward delay

## 3.4 Resources

Parameterize:

- acquisition capacity
- AI service capacity
- specialist count
- queue capacity
- PHC count
- district workload

## 3.5 Metrics

Capture actual simulation measurements:

- arrivals
- completed cases
- rejected/recaptured cases
- throughput
- end-to-end latency
- queue length
- maximum queue
- waiting time
- specialist utilization
- AI utilization
- network utilization
- retransmissions/failures
- referral volume

## 3.6 Scenarios

Implement only after baseline works.

Minimum scenarios:

1. Baseline/good connectivity
2. Low bandwidth
3. High patient load
4. Limited specialists
5. Edge-first/store-and-forward
6. Multi-PHC scaling
7. 100,000+ annual workload

---

# Phase 4 — Person 3: Product / Integration

## 4.1 Integration Boundary

FastAPI remains the application/database authority.

MATLAB should expose one stable clinical entry point: `Matlab/runPipeline.m`, confirmed as the sole entry point already in use.

**RESOLVED — no longer a selection to make.** `backend/app/services/matlab_service.py` (357 lines, confirmed present) already implements this as a `matlab -batch` subprocess call. There is no MATLAB Engine API code anywhere in the repository. The mechanism is subprocess. This phase's remaining work is verifying and hardening the existing implementation, not choosing between options:

- read `matlab_service.py` in full and document its actual current timeout value and behavior on timeout;
- confirm how MATLAB errors/crashes propagate back to FastAPI (structured error vs. raw stack trace vs. silent failure) — none of this has been verified yet;
- confirm exactly how `runPipeline.m`'s JSON output crosses back into Python (file write+read, or captured stdout — check the actual code, don't assume);
- confirm which of the three coexisting inference code paths in `backend/` (`app/model/` direct PyTorch, `app/services/matlab_service.py`, standalone `model_service/`) is the one `features/screenings/routes.py` currently calls — this is the one open question that actually changes what "integration" means here: is MATLAB already live, or built and waiting to be switched on?

Do not change mechanisms halfway through without documenting it — this guidance stands, but there is currently only one mechanism in the codebase to preserve.

## 4.2 API Contract

The backend should receive the MATLAB result without having to understand internal MATLAB algorithms.

The backend stores:

- screening metadata
- quality results
- enhancement status
- grade
- raw/calibrated confidence
- referable state
- decision
- Grad-CAM/evidence artifacts
- pipeline/model versions

## 4.3 UI

Display:

- original image
- quality breakdown
- enhancement result when used
- DR grade
- raw confidence
- calibrated confidence when available
- Grad-CAM
- retinal evidence
- referral/human-review decision
- limitations/disclaimer

---

# Phase 5 — Offline / Rural Workflow

Prototype:

```text
Capture
→ Local quality check
→ Local inference if deployment path is available
→ Local result storage
→ Store-and-forward synchronization
→ Central persistence
```

The project must distinguish:

- demonstrated local inference
- simulated edge behavior
- future deployment feasibility

---

# Phase 6 — Validation

## Clinical AI

Use task-specific datasets where available:

- APTOS
- IDRiD
- DRIVE
- Messidor-2

Map each dataset to a specific task.

Report:

- confusion matrix
- per-class precision/recall/F1
- macro F1
- referable-DR sensitivity
- referable-DR specificity
- calibration metrics where applicable
- quality-gate performance
- lesion/anatomy metrics where ground truth exists

The PS target of >90% sensitivity and >85% specificity is a target requirement, not a result to assume.

## System

Report:

- throughput
- latency
- queue behavior
- utilization
- bottlenecks
- capacity under scenarios
- annual workload interpretation

---

# Phase 7 — Integration Testing

Test end-to-end:

```text
Frontend
→ FastAPI
→ MATLAB
→ result JSON
→ MongoDB
→ frontend result view
```

Also test:

- invalid image
- borderline image
- ungradable image
- good image
- low confidence
- referable result
- Grad-CAM generation failure
- MATLAB failure
- timeout
- missing model
- network failure
- offline/store-and-forward behavior

---

# Phase 8 — Demo Lock

Prepare fixed demonstrable cases:

1. Good fundus
2. Borderline fundus
3. Ungradable image
4. No DR
5. Referable DR
6. Uncertain/human-review case

Then capture:

- application screenshots
- MATLAB outputs
- Grad-CAM/evidence
- SimEvents model
- scenario charts
- bottleneck analysis
- validation tables

---

## 5. OpenCode/Vibe Coding Rules

OpenCode is the code-generation layer, not the verification layer.

For every implementation task:

1. Inspect first.
2. Identify exact files.
3. Read relevant code.
4. Generate minimal changes.
5. Do not invent APIs or toolbox blocks.
6. Run static checks.
7. Hand off MATLAB/Simulink execution to MATLAB.
8. Capture the actual error if execution fails.
9. Debug from the actual error.
10. Re-run the smallest failing case.
11. Only then run larger scenarios.
12. Update documentation/evidence.

Generated code is not considered implemented until runtime verification passes.

---

## 6. Definition of Done

A component is DONE only when all applicable conditions hold:

- code exists;
- dependencies are known;
- it executes in the target environment;
- expected output is produced;
- failure behavior is tested;
- output is connected to the next stage;
- result is documented;
- evidence is captured.

For SimEvents specifically:

**A model diagram alone is NOT DONE.**

It must:

- execute;
- generate entities;
- route entities;
- queue entities;
- process entities;
- produce measurable statistics;
- respond to scenario parameters.

---

## 7. Execution Order

```text
AUDIT
  ↓
SYSTEM CONTRACT
  ↓
MATLAB CLINICAL BASELINE
  ↓
MATLAB IMPLEMENTATION
  ↓
SIMEVENTS BASELINE
  ↓
SIMEVENTS SCENARIOS
  ↓
INTEGRATION CONTRACT
  ↓
FASTAPI INTEGRATION
  ↓
UI/XAI/REPORT
  ↓
OFFLINE PROTOTYPE
  ↓
VALIDATION
  ↓
END-TO-END TEST
  ↓
DEMO LOCK
```

This sequence prevents us from debugging three moving systems simultaneously.

## 7a. Parallel Execution Clarification

Section 7's order is the dependency order, not a strict single-threaded
schedule. For a three-person team:

  - Phase 0 (Audit) and Phase 1 (Contract Freeze) are sequential and
    blocking for everyone — nothing else starts until both are done.
  - After Phase 1, Phase 2 (Person 1 — MATLAB clinical engine) and
    Phase 3 (Person 2 — Simulink/SimEvents) run IN PARALLEL. They do
    not depend on each other.
  - Phase 4 (Person 3 — integration) may begin non-blocking prep in
    parallel with Phases 2–3 (API scaffolding, DB schema, UI shells
    against mock data matching the frozen contract), but the actual
    MATLAB-orchestration wiring cannot be completed until Phase 2's
    MATLAB clinical engine produces real output matching the contract.
  - A single solo agent working without teammates should follow
    Section 7 literally, top to bottom.

## 7b. Blocker Escalation Protocol

When any phase task cannot be completed as specified:

  1. Stop that task. Do not substitute a fabricated, mocked, or
     simplified result and continue as if it were real (this includes
     analytical-equation results standing in for SimEvents output, or
     placeholder confidence values standing in for model output).
  2. Log the blocker in audit.md under the relevant section, with the
     exact error/reason.
  3. Continue with other non-dependent tasks if any exist; otherwise
     report BLOCKED and stop.
  4. A blocker is a valid, acceptable outcome. It must never be
     silently resolved by lowering the bar for what counts as DONE.

## 7c. Default Timeouts (tune and document actual values used)

    MATLAB single-image quality/enhancement call:  30s
    MATLAB full pipeline call (quality→grade→Grad-CAM): 60s
    FastAPI → MATLAB orchestration call (end-to-end):    90s
    SimEvents scenario run (per scenario):               configurable,
      default cap 120s wall-clock for hackathon iteration

These are starting defaults, not measured values. Once real runtimes
are observed (Phase 0 audit), replace these with actual measured
figures and note the source.

## 7d. Evidence Convention

All phases write evidence to docs/evidence/<phase-name>/ following the
same convention defined in audit.md Section 27. A phase is not DONE
(per Section 6, Definition of Done) unless its evidence folder exists
and contains the artifacts that support its claimed status.
