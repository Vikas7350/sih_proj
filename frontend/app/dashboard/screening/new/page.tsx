'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  UploadCloud,
  FileImage,
  Eye,
  AlertCircle,
  X,
  CheckCircle2,
  Users,
  Loader2,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
} from 'lucide-react';
import { getPatients, registerPatient } from '@/lib/api/patients';
import { createScreening } from '@/lib/api/screening';
import { Patient } from '@/lib/api/types';

export default function NewScreeningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId');

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(preselectedPatientId || '');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  
  // Quick inline registration state if patient not yet registered
  const [showQuickRegister, setShowQuickRegister] = useState(false);
  const [quickRegistering, setQuickRegistering] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientAge, setNewPatientAge] = useState('');
  const [newPatientGender, setNewPatientGender] = useState<'Male' | 'Female' | 'Other'>('Female');
  const [newDiabetesYears, setNewDiabetesYears] = useState('');
  const [newPatientContact, setNewPatientContact] = useState('');

  // Eye selection
  const [eye, setEye] = useState<'left' | 'right'>('right');

  // Image Upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Submission loading state
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadPatientsList() {
      try {
        const list = await getPatients();
        setPatients(list);
        if (preselectedPatientId) {
          const match = list.find((p) => p.id === preselectedPatientId || p.patientId === preselectedPatientId);
          if (match) setSelectedPatient(match);
        } else if (list.length > 0) {
          setSelectedPatientId(list[0].id);
          setSelectedPatient(list[0]);
        }
      } catch (err) {
        console.error('Failed to load patients:', err);
      }
    }
    loadPatientsList();
  }, [preselectedPatientId]);

  const handlePatientSelect = (id: string) => {
    setSelectedPatientId(id);
    const match = patients.find((p) => p.id === id || p.patientId === id);
    setSelectedPatient(match || null);
  };

  const handleQuickRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName || !newPatientAge || !newDiabetesYears) return;

    setQuickRegistering(true);
    try {
      const created = await registerPatient({
        patientId: `PAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        name: newPatientName.trim(),
        age: parseInt(newPatientAge, 10),
        gender: newPatientGender,
        diabetesDurationYears: parseInt(newDiabetesYears, 10),
        contactNumber: newPatientContact.trim() || undefined,
      });
      setPatients((prev) => [created, ...prev]);
      setSelectedPatientId(created.id);
      setSelectedPatient(created);
      setShowQuickRegister(false);
      setNewPatientName('');
      setNewPatientAge('');
      setNewDiabetesYears('');
      setNewPatientContact('');
    } catch (err) {
      console.error('Failed to quick-register patient:', err);
    } finally {
      setQuickRegistering(false);
    }
  };

  // Image validation and handling
  const handleFileChange = (file: File | null) => {
    setFileError(null);
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      setFileError('Invalid file format. Please upload a JPG, JPEG, or PNG fundus image.');
      return;
    }

    const maxSizeMb = 10;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setFileError(`File size exceeds ${maxSizeMb}MB limits. Please upload a smaller image.`);
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!selectedPatientId) {
      setFileError('Please select or register a patient first.');
      return;
    }

    if (!imagePreview) {
      setFileError('Please upload or select a retinal fundus image before starting screening.');
      return;
    }

    setAnalyzing(true);
    setAnalysisStep('Uploading retinal fundus image to screening server...');

    try {
      const stepTimer1 = setTimeout(() => {
        setAnalysisStep('Stage 0: Fundus Image Validation (checking anatomical field and lighting)...');
      }, 1500);

      const stepTimer2 = setTimeout(() => {
        setAnalysisStep('Stage 1: Image quality assessment & CLAHE illumination enhancement...');
      }, 4500);

      const stepTimer3 = setTimeout(() => {
        setAnalysisStep('Stage 3: EfficientNet-B0 DR classification & MATLAB Retinal Morphology extraction...');
      }, 8500);

      const result = await createScreening(
        selectedPatientId,
        eye,
        imagePreview
      );

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);

      router.push(`/dashboard/screening/${result.screeningId}`);
    } catch (err) {
      console.error('Screening failed:', err);
      setFileError('Failed to complete retinal AI screening. Please verify the image file and retry.');
      setAnalyzing(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header & Guided Workflow Indicator */}
      <div className="flex flex-col gap-4 pb-4 border-b border-line-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-petrol-600 mb-0.5">
              <Eye className="w-4 h-4" />
              <span>Primary Health Centre Clinical Workflow</span>
            </div>
            <h1 className="text-2xl font-bold text-ink-900 tracking-tight">
              New Retinal Screening Workflow
            </h1>
          </div>

          <Link
            href="/dashboard"
            className="text-xs font-semibold text-slate-600 hover:text-ink-900 bg-mist-100 px-3 py-1.5 rounded-lg border border-line-200 w-fit"
          >
            &larr; Back to dashboard
          </Link>
        </div>

        {/* 4-Step Clinical Breadcrumb / Workflow Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 font-bold ${
            selectedPatientId ? 'bg-petrol-50 border-petrol-300 text-petrol-900' : 'bg-white border-line-200 text-ink-900'
          }`}>
            <span className="w-5 h-5 rounded-full bg-petrol-600 text-white flex items-center justify-center text-[10px]">1</span>
            <span>Patient</span>
          </div>
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 font-bold ${
            imagePreview ? 'bg-petrol-50 border-petrol-300 text-petrol-900' : 'bg-mist-100 border-line-200 text-slate-500'
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
              imagePreview ? 'bg-petrol-600 text-white' : 'bg-slate-300 text-slate-700'
            }`}>2</span>
            <span>Capture / Upload</span>
          </div>
          <div className={`p-2.5 rounded-xl border flex items-center gap-2 font-bold ${
            analyzing ? 'bg-teal-50 border-teal-300 text-teal-900' : 'bg-mist-100 border-line-200 text-slate-500'
          }`}>
            <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[10px]">3</span>
            <span>Analyze</span>
          </div>
          <div className="p-2.5 rounded-xl border bg-mist-100 border-line-200 text-slate-500 flex items-center gap-2 font-bold">
            <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-700 flex items-center justify-center text-[10px]">4</span>
            <span>Review &amp; Protocol</span>
          </div>
        </div>
      </div>

      {/* Analysis Overlay Progress Modal */}
      {analyzing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-paper-0 rounded-2xl p-8 max-w-md w-full text-center space-y-6 border border-line-200 shadow-2xl">
            {/* Iris Scan Progress Ring Motif */}
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-petrol-600/30 animate-ping" />
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-petrol-600 animate-spin" />
              <div className="w-10 h-10 rounded-full bg-petrol-900 border-2 border-teal-400 text-teal-300 flex items-center justify-center z-10">
                <Eye className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-ink-900">NetraCare Retinal AI &amp; MATLAB Pipeline</h3>
              <p className="text-xs text-slate-600 font-medium">{analysisStep}</p>
            </div>

            <div className="w-full bg-mist-100 h-2 rounded-full overflow-hidden">
              <div className="bg-petrol-600 h-full animate-pulse rounded-full w-full" />
            </div>

            <div className="p-3 rounded-lg bg-mist-100 border border-line-200 text-[11px] text-slate-600 flex items-center gap-2 text-left">
              <ShieldCheck className="w-4 h-4 text-petrol-600 shrink-0" />
              <span>Pipeline: Stage 0 Validation &bull; Stage 1 CLAHE Preprocessing &bull; Stage 3 EfficientNet &amp; MATLAB extraction.</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Form Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Patient Selection & Eye Selector */}
        <div className="space-y-6">
          {/* Patient Card / Selector */}
          <div className="bg-paper-0 p-5 rounded-xl border border-line-200 space-y-4">
            <div className="flex items-center justify-between border-l-[3px] border-petrol-600 pl-3 py-0.5">
              <h2 className="text-sm font-bold text-ink-900 flex items-center gap-2">
                <span>Patient context</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowQuickRegister(!showQuickRegister)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-petrol-600 hover:bg-[#0c595c] transition-all cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>{showQuickRegister ? 'Select existing' : '+ Register new'}</span>
              </button>
            </div>

            {!showQuickRegister ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-ink-900 mb-1">Select patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => handlePatientSelect(e.target.value)}
                  className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 text-ink-900"
                >
                  <option value="">-- Choose patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.patientId}) - Age {p.age}
                    </option>
                  ))}
                </select>

                {selectedPatient && (
                  <div className="p-3 rounded-lg bg-mist-100 border border-line-200 space-y-1.5 text-xs text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Patient ID:</span>
                      <span className="font-mono font-semibold text-ink-900">{selectedPatient.patientId}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Age / Gender:</span>
                      <span className="font-medium text-ink-900">{selectedPatient.age} yrs &bull; {selectedPatient.gender}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Diabetes duration:</span>
                      <span className="font-semibold text-petrol-600">{selectedPatient.diabetesDurationYears} years</span>
                    </div>
                    {selectedPatient.contactNumber ? (
                      <div className="flex justify-between items-center pt-1.5 border-t border-line-200">
                        <span className="text-slate-500">Mobile (SMS):</span>
                        <span className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px] flex items-center gap-1">
                          📱 {selectedPatient.contactNumber}
                        </span>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center pt-1.5 border-t border-line-200">
                        <span className="text-slate-500">Mobile (SMS):</span>
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                          No phone registered
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleQuickRegister} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-ink-900 mb-1">Full name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Savitri Devi"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    className="w-full p-2 bg-mist-100/50 border border-line-200 rounded-lg text-ink-900"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold text-ink-900 mb-1">Age *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="120"
                      placeholder="e.g. 58"
                      value={newPatientAge}
                      onChange={(e) => setNewPatientAge(e.target.value)}
                      className="w-full p-2 bg-mist-100/50 border border-line-200 rounded-lg text-ink-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-ink-900 mb-1">Gender *</label>
                    <select
                      value={newPatientGender}
                      onChange={(e) => setNewPatientGender(e.target.value as any)}
                      className="w-full p-2 bg-mist-100/50 border border-line-200 rounded-lg text-ink-900"
                    >
                      <option value="Female">Female</option>
                      <option value="Male">Male</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block font-semibold text-ink-900 mb-1">Diabetes duration (years) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 8"
                    value={newDiabetesYears}
                    onChange={(e) => setNewDiabetesYears(e.target.value)}
                    className="w-full p-2 bg-mist-100/50 border border-line-200 rounded-lg text-ink-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-ink-900 mb-1">
                    Mobile number (for SMS follow-up reminders) *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. +91 98765 43210 or 9876543210"
                    value={newPatientContact}
                    onChange={(e) => setNewPatientContact(e.target.value)}
                    className="w-full p-2 bg-mist-100/50 border border-line-200 rounded-lg text-ink-900"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Used to send automated SMS appointment notices & DR check-up reminders.
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={quickRegistering}
                  className="w-full py-2 bg-petrol-600 hover:bg-[#0c595c] text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {quickRegistering ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save & select patient</span>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Eye Selection Toggle */}
          <div className="bg-paper-0 p-5 rounded-xl border border-line-200 space-y-3">
            <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
              <label className="block text-xs font-bold text-ink-900">
                Select eye examined
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setEye('left')}
                className={`py-3 px-4 rounded-xl border text-center font-semibold text-xs transition-all cursor-pointer ${
                  eye === 'left'
                    ? 'bg-mist-100 border-petrol-600 text-petrol-600'
                    : 'bg-paper-0 border-line-200 text-slate-600 hover:bg-mist-100'
                }`}
              >
                Left eye (OS)
              </button>
              <button
                type="button"
                onClick={() => setEye('right')}
                className={`py-3 px-4 rounded-xl border text-center font-semibold text-xs transition-all cursor-pointer ${
                  eye === 'right'
                    ? 'bg-mist-100 border-petrol-600 text-petrol-600'
                    : 'bg-paper-0 border-line-200 text-slate-600 hover:bg-mist-100'
                }`}
              >
                Right eye (OD)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Retinal Fundus Image Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-paper-0 p-6 rounded-xl border border-line-200 space-y-4">
            <div className="flex items-center justify-between border-l-[3px] border-petrol-600 pl-3 py-0.5">
              <h2 className="text-sm font-bold text-ink-900">
                Retinal fundus image upload
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                Supports JPG, JPEG, PNG (Max 10MB)
              </span>
            </div>

            {fileError && (
              <div className="p-3 rounded-lg bg-saffron-500/10 border border-saffron-500/30 text-[#B36615] text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-saffron-500 shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
              className="hidden"
            />

            {!imagePreview ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileChange(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-petrol-600 bg-mist-100/60 scale-[0.99]'
                    : 'border-line-200 hover:border-petrol-600 hover:bg-mist-100/50'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-mist-100 border border-line-200 text-petrol-600 flex items-center justify-center mx-auto mb-3">
                  <UploadCloud className="w-7 h-7" />
                </div>

                <h3 className="text-sm font-bold text-ink-900 mb-1">
                  Drag and drop retinal fundus image here
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                  or click to select file from your computer / connected PHC store.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-slate-900 border border-line-200 max-h-96 flex items-center justify-center p-2">
                  <img
                    src={imagePreview}
                    alt="Fundus Preview"
                    className="max-h-88 object-contain rounded-xl"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-4 right-4 p-2 bg-slate-900/80 hover:bg-rose-600 text-white rounded-full transition-colors"
                    title="Remove image"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="absolute bottom-4 left-4 bg-slate-900/80 backdrop-blur-xs text-white px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{imageFile?.name || 'fundus_retinal_scan.png'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 bg-mist-100 p-3 rounded-lg border border-line-200">
                  <span>File ready: <strong className="text-ink-900">{imageFile?.name || 'Selected Fundus Scan'}</strong></span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-petrol-600 font-semibold hover:underline cursor-pointer"
                  >
                    Change image
                  </button>
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              disabled={!selectedPatientId || !imagePreview || analyzing}
              onClick={handleAnalyze}
              className={`w-full py-4 px-6 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
                !selectedPatientId || !imagePreview || analyzing
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-petrol-600 hover:bg-[#0c595c] text-white'
              }`}
            >
              <span>Analyze retinal image with EfficientNet</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
