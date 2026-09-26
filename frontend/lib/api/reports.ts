import { ScreeningReport } from './types';
import { getScreeningResult } from './screening';
import { getPHCProfile } from './phc';

export async function getScreeningReport(screeningId: string): Promise<ScreeningReport | null> {
  const result = await getScreeningResult(screeningId);
  if (!result) return null;

  const phc = await getPHCProfile();

  const report: ScreeningReport = {
    ...result,
    phcName: phc.name,
    phcCode: phc.code,
    district: phc.district,
    state: phc.state,
    healthcareWorkerName: phc.healthcareWorkerName,
    reportGeneratedAt: new Date().toISOString(),
  };

  return report;
}
