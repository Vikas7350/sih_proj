# NetraCare — Security & Data Hygiene Audit Report
## SIH 2026 | Problem Statement: PS 26038 | Phase 6 Final Validation

This document presents the security, privacy, data hygiene, and credentials audit conducted for the NetraCare repository.

---

## 1. Audit Findings Summary

| Category | Checked Items | Result | Notes / Mitigations |
|---|---|---|---|
| **Hardcoded Secrets** | Passwords, API Keys, Private Tokens in codebase | **PASS** | No plaintext keys found in source. `AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`, and `GEMINI_API_KEY` are read exclusively from environment variables via `backend/app/core/config.py`. |
| **Environment Configuration** | `.env` vs `.env.example` | **PASS** | `.env.example` contains sanitized placeholders (`AUTH_SECRET=your_auth_secret_here`). `.env` files are included in `.gitignore`. |
| **Patient Identifiers & PHI** | Real patient names, MRNs, Aadhaar numbers, unanonymized metadata | **PASS** | All test suites and SimEvents entities use synthetic identifiers (`P-0001`, `SCR-TEST-0044`, `Patient_12345`). Zero Protected Health Information (PHI) is committed. |
| **Image & Heatmap Storage** | Upload and artifact directory permissions & isolation | **PASS** | Uploaded fundus images and Grad-CAM heatmaps are stored in separate directories (`backend/storage/uploads/`, `backend/storage/heatmaps/`). Grad-CAM heatmaps are accessed via HMAC-signed URLs with expiration timestamps. |
| **Path Hygiene** | Absolute machine paths in committed code | **PASS** | All MATLAB and Python scripts use dynamic root resolution (`fileparts(mfilename('fullpath'))` and `os.path.abspath(os.path.join(...))`). No hardcoded `C:\Users\...` paths in production source. |
| **Authentication & Session Security** | JWT tokens, Session Cookies, OAuth flow | **PASS** | Backend enforces HS256 JWT access tokens with expiration. Session cookies are configured with `httpOnly=True` and `SameSite=lax`. |
| **Database Payload Hygiene** | MongoDB document size limit (16MB BSON) | **PASS** | 2D pixel masks from retinal analysis are stripped during backend ingestion (`_sanitize_for_storage`), storing only numerical counts, bounding metrics, and scalar features. Screenings documents remain < 50 KB. |

---

## 2. Secrets & Credential Verification Command Audit
- Regex search for `AKIA[0-9A-Z]{16}`, `AIza[0-9A-Za-z-_]{35}`, `-----BEGIN PRIVATE KEY-----`, and unmasked passwords across `backend/`, `Matlab/`, and `frontend/` returned zero matching credentials.
- All simulation data and test logs use synthetic names (`Phase 6 Validator`, `Nurse Validation`, `PHC-P6`).

---

## 3. Storage & Artifact Isolation Architecture
```text
Client Request
      │
      ▼
FastAPI Server (Authentication: JWT / HMAC Signature)
      ├── Uploads:   backend/storage/uploads/   (Raw fundus image)
      ├── Heatmaps:  backend/storage/heatmaps/  (Grad-CAM artifact)
      └── Database:  MongoDB (Sanitized clinical metadata only)
```

- Raw pixel arrays are never serialized into MongoDB collections.
- Temporary MATLAB execution JSON files (`tempfile.gettempdir()/netracare_matlab_*.json`) are deleted upon pipeline completion.
