# PS 26038 — MATLAB Clinical Pipeline Traceability

Date: 2026-09-23
Scope: Software/integration traceability (NO clinical validation claim)
Basis: actual code inspection + actual MATLAB execution (2026-09-23 19:37 standalone `matlab -batch` via `phase4_verify.m`) + Phase 3 API evidence

Status legend: VERIFIED | PARTIALLY VERIFIED | IMPLEMENTED BUT NOT VALIDATED | NOT IMPLEMENTED | NOT APPLICABLE

## 1. Retinal image acquisition / input
- **Implementation:** `runPipeline(imageInput)` accepts file path or RGB matrix; imread with structured-REJECT on decode failure.
- **Files/Functions:** `Matlab/runPipeline.m` (69-108)
- **Runtime evidence:** 6 live fixture runs (fundus/non-fundus/uncertain) all produced complete contract output (`runtime_summary.json`); legacy Phase 3 `integration_summary.json` (SCR-0062 in, contract out)
- **Status:** VERIFIED
- **Remaining limitation:** Camera/POC acquisition hardware not in scope of this workspace.

## 2. Image-quality assessment
- **Implementation:** Stage 1 `assessQuality` — focus (modified Laplacian), illumination, contrast, FOV; GOOD / BORDERLINE / UNGRADABLE; reasons exposed in contract `quality.reasons`.
- **Files/Functions:** `Matlab/quality/assessQuality.m`, `Matlab/config/quality_config.m`
- **Runtime evidence:** `quality_results.json` — 9 fixtures: 6 GOOD, 3 UNGRADABLE (SCR-0001 0.3708, SCR-0002 0.3324, SCR-0066 0.7847); deterministic; black-image synthetic UNGRADABLE.
- **Status:** VERIFIED
- **Remaining limitation:** Thresholds are heuristic, not calibrated against clinician grading.

## 3. Preprocessing / enhancement
- **Implementation:** Stage 2 `enhanceBorderline` (CIE-L* luminance + illumination normalization + CLAHE via adapthisteq + bilateral denoising, then re-assessment); GOOD bypasses; UNGRADABLE bypasses -> RECAPTURE.
- **Files/Functions:** `Matlab/enhancement/enhanceBorderline.m`, `Matlab/config/enhancement_config.m`
- **Runtime evidence:** `enhancement_results.json` — GOOD bypasses live on 6 fixtures (applied=false, method 'None (Bypassed: Image is already GOOD)'), UNGRADABLE bypasses live on 3 fixtures; black-image synthetic also bypassed.
- **Status:** VERIFIED (GOOD/UNGRADABLE paths); PARTIALLY VERIFIED overall (BORDERLINE enhance path executed only via suite synthetic sample — no natural borderline fixture in repo; branch code-verified in runPipeline.m:176-191).
- **Remaining limitation:** BORDERLINE enhancement branch has no natural fixture; enhancement_config thresholds are engineering values, not clinically validated.

## 4. Diabetic-retinopathy grading
- **Implementation:** Stage 3 `predictDR` on real EfficientNet-B0 `dlnetwork` (Phase-2 ONNX import), 5 ICDR classes.
- **Files/Functions:** `Matlab/model/predictDR.m`, `Matlab/model/loadModel.m`, `Matlab/config/model_config.m`
- **Runtime evidence:** live grade 4 conf 0.9338 (SCR-0062), grade 0 conf 0.996 (SCR-0044); 5-class parity max diff 1.249e-6 (`test_suite_results.json`); deterministic across 3 runs.
- **Status:** IMPLEMENTED BUT NOT VALIDATED
- **Remaining limitation:** No labelled APTOS data in workspace; reported metrics not re-derived here.

## 5. Retinal lesion / evidence analysis
- **Implementation:** STEP C `runRetinalEvidence` -> `model/matlab/runRetinalAnalysis` island; returns summary + candidate disclaimer.
- **Files/Functions:** `Matlab/runPipeline.m` (314-359), `model/matlab/runRetinalAnalysis.m`, `model/matlab/defaultRetinalConfig.m`, `model/matlab/{segmentVessels,detectOpticDisc,locateFovea,detectMicroaneurysms,detectExudates,detectHemorrhages,analyzeNeovascularization}.m`
- **Runtime evidence:** `retinal_evidence_results.json` — island produced populated `retinal_analysis` (all 7 keys) on 1920x1920 SCR-0044 (vessel_density 0.953, microaneurysm 2329 candidates, exudate 30, hemorrhage 4889, neovascularization indicator "research_prototype"); empty body on 475x421 SCR-0062 because the island's own min-resolution gate (minWidth=640/minHeight=480) returns INSUFFICIENT at runRetinalAnalysis.m:28-34 before detectors run.
- **Status:** PARTIALLY VERIFIED
- **Remaining limitation:** Detectors are heuristic candidate prototypes, not diagnostic; `runPipeline.m:354` hardcodes evidence.status=SUCCESS and does not forward island `summary.status`/`quality`/`enhancement` — a SUCCESS can accompany empty analysis (P1, documented in pipeline_audit.md).

