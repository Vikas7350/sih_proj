# REST API Reference Manual

This document provides the complete API specification for the NetraCare backend, derived directly from the FastAPI routes in `backend/app/`.

- **Base URL (Direct Backend):** `http://127.0.0.1:8000`
- **Base URL (Proxied via Frontend):** `http://localhost:3000/api/backend`
- **OpenAPI Schema (Interactive Docs):** `http://127.0.0.1:8000/docs`

---

## 1. Authentication & Session Management (`/api/auth`)

### 1.1 Clinician Login
- **Method:** `POST`
- **Path:** `/api/auth/login`
- **Purpose:** Authenticate an existing healthcare worker and issue a JWT session cookie (`dr_token`).
- **Request Body (JSON):**
  ```json
  {
    "email": "clinician@phc.in",
    "password": "SecurePassword123!"
  }
  ```
- **Response Structure (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "bearer",
    "user": {
      "id": "USR-1029",
      "email": "clinician@phc.in",
      "name": "Dr. Sarah Rao",
      "phc_id": "PHC-BLR-01",
      "needs_profile": false
    }
  }
  ```
- **Status Codes:** `200 OK`, `400 Bad Request` (Invalid credentials), `422 Unprocessable Entity` (Schema validation failure).

---

### 1.2 Clinician Registration
- **Method:** `POST`
- **Path:** `/api/auth/register`
- **Purpose:** Register a new healthcare worker account.
- **Request Body (JSON):**
  ```json
  {
    "email": "clinician@phc.in",
    "password": "SecurePassword123!",
    "name": "Dr. Sarah Rao"
  }
  ```
- **Response Structure (201 Created):** Same user object and access token as login.
- **Status Codes:** `201 Created`, `400 Bad Request` (Email already registered).

---

### 1.3 Complete PHC Profile Onboarding
- **Method:** `POST`
- **Path:** `/api/auth/complete-profile`
- **Purpose:** Associate a Primary Health Centre facility profile with an account (typically after OAuth registration).
- **Request Body (JSON):**
  ```json
  {
    "name": "Dr. Sarah Rao",
    "phc_name": "Rural PHC Anekal",
    "phc_code": "KA-ANK-001",
    "state": "Karnataka",
    "district": "Bengaluru Rural",
    "address": "Main Hospital Road, Anekal 562106",
    "contact_number": "+919876543210"
  }
  ```
- **Response Structure (200 OK):** Refreshed user session with `needs_profile: false`.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

---

## 2. Patients (`/api/patients`)

### 2.1 Create Patient
- **Method:** `POST`
- **Path:** `/api/patients`
- **Purpose:** Enroll a new patient into the PHC screening registry.
- **Headers:** `Authorization: Bearer <token>` or session cookie
- **Request Body (JSON):**
  ```json
  {
    "name": "Ramesh Kumar",
    "age": 58,
    "gender": "Male",
    "diabetes_duration_years": 12,
    "contact_number": "+919876543210"
  }
  ```
- **Response Structure (201 Created):**
  ```json
  {
    "id": "60d5ecb8b5c0c82b8c8d1e2a",
    "patient_id": "PAT-0042",
    "name": "Ramesh Kumar",
    "age": 58,
    "gender": "Male",
    "diabetes_duration_years": 12,
    "contact_number": "+919876543210",
    "phc_id": "PHC-BLR-01",
    "created_at": "2026-09-19T10:30:00Z"
  }
  ```
- **Status Codes:** `201 Created`, `401 Unauthorized`, `422 Unprocessable Entity`.

---

### 2.2 List Patients
- **Method:** `GET`
- **Path:** `/api/patients`
- **Query Parameters:**
  - `search` (Optional, string): Filter by patient name or patient ID.
  - `page` (Optional, integer, default: 1): Page number.
  - `limit` (Optional, integer, default: 20, max: 100): Results per page.
- **Response Structure (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "60d5ecb8b5c0c82b8c8d1e2a",
        "patient_id": "PAT-0042",
        "name": "Ramesh Kumar",
        "age": 58,
        "gender": "Male",
        "diabetes_duration_years": 12,
        "created_at": "2026-09-19T10:30:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
  ```
- **Status Codes:** `200 OK`, `401 Unauthorized`.

---

### 2.3 Get Patient by ID
- **Method:** `GET`
- **Path:** `/api/patients/{patient_id}`
- **Parameters:** `patient_id` (string, path)
- **Status Codes:** `200 OK`, `404 Not Found` (`PATIENT_NOT_FOUND`).

