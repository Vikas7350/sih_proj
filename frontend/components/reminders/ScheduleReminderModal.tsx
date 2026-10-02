'use client';

import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Mail,
  Phone,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  CalendarCheck,
} from 'lucide-react';
import { createReminder } from '@/lib/api/reminders';
import { PatientReminder } from '@/lib/api/types';

interface ScheduleReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  screeningId?: string;
  initialDate?: string;
  initialPurpose?: string;
  patientEmail?: string;
  patientPhone?: string;
  onSuccess?: (reminder: PatientReminder) => void;
}

export default function ScheduleReminderModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  screeningId,
  initialDate,
  initialPurpose,
  patientEmail = '',
  patientPhone = '',
  onSuccess,
}: ScheduleReminderModalProps) {
  const getDefaultDate = (offsetDays: number = 90) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const [scheduledDate, setScheduledDate] = useState(initialDate || getDefaultDate(90));
  const [scheduledTime, setScheduledTime] = useState('10:00 AM');
  const [purpose, setPurpose] = useState(initialPurpose || 'Diabetic Retinopathy 3-Month Follow-up Check');
  const [email, setEmail] = useState(patientEmail);
  const [phone, setPhone] = useState(patientPhone);
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>(
    patientPhone && !patientEmail ? 'sms' : patientEmail && !patientPhone ? 'email' : 'both'
  );
  const [notes, setNotes] = useState('');
  const [sendImmediate, setSendImmediate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<PatientReminder | null>(null);

  useEffect(() => {
    if (initialDate) setScheduledDate(initialDate);
    if (initialPurpose) setPurpose(initialPurpose);
    if (patientEmail) setEmail(patientEmail);
    if (patientPhone) {
      setPhone(patientPhone);
      if (!patientEmail) setChannel('sms');
      else setChannel('both');
    }
  }, [initialDate, initialPurpose, patientEmail, patientPhone, isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleQuickDate = (months: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    setScheduledDate(d.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const created = await createReminder({
        patientId,
        screeningId,
        scheduledDate,
        scheduledTime,
        purpose,
        notes: notes.trim() || undefined,
        channel,
        patientEmail: email.trim() || undefined,
        patientPhone: phone.trim() || undefined,
        sendImmediateNotification: sendImmediate && Boolean(email.trim() || phone.trim()),
      });
      setSuccess(created);
      if (onSuccess) onSuccess(created);
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to schedule follow-up. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header - Compact & Elegant */}
        <div className="px-5 py-4 bg-petrol-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Schedule Follow-up</h2>
              <p className="text-[11px] text-slate-300">
                {patientName} <span className="text-teal-200">({patientId})</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto">
          {success ? (
            <div className="py-6 text-center space-y-2">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Follow-up Scheduled</h3>
              <p className="text-xs text-slate-600">
                Scheduled for <strong>{success.scheduledDate}</strong> at {success.scheduledTime}.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Follow-up Date & Quick Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">Date &amp; Time *</label>
                  <div className="flex items-center gap-1">
                    {[
                      { label: '+1 Mo', months: 1 },
                      { label: '+3 Mo', months: 3 },
                      { label: '+6 Mo', months: 6 },
                      { label: '+1 Yr', months: 12 },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleQuickDate(preset.months)}
                        className="px-2 py-0.5 text-[10px] font-semibold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-600 rounded-md transition-colors cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Calendar className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                    />
                  </div>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      placeholder="10:00 AM"
                      className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
                    />
                  </div>
                </div>
              </div>

              {/* Purpose */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Purpose / Reason *</label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                >
                  <option value="Diabetic Retinopathy 3-Month Follow-up Check">
                    DR 3-Month Follow-up Check (Moderate)
                  </option>
                  <option value="Diabetic Retinopathy 6-Month Routine Follow-up">
                    DR 6-Month Routine Follow-up (Mild)
                  </option>
                  <option value="Annual Diabetic Retinal Re-screening">
                    Annual Retinal Screening (Grade 0)
                  </option>
                  <option value="Specialist Ophthalmologist Referral Follow-up">
                    Specialist Ophthalmologist Referral (Severe/PDR)
                  </option>
                  <option value="Blood Sugar Control & Visual Acuity Review">
                    Blood Sugar &amp; Vision Review
                  </option>
                </select>
              </div>

              {/* Notification Channel Segmented Controls */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-800">Notification Channel</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      channel === 'sms'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Phone className="w-3 h-3 text-emerald-600" />
                    <span>SMS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('email')}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      channel === 'email'
                        ? 'bg-blue-50 border-blue-500 text-blue-800 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Mail className="w-3 h-3 text-blue-600" />
                    <span>Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('both')}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      channel === 'both'
                        ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-2xs font-bold'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>SMS + Email</span>
                  </button>
                </div>
              </div>

              {/* Contact Inputs */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 mb-0.5 block">Mobile Number</label>
                  <div className="relative">
                    <Phone className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 mb-0.5 block">Email (Optional)</label>
                  <div className="relative">
                    <Mail className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="patient@email.com"
                      className="w-full pl-7 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-semibold text-slate-700 mb-0.5 block">
                  Instructions / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Bring existing spectacles and fasting glucose log."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                />
              </div>

              {/* Immediate SMS Checkbox */}
              <div className="flex items-center gap-2 pt-0.5">
                <input
                  id="sendImmediate"
                  type="checkbox"
                  checked={sendImmediate}
                  onChange={(e) => setSendImmediate(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="sendImmediate" className="text-xs text-slate-700 cursor-pointer flex items-center gap-1.5">
                  <span>Send SMS confirmation to patient immediately</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold border border-emerald-200">
                    Instant
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Schedule Follow-Up</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
