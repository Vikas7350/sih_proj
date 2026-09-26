import { Patient } from './types';
import {
  fetchPatients,
  fetchPatient,
  createPatient as backendCreatePatient,
} from './backendClient';

export async function getPatients(searchQuery?: string, filterStatus?: string): Promise<Patient[]> {
  const { items } = await fetchPatients(searchQuery);
  return items;
}

export async function getPatientById(id: string): Promise<Patient | null> {
  try {
    // The backend uses patient_id (e.g. P-0001) — accept both formats
    return await fetchPatient(id);
  } catch {
    // If not found by patient_id, try fetching all and searching
    const { items } = await fetchPatients();
    return items.find((p) => p.patientId === id || p.id === id) || null;
  }
}

export async function registerPatient(
  patientData: Omit<Patient, 'id' | 'createdAt'>
): Promise<Patient> {
  return backendCreatePatient({
    name: patientData.name,
    age: patientData.age,
    gender: patientData.gender,
    diabetesDurationYears: patientData.diabetesDurationYears,
    contactNumber: patientData.contactNumber,
  });
}
