# Phase 4 — Pipeline Audit (MATLAB Clinical Engine)

Date: 2026-09-23
Basis: code inspection of actual current repository files + runtime execution on 2026-09-23 19:37 (standalone `matlab -batch`, no FastAPI) via `docs/evidence/phase4/phase4_verify.m`.

## Call / dependency map (actual)

```
runPipeline.m
  ├─ Stage 0: checkFundusImage(img, cfg)          -> NON_FUNDUS | UNCERTAIN | FUNDUS
  │     ├─ NON_FUNDUS   -> decision=reject, action=REJECT           (return, no inference)
  │     └─ UNCERTAIN    -> decision=review, action='REJECT / HUMAN REVIEW' (return, no inference)
  ├─ Stage 1: assessQuality(img, cfg)             -> GOOD | BORDERLINE | UNGRADABLE
  ├─ Stage 2: enhanceBorderline(img, cfg)         (only if BORDERLINE)
  │     └─ re-assessQuality(enhanced) -> acceptable ? infer : RECAPTURE
  │     UNGRADABLE -> RECAPTURE (bypasses enhancement by design)
  ├─ Stage 3: loadModel(cfg.model.mat_file) -> predictDR(net, img, cfg)
  │     -> predGrade, probs, confidence.raw (softmax), referable = (grade>=2)
  │     -> generateGradCAM(net, img, grade+1, cfg) -> gradcamPath
  │     -> runRetinalEvidence(...) -> evidencePayload (with candidate disclaimer)
  ├─ Decision: referable ? (review, SPECIALIST REFERRAL) : (proceed, PROCEED)
  └─ Contract: jsonencode(16-field struct)
```

Verified by reading `Matlab/runPipeline.m` (full, this session).

## Stage inventory

| Stage | Function | Actual caller | Runtime verified | Missing |
|-------|----------|---------------|------------------|---------|
| 0 fundus validation | `quality/checkFundusImage.m` | `runPipeline.m:123` | YES (9/9 in testFundusValidation; SCR-0062 FUNDUS, SCR-0002 NON_FUNDUS, SCR-0050 UNCERTAIN) | none |
| 1 quality | `quality/assessQuality.m` | `runPipeline.m:160` | YES (9 fixtures in `quality_results.json`, statuses recorded) | none |
| 2 enhancement | `enhancement/enhanceBorderline.m` | `runPipeline.m:178` (BORDERLINE branch) | PARTIAL (GOOD/UNGRADABLE bypasses verified live on all 9 fixtures; BORDERLINE branch code-verified only — no borderline fixture in repo) | borderline fixture |
| 3 DR model | `model/predictDR.m` + `loadModel.m` | `runPipeline.m:221-224` | YES (grade 4 conf 0.9338 / grade 0 conf 0.996; parity 1.249e-6; deterministic) | none |
| retinal evidence | `runRetinalEvidence` -> `model/matlab/runRetinalAnalysis` | `runPipeline.m:241` | YES — executed on both fundus fixtures; EMPTY body on 475x421 SCR-0062 (island INSUFFICIENT gate), POPULATED on 1920x1920 SCR-0044 (see root cause below) | forwarded island status (P1) |
| XAI Grad-CAM | `xai/generateGradCAM.m` | `runPipeline.m:233` | YES (133,699-byte PNG ×3 deterministic; 2.49 MB for 1920x1920; imfinfo valid) | none |
| decision referable/HITL | inline in `runPipeline.m:125-157, 244-251` | `runPipeline.m` | YES (non-fundus->reject/REJECT, uncertain->review/REJECT / HUMAN REVIEW, grade>=2->review/SPECIALIST REFERRAL, else proceed/PROCEED; all consistent per decision_unit_test.json) | none |
| report / contract | inline `runPipeline.m:253-311` | `runPipeline.m` | YES (16/16 fields present on all 6 fixture runs; contract_missing empty) | none (createRetinalReport not wired — see Part L) |

## Duplication note (Part C, model/matlab/assessQuality.m)

- Two `assessQuality` implementations exist: `Matlab/quality/` (canonical, added by `runPipeline.m:46` addpath) and `model/matlab/` (used by the retinal island via `addpath` in `runRetinalEvidence`).
- `runPipeline` explicitly adds `Matlab/quality` to path first; the island prepends its own `model/matlab` only during its own call (`onCleanup` removes it). No observed conflict in executed runs (island resoloved its own assessQuality with island config `defaultRetinalConfig()`, confirmed by island metrics fields `width/height/brightness/...` in `retinal_evidence_results.json`).
- NOT deleted — caller verification required before any cleanup (Part V).

## Retinal evidence — root cause of earlier empty `retinal_analysis` (CONFIRMED, P1)

Earlier captured runs showed `evidence.status='SUCCESS'` with `retinal_analysis={}`. This phase directly ran the island on both fixtures and isolated the cause:

