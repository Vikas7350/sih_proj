# NetraCare Frontend (Next.js)

A Next.js clinical decision support interface designed for Primary Health Centres (PHC) to manage patients, execute automated diabetic retinopathy screenings, visualize Explainable AI (Grad-CAM) saliency maps, and export clinical audit reports.

---

## 1. Technologies & Architecture

- **Framework:** Next.js 15.2.0 (App Router architecture)
- **Runtime:** React 19 / Node.js 20+ (Verified on Node.js v24.21.0)
- **Styling:** TailwindCSS 3.4.17 (Custom medical petrol/slate palette, glassmorphism card surfaces)
- **Icons:** Lucide React
- **Language:** TypeScript 5.7+ (Strict typing enabled)

### API Communication & Backend Proxy
The frontend interacts with the FastAPI backend through a unified Next.js rewrite proxy configured in `next.config.ts`. This architecture provides several essential benefits:
1. **Elimination of Cross-Origin Resource Sharing (CORS) complications:** Browser requests are sent to the same origin (`http://localhost:3000/api/backend/*`), avoiding browser pre-flight failures.
2. **HttpOnly Cookie Propagation:** Session tokens (`dr_token`) set by the backend are transmitted transparently across requests.
3. **Long-Running Request Proxy:** Deep learning inference in MATLAB requires 30–60 seconds. The rewrite proxy includes an explicit 120-second timeout configuration to prevent premature socket termination.

```
[ Browser Client ]
        │
        │ HTTP Requests to /api/backend/... and /storage/...
        ▼
┌─────────────────────────────────────────────────────────────┐
│                 Next.js Server (Port 3000)                  │
│                                                             │
│  next.config.ts:                                            │
│    experimental.proxyTimeout: 120_000 (120 seconds)         │
│                                                             │
│  Rewrites:                                                  │
│    /api/backend/:path*  ──►  http://127.0.0.1:8000/api/:path*│
│    /storage/:path*      ──►  http://127.0.0.1:8000/storage/:path*
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ Fast local loopback
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 FastAPI Backend (Port 8000)                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure

```
frontend/
├── app/                         # Next.js App Router hierarchy
│   ├── (auth)/                  # Authentication routes (login, register, reset)
│   ├── dashboard/               # Authenticated clinician portal
│   │   ├── layout.tsx           # Dashboard shell with sidebar & navigation
│   │   ├── page.tsx             # PHC overview metrics & recent activity
│   │   ├── patients/            # Patient roster and registration
│   │   ├── reports/             # Aggregated screening summaries and audits
│   │   └── screening/           # Screening workflows
│   │       ├── new/page.tsx     # 3-step screening creation & analysis trigger
│   │       └── [screeningId]/   # Result display: Stage 0–3, Grad-CAM, risk
│   ├── globals.css              # Design tokens and base utility classes
│   └── layout.tsx               # Root HTML structure and font definitions
├── components/                  # Reusable UI components
│   ├── GradcamViewer.tsx        # Side-by-side & overlay saliency visualizer
│   ├── MetricCard.tsx           # Dashboard stat tiles
│   └── StageTracker.tsx         # Pipeline stage stepper indicator
├── lib/
│   ├── api/                     # Typed client libraries for backend endpoints
│   │   ├── backendClient.ts     # Core fetch wrapper, data transformers, & mapping
│   │   ├── patients.ts          # Patient demographic CRUD
│   │   ├── reports.ts           # Facility reports and summary statistics
│   │   ├── screening.ts         # Screening lifecycle orchestrator
│   │   └── types.ts             # TypeScript interfaces for API contracts
│   └── auth/                    # Session state and authentication helpers
├── public/                      # Static assets and benchmark images
├── .env.example                 # Example frontend environment variables
├── next.config.ts               # Proxy rewrites and timeout settings
├── package.json                 # Dependencies and scripts
└── tsconfig.json                # TypeScript compiler configuration
```

---

## 3. End-to-End Screening Flow

1. **Patient Selection or Registration:** Clinician selects an existing patient from the database or completes a quick inline registration (`/dashboard/screening/new`).
2. **Eye Selection & Image Acquisition:** Clinician specifies the eye (`Left` or `Right`) and uploads the fundus photograph via drag-and-drop or file selector.
3. **Execution (`runFullScreening`):**
   - Step A: `POST /api/screenings` creates a new screening record in status `pending`.
   - Step B: `POST /api/screenings/{id}/image` uploads the binary file via `multipart/form-data`.
   - Step C: `POST /api/screenings/{id}/analyze` initiates the MATLAB pipeline. An interactive modal displays the step-by-step progress to the clinician.
4. **Navigation:** Upon successful analysis completion, the browser routes automatically to `/dashboard/screening/{screening_id}` to inspect results.

---

## 4. Stage 0 Safety Gating & Suppression Logic

A foundational clinical safety principle enforced in `frontend/lib/api/backendClient.ts` and `frontend/app/dashboard/screening/[screeningId]/page.tsx` is:

> **Non-fundus or ungradable inputs must NEVER display deep learning predictions, disease classifications, or Grad-CAM saliency maps.**

### Implementation Details
- **Safety Detection:**
  ```typescript
  const isNonFundus =
    fundus?.status === 'NON_FUNDUS' ||
    (fundus as { status?: string })?.status === 'UNCERTAIN' ||
    fundus?.isFundus === false ||
    screening.status === 'rejected';
  ```
- **Prediction Suppression:**
  In `toPrediction(...)`, if `isNonFundus` evaluates to `true`, the function unconditionally returns `undefined`.
- **UI Safety Rendering:**
  When `isNonFundus` is active:
  - The results page highlights a prominent red safety alert: **"Safety Check: Retinal Fundus Validation Rejected"**.
  - Detailed heuristic failure reasons from Stage 0 are displayed (e.g., *Insufficient red channel dominance*, *Vessel contrast too low*, *Non-circular aperture*).
  - Stage 3 (DR Inference, Grade classification, and Grad-CAM) is **completely hidden and omitted from the DOM**.
  - An immediate **"Upload Another Image"** call-to-action is presented.

---

## 5. Model Inference Display & Uncalibrated Output Disclosure

When an image passes Stage 0 and Stage 1 validation, the results page displays the Stage 3 deep learning outputs:

### 1. Classification & Findings
- **Class Label & Grade:** Displays Grade 0 (`No DR`) through Grade 4 (`Proliferative DR`) aligned with the international ETDRS clinical classification.
- **Rule-Based Clinical Findings:** Automatically generates specific clinical indicators corresponding to the predicted grade (e.g., *Microaneurysms detected*, *Cotton wool spots present*).

### 2. Explicit Confidence Disclaimer
The frontend rigorously distinguishes between raw model softmax confidence and post-hoc calibrated probabilities:
- **Badge Indicator:** Displays `Raw Softmax Confidence: XX.X%`.
- **Calibration Status:** Displays `Uncalibrated Model Output (Calibrated: Not Available)` in amber styling.
- **Clinical Decision Support Banner:**
  > *"The raw confidence score displayed represents uncalibrated neural network softmax output and must not be interpreted as a calibrated probability. This AI screening result is an assistive tool for Primary Health Centres and does not replace a definitive medical diagnosis by an ophthalmologist."*

### 3. Grad-CAM Saliency Map Viewer
The Explainable AI (XAI) section provides three interactive inspection modes:
- **Side-by-Side:** Displays the original fundus photograph directly adjacent to the Grad-CAM heatmap.
- **Original Fundus:** Dedicated view of the preprocessed clinical image.
- **Grad-CAM Heatmap:** Dedicated view of the thermal saliency overlay generated by MATLAB from feature layer `x_features_featu_469`.

---

## 6. Installation & Execution

### Prerequisites
- Node.js 20.x or higher (Verified on Node.js v24.21.0)
- npm 10.x or higher

### Setup Steps
```powershell
# 1. Navigate to frontend directory
cd C:\Users\ysyas\RentoAI\frontend

