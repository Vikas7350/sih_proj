import {
  PatientReminder,
  CreateReminderRequest,
  UpdateReminderRequest,
  ReminderSummary,
} from './types';

const BASE_URL = '/api/backend';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init?.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    let msg = `API error ${res.status}`;
    if (body?.detail) {
      if (typeof body.detail === 'string') {
        msg = body.detail;
      } else if (Array.isArray(body.detail)) {
        msg = body.detail.map((d: any) => d?.msg || JSON.stringify(d)).join(', ');
      } else if (typeof body.detail === 'object' && body.detail.message) {
        msg = body.detail.message;
      } else {
        msg = JSON.stringify(body.detail);
      }
    }
    throw new Error(msg);
  }
  return res.json();
}

function toPatientReminder(raw: Record<string, any>): PatientReminder {
  return {
    id: raw.reminder_id || raw.id || '',
    reminderId: raw.reminder_id || raw.id || '',
    patientId: raw.patient_id || '',
    patientName: raw.patient_name || '',
    patientEmail: raw.patient_email || undefined,
    patientPhone: raw.patient_phone || undefined,
    screeningId: raw.screening_id || undefined,
    drGrade: raw.dr_grade !== undefined ? raw.dr_grade : undefined,
    destination: raw.destination || 'phc',
    destinationLabel: raw.destination_label || undefined,
    isReferral: Boolean(raw.is_referral),
    isUrgent: Boolean(raw.is_urgent),
    referralFacility: raw.referral_facility || undefined,
    referralStatus: raw.referral_status || undefined,
    phcId: raw.phc_id || undefined,
    phcName: raw.phc_name || undefined,
    scheduledDate: raw.scheduled_date || '',
    scheduledTime: raw.scheduled_time || '10:00 AM',
    purpose: raw.purpose || '',
    notes: raw.notes || undefined,
    channel: raw.channel || 'sms',
    status: raw.status || 'scheduled',
    notificationStatus: raw.notification_status || 'pending',
    notificationSentAt: raw.notification_sent_at || undefined,
    notificationError: raw.notification_error || undefined,
    notificationHistory: raw.notification_history || [],
    createdBy: raw.created_by || undefined,
    createdAt: raw.created_at || '',
    updatedAt: raw.updated_at || '',
  };
}

export async function createReminder(
  data: CreateReminderRequest
): Promise<PatientReminder> {
  const payload = {
    patient_id: data.patientId,
    screening_id: data.screeningId,
    scheduled_date: data.scheduledDate,
    scheduled_time: data.scheduledTime || '10:00 AM',
    purpose: data.purpose,
    notes: data.notes,
    channel: data.channel || 'sms',
    patient_email: data.patientEmail,
    patient_phone: data.patientPhone,
    dr_grade: data.drGrade,
    destination: data.destination,
    destination_label: data.destinationLabel,
    is_referral: data.isReferral,
    is_urgent: data.isUrgent,
    referral_facility: data.referralFacility,
    referral_status: data.referralStatus,
    send_immediate_notification: data.sendImmediateNotification ?? false,
  };
  const raw = await apiFetch<Record<string, any>>('/reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return toPatientReminder(raw);
}

export async function getReminders(params?: {
  patientId?: string;
  screeningId?: string;
  status?: string;
  drGrade?: number;
  isUrgent?: boolean;
  isReferral?: boolean;
  notificationStatus?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: PatientReminder[]; total: number; pages: number }> {
  const q = new URLSearchParams();
  if (params?.patientId) q.set('patient_id', params.patientId);
  if (params?.screeningId) q.set('screening_id', params.screeningId);
  if (params?.status && params.status !== 'ALL') q.set('status', params.status);
  if (params?.drGrade !== undefined) q.set('dr_grade', String(params.drGrade));
  if (params?.isUrgent !== undefined) q.set('is_urgent', String(params.isUrgent));
  if (params?.isReferral !== undefined) q.set('is_referral', String(params.isReferral));
  if (params?.notificationStatus && params.notificationStatus !== 'ALL') q.set('notification_status', params.notificationStatus);
  if (params?.search) q.set('search', params.search);
  if (params?.page) q.set('page', String(params.page));
  if (params?.limit) q.set('limit', String(params.limit));

  const qs = q.toString();
  const raw = await apiFetch<{ items: Record<string, any>[]; total: number; pages: number }>(
    `/reminders${qs ? `?${qs}` : ''}`
  );
  return {
    items: (raw.items || []).map(toPatientReminder),
    total: raw.total || 0,
    pages: raw.pages || 1,
  };
}

export async function getReminderById(reminderId: string): Promise<PatientReminder> {
  const raw = await apiFetch<Record<string, any>>(`/reminders/${encodeURIComponent(reminderId)}`);
  return toPatientReminder(raw);
}

export async function getRemindersSummary(): Promise<ReminderSummary> {
  const raw = await apiFetch<Record<string, any>>('/reminders/summary');
  return {
    total: raw.total || 0,
    scheduled: raw.scheduled || 0,
    dueToday: raw.due_today || 0,
    completed: raw.completed || 0,
    cancelled: raw.cancelled || 0,
    sentNotifications: raw.sent_notifications || 0,
    urgentReferrals: raw.urgent_referrals || 0,
    failedNotifications: raw.failed_notifications || 0,
    missingContact: raw.missing_contact || 0,
  };
}

export async function updateReminder(
  reminderId: string,
  data: UpdateReminderRequest
): Promise<PatientReminder> {
  const payload: Record<string, any> = {};
  if (data.scheduledDate !== undefined) payload.scheduled_date = data.scheduledDate;
  if (data.scheduledTime !== undefined) payload.scheduled_time = data.scheduledTime;
  if (data.purpose !== undefined) payload.purpose = data.purpose;
  if (data.notes !== undefined) payload.notes = data.notes;
  if (data.status !== undefined) payload.status = data.status;
  if (data.patientEmail !== undefined) payload.patient_email = data.patientEmail;
  if (data.patientPhone !== undefined) payload.patient_phone = data.patientPhone;
  if (data.channel !== undefined) payload.channel = data.channel;
  if (data.referralFacility !== undefined) payload.referral_facility = data.referralFacility;
  if (data.referralStatus !== undefined) payload.referral_status = data.referralStatus;
  if (data.resendNotification !== undefined) payload.resend_notification = data.resendNotification;

  const raw = await apiFetch<Record<string, any>>(`/reminders/${encodeURIComponent(reminderId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return toPatientReminder(raw);
}

export async function cancelReminder(
  reminderId: string,
  reason?: string
): Promise<PatientReminder> {
  const raw = await apiFetch<Record<string, any>>(`/reminders/${encodeURIComponent(reminderId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || 'Staff cancellation' }),
  });
  return toPatientReminder(raw);
}

export async function sendReminderNotification(
  reminderId: string
): Promise<{ success: boolean; notificationStatus: string; error?: string; reminder: PatientReminder }> {
  const raw = await apiFetch<Record<string, any>>(`/reminders/${encodeURIComponent(reminderId)}/notify`, {
    method: 'POST',
  });
  return {
    success: Boolean(raw.success),
    notificationStatus: raw.notification_status || 'pending',
    error: raw.error || undefined,
    reminder: toPatientReminder(raw.reminder || {}),
  };
}
