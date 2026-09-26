'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, ArrowRight, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { registerPatient } from '@/lib/api/patients';

export default function PatientRegistrationPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [patientIdInput, setPatientIdInput] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Female');
  const [diabetesDurationYears, setDiabetesDurationYears] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !age || !diabetesDurationYears) return;

    setSubmitting(true);

    try {
      const created = await registerPatient({
        patientId: patientIdInput.trim() || `PAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        name: name.trim(),
        age: parseInt(age, 10),
        gender,
        diabetesDurationYears: parseInt(diabetesDurationYears, 10),
        contactNumber: contactNumber.trim() || undefined,
      });

      setSuccessMsg(true);

      setTimeout(() => {
        router.push(`/dashboard/screening/new?patientId=${created.id}`);
      }, 600);
    } catch (err) {
      console.error('Failed to register patient:', err);
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-line-200">
        <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight flex items-center gap-2">
            <span>Patient registration</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Register a diabetic patient at the Primary Health Centre for DR screening.
          </p>
        </div>

        <Link
          href="/dashboard/patients"
          className="text-xs font-semibold text-slate-600 hover:text-ink-900 bg-mist-100 px-3 py-1.5 rounded-lg border border-line-200 flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Patient list</span>
        </Link>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Patient registered successfully! Redirecting to new screening...</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-paper-0 p-6 rounded-xl border border-line-200 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">Full name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Savitri Devi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">Patient ID (optional / auto-generated)</label>
            <input
              type="text"
              placeholder="e.g. PAT-2026-0895"
              value={patientIdInput}
              onChange={(e) => setPatientIdInput(e.target.value)}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 font-mono text-ink-900"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">Age (years) *</label>
            <input
              type="number"
              required
              min="1"
              max="120"
              placeholder="e.g. 58"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">Gender *</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as any)}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">Diabetes duration (years) *</label>
            <input
              type="number"
              required
              min="0"
              placeholder="e.g. 8"
              value={diabetesDurationYears}
              onChange={(e) => setDiabetesDurationYears(e.target.value)}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">Contact number (optional)</label>
            <input
              type="tel"
              placeholder="e.g. +91 98765 43210"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 font-mono text-ink-900"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 px-6 bg-petrol-600 hover:bg-[#0c595c] text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Registering...</span>
            </>
          ) : (
            <>
              <span>Continue to screening</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
