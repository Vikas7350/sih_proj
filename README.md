# RentoAI / NetraCare

> **Explainable AI for Diabetic Retinopathy Screening**  
> *Smart India Hackathon (SIH 2026) | Problem Statement: SIH26038*

RentoAI (NetraCare) is an end-to-end clinical decision-support and assistive screening system designed to detect Diabetic Retinopathy (DR) from digital retinal fundus photographs at Primary Health Centres (PHCs). The platform integrates a modern Next.js user interface, a FastAPI Python service, a MongoDB clinical data store, and a safety-gated MATLAB computational core running a verified EfficientNet-B0 deep convolutional neural network with Explainable AI (Grad-CAM) saliency mapping.

---

## Project Purpose & Regulatory Boundary

> [!IMPORTANT]
> **Assistive Screening Tool — Not an Autonomous Diagnostic Device**
> 
> NetraCare is designed strictly as an **assistive, clinical decision-support tool** for healthcare workers and general practitioners in primary healthcare settings to prioritize referrals.
> - It **does NOT** replace a comprehensive dilated eye examination by a certified ophthalmologist.
> - It **is NOT** an autonomous diagnostic system.
> - It **has NOT** undergone multi-center clinical trials or regulatory clearance (e.g., FDA, CE-IVD, CDSCO).
> - All model predictions are assistive recommendations for triage and referral urgency.

---

## Current Implementation Status

| Stage / Component | Status | Technical Details |
|---|---|---|
| **Stage 0: Fundus Validation** | ✅ **IMPLEMENTED & VERIFIED** | Multiscale spectral chromaticity, border aperture geometry, parenchyma texture variance, and dendritic vessel density screening. Rejects non-fundus and uncertain inputs before clinical evaluation. |
| **Stage 1: Image Quality** | ✅ **IMPLEMENTED & VERIFIED** | Quantitative assessment across 4 physical metrics: Focus (Laplacian variance), Illumination uniformity, Contrast dynamic range (P95-P5), and Field of View (FOV) coverage. Categorizes scans into `GOOD`, `BORDERLINE`, or `UNGRADABLE`. |
| **Stage 2: Borderline Enhancement** | ✅ **IMPLEMENTED & VERIFIED** | Homomorphic illumination correction, Rayleigh-distributed CLAHE on the CIE L\* luminance channel, and edge-preserving bilateral filtering. Strictly triggered only for `BORDERLINE` scans; bypassed for `GOOD` scans; blocked for `UNGRADABLE` scans. |
| **Stage 3: Deep Learning DR Inference** | ✅ **IMPLEMENTED & VERIFIED** | EfficientNet-B0 network classifying images into 5 ICDR/ETDRS grades (0: No DR, 1: Mild, 2: Moderate, 3: Severe, 4: Proliferative). Verified preprocessing parity with torchvision using Pillow-equivalent bilinear resampling (`pil_bilinear_resize.m`). |
| **Explainable AI (Grad-CAM)** | ✅ **IMPLEMENTED & VERIFIED** | Activation gradient saliency maps computed from feature layer `x_features_featu_469` and reduction layer `x_classifier_classif`, overlaying warm activation regions on the original scan (alpha = 0.30, jet colormap). |
| **Confidence Calibration** | ⚠️ **NOT IMPLEMENTED / UNCALIBRATED** | **Current confidence values are raw, uncalibrated neural network softmax outputs.** Post-hoc calibration (e.g., Temperature Scaling, Platt Scaling, ECE optimization) is planned for future work. |
| **Clinical Evaluation** | ⚠️ **PENDING HELD-OUT VALIDATION** | Model has been verified for numerical parity and functional pipeline execution against benchmark reference images. Large-scale multi-ethnic clinical validation (EyePACS, Messidor-2) is required before clinical deployment. |
| **FastAPI Backend Integration** | ✅ **IMPLEMENTED & VERIFIED** | Headless MATLAB invocation via subprocess batch mode (`matlab -batch`), atomic JSON file handoff, and HMAC-signed image/heatmap storage. |
| **Next.js Frontend & Proxy** | ✅ **IMPLEMENTED & VERIFIED** | Interactive screening dashboard with patient management, fundus upload, 120s extended proxy timeout, Stage 0 safety gating, and Grad-CAM side-by-side visualization. |

