# NetraCare Backend (FastAPI)

FastAPI REST service providing authentication, patient management, screening lifecycle orchestration, secure image/heatmap storage, and asynchronous integration with the MATLAB R2026a deep learning inference pipeline.

---

## 1. System Architecture

The backend acts as the central coordinator between the Next.js web application, MongoDB database, and the MATLAB inference engine:

```
[ Next.js Frontend / Proxy ]
             │
             │ HTTP REST (JSON / Multipart)
             ▼
┌─────────────────────────────────────────────────────────────┐
│                 FastAPI Application (:8000)                 │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Middleware Layer                    │  │
│  │  - CORS (Credentials allowed for Frontend Origin)     │  │
│  │  - In-Memory Sliding Window Rate Limiting             │  │
│  │  - Global Exception Handler (Structured Error JSON)    │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   Feature Routers                     │  │
│  │  - /api/auth       (Google OAuth2 / Email & Password) │  │
│  │  - /api/patients   (Patient Demographics & Clinical)  │  │
│  │  - /api/screenings (Upload, Analyze, History, XAI)    │  │
│  │  - /api/reports    (PHC Aggregates & Clinical PDF)    │  │
│  │  - /api/phc        (PHC Profile & Staff Metadata)     │  │
│  │  - /storage/*      (HMAC-SHA256 Signed Static Files)  │  │
│  │  - /health         (MongoDB Connectivity Ping)        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                    Core Services                      │  │
│  │  - matlab_service.py (Subprocess Bridge to MATLAB)    │  │
│  │  - signed_url.py     (HMAC-SHA256 URL Token Signing)  │  │
│  │  - auth.py           (JWT / Session Cookie Validation)│  │
│  │  - llm.py            (Gemini 2.5 Flash / Deterministic)│  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬─────────────────┬────────────────┘
                           │                 │
              Subprocess   │                 │ PyMongo Driver
              Batch Mode   ▼                 ▼
                 ┌──────────────────┐  ┌──────────────────┐
                 │  MATLAB R2026a   │  │  MongoDB Server  │
                 │  (runPipeline.m) │  │  (dr_screening)  │
                 └──────────────────┘  └──────────────────┘
```

---

## 2. Directory Structure

```
backend/
├── app/
│   ├── api/                     # API router aggregation
│   ├── core/                    # Infrastructure and configuration
│   │   ├── auth.py              # JWT encoding/decoding and route dependencies
│   │   ├── config.py            # Environment variables and fail-fast validation
│   │   ├── database.py          # PyMongo MongoClient singleton and ping
│   │   ├── logging.py           # Standardized application logging
│   │   ├── rate_limiter.py      # IP-based sliding window rate limiter
│   │   └── signed_url.py        # HMAC-SHA256 URL signing and verification
│   ├── features/                # Domain-driven feature modules
│   │   ├── auth/                # OAuth2 Google callback & password auth
│   │   ├── patients/            # Patient CRUD & clinical records
│   │   ├── phc/                 # Primary Health Centre facility profile
│   │   ├── reports/             # Summary aggregates and reporting
│   │   └── screenings/          # Screening endpoints, image handling, LLM
│   ├── services/
│   │   └── matlab_service.py    # Subprocess bridge to MATLAB R2026a pipeline
│   ├── utils/                   # MongoDB BSON/ObjectId sanitization utilities
│   └── main.py                  # FastAPI instantiation, lifespan, & static routes
├── storage/                     # Filesystem asset storage (gitignored)
│   ├── uploads/                 # Uploaded patient retinal fundus images
│   └── heatmaps/                # Ingested Grad-CAM saliency overlays
├── tests/                       # Backend test suite (pytest)
├── .env.example                 # Environment template with safe placeholders
├── requirements.txt             # Locked Python dependencies
└── db_schema.json               # MongoDB document structure schema reference
```

---

## 3. MATLAB Subprocess Bridge

### How FastAPI Invokes MATLAB
When a client requests `POST /api/screenings/{screening_id}/analyze`, FastAPI invokes `app.services.matlab_service.run_matlab_pipeline(image_abs_path, screening_id)`.

Because MATLAB R2026a does not provide a native Python engine for Python 3.14+, the bridge operates via an isolated headless **subprocess batch invocation**:

