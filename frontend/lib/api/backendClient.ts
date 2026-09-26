/**
 * Backend API Client
 *
 * Translates between FastAPI (snake_case, lowercase risk levels, decimal confidence)
 * and frontend types (camelCase, UPPERCASE risk levels, percentage confidence).
 */

import {
  Patient,
  ScreeningResult,
  ImageQualityCheck,
  DRPrediction,
  RiskAssessment,
  DRGrade,
  RiskLevel,
  AIExplanation,
} from "./types";

const BASE_URL = "/api/backend";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init?.headers as Record<string, string>) || {}),
  };
  // Auth rides in the httpOnly dr_token cookie set by the backend; the Next.js
  // /api/backend rewrite forwards it automatically (same origin).
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = body?.detail?.message || body?.detail || `API error ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

function convertKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[snakeToCamel(k)] = v;
  }
  return out;
}

// ── Risk level mapping ───────────────────────────────────────────────────────

const RISK_LEVEL_MAP: Record<string, RiskLevel> = {
  low: "LOW RISK",
  monitor: "MONITOR",
  high: "HIGH RISK",
  urgent: "URGENT",
  recapture: "RECAPTURE",
};

// ── Type converters ──────────────────────────────────────────────────────────

function toPatient(raw: Record<string, unknown>): Patient {
  const c = convertKeys(raw);
  return {
    id: (c.patientId as string) || "",
    patientId: (c.patientId as string) || "",
    name: (c.name as string) || "",
    age: (c.age as number) || 0,
    gender: (c.gender as Patient["gender"]) || "Other",
    diabetesDurationYears: (c.diabetesDurationYears as number) || 0,
    contactNumber: (c.contactNumber as string) || undefined,
    createdAt: (c.createdAt as string) || "",
  };
}

function toImageQuality(raw: Record<string, unknown> | null): ImageQualityCheck {
  if (!raw) {
    return {
      status: "insufficient",
      score: 0,
      checks: { resolution: false, brightness: false, contrast: false, blur: false, fundusVisibility: false },
      message: "No quality assessment available",
    };
  }
  const checks = (raw.checks as Record<string, boolean>) || {};
  return {
    status: (raw.status === "good" ? "good" : "insufficient"),
    score: Math.round(((raw.score as number) || 0) * 100),
    checks: {
      resolution: checks.resolution ?? false,
      brightness: checks.brightness ?? false,
      contrast: checks.contrast ?? false,
      blur: checks.blur ?? false,
      fundusVisibility: checks.fundusVisibility ?? checks.fundus_visibility ?? false,
    },
    issues: (raw.issues as string[]) || undefined,
    message: (raw.message as string) || "",
  };
}

function toPrediction(raw: Record<string, unknown> | null): DRPrediction | undefined {
  if (!raw) return undefined;
  const confidence = raw.confidence as number;
  const probabilities = raw.probabilities as Record<string, number> | undefined;
  return {
    grade: (raw.grade as DRGrade) || 0,
    label: (raw.label as DRPrediction["label"]) || "No DR",
    description: (raw.description as string) || "",
    // Backend returns 0-1 decimal, frontend expects percentage (0-100)
    confidence: confidence <= 1 ? Math.round(confidence * 1000) / 10 : confidence,
    probabilities: probabilities
      ? Object.fromEntries(
        Object.entries(probabilities).map(([k, v]) => [
          k,
          v <= 1 ? Math.round(v * 1000) / 10 : v,
        ]),
      )
      : undefined,
  };
}

function toRisk(raw: Record<string, unknown> | null): RiskAssessment | undefined {
  if (!raw) return undefined;
  // Backend now returns uppercase label directly (e.g. "HIGH RISK")
  const label = (raw.label as string) || "";
  const levelKey = (raw.level as string) || "low";
  return {
    level: (label as RiskLevel) || RISK_LEVEL_MAP[levelKey] || "LOW RISK",
    recommendation: (raw.recommendation as string) || "",
    actionRequired: (raw.actionRequired as string) || (raw.action_required as string) || "",
    followUpTimeframe: (raw.followUpTimeframe as string) || (raw.follow_up_timeframe as string) || "",
  };
}

function toScreening(raw: Record<string, unknown>): ScreeningResult {
  const explanation = (raw.explanation as Record<string, unknown>) || {};
  return {
    screeningId: (raw.screening_id as string) || "",
    patientId: (raw.patient_id as string) || "",
    patientName: (raw.patient_name as string) || "",
    patientAge: (raw.patient_age as number) || 0,
    patientGender: (raw.patient_gender as string) || "",
    diabetesDurationYears: (raw.diabetes_duration_years as number) || 0,
    date: (raw.created_at as string) || "",
    eye: (raw.eye as "left" | "right") || "left",
    imageUrl: (raw.image_url as string) || "",
    heatmapUrl: (explanation.heatmap_url as string) || undefined,
    imageQuality: toImageQuality(raw.image_quality as Record<string, unknown> | null),
    prediction: toPrediction(raw.prediction as Record<string, unknown> | null),
    risk: toRisk(raw.risk as Record<string, unknown> | null),
    fundus: (raw.fundus as Record<string, unknown>) || undefined,
    decision: (raw.decision as string) || undefined,
    action: (raw.action as string) || undefined,
    evidence: (raw.evidence as Record<string, unknown>) || undefined,
    matlabResult: (raw.matlab_result as Record<string, unknown>) || undefined,
    status: mapScreeningStatus(raw.status as string),
  };
}

function mapScreeningStatus(backend: string): ScreeningResult["status"] {
  switch (backend) {
    case "completed": return "completed";
    case "quality_failed": return "quality_failed";
    default: return "pending"; // created, image_uploaded, quality_checking, ai_processing, failed
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function fetchPatients(search?: string): Promise<{ items: Patient[]; total: number }> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  params.set("limit", "100");
  const data = await apiFetch<{ items: Record<string, unknown>[]; total: number }>(
    `/patients?${params}`
  );
  return {
    items: data.items.map(toPatient),
    total: data.total,
  };
}

export async function fetchPatient(patientId: string): Promise<Patient> {
  const data = await apiFetch<Record<string, unknown>>(`/patients/${patientId}`);
  return toPatient(data);
}

export async function createPatient(payload: {
  name: string;
  age: number;
  gender: string;
  diabetesDurationYears?: number;
  contactNumber?: string;
}): Promise<Patient> {
  const data = await apiFetch<Record<string, unknown>>("/patients", {
    method: "POST",
    body: JSON.stringify({
      name: payload.name,
      age: payload.age,
      gender: payload.gender,
      diabetes_duration_years: payload.diabetesDurationYears || 0,
      contact_number: payload.contactNumber || "",
    }),
  });
  return toPatient(data);
}

export async function fetchScreenings(params?: {
  patientId?: string;
  risk?: string;
  grade?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: ScreeningResult[]; total: number; pages: number }> {
  const searchParams = new URLSearchParams();
  if (params?.patientId) searchParams.set("patient_id", params.patientId);
  if (params?.risk) searchParams.set("risk", params.risk);
  if (params?.grade !== undefined) searchParams.set("grade", String(params.grade));
  if (params?.dateFrom) searchParams.set("date_from", params.dateFrom);
  if (params?.dateTo) searchParams.set("date_to", params.dateTo);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const data = await apiFetch<{
    items: Record<string, unknown>[];
    total: number;
    pages: number;
  }>(`/screenings?${searchParams}`);
  return {
    items: data.items.map(toScreening),
    total: data.total,
    pages: data.pages,
  };
}

export async function fetchScreeningResult(screeningId: string): Promise<ScreeningResult> {
  const data = await apiFetch<Record<string, unknown>>(`/screenings/${screeningId}`);
  return toScreening(data);
}

export async function createScreening(patientId: string, eye: "left" | "right"): Promise<ScreeningResult> {
  const data = await apiFetch<Record<string, unknown>>("/screenings", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, eye }),
  });
  return toScreening(data);
}

export async function uploadScreeningImage(screeningId: string, file: File): Promise<{ image_url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/screenings/${screeningId}/image`, {
    method: "POST",
    body: formData,
    // Don't set Content-Type — browser sets it with boundary for FormData
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail?.message || `Upload failed (${res.status})`);
  }
  return res.json();
}