- `model/matlab/defaultRetinalConfig.m` gates inputs to `minWidth=640, minHeight=480`.
- SCR-0062 is **475x421** (below gate) -> island `assessQuality` returns `INSUFFICIENT` -> `runRetinalAnalysis.m:28-34` early-returns with `retinal_analysis = struct()` (JSON `{}`). Detectors never run. (`retinal_evidence_results.json` island_direct SCR-0062: summary_status=INSUFFICIENT, early_return_triggered=true.)
- SCR-0044 is **1920x1920** (passes gate) -> island quality `ENHANCE` -> full detector run, `retinal_analysis` populated with all 7 keys. (`retinal_evidence_results.json` island_direct SCR-0044: keys optic_disc/fovea/vessels/microaneurysm/exudates/hemorrhage/neovascularization; vessel_density 0.953, microaneurysm candidates 2329, exudate candidates 30, hemorrhage candidates 4889, neovascularization indicator "research_prototype".)
- `runPipeline.m:354` hardcodes `payload.status='SUCCESS'` after a non-throwing island call and does NOT forward the island's own `summary.status` (nor `summary.quality`/`summary.enhancement`, despite `docs/contract.md` §6 documenting `evidence.quality`/`evidence.enhancement`). So a SUCCESS status can accompany an empty analysis body.

This is a reporting/forwarding defect in the evidence pass, not a detector failure. Documented as P1; NOT changed this phase (no island/contract rebuild; see P1 list).

## Known behavior observations (not modified this phase)

- `createRetinalReport.m` / `runRetinalBatch.m` (Part L) are standalone utilities; `runPipeline` does not call them (contract `reasons` + `evidence` fields already serve the report surface).
- No `confidence.calibrated` fitting anywhere in the repo (Part M) — calibration is PENDING, raw confidence is explicitly labelled uncalibrated.
- No natural BORDERLINE or fundus-valid UNGRADABLE fixture exists in the repo; those matrix rows are code-verified only (no fabricated clinical images).

## Retinal detectors (Part G/H/I, verified by direct read + live island run)

All detectors in `model/matlab/` are heuristic image-processing prototypes producing **algorithmic candidate evidence**, not clinically confirmed pathology. Detector keys actually read this session:

| Detector | Function outputs (keys) | Candidate wording |
|---|---|---|
| Vessels | `segmentVessels.m` -> mask, skeleton, density, area_percentage, skeleton_length_pixels, features.branching_proxy/tortuosity_proxy (NaN) | heuristic |
| Optic disc | `detectOpticDisc.m` -> found, center_xy, radius, bounding_box, confidence, mask | heuristic locator |
| Microaneurysms | `detectMicroaneurysms.m` -> candidate_count, area_pixels, locations, mask, method | candidates |
| Exudates | `detectExudates.m` -> candidate_count, area_pixels, locations, mask, method | candidates |
| Hemorrhage | `detectHemorrhages.m` -> candidate_count, area_pixels, locations, mask, method | candidates |
| Neovascularization | `analyzeNeovascularization.m` -> `indicator="research_prototype"` composite score | research prototype (NOT diagnostic) |

The pipeline evidence payload carries a `candidate_disclaimer` and these outputs are never presented as confirmed diagnosis. Live detector outputs captured in `retinal_evidence_results.json`.

## Runtime timings (Part R, measured this phase — warm in-session, excludes matlab -batch startup)

| Component | Value (s) |
|---|---|
| Stage 0 checkFundusImage (SCR-0062, 475x421) | 0.114 |
| Stage 1 assessQuality | 0.047 |
| Stage 2 enhanceBorderline (GOOD bypass) | 0.047 |
| Model load (.mat, warm) | 1.638 |
| Stage 3 predictDR | 0.249 |
| Grad-CAM generate | 1.497 |
| Full pipeline (SCR-0062, island INSUFFICIENT early-return) | 5.26 |
| Evidence island (SCR-0062 INSUFFICIENT early-return) | 0.099 |
| Evidence island (SCR-0044 1920x1920 full detector run) | 65.9 |
| Full pipeline (SCR-0044 1920x1920, incl. full island run) | 96.6 |

Dominant runtime component = retinal evidence island on high-resolution images (~66 s of ~97 s). Cold `matlab -batch` startup (~40-60 s) is the other significant cost (Phase 3 API wall ~46.5 s was single-call cold-start dominated).

## Determinism (Part S)

3 identical SCR-0062 full-pipeline runs: identical grade (4), confidence (0.9338), action, decision, quality status. Grad-CAM overlay statistically identical (133,699 bytes, dimensions 475x421, overlay_std 44.407) despite distinct generated filenames. `runtime_summary.json`:

## Contract (Part N)

All 16 fields present and correct-type on all 6 fixture runs (fundus, non-fundus, uncertain) — `contract_missing: []` every run (see `runtime_summary.json`). Reject/uncertain paths use documented `[]`/empty semantics per `docs/contract.md`. Note: `evidence` on reject/uncertain paths is intentionally `[]` (no evidence pass runs; empty struct on forward path is HONEST per runPipeline.m:293-296).

## Test suite (Part T)

All 8 MATLAB test functions executed and PASSED (8/8) on 2026-09-23 19:37 — see `test_suite_results.json`. Included the uncovered 475x421 fix: `uploads/SCR-0001.jpg` had been overwritten by a copy of SCR-0044 (same SHA256); restored from `Matlab/data/raw/SCR-0001.jpg` (verified NON_FUNDUS) so the non-fundus test fixture is correct again.

## Clinical validation boundary

No labelled APTOS dataset in workspace. All model-quality claims retained as previously reported metrics only; this phase did not and cannot revalidate them.
