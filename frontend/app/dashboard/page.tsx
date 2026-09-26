'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Eye,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  PlusCircle,
  Search,
  Building2,
  Calendar,
} from 'lucide-react';
import { getScreeningHistory } from '@/lib/api/screening';
import { fetchReportsSummary, fetchScreenings } from '@/lib/api/backendClient';
import { getPHCProfile } from '@/lib/api/phc';
import { ScreeningResult, PHCProfile } from '@/lib/api/types';

export default function PHCDashboardPage() {
  const [screenings, setScreenings] = useState<ScreeningResult[]>([]);
  const [summary, setSummary] = useState<{
    totalScreenings: number;
    completedScreenings: number;
    qualityFailedScreenings: number;
    gradeDistribution: Record<string, number>;
    riskDistribution: Record<string, number>;
  } | null>(null);
  const [phc, setPHC] = useState<PHCProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'NO_DR' | 'AT_RISK' | 'REFERRALS'>('ALL');

  useEffect(() => {
    async function loadData() {
      try {
        const [summaryData, screeningsData, phcData] = await Promise.all([
          fetchReportsSummary(),
          fetchScreenings({ limit: 10 }),
          getPHCProfile(),
        ]);
        setSummary(summaryData);
        setScreenings(screeningsData.items);
        setPHC(phcData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalScreened = summary?.totalScreenings ?? screenings.length;
  const noDrCount = summary?.gradeDistribution?.['0'] ?? screenings.filter((s) => s.prediction?.grade === 0).length;
  const atRiskCount =
    (summary?.riskDistribution?.['high'] ?? 0) + (summary?.riskDistribution?.['urgent'] ?? 0) ||
    screenings.filter((s) => s.risk?.level === 'HIGH RISK' || s.risk?.level === 'URGENT' || s.risk?.level === 'MONITOR').length;
  const referralCount = atRiskCount;

  const filteredScreenings = screenings.filter((s) => {
    const matchesSearch =
      s.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.screeningId.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'NO_DR') return s.prediction?.grade === 0;
    if (activeFilter === 'AT_RISK') return s.risk?.level !== 'LOW RISK';
    if (activeFilter === 'REFERRALS') return s.risk?.level === 'HIGH RISK' || s.risk?.level === 'URGENT';
    return true;
  });

  // Mock data for 30-day workload trend chart
  const workloadData = [
    { day: '1', count: 12 },
    { day: '5', count: 18 },
    { day: '10', count: 15 },
    { day: '15', count: 24 },
    { day: '20', count: 28 },
    { day: '25', count: 32 },
    { day: '30', count: 38 },
  ];

  // ICDR DR Severity Distribution Data
  const severityDistribution = [
    { grade: 'Grade 0: No DR', count: noDrCount || 24, percent: 63, color: '#0F6E71', barClass: 'bg-petrol-600' },
    { grade: 'Grade 1: Mild DR', count: summary?.gradeDistribution?.['1'] || 6, percent: 16, color: '#F0B86E', barClass: 'bg-[#F0B86E]' },
    { grade: 'Grade 2: Moderate DR', count: summary?.gradeDistribution?.['2'] || 4, percent: 11, color: '#E8A048', barClass: 'bg-[#E8A048]' },
    { grade: 'Grade 3: Severe DR', count: summary?.gradeDistribution?.['3'] || 3, percent: 8, color: '#E08A2C', barClass: 'bg-saffron-500' },
    { grade: 'Grade 4: Proliferative DR', count: summary?.gradeDistribution?.['4'] || 1, percent: 2, color: '#B36615', barClass: 'bg-[#B36615]' },
  ];

  // Today's Waiting Patients Queue
  const todaysQueue = [
    { id: 'P-1092', name: 'Ramesh Patil', age: 58, gender: 'Male', diabetesYears: 8, waitingTime: '15 mins', status: 'Ready for camera' },
    { id: 'P-1093', name: 'Sunita Deshmukh', age: 62, gender: 'Female', diabetesYears: 12, waitingTime: '28 mins', status: 'Dilation in progress' },
    { id: 'P-1094', name: 'Prakash Kamble', age: 51, gender: 'Male', diabetesYears: 5, waitingTime: '35 mins', status: 'Vitals checked' },
  ];

  return (
    <div className="space-y-6 w-full">
      {/* Welcome Banner */}
      <div className="bg-petrol-900 text-white rounded-xl p-6 border border-line-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-200 text-xs font-medium border border-white/20">
            <Building2 className="w-3.5 h-3.5" />
            <span>{phc?.name || 'Alandi Rural Primary Health Centre'} ({phc?.code || 'PHC-001'})</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Diabetic Retinopathy Screening Overview
          </h1>
          <p className="text-slate-300 text-xs max-w-xl leading-relaxed">
            AI-assisted early triage and tele-ophthalmology referral portal for Community Health Officers.
          </p>
        </div>

        <div className="shrink-0 flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard/screening/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-petrol-600 hover:bg-[#0c595c] text-white font-semibold text-xs rounded-lg transition-colors border border-white/10 cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-4 h-4 text-white" />
            <span>+ New Patient Screening</span>
          </Link>
        </div>
      </div>

      {/* Row 1: Interactive Clickable Stat Tiles (4-col grid, 12px gap, 16px/20px padding) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Screened */}
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          className={`bg-paper-0 py-4 px-5 rounded-xl border transition-all text-left cursor-pointer ${
            activeFilter === 'ALL'
              ? 'border-petrol-600 ring-2 ring-petrol-600/20 bg-mist-100/30'
              : 'border-line-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total screened</span>
            <div className="w-8 h-8 rounded-lg bg-mist-100 border border-line-200 text-petrol-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-ink-900 tabular-nums mt-1">{totalScreened}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Click to view all evaluations</span>
        </button>

        {/* No DR (Normal) */}
        <button
          type="button"
          onClick={() => setActiveFilter('NO_DR')}
          className={`bg-paper-0 py-4 px-5 rounded-xl border transition-all text-left cursor-pointer ${
            activeFilter === 'NO_DR'
              ? 'border-petrol-600 ring-2 ring-petrol-600/20 bg-mist-100/30'
              : 'border-line-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">No DR (normal)</span>
            <div className="w-8 h-8 rounded-lg bg-mist-100 border border-line-200 text-teal-700 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-ink-900 tabular-nums mt-1">{noDrCount}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Annual routine follow-up</span>
        </button>

        {/* At Risk (DR Detected) */}
        <button
          type="button"
          onClick={() => setActiveFilter('AT_RISK')}
          className={`bg-paper-0 py-4 px-5 rounded-xl border transition-all text-left cursor-pointer ${
            activeFilter === 'AT_RISK'
              ? 'border-saffron-500 ring-2 ring-saffron-500/20 bg-saffron-500/5'
              : 'border-line-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">At risk (DR detected)</span>
            <div className="w-8 h-8 rounded-lg bg-saffron-500/10 border border-saffron-500/30 text-saffron-500 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#C2731B] tabular-nums mt-1">{atRiskCount}</div>
          <span className="text-[11px] text-saffron-500 font-medium mt-1 block">Requires clinical triage</span>
        </button>

        {/* Specialist Referrals */}
        <button
          type="button"
          onClick={() => setActiveFilter('REFERRALS')}
          className={`bg-paper-0 py-4 px-5 rounded-xl border transition-all text-left cursor-pointer ${
            activeFilter === 'REFERRALS'
              ? 'border-saffron-500 ring-2 ring-saffron-500/20 bg-saffron-500/5'
              : 'border-line-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Specialist referrals</span>
            <div className="w-8 h-8 rounded-lg bg-saffron-500/10 border border-saffron-500/30 text-saffron-500 flex items-center justify-center">
              <Eye className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-[#C2731B] tabular-nums mt-1">{referralCount}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">District hospital pipeline</span>
        </button>
      </div>

      {/* Row 2: Side-by-Side Clinical Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Screenings Workload Trend (Last 30 Days) */}
        <div className="bg-paper-0 rounded-xl border border-line-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-line-200 pb-3">
            <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
              <h2 className="text-sm font-bold text-ink-900">Screening workload trend (Last 30 days)</h2>
              <p className="text-[11px] text-slate-500">Daily CHO fundus evaluation volume</p>
            </div>
            <span className="text-xs font-semibold text-petrol-600 bg-mist-100 px-2.5 py-1 rounded-md border border-line-200">
              Avg: 26/day
            </span>
          </div>

          {/* SVG Smooth Area Chart */}
          <div className="h-44 w-full relative pt-2">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 400 120" preserveAspectRatio="none">
              <defs>
                <linearGradient id="petrolGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F6E71" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#0F6E71" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Horizontal Grid lines */}
              <line x1="0" y1="20" x2="400" y2="20" stroke="#DDE5E3" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="400" y2="60" stroke="#DDE5E3" strokeDasharray="3 3" />
              <line x1="0" y1="100" x2="400" y2="100" stroke="#DDE5E3" strokeDasharray="3 3" />

              {/* Gradient Fill */}
              <path
                d="M 0,100 L 0,80 Q 60,60 120,70 T 240,40 T 360,20 L 400,10 L 400,110 L 0,110 Z"
                fill="url(#petrolGradient)"
              />

              {/* Trend Line */}
              <path
                d="M 0,80 Q 60,60 120,70 T 240,40 T 360,20 L 400,10"
                fill="none"
                stroke="#0F6E71"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Data Points */}
              <circle cx="0" cy="80" r="3.5" fill="#0F6E71" />
              <circle cx="60" cy="65" r="3.5" fill="#0F6E71" />
              <circle cx="120" cy="70" r="3.5" fill="#0F6E71" />
              <circle cx="180" cy="50" r="3.5" fill="#0F6E71" />
              <circle cx="240" cy="40" r="3.5" fill="#0F6E71" />
              <circle cx="300" cy="30" r="3.5" fill="#0F6E71" />
              <circle cx="360" cy="20" r="3.5" fill="#0F6E71" />
              <circle cx="400" cy="10" r="4.5" fill="#0B3A3F" stroke="#FFFFFF" strokeWidth="2" />
            </svg>

            <div className="flex justify-between text-[10px] text-slate-400 pt-2 font-mono">
              <span>Day 1</span>
              <span>Day 7</span>
              <span>Day 14</span>
              <span>Day 21</span>
              <span>Day 30 (Today)</span>
            </div>
          </div>
        </div>

        {/* Chart 2: ICDR DR Severity Distribution Chart */}
        <div className="bg-paper-0 rounded-xl border border-line-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-line-200 pb-3">
            <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
              <h2 className="text-sm font-bold text-ink-900">ICDR severity distribution</h2>
              <p className="text-[11px] text-slate-500">Grad-CAM neural network DR grade breakdown</p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-mist-100 px-2.5 py-1 rounded-md border border-line-200">
              ICDR Scale
            </span>
          </div>

          {/* Horizontal Bar Breakdown */}
          <div className="space-y-3 pt-1">
            {severityDistribution.map((item) => (
              <div key={item.grade} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-ink-900">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.barClass}`} />
                    <span>{item.grade}</span>
                  </span>
                  <span className="font-mono text-slate-600">
                    {item.count} pts ({item.percent}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-mist-100 rounded-full overflow-hidden border border-line-200">
                  <div
                    className={`h-full ${item.barClass} transition-all duration-500`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Today's Screening Queue Card (Actionable TO-DO List) */}
      <div className="bg-paper-0 rounded-xl border border-line-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line-200 pb-4">
          <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
            <h2 className="text-sm font-bold text-ink-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-petrol-600" />
              <span>Today&apos;s registered screening queue</span>
            </h2>
            <p className="text-xs text-slate-500">Diabetic OPD patients waiting for retinal fundus camera exam</p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-petrol-600 bg-mist-100 px-3 py-1 rounded-full border border-line-200 self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            3 Patients Waiting
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {todaysQueue.map((patient) => (
            <div
              key={patient.id}
              className="p-4 rounded-xl bg-mist-100/50 border border-line-200 flex flex-col justify-between space-y-3 hover:bg-mist-100 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink-900 text-sm">{patient.name}</span>
                  <span className="text-[11px] font-mono text-slate-400">{patient.id}</span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-2">
                  <span>{patient.age} yrs &bull; {patient.gender}</span>
                  <span>&bull; DM: {patient.diabetesYears} yrs</span>
                </div>
                <div className="text-[11px] text-slate-600 pt-1 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-saffron-500" />
                  <span>Waiting: {patient.waitingTime} ({patient.status})</span>
                </div>
              </div>

              <Link
                href={`/dashboard/screening/new?patientId=${patient.id}`}
                className="w-full text-center py-2 px-3 bg-petrol-600 hover:bg-[#0c595c] text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Start screening exam</span>
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Row 4: Multi-PHC District Reporting Coverage Strip */}
      <div className="p-4 rounded-xl bg-petrol-900 text-white border border-line-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 text-teal-300 flex items-center justify-center border border-white/20 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <span>District Tele-Ophthalmology Network &bull; Pune Region</span>
              <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 text-[10px] border border-teal-500/30">
                District Active
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              3 of 5 PHCs (Alandi, Chakan, Khed) reporting active screenings this month &bull; 98.4% image quality compliance.
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/reports"
          className="shrink-0 px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-lg border border-white/20 transition-colors"
        >
          View District Reports &rarr;
        </Link>
      </div>

      {/* Row 5: Quick Search Bar & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper-0 p-4 rounded-xl border border-line-200">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search recent screenings by patient name, ID, or screening ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
          />
        </div>

        <div className="flex items-center gap-3">
          {activeFilter !== 'ALL' && (
            <button
              onClick={() => setActiveFilter('ALL')}
              className="text-xs font-semibold text-saffron-500 hover:underline bg-saffron-500/10 px-3 py-1.5 rounded-lg border border-saffron-500/30 cursor-pointer"
            >
              Clear Filter ({activeFilter}) &times;
            </button>
          )}

          <Link
            href="/dashboard/patients/register"
            className="px-3.5 py-2 bg-mist-100 hover:bg-slate-200 text-ink-900 text-xs font-semibold rounded-lg border border-line-200 transition-colors inline-flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span>+ Register New Patient</span>
          </Link>
          <Link
            href="/dashboard/screenings"
            className="px-3.5 py-2 bg-mist-100 hover:bg-slate-200 text-petrol-600 text-xs font-semibold rounded-lg border border-line-200 transition-colors inline-flex items-center gap-1.5"
          >
            <span>View All Archive</span>
            <ArrowRight className="w-3.5 h-3.5 text-petrol-600" />
          </Link>
        </div>
      </div>

      {/* Row 6: Recent Screenings Table */}
      <div className="bg-paper-0 rounded-xl border border-line-200 overflow-hidden">
        <div className="p-4 border-b border-line-200 flex items-center justify-between">
          <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
            <h2 className="text-sm font-bold text-ink-900 flex items-center gap-2">
              <span>Recent screening evaluations</span>
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredScreenings.length} records
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-3 border-petrol-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium">Loading PHC screening records...</p>
          </div>
        ) : filteredScreenings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Eye className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-ink-900">No matching screening records found</p>
            <p className="text-xs text-slate-500">Start by registering a patient or creating a new screening.</p>
            <Link
              href="/dashboard/screening/new"
              className="inline-block mt-2 px-4 py-2 bg-petrol-600 text-white text-xs font-semibold rounded-lg"
            >
              + Start First Screening
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-mist-100 text-slate-600 text-xs font-semibold border-b border-line-200">
                  <th className="py-2.5 px-4">Patient name</th>
                  <th className="py-2.5 px-4">Patient ID</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Eye</th>
                  <th className="py-2.5 px-4">AI DR screening</th>
                  <th className="py-2.5 px-4 w-40 text-right pr-6">Risk level</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-200">
                {filteredScreenings.map((s) => {
                  const isElevatedRisk = s.risk?.level !== 'LOW RISK';

                  return (
                    <tr key={s.screeningId} className="hover:bg-mist-100/60 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-ink-900">
                        {s.patientName}
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono text-slate-500">
                        {s.patientId}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(s.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 capitalize text-xs font-medium text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-mist-100 border border-line-200">
                          {s.eye} Eye
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {s.prediction ? (
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ink-900">
                              {s.prediction.label}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ({s.prediction.confidence}%)
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Quality issue</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 w-40 text-right pr-6">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isElevatedRisk
                              ? 'bg-saffron-500/10 text-[#B36615] border border-saffron-500/30'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {s.risk?.level || 'RECAPTURE'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Link
                          href={`/dashboard/screening/${s.screeningId}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-petrol-600 hover:text-petrol-900 bg-mist-100 hover:bg-slate-200 px-3 py-1 rounded-md border border-line-200 transition-colors"
                        >
                          <span>View result</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
