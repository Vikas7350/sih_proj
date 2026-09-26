# NetraCare — AI Result Contract (FROZEN)
## SIH 2026 | PS 26038 | Version 1.0.0-frozen

**Freeze date:** 2026-09-23. **Freeze authority:** audit.md §24 step 2 decision.
**Producers:** `Matlab/runPipeline.m` (single MATLAB entry point).
**Consumers:** `backend/app/services/matlab_service.py` (parser/persister),
frontend (projection renderer), MongoDB (stored document).

**Decision (per contract-freeze step A of the implementation plan):**
the **NESTED shape** per `system.md` §11 is canonical. The flat top-level
fields returned by `_map_matlab_result_to_screening()` (status, prediction,
risk, image_quality, stage, decision, action, fundus, quality, enhancement)
are a **derived UI/database projection** of the nested object, NOT an
alternative contract. Any change to a nested field MUST be reflected by an
explicit projection update; the nested object remains the single source of
truth for what MATLAB computed.

Source of truth rule (§2): this file describes the shape emitted by
`runPipeline.m` as verified at runtime on 2026-09-23 (R2026a). In no case
does documentation override an executable observation.

---

## 1. Top-level shape

MATLAB emits one JSON object. Field presence is stage-dependent; the two
stable shapes are the **REJECT shape** (Stage 0/quality failure) and the
**COMPLETED shape** (inference + XAI). A third transitional shape exists as
implemented today (UNGRADABLE → RECAPTURE) and is structurally identical to
REJECT except for `quality` content.

| Field | Type | Present | Meaning |
|---|---|---|---|
| `screening_id` | string | always | Client-supplied screening identifier |
| `stage` | string enum | always | Pipeline stage that produced the terminal result |
| `status` | string | always | REJECT: `NON_FUNDUS`/`UNCERTAIN`/`UNREADABLE`; COMPLETED: quality status (`GOOD`/`BORDERLINE`/`UNGRADABLE`). `UNREADABLE` = input file could not be decoded as an image (STEP B fix, 2026-09-23); it is a valid reject, not a pipeline failure |
| `action` | string enum | always | `REJECT`, `REJECT / HUMAN REVIEW`, `RECAPTURE`, `SPECIALIST REFERRAL`, `PROCEED` |
| `decision` | string enum | always | `reject`, `review`, `recapture`, `proceed` |
| `fundus` | object | always | Stage 0 gate output (`checkFundusImage`) |
| `quality` | `[]` \| object | always | REJECT: `[]`; COMPLETED: `{status, scores, reasons}` |
| `enhancement` | `[]` \| object | always | REJECT: `[]`; COMPLETED: `{applied, improved, method}` |
| `prediction` | object | always | `{grade, label}`; `grade=[]` on reject path |
| `confidence` | object | always | `{raw, calibrated}`; `raw=0`, `calibrated=[]` on reject |
| `referable` | boolean | always | `true` only when decision=`review` |
| `xai` | object | always | `{gradcam_path}`; `""` when no Grad-CAM produced |
| `evidence` | object | always | Retinal-evidence payload; `{}` until STEP C wiring populated it |
| `reasons` | string[] | always | Human-readable gate/diagnostic reasons |
| `model_version` | string | always | `EfficientNet-B0-APTOS-v1` (from `model_config.m`) |
| `pipeline_version` | string | always | `0.1.0-parity` (from `model_config.m`) |

## 2. Stage vocabulary

| Stage constant | When it is the terminal `stage` |
|---|---|
| `STAGE_0_FUNDUS_VALIDATION` | Input rejected at the fundus gate (`REJECT` / `REJECT / HUMAN REVIEW`) |
| `STAGE_1_QUALITY_GATE` | Quality/recapture failure path (UNGRADABLE or unrecoverable BORDERLINE) |
| `STAGE_3_DR_INFERENCE` | Inference + Grad-CAM completed (COMPLETED shape) |

Planned (implemented in pipeline step C and documented here now):
`STAGE_RETINAL_EVIDENCE` is a mid-pipeline stage label for the retinal-evidence
pass; it never replaces the terminal `stage` value described above unless the
evidence gate stops the pipeline.

## 3. decision / action / status matrix

| decision | action | status interpretation (backend projection) |
|---|---|---|
| `reject` | `REJECT` | image rejected at Stage 0 — no inference |
| `review` | `REJECT / HUMAN REVIEW` | Stage 0 UNCERTAIN — specialist review |
| `recapture` | `RECAPTURE` | quality unrecoverable — recapture image |
| `proceed` | `PROCEED` | non-referable completed screening |
| `review` | `SPECIALIST REFERRAL` | referable grade (≥2) completed screening |

## 4. Error / uncertainty semantics

- MATLAB runtime failure (non-zero exit, thrown error): surface as a FastAPI
  error path (`AI_SERVICE_ERROR` / `AI_SERVICE_TIMEOUT` etc.), NEVER as a
  structured 200 with fabricated values.
- Reject path is a **valid, complete result**: 200 OK, structured JSON above.
- `confidence.raw` is raw softmax and is NEVER represented as calibrated
  probability; `confidence.calibrated=[]` means "calibration pending", i.e.
  `calibrated_confidence = unavailable` (system.md §9).
- Empty `evidence` (`{}`) is honest: it means the retinal-evidence module was
  not run/populated, not that no lesions exist.

## 5. Grad-CAM

`xai.gradcam_path` points to the heatmap artifact written by MATLAB. An empty
string is honest (no heatmap produced). Backend copies the file into its own
storage (`HEATMAP_DIR`) and serves it via signed URL; it never rewrites the
path into a claim that a heatmap proves a clinical lesion (system.md §8).

## 6. Retinal evidence payload (populated by pipeline step C)

When the retinal-evidence pass runs, `evidence` carries the
`runRetinalAnalysis.m` summary reduced to clinical metadata (large pixel masks
stripped per `_sanitize_for_storage`):

```text
evidence.retinal_analysis = {
  optic_disc, fovea, vessels, microaneurysm, exudates, hemorrhage,
  neovascularization
}                     # each: {found/estimated/count/score, ...} per detector
evidence.processing_time_seconds   # wall time of the evidence pass
evidence.quality                    # quality summary used by the evidence pass
evidence.enhancement               # enhanced-image metadata when produced
evidence.candidate_disclaimer      # fixed label: candidate evidence is not
                                   # clinically confirmed pathology
```

## 7. Model / pipeline versioning

- `model_version`: identifies the trained DR network snapshot (currently
  `EfficientNet-B0-APTOS-v1`).
- `pipeline_version`: identifies the MATLAB pipeline build (currently
  `0.1.0-parity`). Bump on any contract-relevant pipeline change; record in
  evidence per §27 of audit.md.

## 8. Change control

A contract change requires:
1. Update this file (new version string);
2. Update `runPipeline.m` producer;
3. Update `_map_matlab_result_to_screening()` projection + `schemas.py`;
4. Update frontend consumers;
5. Record in audit.md (§21) with dated note.

Until all five land, the contract version must not be claimed frozen.