---

## System Architecture

```text
[ Browser / PHC Healthcare Worker ]
                │
                ▼ HTTP (Port 3000)
┌────────────────────────────────────────────────────────┐
│               Next.js 15 Frontend (SPA)                │
│  - Patient Registration & Selection                   │
│  - Drag-and-drop Fundus Upload                         │
│  - Stage 0 Rejection Gate Display                     │
│  - Stage 3 DR Grade & Softmax Confidence Display       │
│  - Grad-CAM Interactive Side-by-Side Saliency Viewer  │
└────────────────────────────────────────────────────────┘
                │
                │ Proxy Rewrite (/api/backend/* -> :8000)
                │ Timeout: 120,000 ms (proxyTimeout)
                ▼
┌────────────────────────────────────────────────────────┐
│             FastAPI Python Backend (Port 8000)         │
│  - Authentication & Rate Limiting                     │
│  - MongoDB Storage (`patients`, `screenings`, `phcs`) │
│  - HMAC-SHA256 Signed File Delivery                   │
│  - MATLAB Process Orchestration (`matlab_service.py`) │
└────────────────────────────────────────────────────────┘
                │
                │ 1. Saves image to `backend/storage/uploads/{id}.jpg`
                │ 2. Spawns headless subprocess: `matlab -batch runPipeline(...)`
                │ 3. Writes result to temporary JSON file in OS tempdir
                ▼
┌────────────────────────────────────────────────────────┐
│           MATLAB R2026a Computational Pipeline         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ STAGE 0: Fundus Image Validation Gate            │  │
│  │ (checkFundusImage.m - Spectral/Geometry/Vessels) │  │
│  └──────────────────────────────────────────────────┘  │
│           │ [FUNDUS]                │ [NON_FUNDUS]     │
│           ▼                         ▼                  │
│  ┌────────────────────────┐   ┌─────────────────────┐  │
│  │ STAGE 1: Image Quality │   │ REJECT PIPELINE     │  │
│  │ (assessQuality.m)      │   │ - DR Inference: OFF │  │
│  └────────────────────────┘   │ - Grad-CAM: OFF     │  │
│     │ GOOD       │ BORDERLINE └─────────────────────┘  │
│     │            ▼                                     │
│     │    ┌────────────────────────┐                    │
│     │    │ STAGE 2: Enhancement   │                    │
│     │    │ (enhanceBorderline.m)  │                    │
│     │    └────────────────────────┘                    │
│     ▼            │                                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ STAGE 3: Deep Learning DR Inference              │  │
│  │ (predictDR.m - EfficientNet-B0 ONNX/MAT)         │  │
│  └──────────────────────────────────────────────────┘  │
│           │                                            │
│           ▼                                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ EXPLAINABLE AI: Grad-CAM Saliency Map            │  │
│  │ (generateGradCAM.m - Layer x_features_featu_469) │  │
│  └──────────────────────────────────────────────────┘  │
│           │                                            │
│           ▼ Writes Blueprint Section 10 JSON Contract  │
└────────────────────────────────────────────────────────┘
                │
                ▼ Temporary JSON read & unlinked by FastAPI
┌────────────────────────────────────────────────────────┐
│             Data Persistence & Delivery                │
│  - Ingests Grad-CAM heatmap to `backend/storage/`      │
│  - Persists full screening record in MongoDB           │
│  - Returns HTTP 200 JSON through Next.js proxy         │
└────────────────────────────────────────────────────────┘
```

---

## Repository Structure