## 6. Explainability
- **Implementation:** Grad-CAM on verified layer `x_features_featu_469`, reduction `x_classifier_classif`, target class = predicted+1, overlay saved per config `cfg.paths.results`.
- **Files/Functions:** `Matlab/xai/generateGradCAM.m`, `Matlab/config/model_config.m`
- **Runtime evidence:** `gradcam_results.json` — 4 valid PNGs (imfinfo-verified): 133,699 B at 475x421 (SCR-0062 ×3 runs, overlay_std 44.407), 2.49 MB at 1920x1920 (SCR-0044, overlay_std 50.66); suite generateGradCAM PASS.
- **Status:** VERIFIED
- **Remaining limitation:** Visual/clinical meaningfulness of heatmap not expert-reviewed.

## 7. Referral support
- **Implementation:** `referable = (grade >= 2)` -> decision `review`, action `SPECIALIST REFERRAL`.
- **Files/Functions:** `Matlab/runPipeline.m` (244-250), `Matlab/model/predictDR.m`
- **Runtime evidence:** `decision_unit_test.json` all_consistent=true — grade 4 -> referable/review/SPECIALIST REFERRAL, grade 0 -> non-referable/proceed/PROCEED; formula check on all 3 parity images; threshold==2.
- **Status:** VERIFIED
- **Remaining limitation:** Rule is ICDR-conventional, not local-protocol configured.

## 8. Human-in-the-loop
- **Implementation:** Stage 0 UNCERTAIN -> decision `review` + `REJECT / HUMAN REVIEW`; referable -> review; NON_FUNDUS -> reject (no inference).
- **Files/Functions:** `Matlab/runPipeline.m` (125-157)
- **Runtime evidence:** `runtime_summary.json` P4-NONFUNDUS (reject/REJECT, prediction absent), P4-UNCERTAIN (review/REJECT / HUMAN REVIEW, prediction absent), P4-G0-0044/P4-DET-* (review/proceed paths).
- **Status:** VERIFIED
- **Remaining limitation:** HITL queue/workflow lives in later operational phase (SimEvents), not this engine.

## 9. Reporting
- **Implementation:** Frozen 16-field JSON contract per case; flat UI projection in FastAPI; `createRetinalReport.m`/`runRetinalBatch.m` are standalone utilities not wired into `runPipeline`.
- **Files/Functions:** `Matlab/runPipeline.m` (253-311), `docs/contract.md`, `model/matlab/createRetinalReport.m`
- **Runtime evidence:** `runtime_summary.json` — 16/16 required fields present on all 6 fixture runs (contract_missing empty on every record).
- **Status:** VERIFIED (contract); report-file task not wired (documented, acceptable — contract `reasons`+`evidence` serve the report surface).
- **Remaining limitation:** No standalone PDF/clinical text report generated by `runPipeline` (not a rule violation; flagged as P2).

## 10. MATLAB integration
- **Implementation:** FastAPI -> `matlab -batch` subprocess -> `runPipeline`; no Python model on route.
- **Files/Functions:** `backend/app/services/matlab_service.py`, `backend/app/features/screenings/routes.py`
- **Runtime evidence:** Phase 3 suite 65/0; timeout budget corrected to 300s. Phase 4 standalone: full pipeline 5.3 s (sub-640px fundus) / ~97 s (1920x1920 fundus incl. island) warm, plus ~40-60 s cold startup.
- **Status:** VERIFIED
- **Remaining limitation:** Per-call wall time dominated by cold MATLAB start + high-res island run (Part R measured).

## 11. Reliability / failure handling
- **Implementation:** imread decode -> structured REJECT; MATLAB errors -> HTTP 502/504 with `status=failed`, `prediction=None`; uniform placeholder removed on success path.
- **Files/Functions:** `Matlab/runPipeline.m` (73-101), `backend/app/services/matlab_service.py`, tests.
- **Runtime evidence:** Phase 3 error-path tests (504/502), Stage-0 rejection tests (P4-NONFUNDUS this run).
- **Status:** VERIFIED
- **Remaining limitation:** No retry/backoff on transient MATLAB spawn failure (not required by PS as read).

## 12. Rural / low-connectivity (local execution)
- **Implementation:** Entire clinical engine is local MATLAB; no cloud inference required for Stage 0-3 + XAI + evidence; deterministic local output artifacts.
- **Files/Functions:** `Matlab/**` (all stages), `model/checkpoints` local.
- **Runtime evidence:** `runtime_summary.json` (standalone local execution timings, no network dependency); `test_suite_results.json` (8/8 tests local).
- **Status:** PARTIALLY VERIFIED
- **Remaining limitation:** Store-and-forward / offline operational workflow belongs to SimEvents operational phase — NOT implemented here (out of scope).

## Calibration (cross-cutting)
- **Status:** IMPLEMENTED BUT NOT VALIDATED (raw softmax retained; uncalibrated label used)
- **Files/Functions:** `Matlab/model/predictDR.m` (`confidence.raw`, `confidence.calibrated=[]`)
- **Runtime evidence:** codebase search for calibration/temperature/isotonic/ECE/Brier -> none; confidence.calibrated empty on all live runs (`runtime_summary.json`).
- **Remaining limitation:** Fitted calibration requires labelled validation data (PENDING).

## Not applicable / not implemented (explicit)
- Clinical accuracy/sensitivity/specificity claims: NOT APPLICABLE (no labelled evaluation set in workspace; reported metrics retained as reported).
- SimEvents/offline operational workflow: NOT IMPLEMENTED (later phase, out of scope by rule).
