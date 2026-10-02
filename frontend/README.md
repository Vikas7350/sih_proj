# NetraCare Frontend (Next.js 15)

Clinical decision-support user interface built with Next.js 15 App Router and TailwindCSS, designed for Primary Health Centre (PHC) healthcare workers to conduct AI diabetic retinopathy screenings, inspect Grad-CAM heatmaps, manage patient registries, and review automated follow-up appointments.

---

## 1. Technologies & Architecture

- **Framework:** Next.js 15 (App Router with Server Components & SSR)
- **Runtime:** React 19 / Node.js 20+
- **Styling:** TailwindCSS with NetraCare Clinical Design System (`#0B3A3F` Deep Teal, `#0F766E` Primary, `#F3F6F5` Light Canvas)
- **Icons:** Lucide React & NetraCare Brand SVG Vector Icons
- **Deployment:** AWS Amplify Hosting (SSR), Vercel, or Production Docker Container

---

## 2. API Proxy & Security Architecture

The frontend communicates with the FastAPI backend through server-side rewrite rules defined in `next.config.ts`:

1. **Zero Client-Side Secret Leakage:** Private environment variables (like `BACKEND_URL`) are strictly server-side and never prefixed with `NEXT_PUBLIC_`.
2. **HttpOnly Cookie Handling:** Session tokens (`dr_token`) set by the backend flow securely across requests.
3. **Hardened Security Headers:** Automatically injects `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, and `Permissions-Policy`.
4. **Extended Proxy Timeout:** Deep learning inference and Grad-CAM generation take 15–45 seconds; the rewrite proxy includes an explicit 300-second timeout configuration to prevent premature socket termination.

---

## 3. Directory Structure

```text
Frontend/
├── app/                         # Next.js App Router
│   ├── (auth)/                  # Login, Register, Forgot Password, Reset Password
│   ├── dashboard/               # Authenticated clinician portal
│   │   ├── page.tsx             # PHC overview metrics & real database aggregations
│   │   ├── patients/            # Patient roster, demographic records & history
│   │   ├── reminders/           # Scheduled follow-up appointments & SMS audits
│   │   ├── reports/             # Aggregated screening summaries and audits
│   │   └── screening/           # 4-step guided screening capture & results
│   ├── icon.svg                 # NetraCare vector medical brand icon / favicon
│   ├── manifest.ts              # Progressive Web App (PWA) manifest
│   ├── robots.ts                # Dynamic robots.txt (allows marketing, disallows PHI)
│   ├── sitemap.ts               # Dynamic sitemap.xml for public routes
│   ├── globals.css              # Design tokens and base utility classes
│   └── layout.tsx               # Root HTML structure and font definitions
├── components/                  # Reusable UI components & clinical viewers
│   ├── reminders/               # Follow-up tables, modals, & reschedule dialogs
│   ├── screening/               # Guided screening capture steps & Grad-CAM viewer
│   └── dashboard/               # Navigation shells and stat cards
├── lib/                         # API clients, validators, and utility functions
├── public/                      # Static assets & brand vectors
├── .dockerignore                # Production Docker exclusions
├── Dockerfile                   # Multi-stage production container
├── amplify.yml                  # AWS Amplify build configuration
├── .env.example                 # Example frontend environment variables
├── next.config.ts               # Security headers, rewrites, and timeouts
├── package.json                 # Dependencies and build scripts
└── tsconfig.json                # TypeScript compiler configuration
```

---

## 4. Getting Started Locally

### 1. Install Dependencies
```bash
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables
```bash
cp .env.example .env.local
```
Edit `.env.local`:
```ini
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Production Build & Validation

```bash
# Type checking
npx tsc --noEmit

# Production build
npm run build
```

---

## 6. AWS Amplify Deployment

This project includes a ready-to-use **`amplify.yml`** build specification for AWS Amplify Hosting:
- Framework: `Next.js - SSR`
- Build Output: `.next`
- Dependency Caching: `node_modules` & `.next/cache`
