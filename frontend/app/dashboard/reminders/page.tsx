'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Search,
  Filter,
  PhoneOff,
  Building2,
  Mail,
  UserCheck,
} from 'lucide-react';
import { getReminders, getRemindersSummary, sendReminderNotification } from '@/lib/api/reminders';
import { getPatients } from '@/lib/api/patients';
import { PatientReminder, ReminderSummary, Patient } from '@/lib/api/types';
import ReminderList from '@/components/reminders/ReminderList';
import ScheduleReminderModal from '@/components/reminders/ScheduleReminderModal';

type DashboardTab = 'all' | 'upcoming' | 'urgent' | 'sms_history';

export default function RemindersDashboardPage() {
  const [reminders, setReminders] = useState<PatientReminder[]>([]);
  const [summary, setSummary] = useState<ReminderSummary | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('all');

  // Search and Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [remData, sumData, patData] = await Promise.all([
        getReminders({ limit: 200 }),
        getRemindersSummary(),
        getPatients(),
      ]);
      setReminders(remData.items);
      setSummary(sumData);
      setPatients(patData);
    } catch (err) {
      console.error('Failed to load reminders data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Upcoming reminders (scheduled and sorted by nearest date)
  const upcomingReminders = useMemo(() => {
    return reminders
      .filter((r) => r.status === 'scheduled')
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));
  }, [reminders]);

  // Urgent Referrals (Grade 3 & 4 or urgent flag)
  const urgentReferrals = useMemo(() => {
    return reminders.filter(
      (r) =>
        r.isUrgent ||
        r.isReferral ||
        (r.drGrade !== undefined && r.drGrade >= 3) ||
        r.purpose.toLowerCase().includes('specialist') ||
        r.purpose.toLowerCase().includes('referral')
    );
  }, [reminders]);

  // Notification History Feed
  const notificationHistoryList = useMemo(() => {
    const list: {
      reminderId: string;
      patientName: string;
      patientPhone?: string;
      drGrade?: number;
      timestamp: string;
      channel: string;
      recipient: string;
      status: string;
      message?: string;
      error?: string;
    }[] = [];

    reminders.forEach((r) => {
      if (r.notificationHistory && r.notificationHistory.length > 0) {
        r.notificationHistory.forEach((log) => {
          list.push({
            reminderId: r.reminderId,
            patientName: r.patientName,
            patientPhone: r.patientPhone,
            drGrade: r.drGrade,
            timestamp: log.timestamp,
            channel: log.channel,
            recipient: log.recipient,
            status: log.status,
            message: log.message,
            error: log.error,
          });
        });
      }
    });

    return list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [reminders]);

  // General Filtered Reminders based on active tab and search/filter inputs
  const displayedReminders = useMemo(() => {
    let list = reminders;
    if (activeTab === 'upcoming') {
      list = upcomingReminders;
    } else if (activeTab === 'urgent') {
      list = urgentReferrals;
    }

    return list.filter((rem) => {
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !searchLower ||
        rem.patientName.toLowerCase().includes(searchLower) ||
        rem.patientId.toLowerCase().includes(searchLower) ||
        (rem.patientPhone && rem.patientPhone.includes(searchLower)) ||
        rem.reminderId.toLowerCase().includes(searchLower) ||
        (rem.screeningId && rem.screeningId.toLowerCase().includes(searchLower)) ||
        rem.purpose.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      if (gradeFilter !== 'ALL') {
        const gNum = parseInt(gradeFilter, 10);
        if (rem.drGrade !== gNum) return false;
      }

      if (statusFilter === 'scheduled') return rem.status === 'scheduled';
      if (statusFilter === 'sent') return rem.notificationStatus === 'sent';
      if (statusFilter === 'no_contact') return rem.notificationStatus === 'no_contact' || !rem.patientPhone;
      if (statusFilter === 'failed') return rem.notificationStatus === 'failed';
      if (statusFilter === 'cancelled') return rem.status === 'cancelled';

      return true;
    });
  }, [reminders, upcomingReminders, urgentReferrals, activeTab, searchTerm, gradeFilter, statusFilter]);

  const urgentCount = summary?.urgentReferrals ?? urgentReferrals.length;
  const totalCount = summary?.total ?? reminders.length;
  const upcomingCount = summary?.scheduled ?? upcomingReminders.length;
  const sentCount = summary?.sentNotifications ?? reminders.filter((r) => r.notificationStatus === 'sent').length;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 p-4 bg-emerald-700 text-white rounded-xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner - Clean & Modern */}
      <div className="bg-petrol-900 text-white rounded-2xl p-6 sm:p-7 border border-line-200 flex flex-col md:flex-row md:items-center justify-between gap-5 shadow-sm">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Patient Follow-Ups &amp; Reminders
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Automated recalls, specialist referrals, and SMS notifications for diabetic eye care.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/10 transition-colors inline-flex items-center gap-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (patients.length > 0) setSelectedPatient(patients[0]);
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold rounded-xl transition-colors inline-flex items-center gap-2 text-xs shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Schedule Follow-Up</span>
          </button>
        </div>
      </div>

      {/* Metric Stat Tiles - 4 Clean Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Follow-Ups */}
        <div
          onClick={() => setActiveTab('all')}
          className={`p-5 bg-white rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTab === 'all'
              ? 'border-petrol-600 ring-2 ring-petrol-600/20 bg-mist-100/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Follow-Ups</span>
            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 text-petrol-600 flex items-center justify-center">
              <CalendarClock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">{totalCount}</div>
        </div>

        {/* Upcoming Recalls */}
        <div
          onClick={() => setActiveTab('upcoming')}
          className={`p-5 bg-white rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTab === 'upcoming'
              ? 'border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Upcoming Recalls</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-teal-700 mt-2">{upcomingCount}</div>
        </div>

        {/* Urgent Referrals */}
        <div
          onClick={() => setActiveTab('urgent')}
          className={`p-5 bg-white rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTab === 'urgent'
              ? 'border-rose-400 ring-2 ring-rose-400/20 bg-rose-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Urgent Referrals</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-rose-700 mt-2">{urgentCount}</div>
        </div>

        {/* SMS Dispatched */}
        <div
          onClick={() => setActiveTab('sms_history')}
          className={`p-5 bg-white rounded-2xl border transition-all cursor-pointer shadow-xs ${
            activeTab === 'sms_history'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">SMS Dispatched</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-indigo-700 mt-2">{sentCount}</div>
        </div>
      </div>

      {/* Navigation Tabs & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-petrol-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Reminders ({totalCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'upcoming'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Upcoming ({upcomingCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('urgent')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'urgent'
                  ? 'bg-rose-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Urgent Referrals ({urgentCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sms_history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'sms_history'
                  ? 'bg-indigo-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              SMS History ({notificationHistoryList.length})
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        {activeTab !== 'sms_history' && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search patient name, phone, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petrol-600/20 text-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 font-medium"
              >
                <option value="ALL">All DR Grades</option>
                <option value="0">Grade 0 (No DR)</option>
                <option value="1">Grade 1 (Mild)</option>
                <option value="2">Grade 2 (Moderate)</option>
                <option value="3">Grade 3 (Severe)</option>
                <option value="4">Grade 4 (Proliferative)</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="p-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none text-slate-800 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="sent">SMS Sent</option>
                <option value="no_contact">Missing Mobile</option>
                <option value="failed">Failed / Retry</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-16 bg-white rounded-2xl border border-slate-200 text-center space-y-3">
          <div className="w-8 h-8 border-3 border-petrol-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Loading follow-ups &amp; reminders...</p>
        </div>
      ) : activeTab === 'sms_history' ? (
        /* SMS Audit Table */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          {notificationHistoryList.length === 0 ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <Send className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-800">No Dispatched SMS History</p>
              <p className="text-xs text-slate-500">
                SMS delivery logs will appear here once patient notifications are dispatched.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-4">Recipient Phone</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {notificationHistoryList.map((log, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{log.patientName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{log.recipient || '—'}</td>
                      <td className="py-3 px-4 uppercase font-bold text-slate-500">{log.channel}</td>
                      <td className="py-3 px-4 text-slate-500">{log.timestamp.replace('T', ' ').substring(0, 19)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'sent'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status === 'sent' ? '✓ Delivered' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Reminders Cards List */
        <ReminderList
          reminders={displayedReminders}
          onRefresh={loadData}
          showPatientName={true}
        />
      )}

      {/* Schedule Modal */}
      {isCreateModalOpen && (
        <ScheduleReminderModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            setToastMessage('New patient follow-up appointment scheduled successfully!');
            loadData();
            setTimeout(() => setToastMessage(null), 4000);
          }}
          patientId={selectedPatient?.patientId || selectedPatient?.id || (patients[0]?.patientId || patients[0]?.id || '')}
          patientName={selectedPatient?.name || (patients[0]?.name || 'Patient')}
          patientPhone={selectedPatient?.contactNumber || patients[0]?.contactNumber || ''}
        />
      )}
    </div>
  );
}
