'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { User, Eye, Calendar, ArrowRight, ArrowLeft, History, PlusCircle } from 'lucide-react';
import { getPatientById } from '@/lib/api/patients';
import { getScreeningsByPatientId } from '@/lib/api/screening';
import { Patient, ScreeningResult } from '@/lib/api/types';

export default function PatientDetailsPage() {
  const pathname = usePathname();
  const patientIdParam = pathname.split('/').pop() || '';

  const [patient, setPatient] = useState<Patient | null>(null);
  const [screenings, setScreenings] = useState<ScreeningResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPatientData() {
      if (!patientIdParam) return;
      try {
        const [pData, sData] = await Promise.all([
          getPatientById(patientIdParam),
          getScreeningsByPatientId(patientIdParam),
        ]);
        setPatient(pData);
        setScreenings(sData);
      } catch (err) {
        console.error('Failed to load patient details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPatientData();
  }, [patientIdParam]);

  if (loading) {
    return (
      <div className="p-16 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Loading patient profile...</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-12 bg-white rounded-xl border border-slate-200 text-center space-y-4 max-w-md mx-auto">
        <User className="w-10 h-10 text-slate-300 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Patient Not Found</h2>
        <Link href="/dashboard/patients" className="inline-block px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg">
          Back to Patient List
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 mb-1">
            <span>Patient ID: {patient.patientId}</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <User className="w-6 h-6 text-teal-600" />
            <span>{patient.name}</span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/patients"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-2 rounded-lg flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Patients List</span>
          </Link>
          <Link
            href={`/dashboard/screening/new?patientId=${patient.id}`}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Start New Screening</span>
          </Link>
        </div>
      </div>

      {/* Patient Overview Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="space-y-1">
          <span className="text-slate-500 font-medium block">Age</span>
          <span className="text-base font-extrabold text-slate-900">{patient.age} Years</span>
        </div>
        <div className="space-y-1">
          <span className="text-slate-500 font-medium block">Gender</span>
          <span className="text-base font-extrabold text-slate-900">{patient.gender}</span>
        </div>
        <div className="space-y-1">
          <span className="text-slate-500 font-medium block">Diabetes Duration</span>
          <span className="text-base font-extrabold text-teal-700">{patient.diabetesDurationYears} Years</span>
        </div>
        <div className="space-y-1">
          <span className="text-slate-500 font-medium block">Contact Number</span>
          <span className="text-base font-mono font-bold text-slate-800">{patient.contactNumber || 'N/A'}</span>
        </div>
      </div>

      {/* Screening History Timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <History className="w-4 h-4 text-teal-600" />
          <span>Screening Assessment History</span>
        </h2>

        {screenings.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-2">
            <p>No screening records found for this patient.</p>
            <Link
              href={`/dashboard/screening/new?patientId=${patient.id}`}
              className="inline-block px-3.5 py-1.5 bg-teal-600 text-white font-semibold rounded-lg text-xs"
            >
              Perform First Screening
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {screenings.map((s) => (
              <div
                key={s.screeningId}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 capitalize">{s.eye} Eye Exam</span>
                    <span className="text-slate-400">&bull;</span>
                    <span className="text-slate-500 flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{s.prediction?.label || 'Quality Issue'}</span>
                    {s.prediction && <span className="text-slate-400 font-mono">({s.prediction.confidence}%)</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      s.risk?.level === 'HIGH RISK' || s.risk?.level === 'URGENT'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    {s.risk?.level || 'RECAPTURE'}
                  </span>

                  <Link
                    href={`/dashboard/screening/${s.screeningId}`}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 bg-white px-3 py-1.5 rounded-md border border-slate-200 flex items-center gap-1"
                  >
                    <span>View Result</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