export async function analyzeScreening(screeningId: string): Promise<ScreeningResult> {
  const data = await apiFetch<Record<string, unknown>>(`/screenings/${screeningId}/analyze`, {
    method: "POST",
  });
  return toScreening(data);
}

export async function fetchAiExplanation(screeningId: string): Promise<AIExplanation> {
  const raw = await apiFetch<Record<string, unknown>>(`/screenings/${screeningId}/ai-explanation`, {
    method: "POST",
  });
  return {
    explanation: (raw.explanation as string) || "",
    precautions: (raw.precautions as string[]) || [],
    model: (raw.model as string) || "",
    source: (raw.source as AIExplanation["source"]) || "fallback",
  };
}

export async function fetchReportsSummary(): Promise<{
  totalPatients: number;
  totalScreenings: number;
  completedScreenings: number;
  qualityFailedScreenings: number;
  gradeDistribution: Record<string, number>;
  riskDistribution: Record<string, number>;
}> {
  const data = await apiFetch<{
    total_patients: number;
    total_screenings: number;
    completed_screenings: number;
    quality_failed_screenings: number;
    grade_distribution: Record<string, number>;
    risk_distribution: Record<string, number>;
  }>("/reports/summary");
  return {
    totalPatients: data.total_patients,
    totalScreenings: data.total_screenings,
    completedScreenings: data.completed_screenings,
    qualityFailedScreenings: data.quality_failed_screenings,
    gradeDistribution: data.grade_distribution,
    riskDistribution: data.risk_distribution,
  };
}