```text
RentoAI/
├── README.md                     # Root project guide and developer onboarding
├── .gitignore                    # Global git ignore rules (secrets, venv, node_modules, cache)
├── .env.example                  # Safe template of all environment variables
├── docs/                         # In-depth architectural & operational documentation
│   ├── ARCHITECTURE.md           # Detailed system components, boundaries & data contracts
│   ├── API.md                    # Complete FastAPI endpoint specification
│   ├── MATLAB_PIPELINE.md        # Mathematical & algorithmic deep dive into Stages 0–3
│   ├── TESTING.md                # Comprehensive test suite and validation procedures
│   └── HANDOVER.md               # Developer handover priorities and maintenance guide
│
├── model_new/                    # Canonical PyTorch Deep Learning workstream & checkpoints
│   └── checkpoints/              # Production PyTorch weights (best_model.pth - 48.6 MB)
├── backend/                      # Python FastAPI application
│   ├── README.md                 # Backend-specific architecture and developer instructions
│   ├── .env.example              # Backend environment template
│   ├── requirements.txt          # Python runtime dependencies
│   ├── app/
│   │   ├── main.py               # FastAPI application entrypoint, CORS, storage routes
│   │   ├── core/                 # Config, database, security, rate limiting, signed URLs
│   │   ├── features/             # Feature routers (patients, screenings, auth, phc, reports)
│   │   └── services/
│   │       └── matlab_service.py # Subprocess bridge executing MATLAB runPipeline.m
│   ├── storage/
│   │   ├── uploads/              # Uploaded retinal fundus images (.gitkeep preserved)
│   │   ├── heatmaps/             # Ingested Grad-CAM PNG heatmaps (.gitkeep preserved)
│   │   └── retinal_evidence/     # Segmented lesion candidates & overlays (.gitkeep preserved)
│   └── tests/
│       └── test_api.py           # Pytest test suite for API endpoints and auth flows
│
├── frontend/                     # Next.js 15 + React 19 single-page application
│   ├── README.md                 # Frontend architecture, proxy setup & UI documentation
│   ├── .env.example              # Frontend environment template
│   ├── package.json              # NPM dependencies and build scripts
│   ├── next.config.ts            # Next.js configuration & 120s rewrite proxy timeout
│   ├── middleware.ts             # Auth guard verifying httpOnly session JWT
│   ├── app/
│   │   ├── layout.tsx            # Global layout, fonts, navigation shell
│   │   ├── login/                # Authentication page
│   │   ├── dashboard/
│   │   │   ├── page.tsx          # Main clinic dashboard & statistics
│   │   │   ├── patients/         # Patient registry
│   │   │   ├── screening/new/    # Screening wizard: patient selection, image upload, analyze
│   │   │   ├── screening/[id]/   # Results page: Stage 0/1/3 indicators & Grad-CAM viewer
│   │   │   └── reports/[id]/     # Clinical referral report generation
│   │   └── api/backend/[...path] # Proxied rewrite endpoint to FastAPI
│   └── lib/
│       ├── api/
│       │   ├── backendClient.ts  # Client fetch wrapper, type converters, status mappers
│       │   ├── screening.ts      # Screening action functions
│       │   └── types.ts          # TypeScript domain interfaces
│       └── auth/                 # Edge-safe JWT token verification
│
└── Matlab/                       # MATLAB R2026a clinical AI workstream
    ├── README.md                 # MATLAB engineer guide, algorithm specifications & tests
    ├── runPipeline.m             # Primary entrypoint matching Blueprint Section 10 contract
    ├── config/                   # Central configuration structs
    │   ├── model_config.m        # Model classes, ImageNet normalization, XAI layers
    │   ├── fundus_config.m       # Stage 0 spectral & morphological thresholds
    │   ├── quality_config.m      # Stage 1 physical image quality criteria
    │   └── enhancement_config.m  # Stage 2 CLAHE & homomorphic illumination settings
    ├── quality/
    │   ├── checkFundusImage.m    # Stage 0: Fundus vs Non-Fundus validation algorithm
    │   └── assessQuality.m       # Stage 1: Focus, Illumination, Contrast, FOV scoring
    ├── enhancement/
    │   └── enhanceBorderline.m   # Stage 2: Adaptive CLAHE on L* luminance channel
    ├── model/
    │   ├── loadModel.m           # Loads ONNX/MAT dlnetwork
    │   ├── predictDR.m           # Evaluates EfficientNet-B0 network on preprocessed input
    │   ├── pil_bilinear_resize.m # Bit-accurate MATLAB equivalent of Pillow BILINEAR resize
    │   ├── netracare_efficientnet_b0.mat  # Imported MATLAB dlnetwork weights (17.5 MB)
    │   └── netracare_efficientnet_b0.onnx # Exported ONNX model weights (16.0 MB)
    ├── xai/
    │   └── generateGradCAM.m     # Computes Grad-CAM activation map and heatmap overlay
    ├── calibration/              # Planned confidence calibration module (Placeholder)
    ├── evaluation/               # Model evaluation routines (evaluateDR.m)
    ├── data/
    │   └── results/              # Generated benchmark outputs & python_parity_reference.json
    └── tests/                    # MATLAB unit & integration test suite
        ├── testParity.m          # Numerical parity test (<1e-4 probability difference vs PyTorch)
        ├── testPipeline.m        # Functional unit tests for Stages 0, 1, 2, 3
        └── testPipelineEndToEnd.m# 7-image trace across fundus & non-fundus inputs
```