---

### 2.4 Get Patient Screening History
- **Method:** `GET`
- **Path:** `/api/patients/{patient_id}/screenings`
- **Parameters:** `patient_id` (string, path)
- **Status Codes:** `200 OK`, `404 Not Found` (`PATIENT_NOT_FOUND`).

---

## 3. Screenings (`/api/screenings`)

### 3.1 Create Screening Record
- **Method:** `POST`
- **Path:** `/api/screenings`
- **Purpose:** Initialize an empty screening record associated with a patient and specific eye.
- **Request Body (JSON):**
  ```json
  {
    "patient_id": "PAT-0042",
    "eye": "right"
  }
  ```
- **Response Structure (201 Created):**
  ```json
  {
    "screening_id": "SCR-0048",
    "patient_id": "PAT-0042",
    "eye": "right",
    "status": "pending",
    "created_at": "2026-09-19T10:35:00Z"
  }
  ```
- **Status Codes:** `201 Created`, `404 Not Found` (Patient does not exist), `422 Unprocessable Entity` (Invalid eye, must be `'left'` or `'right'`).

---

### 3.2 Upload Screening Retinal Image
- **Method:** `POST`
- **Path:** `/api/screenings/{screening_id}/image`
- **Purpose:** Upload the retinal fundus image binary for processing.
- **Content-Type:** `multipart/form-data`
- **Form Fields:** `file` (File binary: JPEG, JPG, PNG; max 10MB)
- **Response Structure (200 OK):**
  ```json
  {
    "screening_id": "SCR-0048",
    "image_uploaded": true,
    "image_url": "/storage/uploads/SCR-0048_abc123.jpg?exp=1790000000&sig=..."
  }
  ```
- **Status Codes:**
  - `200 OK`: File uploaded and verified successfully.
  - `404 Not Found`: `SCREENING_NOT_FOUND`.
  - `413 Payload Too Large`: `FILE_TOO_LARGE` (Exceeds 10MB limit).
  - `415 Unsupported Media Type`: `UNSUPPORTED_TYPE` (Only JPG/PNG allowed).
  - `422 Unprocessable Entity`: `INVALID_IMAGE` (File header cannot be decoded).

---

### 3.3 Execute Screening Pipeline (MATLAB Integration)
- **Method:** `POST`
- **Path:** `/api/screenings/{screening_id}/analyze`
- **Purpose:** Run the complete MATLAB scientific analysis pipeline (Stage 0 validation, Stage 1 quality assessment, Stage 2 CLAHE enhancement, Stage 3 EfficientNet-B0 inference, and Grad-CAM explainability).
- **Execution Model:** Synchronous subprocess execution with 180s server timeout.
- **Response Structure (200 OK):**
  ```json
  {
    "screening_id": "SCR-0048",
    "patient_id": "PAT-0042",
    "eye": "right",
    "status": "completed",
    "stage": "STAGE_3_DR_INFERENCE",
    "decision": "proceed",
    "action": "PROCEED",
    "fundus": {
      "isFundus": true,
      "confidence": 0.9878,
      "score": 0.9878,
      "status": "FUNDUS",
      "method": "multivariate_heuristic",
      "reasons": []
    },
    "image_quality": {
      "status": "good",
      "score": 0.891,
      "checks": {
        "resolution": true,
        "blur": true,
        "brightness": true,
        "contrast": true,
        "fundus_structure": true,
        "fundus_visibility": true
      },
      "issues": [],
      "action": "PROCEED"
    },
    "prediction": {
      "grade": 0,
      "label": "No DR",
      "description": "No observable signs of diabetic retinopathy in this fundus image.",
      "confidence": 0.9634,
      "calibrated_confidence": null
    },
    "explanation": {
      "heatmap_url": "/storage/heatmaps/SCR-0048.png?exp=1790000000&sig=..."
    },
    "risk": {
      "level": "low",
      "label": "LOW RISK",
      "recommendation": "Annual diabetic eye exam recommended.",
      "action_required": "Routine follow-up in 12 months.",
      "follow_up_timeframe": "12 Months"
    },
    "matlab_result": { "...": "Complete raw pipeline telemetry" }
  }
  ```