# 2. Install dependencies
npm.cmd install

# 3. Create local environment configuration
copy .env.example .env.local
```

### Running the Development Server
```powershell
npm.cmd run dev
```
- Development URL: `http://localhost:3000`
- The application will automatically connect to the backend at `http://127.0.0.1:8000` via the proxy rewrite rules.

### TypeScript Compilation Check
To verify that all types and components satisfy the TypeScript compiler without emitting output:
```powershell
npx.cmd tsc --noEmit
```

---

## 7. Troubleshooting

### 1. PowerShell Script Execution Policy Blocks `npm`
- **Error:** `File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running scripts is disabled on this system.`
- **Safe Solution:** Use the Windows command wrapper `npm.cmd` instead of calling `npm.ps1`:
  ```powershell
  npm.cmd run dev
  ```
  *(This avoids having to modify system-wide execution policies).*

### 2. HTTP 500 / 504 on Screening Analysis After 30 Seconds
- **Cause:** Earlier Next.js dev server configurations defaulted to a 30-second proxy timeout. Deep learning inference and Grad-CAM generation in MATLAB can take 30–60 seconds.
- **Resolution:** Verify `frontend/next.config.ts` includes:
  ```typescript
  experimental: {
    proxyTimeout: 120_000, // 120 seconds
  }
  ```
  Restart the dev server after updating `next.config.ts`.

### 3. Grad-CAM Heatmap Fails to Load (Broken Image Icon)
- **Cause:** Expired signed URL or missing storage directory.
- **Resolution:** Verify that `backend/storage/heatmaps/{screening_id}.png` exists and that the client is receiving the signed URL query parameters (`?exp=...&sig=...`). Check that `NEXT_PUBLIC_BACKEND_URL` is properly configured.