---

## AWS Deployment Architecture

NetraCare is prepared for cloud deployment using a decoupled, secure architecture across AWS and cloud services:

```text
                    Internet
                       │
                       ▼
              AWS Amplify (Next.js SPA)
                       │
                     HTTPS
                       │
                       ▼
            AWS EC2 Instance (Linux)
              FastAPI Server (0.0.0.0:8000)
               ├── PyTorch (CPU EfficientNet-B0)
               ├── PyTorch Grad-CAM Saliency
               └── MATLAB R2026a Engine (`runPipeline.m`)
                       │
                       ▼
         MongoDB Atlas (Cloud Data Store)
```

### Infrastructure Summary

- **Frontend:** **AWS Amplify Hosting** (Next.js 15 App Router,SSR/Static Build, proxied via `BACKEND_URL`).
- **Backend:** **AWS EC2 (Linux)** running FastAPI on `0.0.0.0:8000` under Uvicorn.
- **Database:** **MongoDB Atlas** managed cloud cluster (`MONGODB_URL`).
- **Transactional Email:** **Brevo** REST API v3 / SMTP for OTP authentication (`BREVO_API_KEY`).
- **AI Model:** **CPU-only PyTorch** 5-class EfficientNet-B0 (`model_new/checkpoints/best_model.pth`).
- **Scientific Core:** **MATLAB R2026a Engine** (`matlab -batch`) for Stages 0–2 safety validation & retinal lesion analysis.

### Production Environment Configuration (Placeholders)

**Backend EC2 (`backend/.env`):**
```ini
HOST=0.0.0.0
PORT=8000
MONGODB_URL=mongodb+srv://<user>:<password>@cluster.mongodb.net/dr_screening?retryWrites=true&w=majority
DATABASE_NAME=dr_screening
CORS_ORIGINS=https://<your-amplify-app>.amplifyapp.com
AUTH_SECRET=your_secure_random_32_byte_jwt_secret
FRONTEND_ORIGIN=https://<your-amplify-app>.amplifyapp.com
MATLAB_EXECUTABLE=/usr/local/MATLAB/R2026a/bin/matlab
MATLAB_ROOT=/home/ubuntu/SIH_proj/Matlab
MATLAB_TIMEOUT_SECONDS=300
BREVO_API_KEY=xkeysib-your_brevo_v3_api_key
EMAIL_FROM="NetraCare <noreply@yourdomain.com>"
```

**Frontend AWS Amplify (`frontend/.env.local` or Amplify Environment Variables):**
```ini
BACKEND_URL=https://<ec2-domain-or-alb-dns>
AUTH_SECRET=your_secure_random_32_byte_jwt_secret
SESSION_COOKIE_NAME=dr_token
```