```
[FastAPI: matlab_service.py]
          │
          │ 1. Allocates temp JSON: %TEMP%/netracare_matlab_<id>_<uuid>.json
          │ 2. Spawns: matlab.exe -batch "cd('...'); runPipeline('...', '...');"
          ▼
┌─────────────────────────────────────────────────────────────┐
│                       MATLAB R2026a                         │
│                                                             │
│  - Loads and executes runPipeline.m                         │
│  - Stage 0: Fundus Image Validation                         │
│  - Stage 1: Image Quality Assessment                        │
│  - Stage 2: CLAHE Enhancement (if BORDERLINE)               │
│  - Stage 3: EfficientNet-B0 Inference (if FUNDUS + GRADABLE) │
│  - XAI: Generates Grad-CAM overlay PNG                      │
│  - Serializes pipeline output to UTF-8 JSON                 │
│  - Writes directly to %TEMP%/netracare_matlab_*.json        │
│  - Exits with return code 0 (or 1 on unhandled exception)   │
└──────────────────────────┬──────────────────────────────────┘
                           │
          │ 3. Subprocess exits with code 0
          │ 4. Reads and unlinks temp JSON file
          │ 5. Copies Grad-CAM overlay to backend/storage/heatmaps/{id}.png
          │ 6. Generates HMAC-SHA256 signed URL for heatmap
          │ 7. Sanitizes masks (strips 2D matrices) & persists to MongoDB
          ▼
[MongoDB & HTTP 200 to Client]
```

### Temporary JSON Handoff Mechanics
1. **Isolated Output Path:** A unique temporary file path is generated using `tempfile.gettempdir()`: `netracare_matlab_{screening_id}_{uuid.uuid4().hex}.json`.
2. **Atomic Write & UTF-8 Encoding:** MATLAB opens the file with `fopen(..., 'w', 'n', 'UTF-8')`, writes the JSON string via `fwrite`, and closes the file handle.
3. **Automatic Cleanup:** In the Python service, a `try...finally` block ensures the temporary JSON file is deleted (`os.remove`) immediately after parsing, preventing disk leaks.
4. **Failure Resiliency:** If MATLAB terminates prematurely or times out, the cleanup routine removes any orphan temporary file.

### Ingestion of Grad-CAM Overlays
1. MATLAB writes the generated visual overlay to its configured path (`Matlab/deployment/output/gradcam_<id>.png`).
2. `matlab_service.py` detects this file via `matlab_result["xai"]["gradcam_path"]`.
3. The image is atomically copied into `backend/storage/heatmaps/{screening_id}.png`.
4. A time-limited HMAC-SHA256 signed URL (`/storage/heatmaps/{screening_id}.png?exp=...&sig=...`) is generated and stored in `screening["explanation"]["heatmap_url"]`.

---

## 4. Configuration & Environment Variables

All settings are read from `backend/.env` using standard `pydantic`/`python-dotenv`.

| Variable | Type | Default | Description |
|---|---|---|---|
| `MONGODB_URL` | String | `mongodb://localhost:27017` | MongoDB connection URI. |
| `DATABASE_NAME` | String | `dr_screening` | MongoDB database name. |
| `CORS_ORIGINS` | String | `http://localhost:3000` | Comma-separated allowed frontend origins. |
| `FRONTEND_ORIGIN` | String | `http://localhost:3000` | Canonical origin for OAuth callbacks and links. |
| `AUTH_SECRET` | String | *Required (No default)* | Secret key for JWT signing and HMAC storage signatures. |
| `SESSION_COOKIE_NAME` | String | `dr_token` | Name of the authentication cookie. |
| `COOKIE_SECURE` | Boolean | `false` | Enable `Secure` flag on cookies (`true` in production). |
| `COOKIE_SAMESITE` | String | `lax` | SameSite cookie policy (`lax`, `strict`, `none`). |
| `SESSION_COOKIE_MAX_AGE`| Integer | `86400` | Session lifetime in seconds (default: 24 hours). |
| `MAX_UPLOAD_SIZE_MB` | Integer | `10` | Maximum permissible fundus image upload size in MB. |
| `MATLAB_EXECUTABLE` | String | Auto-detected | Absolute path to `matlab.exe`. If empty, the service searches standard Windows install paths. |
| `MATLAB_ROOT` | String | `../Matlab` | Path to the directory containing `runPipeline.m`. |
| `MATLAB_TIMEOUT_SECONDS`| Integer | `180` | Subprocess timeout in seconds (must accommodate cold start). |
| `GEMINI_API_KEY` | String | `""` (Optional) | API key for Gemini 2.5 Flash patient explanations. |
| `LLM_MODEL` | String | `gemini-2.5-flash` | LLM model identifier for patient report summaries. |
| `GOOGLE_CLIENT_ID` | String | `""` (Optional) | Google OAuth 2.0 Client ID. |
| `GOOGLE_CLIENT_SECRET` | String | `""` (Optional) | Google OAuth 2.0 Client Secret. |
| `GOOGLE_REDIRECT_URI` | String | Derived | OAuth2 callback URI (routed via Next.js proxy). |

