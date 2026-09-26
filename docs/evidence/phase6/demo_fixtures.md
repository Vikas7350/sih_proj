# NetraCare — Phase 6 Verified Demo Fixtures Dictionary
## SIH 2026 | PS 26038 | Validation date: 2026-09-24

This document catalogs the repository fixtures (`Matlab/data/raw/` and `backend/storage/uploads/`) with the **executed** Stage-0 / quality / model / decision results for each. Only rows with live evidence are marked VERIFIED. Fixtures with only standalone quality scores are marked accordingly and are NOT claimed to have E2E-tested Stage-0 behavior.

> **Naming hazard (documented):** `backend/storage/uploads/SCR-0003.jpg` and `.../SCR-0004.jpg` are *copies of the raw non-fundus / uncertain probes* uploaded during Phase 6 E2E (they byte-match `Matlab/data/raw/SCR-0002.jpg` [17,335 B] and `SCR-0050.jpg` [48,274 B] respectively). They are NOT the same images as `Matlab/data/raw/SCR-0003.jpg` (249,178 B) / `SCR-0004.jpg` (107,630 B). Always reference the `Matlab/data/raw/` path.

---

## 1. Core Demo Fixtures — LIVE E2E VERIFIED (Phase 6)

| Fixture (`Matlab/data/raw/`) | Purpose | Stage-0 result | Quality (pipeline) | Model behavior | Decision / Action | Referable | Evidence |
|---|---|---|---|---|---|---|---|
| `SCR-0044.jpg` | Valid normal fundus — happy path | `FUNDUS` | GOOD (0.8117) | Grade 0 "No DR", conf **0.996** | PROCEED / proceed | false | `phase6/end_to_end_results.json` SCR-0002 (193.16 s cold), `phase4/runtime_summary.json` P4-G0-0044 |
| `SCR-0062.jpg` | Referable Proliferative DR | `FUNDUS` | GOOD (0.7801) | Grade 4 "Proliferative DR", conf **0.9338** | SPECIALIST REFERRAL / review | true | `phase6/end_to_end_results.json` SCR-0005 (56.56 s warm), `phase4/runtime_summary.json` P4-DET-1..3 (deterministic) |
| `SCR-0002.jpg` | Non-fundus rejection probe | `NON_FUNDUS` | skipped (`[]`) — Stage-0 halt | **Blocked** (no inference, no Grad-CAM) | REJECT / reject | false | `phase6/end_to_end_results.json` SCR-0003 (19.62 s); `prediction_absent=true`, `gradcam_absent=true` |
| `SCR-0050.jpg` | Uncertain / human-review probe | `UNCERTAIN` | skipped (`[]`) — Stage-0 halt | **Blocked** (no definitive prediction) | REJECT / HUMAN REVIEW / review | true | `phase6/end_to_end_results.json` SCR-0004 (19.64 s); `prediction_absent=true` |

**Label basis:** SCR-0044 (grade 0) and SCR-0062 (grade 4) labels come from the verified EfficientNet-B0 QAT-parity runs (softmax argmax). **No external ophthalmologist label exists in this workspace.** These fixtures therefore have a *model-derived label*, not certified ground truth. The directive's rule is honored: we do not call them "APTOS-labelled ground truth".

---

## 2. Quality-Failure Fixtures — STANDALONE STAGE-1 ONLY (no E2E grade)

| Fixture (`Matlab/data/raw/`) | Purpose | Stage-0 result | Standalone Stage-1 quality | Model behavior | Expected decision | Ground-truth basis |
|---|---|---|---|---|---|---|
| `SCR-0001.jpg` | Severely blurred send — **not** a PDR case | *not E2E-tested* | **UNGRADABLE** (0.3708; severe blur, 45.3% FOV) | Inference blocked by quality gate → RECAPTURE | RECAPTURE | `phase4/quality_results.json` — no pipeline run recorded; prior Python-era record grade 1 is **stale and not relied upon** |
| `SCR-0066.jpg` | Overexposed send | *not E2E-tested* | **UNGRADABLE** (0.7847; 56.1% highlight clipping) | Quality gate → RECAPTURE | RECAPTURE | `phase4/quality_results.json` |
| black image (synthetic) | Degenerate-input code-path proof | — | UNGRADABLE, acceptable=false, enhancement bypassed | blocked | RECAPTURE | `phase4/quality_results.json` `synthetic_checks` |

## 3. Fixtures with NO worked evidence (available, UNVERIFIED)

These files exist and have standalone Stage-1 scores only. Their **Stage-0 status is unrecorded** — they must not be demoed as non-fundus probes:

| Fixture | Standalone Stage-1 score (evidence) | Status this phase |
|---|---|---|
| `SCR-0003.jpg` | GOOD 0.8683 | **UNVERIFIED** — no Stage-0 / pipeline record |
| `SCR-0004.jpg` | GOOD 0.8626 (24.4% saturation warning) | **UNVERIFIED** |
| `SCR-0055.jpg` | GOOD 0.8479 | **UNVERIFIED** |
| `SCR-0045.jpg` … `SCR-0065.jpg` (remaining raw fixtures) | not in `quality_results.json` | **UNVERIFIED** — no evidence any phase |

> **Correction notice:** the previous draft claimed SCR-0001 = "PDR grade 4 conf ~0.70", SCR-0003/SCR-0004/SCR-0055/SCR-0066 = "NON_FUNDUS reject", and SCR-0044/SCR-0062 confidences "~0.70", plus "APTOS 2019 unvalidated label" for several files. None of those statements is supported by evidence files; all have been replaced by the recorded values above.

## 4. Demo sequencing (matches Part S)

1. Normal happy path → `SCR-0044.jpg` (PROCEED, grade 0, Grad-CAM present)
2. Referable → `SCR-0062.jpg` (SPECIALIST REFERRAL, grade 4, Grad-CAM present)
3. Safety gate → `SCR-0002.jpg` (NON_FUNDUS → REJECT, no inference, no Grad-CAM)
4. Human review → `SCR-0050.jpg` (UNCERTAIN → REJECT / HUMAN REVIEW)
5. Quality → (optional) `SCR-0001.jpg` (UNGRADABLE → RECAPTURE)

## 5. Clinical boundary

> These fixtures are for **software runtime, contract, and demo verification only**. They do **NOT** constitute a clinical validation dataset. Sensitivity/specificity accuracy remains **NOT VALIDATED** pending labelled multi-centre evaluation (see master traceability row 30).