> [!NOTE]
> The exact EC2 instance size (recommended: 8GB+ RAM to comfortably handle PyTorch & MATLAB process spawning) and the exact Linux MATLAB installation path depend on your final AWS EC2 environment provisioning.

---

## System Requirements

| Dependency | Minimum Version | Tested / Active Version | Notes |
|---|---|---|---|
| **Operating System** | Windows 10/11 (x64) | Windows 11 (x64) | MATLAB path execution uses Windows CLI conventions |
| **Python** | Python 3.10+ | Python 3.14.3 | Required for FastAPI, PyMongo, OpenCV, Uvicorn |
| **Node.js** | Node.js v20.x+ | Node.js v24.21.0 | Required for Next.js 15 dev server & compilation |
| **NPM** | v10.x+ | v11.x+ | Node package manager |
| **MATLAB** | MATLAB R2022b+ | MATLAB R2026a | Requires `Deep Learning Toolbox` & `Image Processing Toolbox` |
| **MongoDB** | MongoDB 6.0+ | MongoDB Atlas / Local 7.0 | Document store for patients, screenings, and users |
| **Git** | v2.40+ | Installed | Version control (recommend Git LFS for model weights) |

---

## Installation & Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd SIH_proj
```

### 2. Backend Setup (FastAPI)

Open a terminal in the `backend/` directory:

```bash
cd backend

# Create or verify Python environment
python -m venv venv
venv\Scripts\activate

# Install required Python packages
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Configure environment variables
copy .env.example .env
```

Edit `backend/.env` with your settings:
- Set `AUTH_SECRET` to a secure 32+ character string.
- Set `MONGODB_URL` to your MongoDB connection string.
- Set `MATLAB_EXECUTABLE` to your local MATLAB binary path (e.g., `C:\Program Files\MATLAB\R2026a\bin\matlab.exe`).

### 2. Frontend Setup (Next.js)

Open a second terminal in the `frontend/` directory:

```bash
cd frontend

# Install Node dependencies (use npm.cmd if PowerShell blocks npm.ps1)
npm.cmd install

# Configure environment variables
copy .env.example .env.local
```

Edit `frontend/.env.local`:
- Set `AUTH_SECRET` to match the exact value used in `backend/.env`.
- Set `BACKEND_URL=http://localhost:8000`.

### 3. MATLAB Setup

1. Open MATLAB R2026a.
2. Change current working directory to `C:\Users\<username>\RentoAI\Matlab`.
3. Verify required toolboxes:
   ```matlab
   v = ver;
   any(strcmp({v.Name}, 'Deep Learning Toolbox'))
   any(strcmp({v.Name}, 'Image Processing Toolbox'))
   ```
4. Verify the model loads and passes numerical parity with PyTorch:
   ```matlab
   testParity
   ```

---

## Running the Complete System

### Start the Backend Service (Port 8000)

```bash
# In backend/ directory with Python active
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Health check:* Verify in browser or via curl: `http://localhost:8000/health` (returns `{"status": "ok", "db": "connected"}`).

### Start the Frontend Dev Server (Port 3000)

