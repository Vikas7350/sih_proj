'use client';

import { useState, useEffect, useMemo } from 'react';
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
  Clock,
  Send,
  PhoneOff,
  CalendarClock,
  ShieldAlert,
  ChevronRight,
  UserCheck,
} from 'lucide-react';
import { fetchReportsSummary, fetchScreenings } from '@/lib/api/backendClient';
import { getRemindersSummary, getReminders } from '@/lib/api/reminders';
import { getPHCProfile } from '@/lib/api/phc';
import { getPatients } from '@/lib/api/patients';
import { ScreeningResult, PHCProfile, ReminderSummary, PatientReminder, Patient } from '@/lib/api/types';

export default function PHCDashboardPage() {
  const [screenings, setScreenings] = useState<ScreeningResult[]>([]);
  const [summary, setSummary] = useState<{
    totalScreenings: number;
    completedScreenings: number;
    qualityFailedScreenings: number;
    gradeDistribution: Record<string, number>;
    riskDistribution: Record<string, number>;
  } | null>(null);
  const [remindersSummary, setRemindersSummary] = useState<ReminderSummary | null>(null);
  const [attentionReminders, setAttentionReminders] = useState<PatientReminder[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [phc, setPHC] = useState<PHCProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'NO_DR' | 'AT_RISK' | 'REFERRALS'>('ALL');

  useEffect(() => {
    async function loadData() {
      try {
        const [summaryData, screeningsData, phcData, remSumData, allReminders, patientsData] = await Promise.all([
          fetchReportsSummary().catch(() => null),
          fetchScreenings({ limit: 50 }).catch(() => ({ items: [], total: 0, pages: 1 })),
          getPHCProfile().catch(() => null),
          getRemindersSummary().catch(() => null),
          getReminders({ limit: 100 }).catch(() => ({ items: [], total: 0, pages: 1 })),
          getPatients().catch(() => []),
        ]);
        setSummary(summaryData);
        setScreenings(screeningsData.items);
        setPHC(phcData);
        setRemindersSummary(remSumData);
        setPatients(patientsData);

        // Filter reminders that need CHO attention
        const attentionItems = allReminders.items.filter((r) => {
          const isFailedSMS = r.notificationStatus === 'failed';
          const isMissingMobile = r.notificationStatus === 'no_contact' || !r.patientPhone;
          const isUrgentReferral = r.isUrgent || (r.drGrade !== undefined && r.drGrade >= 3);
          const isDueOrOverdue = r.status === 'scheduled' && r.scheduledDate <= new Date().toISOString().split('T')[0];
          return isFailedSMS || isMissingMobile || (isUrgentReferral && r.referralStatus !== 'attended') || isDueOrOverdue;
        });
        setAttentionReminders(attentionItems.slice(0, 5));
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Screenings completed today
  const todayScreenings = useMemo(() => {
    return screenings.filter((s) => {
      if (!s.date) return false;
      const sDate = s.date.split('T')[0];
      return sDate === todayStr;
    });
  }, [screenings, todayStr]);

  const totalScreened = summary?.totalScreenings ?? screenings.length;
  const noDrCount = summary?.gradeDistribution?.['0'] ?? screenings.filter((s) => s.prediction?.grade === 0).length;
  const atRiskCount =
    (summary?.riskDistribution?.['high'] ?? 0) + (summary?.riskDistribution?.['urgent'] ?? 0) ||
    screenings.filter((s) => s.risk?.level === 'HIGH RISK' || s.risk?.level === 'URGENT' || s.risk?.level === 'MONITOR').length;
  const referralCount =
    (summary?.riskDistribution?.['urgent'] ?? 0) ||
    screenings.filter((s) => s.risk?.level === 'URGENT' || (s.prediction?.grade !== undefined && s.prediction.grade >= 3)).length;

  // Real Severity Distribution based strictly on actual data
  const severityDistribution = useMemo(() => {
    const total = totalScreened || 1;
    const g0 = summary?.gradeDistribution?.['0'] ?? screenings.filter((s) => s.prediction?.grade === 0).length;
    const g1 = summary?.gradeDistribution?.['1'] ?? screenings.filter((s) => s.prediction?.grade === 1).length;
    const g2 = summary?.gradeDistribution?.['2'] ?? screenings.filter((s) => s.prediction?.grade === 2).length;
    const g3 = summary?.gradeDistribution?.['3'] ?? screenings.filter((s) => s.prediction?.grade === 3).length;
    const g4 = summary?.gradeDistribution?.['4'] ?? screenings.filter((s) => s.prediction?.grade === 4).length;

    return [
      { grade: 'Grade 0: No DR', count: g0, percent: totalScreened ? Math.round((g0 / total) * 100) : 0, barClass: 'bg-emerald-600' },
      { grade: 'Grade 1: Mild DR', count: g1, percent: totalScreened ? Math.round((g1 / total) * 100) : 0, barClass: 'bg-teal-600' },
      { grade: 'Grade 2: Moderate DR', count: g2, percent: totalScreened ? Math.round((g2 / total) * 100) : 0, barClass: 'bg-amber-500' },
      { grade: 'Grade 3: Severe DR', count: g3, percent: totalScreened ? Math.round((g3 / total) * 100) : 0, barClass: 'bg-orange-600' },
      { grade: 'Grade 4: Proliferative DR', count: g4, percent: totalScreened ? Math.round((g4 / total) * 100) : 0, barClass: 'bg-rose-700' },
    ];
  }, [summary, screenings, totalScreened]);

  // Patients recently registered who might be waiting for screening
  const pendingPatients = useMemo(() => {
    const screenedPatientIds = new Set(screenings.map((s) => s.patientId));
    return patients.filter((p) => !screenedPatientIds.has(p.id) && !screenedPatientIds.has(p.patientId)).slice(0, 3);
  }, [patients, screenings]);

  const filteredScreenings = useMemo(() => {
    return screenings.filter((s) => {
      const matchesSearch =
        !searchTerm ||
        s.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.patientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.screeningId.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (activeFilter === 'NO_DR') return s.prediction?.grade === 0;
      if (activeFilter === 'AT_RISK') return s.risk?.level !== 'LOW RISK';
      if (activeFilter === 'REFERRALS') return s.risk?.level === 'HIGH RISK' || s.risk?.level === 'URGENT';
      return true;
    });
  }, [screenings, searchTerm, activeFilter]);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      {/* Header Operational Workspace Banner */}
      <div className="bg-petrol-900 text-white rounded-2xl p-6 sm:p-7 border border-line-200 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-teal-200 text-xs font-medium border border-white/20">
            <Building2 className="w-3.5 h-3.5" />
            <span>{phc?.name || 'Primary Health Centre'} ({phc?.code || 'PHC-001'})</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Diabetic Retinopathy Screening Workspace
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
            AI-assisted triage, MATLAB structural retinal analysis, and automated tele-ophthalmology follow-ups for Primary Health Centres.
          </p>
        </div>

        <div className="shrink-0 flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard/screening/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-colors shadow-md cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            <span>+ New Patient Screening</span>
          </Link>
        </div>
      </div>

      {/* 1. TODAY'S WORKLOAD & KPI TILES */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Screened */}
        <button
          type="button"
          onClick={() => setActiveFilter('ALL')}
          className={`bg-paper-0 p-5 rounded-2xl border transition-all text-left cursor-pointer shadow-xs ${
            activeFilter === 'ALL'
              ? 'border-petrol-600 ring-2 ring-petrol-600/20 bg-mist-100/30'
              : 'border-line-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Screened</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 text-petrol-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-ink-900 tabular-nums mt-2">{totalScreened}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {todayScreenings.length} completed today
          </div>
        </button>

        {/* No DR (Normal) */}
        <button
          type="button"
          onClick={() => setActiveFilter('NO_DR')}
          className={`bg-paper-0 p-5 rounded-2xl border transition-all text-left cursor-pointer shadow-xs ${
            activeFilter === 'NO_DR'
              ? 'border-teal-600 ring-2 ring-teal-600/20 bg-teal-50/30'
              : 'border-line-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">No DR (Routine)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-700 tabular-nums mt-2">{noDrCount}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            {totalScreened ? `${Math.round((noDrCount / totalScreened) * 100)}% of screened` : 'Annual routine recall'}
          </div>
        </button>

        {/* At Risk (DR Detected) */}
        <button
          type="button"
          onClick={() => setActiveFilter('AT_RISK')}
          className={`bg-paper-0 p-5 rounded-2xl border transition-all text-left cursor-pointer shadow-xs ${
            activeFilter === 'AT_RISK'
              ? 'border-saffron-500 ring-2 ring-saffron-500/20 bg-saffron-500/5'
              : 'border-line-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">At Risk (DR Found)</span>
            <div className="w-8 h-8 rounded-lg bg-saffron-500/10 border border-saffron-500/30 text-saffron-500 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#C2731B] tabular-nums mt-2">{atRiskCount}</div>
          <div className="text-[11px] text-[#C2731B] font-medium mt-1">
            Grades 1 to 4 under monitoring
          </div>
        </button>

        {/* Urgent Referrals / Due Today */}
        <Link
          href="/dashboard/reminders"
          className="bg-paper-0 p-5 rounded-2xl border border-line-200 hover:border-slate-300 transition-all text-left cursor-pointer shadow-xs block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Follow-Ups &amp; Recalls</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-indigo-700 tabular-nums mt-2">
            {remindersSummary?.total || 0}
          </div>
          <div className="text-[11px] text-indigo-700 font-medium mt-1">
            {remindersSummary?.dueToday || 0} due today &bull; {remindersSummary?.urgentReferrals || referralCount} referrals
          </div>
        </Link>
      </div>

      {/* 2. NEEDS ATTENTION SECTION (Render ONLY when there are active attention items) */}
      {attentionReminders.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <h2 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                Needs Attention — Follow-ups, Referrals &amp; Missing Contacts
              </h2>
            </div>
            <Link
              href="/dashboard/reminders"
              className="text-xs font-bold text-amber-900 hover:underline flex items-center gap-1"
            >
              <span>View All in Follow-up Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {attentionReminders.map((item) => {
              const isMissingPhone = !item.patientPhone || item.notificationStatus === 'no_contact';
              const isUrgent = item.isUrgent || (item.drGrade !== undefined && item.drGrade >= 3);

              return (
                <div
                  key={item.reminderId}
                  className="p-3 bg-white rounded-xl border border-amber-200 text-xs flex flex-col justify-between space-y-2 shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{item.patientName}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                        {item.patientId}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-snug">{item.purpose}</p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px]">
                    <span className="font-medium text-slate-500">
                      Due: <strong className="text-slate-800">{item.scheduledDate}</strong>
                    </span>

                    {isMissingPhone ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                        ⚠️ Missing Mobile
                      </span>
                    ) : isUrgent ? (
                      <span className="text-[10px] font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                        🚨 Urgent Referral
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                        Due for recall
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. ICDR Severity Distribution Card (Real data, honest empty state) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Distribution */}
        <div className="lg:col-span-2 bg-paper-0 rounded-2xl border border-line-200 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-line-200 pb-3">
            <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
              <h2 className="text-sm font-bold text-ink-900">ICDR DR Severity Distribution</h2>
              <p className="text-[11px] text-slate-500">Classification breakdown across all recorded PHC screenings</p>
            </div>
            <span className="text-xs font-semibold text-slate-600 bg-mist-100 px-2.5 py-1 rounded-md border border-line-200">
              Total: {totalScreened} patients
            </span>
          </div>

          {totalScreened === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Eye className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-600">No screening records recorded yet</p>
              <p className="text-[11px] text-slate-400">Severity distribution chart will populate automatically as screenings are completed.</p>
            </div>
          ) : (
            <div className="space-y-3.5 pt-1">
              {severityDistribution.map((item) => (
                <div key={item.grade} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-ink-900">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${item.barClass}`} />
                      <span>{item.grade}</span>
                    </span>
                    <span className="font-mono text-slate-600">
                      {item.count} patients ({item.percent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-mist-100 rounded-full overflow-hidden border border-line-200">
                    <div
                      className={`h-full ${item.barClass} transition-all duration-500`}
                      style={{ width: `${Math.max(item.percent, item.count > 0 ? 3 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Queue / Quick Action */}
        <div className="bg-paper-0 rounded-2xl border border-line-200 p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
              <h2 className="text-sm font-bold text-ink-900">Patient Screening Queue</h2>
              <p className="text-[11px] text-slate-500">Registered patients awaiting fundus imaging</p>
            </div>

            {pendingPatients.length === 0 ? (
              <div className="p-6 text-center space-y-2 rounded-xl bg-mist-100/50 border border-line-200">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                <p className="text-xs font-bold text-ink-900">Queue is Clear</p>
                <p className="text-[11px] text-slate-500">All registered patients have completed initial evaluation.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {pendingPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="p-3 rounded-xl bg-mist-100/50 border border-line-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{patient.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {patient.patientId} &bull; {patient.age}y &bull; {patient.gender}
                      </span>
                    </div>

                    <Link
                      href={`/dashboard/screening/new?patientId=${patient.id}`}
                      className="px-2.5 py-1 bg-petrol-600 hover:bg-[#0c595c] text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
                    >
                      Screen &rarr;
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/dashboard/patients/register"
            className="w-full text-center py-2 px-3 bg-mist-100 hover:bg-slate-200 text-petrol-900 text-xs font-bold rounded-xl border border-line-200 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5 text-petrol-600" />
            <span>+ Register New Patient</span>
          </Link>
        </div>
      </div>

      {/* 4. RECENT SCREENINGS WORKSPACE & ARCHIVE TABLE */}
      <div className="bg-paper-0 rounded-2xl border border-line-200 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-line-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
            <h2 className="text-sm font-bold text-ink-900">Recent Screening Records</h2>
            <p className="text-xs text-slate-500">Verified clinical evaluations and AI triage outputs</p>
          </div>

          <div className="flex items-center gap-3">
            {activeFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setActiveFilter('ALL')}
                className="text-xs font-semibold text-saffron-500 hover:underline bg-saffron-500/10 px-3 py-1.5 rounded-lg border border-saffron-500/30 cursor-pointer"
              >
                Clear Filter ({activeFilter}) &times;
              </button>
            )}

            <div className="relative max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search patient, ID, screening..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 text-ink-900"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-3 border-petrol-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading PHC screening records...</p>
          </div>
        ) : filteredScreenings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Eye className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-ink-900">No screening records recorded</p>
            <p className="text-xs text-slate-500">Begin by uploading a patient&apos;s retinal fundus scan.</p>
            <Link
              href="/dashboard/screening/new"
              className="inline-block mt-2 px-4 py-2 bg-petrol-600 text-white text-xs font-semibold rounded-lg"
            >
              + Start First Screening
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-mist-100 text-slate-600 font-semibold border-b border-line-200">
                  <th className="py-2.5 px-4">Patient Name</th>
                  <th className="py-2.5 px-4">Patient ID</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Eye</th>
                  <th className="py-2.5 px-4">DR Prediction</th>
                  <th className="py-2.5 px-4 w-36 text-center">Risk Level</th>
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
                      <td className="py-2.5 px-4 font-mono text-slate-500">
                        {s.patientId}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        <span className="flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {new Date(s.date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 capitalize font-medium text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-mist-100 border border-line-200 font-mono">
                          {s.eye}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {s.prediction ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-ink-900">
                              {s.prediction.label}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              (Gr. {s.prediction.grade})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Quality check issue</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 w-36 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isElevatedRisk
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {s.risk?.level || 'RECAPTURE'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Link
                          href={`/dashboard/screening/${s.screeningId}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-petrol-600 hover:text-petrol-900 bg-mist-100 hover:bg-slate-200 px-2.5 py-1 rounded-md border border-line-200 transition-colors"
                        >
                          <span>View result</span>
                          <ArrowRight className="w-3 h-3" />
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

