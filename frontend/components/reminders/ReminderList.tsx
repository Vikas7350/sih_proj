'use client';

import { useState } from 'react';
import {
  Calendar,
  Clock,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  History,
  CalendarDays,
  FileEdit,
  Loader2,
  Building2,
  AlertTriangle,
  UserCheck,
  Edit3,
  Plus,
} from 'lucide-react';
import { PatientReminder } from '@/lib/api/types';
import {
  cancelReminder,
  sendReminderNotification,
  updateReminder,
} from '@/lib/api/reminders';
import { updatePatient } from '@/lib/api/patients';

interface ReminderListProps {
  reminders: PatientReminder[];
  onRefresh?: () => void;
  showPatientName?: boolean;
}

export default function ReminderList({
  reminders,
  onRefresh,
  showPatientName = true,
}: ReminderListProps) {
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Reschedule modal state
  const [rescheduleModal, setRescheduleModal] = useState<PatientReminder | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('10:00 AM');
  const [rescheduleChannel, setRescheduleChannel] = useState<'sms' | 'email' | 'both'>('sms');
  const [resendNotice, setResendNotice] = useState(true);
  const [rescheduleNotes, setRescheduleNotes] = useState('');

  // Mobile number inline edit state
  const [mobileModal, setMobileModal] = useState<{ reminder: PatientReminder; currentMobile: string } | null>(null);
  const [mobileInput, setMobileInput] = useState('');
  const [mobileLoading, setMobileLoading] = useState(false);

  // Referral update state
  const [referralEditModal, setReferralEditModal] = useState<PatientReminder | null>(null);
  const [refFacility, setRefFacility] = useState('');
  const [refStatus, setRefStatus] = useState<'pending' | 'referred' | 'attended'>('pending');

  const [actionMessage, setActionMessage] = useState<{ id: string; text: string; isError?: boolean } | null>(null);

  const toggleHistory = (id: string) => {
    setExpandedHistory((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSendNotification = async (reminderId: string) => {
    setActionLoading(reminderId);
    setActionMessage(null);
    try {
      const res = await sendReminderNotification(reminderId);
      if (res.success) {
        setActionMessage({ id: reminderId, text: 'Follow-up SMS / Email dispatched successfully!' });
      } else {
        setActionMessage({ id: reminderId, text: res.error || 'Failed to dispatch notification.', isError: true });
      }
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionMessage({ id: reminderId, text: err?.message || 'Error triggering notification.', isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (reminderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this follow-up reminder?')) return;
    setActionLoading(reminderId);
    setActionMessage(null);
    try {
      await cancelReminder(reminderId, 'Staff cancellation from dashboard');
      setActionMessage({ id: reminderId, text: 'Reminder cancelled.' });
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setActionMessage({ id: reminderId, text: err?.message || 'Failed to cancel reminder.', isError: true });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleModal) return;
    setActionLoading(rescheduleModal.reminderId);
    try {
      await updateReminder(rescheduleModal.reminderId, {
        scheduledDate: newDate,
        scheduledTime: newTime,
        channel: rescheduleChannel,
        notes: rescheduleNotes ? `${rescheduleModal.notes || ''} [Rescheduled: ${rescheduleNotes}]`.trim() : undefined,
        resendNotification: resendNotice,
      });
      setRescheduleModal(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to reschedule reminder.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMobileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mobileModal) return;
    const cleaned = mobileInput.trim();
    if (!cleaned || cleaned.length < 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    setMobileLoading(true);
    try {
      // 1. Update patient record in MongoDB
      await updatePatient(mobileModal.reminder.patientId, {
        contactNumber: cleaned,
      });

      // 2. Update reminder record with new mobile number
      await updateReminder(mobileModal.reminder.reminderId, {
        patientPhone: cleaned,
      });

      // 3. Trigger SMS notification immediately
      const notifRes = await sendReminderNotification(mobileModal.reminder.reminderId);

      setMobileModal(null);
      if (notifRes.success) {
        setActionMessage({
          id: mobileModal.reminder.reminderId,
          text: `Mobile updated to ${cleaned} and follow-up SMS sent successfully!`,
        });
      } else {
        setActionMessage({
          id: mobileModal.reminder.reminderId,
          text: `Mobile updated to ${cleaned}, but SMS provider returned: ${notifRes.error}`,
          isError: true,
        });
      }

      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to update mobile number.');
    } finally {
      setMobileLoading(false);
    }
  };

  const handleReferralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralEditModal) return;
    setActionLoading(referralEditModal.reminderId);
    try {
      await updateReminder(referralEditModal.reminderId, {
        referralFacility: refFacility,
        referralStatus: refStatus,
      });
      setReferralEditModal(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to update referral details.');
    } finally {
      setActionLoading(null);
    }
  };

  const getGradeBadge = (grade?: number) => {
    if (grade === 0) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-800 border border-slate-300">
          Grade 0 (No DR) &bull; 12 Mo
        </span>
      );
    } else if (grade === 1) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-50 text-teal-800 border border-teal-200">
          Grade 1 (Mild DR) &bull; 6 Mo
        </span>
      );
    } else if (grade === 2) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-300">
          Grade 2 (Moderate DR) &bull; 3 Mo
        </span>
      );
    } else if (grade === 3) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-orange-50 text-orange-800 border border-orange-300">
          Grade 3 (Severe NPDR) &bull; 1 Mo
        </span>
      );
    } else if (grade === 4) {
      return (
        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-300 animate-pulse">
          🚨 Grade 4 (Proliferative) &bull; 1 Wk
        </span>
      );
    }
    return null;
  };

  if (reminders.length === 0) {
    return (
      <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
        <CalendarDays className="w-10 h-10 text-slate-400 mx-auto" />
        <p className="text-sm font-bold text-slate-800">No Reminders Found</p>
        <p className="text-xs text-slate-500">
          No patient follow-ups match the selected filters or search criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reminders.map((rem) => {
        const isCancelled = rem.status === 'cancelled';
        const isCompleted = rem.status === 'completed';
        const isSent = rem.notificationStatus === 'sent';
        const isFailed = rem.notificationStatus === 'failed';
        const isNoContact = rem.notificationStatus === 'no_contact' || (!rem.patientPhone && !rem.patientEmail);
        const isPending = rem.notificationStatus === 'pending';
        const isHistoryOpen = Boolean(expandedHistory[rem.reminderId]);
        const isLoading = actionLoading === rem.reminderId;

        const isUrgent = rem.isUrgent || rem.drGrade === 4;
        const isReferral = rem.isReferral || rem.drGrade === 3 || rem.drGrade === 4 || rem.purpose.toLowerCase().includes('specialist');

        return (
          <div
            key={rem.reminderId}
            className={`p-5 bg-white rounded-xl border transition-all ${
              isCancelled
                ? 'border-slate-200 bg-slate-50/60 opacity-80'
                : isUrgent
                ? 'border-rose-300 bg-rose-50/20 shadow-xs'
                : isReferral
                ? 'border-amber-300 bg-amber-50/15 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 shadow-xs'
            }`}
          >
            {/* Top row: Date, Badges & Patient Context */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-start sm:items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isCancelled
                      ? 'bg-slate-200 text-slate-500'
                      : isUrgent
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : isReferral
                      ? 'bg-amber-100 text-amber-700 border border-amber-300'
                      : 'bg-teal-50 text-teal-700 border border-teal-200'
                  }`}
                >
                  <Calendar className="w-5 h-5" />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Appointment:
                    </span>
                    <span className="text-base font-extrabold text-slate-900 font-mono">
                      {rem.scheduledDate} &bull; {rem.scheduledTime || '10:00 AM'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                      {rem.reminderId}
                    </span>
                    {getGradeBadge(rem.drGrade)}
                  </div>
                  
                  {showPatientName && (
                    <div className="text-xs text-slate-600 font-medium mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span>
                        Patient: <strong className="text-slate-900 text-sm">{rem.patientName}</strong>{' '}
                        <span className="font-mono text-slate-500">({rem.patientId})</span>
                        {rem.screeningId && (
                          <span className="ml-1 text-teal-700 font-mono font-semibold">&bull; Screening: {rem.screeningId}</span>
                        )}
                      </span>

                      {rem.notificationSentAt && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          <span>
                            SMS Dispatched:{' '}
                            {new Date(rem.notificationSentAt).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                            })}
                          </span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Destination Badge */}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 border ${
                    isUrgent
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : isReferral
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  }`}
                >
                  <Building2 className="w-3 h-3" />
                  <span>{rem.destinationLabel || (isUrgent ? 'Urgent Retina Specialist' : isReferral ? 'Specialist Referral' : 'PHC Follow-up')}</span>
                </span>

                {/* Notification Status */}
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
                    isSent
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : isNoContact
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : isFailed
                      ? 'bg-rose-50 text-rose-700 border-rose-300'
                      : 'bg-teal-50 text-teal-700 border-teal-200'
                  }`}
                  title={rem.notificationError || undefined}
                >
                  {isSent && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                  {isNoContact && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                  {isFailed && <AlertCircle className="w-3 h-3 text-rose-600" />}
                  {isPending && <Clock className="w-3 h-3 text-teal-600" />}
                  <span>
                    {isSent
                      ? '📱 SMS Dispatched'
                      : isNoContact
                      ? '⚠️ Missing Mobile'
                      : isFailed
                      ? '⚠️ Failed / Retry'
                      : '⏳ Scheduled'}
                  </span>
                </span>
              </div>
            </div>

            {/* Purpose & Clinical Details */}
            <div className="py-2.5 space-y-1.5 text-xs">
              <p className="font-semibold text-slate-800">
                Purpose: <span className="font-normal text-slate-700">{rem.purpose}</span>
              </p>
              {rem.notes && (
                <p className="text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  Instructions: {rem.notes}
                </p>
              )}

              {/* Referral Details Row (if applicable) */}
              {isReferral && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-50/70 border border-amber-200 text-amber-950 font-medium text-xs">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Referral Facility: <strong>{rem.referralFacility || 'District Eye Care Hospital'}</strong></span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold">
                      Attendance:{' '}
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-extrabold ${
                        rem.referralStatus === 'attended'
                          ? 'bg-emerald-200 text-emerald-900'
                          : rem.referralStatus === 'referred'
                          ? 'bg-teal-200 text-teal-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}>
                        {rem.referralStatus || 'Pending'}
                      </span>
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setReferralEditModal(rem);
                        setRefFacility(rem.referralFacility || 'District Eye Care Hospital');
                        setRefStatus(rem.referralStatus || 'pending');
                      }}
                      className="text-[10px] text-amber-800 font-bold underline hover:text-amber-950 cursor-pointer"
                    >
                      Update Attendance
                    </button>
                  </div>
                </div>
              )}

              {/* Contact info bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                <div className="flex flex-wrap items-center gap-3">
                  {rem.patientPhone ? (
                    <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <Phone className="w-3 h-3 text-emerald-600" />
                      <span>{rem.patientPhone}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileModal({ reminder: rem, currentMobile: '' });
                        setMobileInput('');
                      }}
                      className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3 text-amber-700" />
                      <span>+ Add Patient Mobile Number</span>
                    </button>
                  )}

                  {rem.patientEmail && (
                    <span className="inline-flex items-center gap-1 font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      <Mail className="w-3 h-3 text-slate-500" />
                      <span>{rem.patientEmail}</span>
                    </span>
                  )}
                  {rem.phcName && (
                    <span className="text-slate-400">&bull; Facility: {rem.phcName}</span>
                  )}
                </div>

                {rem.patientPhone && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileModal({ reminder: rem, currentMobile: rem.patientPhone || '' });
                      setMobileInput(rem.patientPhone || '');
                    }}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit Number</span>
                  </button>
                )}
              </div>
            </div>

            {/* Action Message Feedback */}
            {actionMessage && actionMessage.id === rem.reminderId && (
              <div
                className={`my-2 p-2.5 rounded-lg text-xs font-semibold ${
                  actionMessage.isError
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {actionMessage.text}
              </div>
            )}

            {/* Bottom Actions Row */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => toggleHistory(rem.reminderId)}
                className="text-slate-500 hover:text-slate-800 font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>Notification Log ({rem.notificationHistory?.length || 0})</span>
                {isHistoryOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {!isCancelled && (
                <div className="flex items-center gap-2">
                  {rem.patientPhone ? (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleSendNotification(rem.reminderId)}
                      className="px-3 py-1.5 text-xs font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                    >
                      {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5 text-teal-700" />
                      )}
                      <span>{isSent ? 'Resend SMS' : 'Dispatch SMS Now'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileModal({ reminder: rem, currentMobile: '' });
                        setMobileInput('');
                      }}
                      className="px-3 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-amber-700" />
                      <span>Enter Mobile to Send SMS</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      setRescheduleModal(rem);
                      setNewDate(rem.scheduledDate);
                      setNewTime(rem.scheduledTime || '10:00 AM');
                      setRescheduleNotes('');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileEdit className="w-3.5 h-3.5" />
                    <span>Reschedule</span>
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleCancel(rem.reminderId)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 border border-transparent rounded-lg transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {/* Notification History Drawer */}
            {isHistoryOpen && (
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 animate-in fade-in">
                <p className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                  Notification Audit Trail
                </p>
                {rem.notificationHistory && rem.notificationHistory.length > 0 ? (
                  <div className="space-y-1.5">
                    {rem.notificationHistory.map((log, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 font-mono">
                            [{log.channel.toUpperCase()}] &rarr; {log.recipient}
                          </span>
                          {log.message && <p className="text-slate-600 text-[11px]">{log.message}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                              log.status === 'sent'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.status === 'failed'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.status}
                          </span>
                          <span className="text-slate-500 font-mono text-[11px] font-semibold">
                            {new Date(log.timestamp).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true,
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-[11px] italic">No notifications logged yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 1. Mobile Number Quick Edit & Send Modal */}
      {mobileModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Update Mobile Number
                </h3>
                <p className="text-[11px] text-slate-500">
                  {mobileModal.reminder.patientName} ({mobileModal.reminder.patientId})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleMobileSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Patient Mobile Number (10 Digits) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold font-mono text-xs">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={mobileInput}
                    onChange={(e) => setMobileInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full pl-11 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setMobileModal(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={mobileLoading}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 text-xs disabled:opacity-50 cursor-pointer"
                >
                  {mobileLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Save &amp; Send SMS</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Reschedule Modal */}
      {rescheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Reschedule Follow-Up
                </h3>
                <p className="text-[11px] text-slate-500">{rescheduleModal.patientName} ({rescheduleModal.reminderId})</p>
              </div>
              <button
                type="button"
                onClick={() => setRescheduleModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-800 mb-0.5">New Date *</label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-800 mb-0.5">New Time</label>
                  <input
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="10:00 AM"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-0.5">Channel</label>
                <select
                  value={rescheduleChannel}
                  onChange={(e) => setRescheduleChannel(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="sms">SMS to Mobile ({rescheduleModal.patientPhone || 'No Phone'})</option>
                  <option value="email">Email ({rescheduleModal.patientEmail || 'No Email'})</option>
                  <option value="both">Both SMS &amp; Email</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-0.5">Reason / Instructions</label>
                <input
                  type="text"
                  value={rescheduleNotes}
                  onChange={(e) => setRescheduleNotes(e.target.value)}
                  placeholder="e.g. Patient requested afternoon slot."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  id="resendNotice"
                  type="checkbox"
                  checked={resendNotice}
                  onChange={(e) => setResendNotice(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                />
                <label htmlFor="resendNotice" className="text-slate-700 cursor-pointer text-xs">
                  Send SMS notification to patient immediately
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setRescheduleModal(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(actionLoading)}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Confirm Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Referral Details Edit Modal */}
      {referralEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Specialist Referral Status
                </h3>
                <p className="text-[11px] text-slate-500">{referralEditModal.patientName} ({referralEditModal.patientId})</p>
              </div>
              <button
                type="button"
                onClick={() => setReferralEditModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReferralSubmit} className="space-y-2.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-800 mb-0.5">Referral Facility</label>
                <input
                  type="text"
                  required
                  value={refFacility}
                  onChange={(e) => setRefFacility(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-0.5">Attendance Status</label>
                <select
                  value={refStatus}
                  onChange={(e) => setRefStatus(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="pending">⏳ Referral Pending / Scheduled</option>
                  <option value="referred">📋 Patient Referred &amp; Counseled</option>
                  <option value="attended">✅ Patient Attended Specialist Visit</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1.5">
                <button
                  type="button"
                  onClick={() => setReferralEditModal(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={Boolean(actionLoading)}
                  className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
                >
                  Save Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