> [!IMPORTANT]
> `AUTH_SECRET` is mandatory. The backend enforces fail-fast startup: if `AUTH_SECRET` is missing, the application exits immediately with an error.

---

## 5. Signed Storage Delivery

Uploaded images and generated Grad-CAM heatmaps contain Protected Health Information (PHI) and must not be exposed via public static directories.

### Delivery Protocol
- File endpoints:
  - `GET /storage/uploads/{filename}`
  - `GET /storage/heatmaps/{filename}`
- Access Control:
  Access is permitted if **either** condition is satisfied:
  1. **HMAC-SHA256 Signature:** The query contains valid `exp` (UNIX expiration timestamp) and `sig` parameters signed with `AUTH_SECRET`:
     $$\text{sig} = \text{HMAC-SHA256}(\text{AUTH\_SECRET}, \text{kind} + "/" + \text{filename} + ":" + \text{exp})$$
  2. **Active User Session:** The caller presents an authorized `Authorization: Bearer <token>` or valid `dr_token` cookie.

---

## 6. Installation & Local Execution

### Prerequisites
- Windows 10/11 (64-bit)
- Python 3.10+ (Current verified runtime: Python 3.14.3)
- MongoDB Community Server (Running on `localhost:27017`)
- MATLAB R2026a (with Deep Learning Toolbox and Image Processing Toolbox)

### Setup Steps
```powershell
# 1. Navigate to backend directory
cd C:\Users\ysyas\RentoAI\backend

# 2. Create and activate a Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 3. Upgrade pip and install dependencies
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# 4. Create environment configuration from example template
copy .env.example .env
# Edit .env and supply a strong random AUTH_SECRET and set MATLAB_EXECUTABLE if not in default path
```

### Running the Server
```powershell
python -m uvicorn app.main:app --reload --port 8000
```
- Server URL: `http://127.0.0.1:8000`
- Swagger Interactive Docs: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/health`

---

## 7. Troubleshooting & Common Operational Issues

### 1. Port 8000 Already in Use
If another process holds port 8000:
```powershell
# Identify the process holding the port
netstat -ano | findstr :8000

# Terminate the process by PID (replace <PID> with the actual number in the rightmost column)
taskkill /PID <PID> /F
```

### 2. MATLAB Executable Not Found (`503 AI_SERVICE_UNAVAILABLE`)
- Symptom: `MatlabExecutableNotFoundError: MATLAB executable not found`.
- Cause: MATLAB is installed in a non-standard location or not in the system `PATH`.
- Resolution: Explicitly define `MATLAB_EXECUTABLE` in `backend/.env`:
  ```ini
  MATLAB_EXECUTABLE=C:\Program Files\MATLAB\R2026a\bin\matlab.exe
  ```

### 3. MATLAB Subprocess Timeout (`504 AI_SERVICE_TIMEOUT`)
- Symptom: Analysis aborts after exactly 180 seconds.
- Cause: On cold starts or under heavy resource contention, MATLAB startup and neural network compilation can exceed the default threshold.
- Resolution: Increase `MATLAB_TIMEOUT_SECONDS` in `backend/.env` (e.g., `240` or `300`). Ensure the frontend proxy timeout in `frontend/next.config.ts` (`experimental.proxyTimeout`) is set to accommodate this duration.

### 4. MongoDB Connection Failed (`{"status": "degraded", "db": "unavailable"}`)
- Symptom: `/health` returns `status: degraded`.
- Resolution: Verify the MongoDB Windows service is active:
  ```powershell
  Get-Service MongoDB
  Start-Service MongoDB
  ```