/**
 * Convert a data URL (base64) to a File object for upload.
 */
/**
 * Finish onboarding for a Google-created account: attach a PHC and clear the
 * needs_profile flag. The backend refreshes the session cookie in the response.
 */
export async function completeProfile(payload: {
  name?: string;
  phcName: string;
  phcCode: string;
  state: string;
  district: string;
  address: string;
  contactNumber: string;
}): Promise<{
  access_token: string;
  user: {
    id: string;
    name: string;
    email: string;
    provider: string;
    phc_id: string | null;
    needs_profile: boolean;
  };
}> {
  return apiFetch<{
    access_token: string;
    user: {
      id: string;
      name: string;
      email: string;
      provider: string;
      phc_id: string | null;
      needs_profile: boolean;
    };
  }>('/auth/complete-profile', {
    method: 'POST',
    body: JSON.stringify({
      name: payload.name || undefined,
      phc_name: payload.phcName,
      phc_code: payload.phcCode,
      state: payload.state,
      district: payload.district,
      address: payload.address,
      contact_number: payload.contactNumber,
    }),
  });
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/**
 * Full screening pipeline: create → upload → analyze → return result.
 */
export async function runFullScreening(
  patientId: string,
  eye: "left" | "right",
  imageDataUrl: string,
): Promise<ScreeningResult> {
  // 1. Create screening record
  const screening = await createScreening(patientId, eye);

  // 2. Convert data URL to File and upload
  const file = dataUrlToFile(imageDataUrl, `${screening.screeningId}.jpg`);
  await uploadScreeningImage(screening.screeningId, file);

  // 3. Run analysis (quality check + AI inference + Grad-CAM)
  const result = await analyzeScreening(screening.screeningId);
  return result;
}
