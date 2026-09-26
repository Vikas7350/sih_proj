export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface HealthAssessment {
  id: string;
  date: string;
  symptoms: string[];
  duration: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  age?: number;
  gender?: string;
  location?: string;
  riskLevel: RiskLevel;
  possibleCategory: string;
  summary: string;
  recommendedAction: string;
  recommendedFacility?: string;
  confidence?: string;
}

export interface Facility {
  id: string;
  name: string;
  distance: string;
  type: string;
  services: string[];
  isRecommended?: boolean;
  address: string;
  contact: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface HealthAlert {
  id: string;
  title: string;
  location: string;
  riskType: 'WARNING' | 'INFO' | 'ALERT';
  description: string;
  reportedCases: number;
  timestamp: string;
  category: string;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface SymptomFormInputs {
  age: number | string;
  gender: string;
  location: string;
  symptoms: string;
  duration: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
}