```bash
# In frontend/ directory
npm.cmd run dev
```
*Access:* Open [http://localhost:3000](http://localhost:3000) in your browser.

> [!NOTE]
> When a screening analysis is triggered in the browser, the Next.js proxy forwards the request to FastAPI (`:8000`), which automatically invokes MATLAB in headless batch mode. Inference commonly takes 30–75 seconds. The Next.js proxy timeout is configured for 120 seconds (`proxyTimeout: 120_000` in `frontend/next.config.ts`).

---

## End-to-End Clinical Screening Workflow

```text
[1. Login]               PHC worker signs in with credentials or Google OAuth.
   │
[2. Patient Selection]   Select an existing registered patient or enter quick patient details.
   │
[3. Exam Configuration]  Select examined eye ('left' | 'right').
   │
[4. Image Upload]        Select a high-resolution fundus photograph (JPEG/PNG).
   │
[5. Create Record]       POST /api/screenings creates record with status 'created'.
   │
[6. Upload Image File]   POST /api/screenings/{id}/image writes file to backend storage.
   │
[7. Trigger Analysis]    POST /api/screenings/{id}/analyze invokes MATLAB pipeline.
   │
[8. Stage 0 Check]       MATLAB validates retinal hue, dark circular aperture, parenchymal smoothness, and vessels.
   │                     ├── If NON_FUNDUS -> Rejection gate triggered. Analysis terminates.
   │                     └── If FUNDUS     -> Proceed to Stage 1.
   │
[9. Stage 1 Quality]     Evaluates Focus (Laplacian Var), Illumination, Contrast, and FOV ratio.
   │                     ├── If GOOD       -> Proceed to Stage 3.
   │                     ├── If BORDERLINE -> Execute Stage 2 Enhancement (Rayleigh CLAHE on L*).
   │                     └── If UNGRADABLE -> Clinical Action: RECAPTURE. Inference bypassed.
   │
[10. Stage 3 DR Model]   EfficientNet-B0 predicts ICDR severity (Grade 0–4) with uncalibrated softmax confidence.
   │
[11. Grad-CAM XAI]       Computes gradient attribution heatmap from feature layer x_features_featu_469.
   │
[12. Output Contract]    MATLAB writes complete JSON record matching Blueprint Section 10 to temp file.
   │
[13. Ingest & Persist]   FastAPI copies Grad-CAM heatmap to backend storage, signs URL, updates MongoDB.
   │
[14. Client Rendering]   Next.js displays Grade, uncalibrated confidence, clinical action, and Grad-CAM viewer.
```

---

## API Overview

All frontend requests route through `/api/backend/*` to avoid cross-origin cookie restrictions.

| Endpoint | Method | Purpose | Auth Required |
|---|---|---|---|
| `/health` | `GET` | Service & database connectivity health check | No |
| `/api/auth/login` | `POST` | Authenticate user & issue httpOnly `dr_token` cookie | No |
| `/api/patients` | `GET` | List patients registered at the user's PHC | Yes (Cookie/Bearer) |
| `/api/patients` | `POST` | Register a new patient profile | Yes |
| `/api/screenings` | `POST` | Create a new screening assessment record | Yes |
| `/api/screenings/{id}` | `GET` | Retrieve complete screening result, quality, and Grad-CAM | Yes |
| `/api/screenings/{id}/image` | `POST` | Upload fundus image multipart form data | Yes |
| `/api/screenings/{id}/analyze` | `POST` | Run safety-gated MATLAB pipeline on uploaded image | Yes |
| `/api/screenings/{id}/ai-explanation` | `POST` | LLM plain-language patient summary & precautions | Yes |
| `/storage/heatmaps/{file}` | `GET` | Serve Grad-CAM heatmap image with HMAC expiration signature | Yes / Signed URL |

*For complete request/response schemas and HTTP status codes, see [docs/API.md](docs/API.md).*

---

## Testing & Verification

### 1. Backend Integration Test Suite
```bash
cd backend
python -m pytest tests/test_api.py -v
```

### 2. MATLAB Unit & Pipeline Verification
In MATLAB console:
```matlab
% Run unit tests across all stages
testPipeline

% Run numerical parity verification against Python PyTorch predictions
testParity

% Run full 7-image trace
testPipelineEndToEnd
```

### 3. Frontend TypeScript Compilation
```bash
cd frontend
npm.cmd run build
# OR
npx tsc --noEmit
```

### 4. Verified Benchmark Cases in Repository

| Benchmark Case | File Path | Validation Result | Pipeline Behavior |
|---|---|---|---|
| **Genuine Fundus (No DR)** | `backend/storage/uploads/SCR-0003.jpg` | Stage 0: `FUNDUS` (Score 1.0) | Enters Stage 1; classified as Grade 0 (`No DR`); Grad-CAM produced. |
| **Genuine Fundus (Proliferative DR)** | `backend/storage/uploads/SCR-0048.jpg` | Stage 0: `FUNDUS` (Score 0.925) | Enters Stage 1; classified as Grade 4 (`Proliferative DR`); Action: `SPECIALIST REFERRAL`. |
| **Synthetic Non-Fundus** | `backend/storage/uploads/SCR-0036.jpg` | Stage 0: `NON_FUNDUS` (Score 0.412) | Blocked at Stage 0; DR inference & Grad-CAM strictly suppressed. |
| **Uncertain Ambiguous Input** | `backend/storage/uploads/SCR-0037.jpg` | Stage 0: `UNCERTAIN` (Score 0.875) | Flagged for manual clinical review; DR inference & Grad-CAM suppressed. |
| **Watermelon Artifact Test** | `Matlab/data/results/fundus_check_SCR-0005.png` | Stage 0: `NON_FUNDUS` | Biological vascularity test fails; rejected at Gate 0. |

---

## Known Limitations

1. **Uncalibrated Model Confidence:** The confidence score displayed is raw neural network softmax output. Softmax scores tend to be overconfident and must not be interpreted as calibrated posterior probabilities.
2. **Lack of Multi-Center Clinical Validation:** The model has been verified on developmental datasets (APTOS-2019 reference set) and parity test vectors. It has not been validated on diverse Indian rural PHC camera hardware (e.g., Remidio Fundus on phone, Forus 3nethra, Zeiss Visucam).
3. **Stage 0 Heuristic Limits:** The Stage 0 morphological screening uses hand-tuned optical thresholds. Severe pathological conditions (e.g., massive pre-retinal hemorrhages or central retinal artery occlusions) can alter color histograms and require ongoing validation against rare ophthalmological conditions.
4. **Subprocess Inference Latency:** Spawning MATLAB in batch mode introduces process startup overhead (~15–20s) plus inference (~15–20s), totaling 30–75s per screening. Production deployment should migrate to the MATLAB Production Server REST API or compiled Docker microservices.

---

## Common Troubleshooting

### 1. Port 8000 Already in Use (`WinError 10048`)
```powershell
# Identify process holding port 8000
netstat -ano | findstr :8000

# Terminate process by PID
taskkill /PID <PID_NUMBER> /F
```

### 2. PowerShell Blocks Running `npm` Scripts
Windows PowerShell ExecutionPolicy may prevent running `.ps1` files. Use `npm.cmd`:
```powershell
npm.cmd install
npm.cmd run dev
```

### 3. MATLAB Executable Not Found
Ensure `MATLAB_EXECUTABLE` in `backend/.env` points to the exact binary path:
```ini
MATLAB_EXECUTABLE=C:\Program Files\MATLAB\R2026a\bin\matlab.exe
```
Verify path in PowerShell: `Test-Path "C:\Program Files\MATLAB\R2026a\bin\matlab.exe"`.

### 4. Analysis Request Fails at 30 Seconds with HTTP 500
Next.js dev server rewrite proxy defaults to 30s. Verify that `frontend/next.config.ts` includes:
```typescript
experimental: {
  proxyTimeout: 120_000,
}
```

---

## Handover Documentation Index

For complete architectural and technical details, refer to the documentation package in `docs/`:

1. [**docs/HANDOVER.md**](docs/HANDOVER.md) — Maintenance priorities, safety invariants, and handover task list.
2. [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) — Complete component diagrams, data flows, and security design.
3. [**docs/API.md**](docs/API.md) — Comprehensive OpenAPI/REST endpoint specifications.
4. [**docs/MATLAB_PIPELINE.md**](docs/MATLAB_PIPELINE.md) — Mathematical and algorithmic specification for Stages 0–3.
5. [**docs/TESTING.md**](docs/TESTING.md) — Test protocols, regression benchmarks, and validation steps.
6. [**Matlab/README.md**](Matlab/README.md) — MATLAB engineer implementation handbook.
7. [**backend/README.md**](backend/README.md) — FastAPI service, database models, and MATLAB subprocess bridge.
8. [**frontend/README.md**](frontend/README.md) — Next.js SPA architecture, state management, and safety UI.