- **Possible Status Codes:**
  - `200 OK`: Analysis successfully performed.
  - `400 Bad Request`: `NO_IMAGE` (Screening has no image uploaded yet).
  - `404 Not Found`: `SCREENING_NOT_FOUND`.
  - `422 Unprocessable Entity`: `IMAGE_MISSING` (Image file removed from disk).
  - `502 Bad Gateway`: `AI_SERVICE_ERROR` (MATLAB exited with non-zero code).
  - `503 Service Unavailable`: `AI_SERVICE_UNAVAILABLE` (MATLAB binary not found).
  - `504 Gateway Timeout`: `AI_SERVICE_TIMEOUT` (MATLAB exceeded 180s runtime).

---

### 3.4 Generate Patient AI Explanation (LLM)
- **Method:** `POST`
- **Path:** `/api/screenings/{screening_id}/ai-explanation`
- **Purpose:** Generate patient-friendly natural language explanations and lifestyle precautions using Gemini 2.5 Flash (with deterministic fallback).
- **Rate Limit:** Governed by sliding window rate limiter.
- **Response Structure (200 OK):**
  ```json
  {
    "screening_id": "SCR-0048",
    "explanation": "Your retina shows no signs of damage from diabetes...",
    "precautions": [
      "Maintain consistent blood sugar monitoring (target HbA1c < 7.0%).",
      "Schedule your next routine retinal screening in 12 months.",
      "Follow a balanced low-glycemic diabetic meal plan."
    ],
    "model": "gemini-2.5-flash",
    "source": "llm"
  }
  ```
- **Status Codes:** `200 OK`, `400 Bad Request` (`NOT_ANALYZED` — screening must be analyzed first), `404 Not Found`.

---

### 3.5 Retrieve Single Screening
- **Method:** `GET`
- **Path:** `/api/screenings/{screening_id}`
- **Parameters:** `screening_id` (string, path)
- **Response Structure (200 OK):** Complete screening payload including patient demographics, stage results, prediction, risk, and signed URLs.
- **Status Codes:** `200 OK`, `404 Not Found` (`SCREENING_NOT_FOUND`).

---

### 3.6 List Screenings
- **Method:** `GET`
- **Path:** `/api/screenings`
- **Query Parameters:**
  - `patient_id` (Optional, string)
  - `risk` (Optional, string: `low`, `monitor`, `high`, `urgent`, `recapture`, `reject`)
  - `grade` (Optional, integer: `0`, `1`, `2`, `3`, `4`)
  - `date_from` (Optional, ISO string)
  - `date_to` (Optional, ISO string)
  - `page` (Optional, integer, default: 1)
  - `limit` (Optional, integer, default: 20)
- **Status Codes:** `200 OK`, `401 Unauthorized`.

---

## 4. Reports & PHC Facilities (`/api/reports` & `/api/phc`)

### 4.1 PHC Operational Summary
- **Method:** `GET`
- **Path:** `/api/reports/summary`
- **Purpose:** Aggregate statistics for the authenticated clinician's Primary Health Centre.
- **Response Structure (200 OK):**
  ```json
  {
    "total_patients": 142,
    "total_screenings": 218,
    "completed_screenings": 195,
    "quality_failed_screenings": 15,
    "grade_distribution": {
      "0": 120,
      "1": 35,
      "2": 25,
      "3": 12,
      "4": 3
    },
    "risk_distribution": {
      "low": 120,
      "monitor": 35,
      "high": 25,
      "urgent": 15,
      "recapture": 15,
      "reject": 8
    }
  }
  ```
- **Status Codes:** `200 OK`, `401 Unauthorized`.

---

## 5. Storage & Health

### 5.1 Static Asset Streaming (Signed URL or Auth Token)
- **Methods & Paths:**
  - `GET /storage/uploads/{filename}`
  - `GET /storage/heatmaps/{filename}`
- **Query Parameters:** `exp` (UNIX expiry timestamp), `sig` (HMAC-SHA256 signature).
- **Headers:** Optional `Authorization: Bearer <token>` or session cookie.
- **Response:** Raw binary image (`image/jpeg` or `image/png`).
- **Status Codes:** `200 OK`, `401 Unauthorized` (Missing or invalid signature/token), `404 Not Found`.

### 5.2 System Health Check
- **Method:** `GET`
- **Path:** `/health`
- **Purpose:** Monitor process and database availability.
- **Response Structure (200 OK):**
  ```json
  {
    "status": "ok",
    "db": "connected"
  }
  ```
- **Degraded Response (200 OK with degraded status):**
  ```json
  {
    "status": "degraded",
    "db": "unavailable"
  }
  ```
