=== GRAD-CAM RUNTIME CHECK ===
Date: 2026-09-23
Status: BLOCKED — NOT EXECUTED

RUNNING REQUIREMENT:
  Grad-CAM is produced at pipeline Stage 4 (xAI) in
  Matlab/runPipeline.m (stage5_gradcam / xAI section) and surfaced in
  the result contract as xai.gradcam_path.

BLOCKERS AT AUDIT TIME:
  1. No valid fundus image available on this machine.
     - The referenced images at C:\Users\ysyas\RentoAI\... do not exist
       on this host (LAPTOP-OG6KQI25).
     - Available test images (phc_hero.jpg, synthetic_test.png) are
       correctly REJECTED at Stage 0_Stage 1 (fundus validation), so the
       pipeline never reaches Stage 4.
  2. No inference model artifact present (no .onnx/.mat anywhere in the
     repo; Matlab/model/ contains only source .m stubs), so the
     inference + Grad-CAM path cannot load weights.

EVIDENCE OF THE GATE : matlab_pipeline_invalid/stdout.txt +
  stderr.txt (reject at STAGE_0_FUNDUS_VALIDATION with action=REJECT).

VERDICT:
  Grad-CAM runtime behavior: NOT VERIFIED (blocked by the two blockers
  above). The Python-side heatmap fallback (backend heatmaps dir) was
  also not triggered because rejected images carry no expected pathology.

UNBLOCK WHEN:
  A real fundus JPEG is provided AND a fitted model artifact exists.