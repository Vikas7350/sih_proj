export interface Patient {
  id: string;
  patientId: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  diabetesDurationYears: number;
  contactNumber?: string;
  createdAt: string;
}

export interface PHCProfile {
  id: string;
  name: string;
  code: string;
  state: string;
  district: string;
  address: string;
  contactNumber: string;
  healthcareWorkerName: string;
}

export interface ImageQualityCheck {
  status: 'good' | 'insufficient';
  score: number; // 0 - 100
  checks: {
    resolution: boolean;
    brightness: boolean;
    contrast: boolean;
    blur: boolean;
    fundusVisibility: boolean;
  };
  issues?: string[];
  message: string;
}

export type DRGrade = 0 | 1 | 2 | 3 | 4;

export interface DRPrediction {
  grade: DRGrade;
  label: 'No DR' | 'Mild DR' | 'Moderate DR' | 'Severe DR' | 'Proliferative DR';
  description: string;
  confidence: number; // percentage e.g. 91.5
  probabilities?: Record<string, number>; // per-class confidence 0-100
  isCalibrated?: boolean;
  calibratedConfidence?: number | null;
}

export type RiskLevel = 'LOW RISK' | 'MONITOR' | 'HIGH RISK' | 'URGENT' | 'RECAPTURE';

export interface RiskAssessment {
  level: RiskLevel;
  recommendation: string;
  actionRequired: string;
  followUpTimeframe: string;
}

export interface AIExplanation {
  explanation: string;
  precautions: string[];
  model: string;
  source: 'llm' | 'fallback';
}

export interface FundusCheck {
  status?: string;
  isFundus?: boolean;
  confidence?: number;
  reasons?: string[];
  [key: string]: any;
}

export interface ScreeningResult {
  screeningId: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  diabetesDurationYears: number;
  date: string;
  eye: 'left' | 'right';
  imageUrl: string;
  heatmapUrl?: string;
  imageQuality: ImageQualityCheck;
  prediction?: DRPrediction;
  risk?: RiskAssessment;
  fundus?: FundusCheck;
  qualityDetails?: any;
  enhancement?: any;
  decision?: string;
  action?: string;
  reasons?: string[];
  evidence?: any;
  matlabResult?: any;
  status: 'completed' | 'quality_failed' | 'pending' | 'rejected' | 'created' | 'image_uploaded' | 'quality_checking' | 'ai_processing' | 'failed';
}

export interface ScreeningReport extends ScreeningResult {
  phcName: string;
  phcCode: string;
  district: string;
  state: string;
  healthcareWorkerName: string;
  reportGeneratedAt: string;
}

export interface ScreeningFilters {
  search?: string;
  riskLevel?: string;
  drGrade?: string;
  dateFrom?: string;
  dateTo?: string;
}
