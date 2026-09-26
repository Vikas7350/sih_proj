import { ScreeningResult, ScreeningFilters, AIExplanation } from './types';
import {
  runFullScreening,
  fetchScreeningResult,
  fetchScreenings,
  fetchAiExplanation,
} from './backendClient';

/**
 * Create screening: sends image to FastAPI backend for quality check + AI analysis.
 * `forceQualityFail` is ignored — the backend determines quality from the actual image.
 */
export async function createScreening(
  patientId: string,
  eye: 'left' | 'right',
  imagePreviewUrl: string,
  _forceQualityFail: boolean = false
): Promise<ScreeningResult> {
  return runFullScreening(patientId, eye, imagePreviewUrl);
}

export async function getScreeningResult(screeningId: string): Promise<ScreeningResult | null> {
  try {
    return await fetchScreeningResult(screeningId);
  } catch {
    return null;
  }
}

export async function getAiExplanation(screeningId: string): Promise<AIExplanation | null> {
  try {
    return await fetchAiExplanation(screeningId);
  } catch (err) {
    console.error('Failed to load AI explanation:', err);
    return null;
  }
}

export async function getScreeningsByPatientId(patientId: string): Promise<ScreeningResult[]> {
  const { items } = await fetchScreenings({ patientId, limit: 100 });
  return items;
}

export async function getScreeningHistory(
  filters?: ScreeningFilters,
  page: number = 1,
  limit: number = 20
): Promise<{ items: ScreeningResult[]; total: number; pages: number }> {
  // Build backend filter params
  let riskFilter: string | undefined;
  if (filters?.riskLevel && filters.riskLevel !== 'ALL') {
    // Frontend sends "HIGH RISK", backend expects "high"
    riskFilter = filters.riskLevel.split(' ')[0].toLowerCase();
  }

  let gradeFilter: number | undefined;
  if (filters?.drGrade && filters.drGrade !== 'ALL') {
    gradeFilter = parseInt(filters.drGrade, 10);
  }

  const result = await fetchScreenings({
    risk: riskFilter,
    grade: gradeFilter,
    dateFrom: filters?.dateFrom,
    dateTo: filters?.dateTo,
    page,
    limit,
  });

  // Apply client-side text search (backend doesn't search by patient name)
  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    const filtered = result.items.filter(
      (s) =>
        s.patientName.toLowerCase().includes(q) ||
        s.patientId.toLowerCase().includes(q) ||
        s.screeningId.toLowerCase().includes(q)
    );
    return { ...result, items: filtered };
  }

  return result;
}
