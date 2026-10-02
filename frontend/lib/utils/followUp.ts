export interface FollowUpRecommendation {
  grade: number;
  gradeLabel: string;
  intervalDays: number;
  intervalLabel: string;
  suggestedDate: string; // YYYY-MM-DD
  destination: 'phc' | 'specialist' | 'urgent_specialist';
  destinationLabel: string;
  actionExplanation: string;
  purpose: string;
  isReferralRequired: boolean;
  isUrgent: boolean;
  smsInstructionText: string;
}

export const DR_FOLLOW_UP_RULES: Record<
  number,
  {
    gradeLabel: string;
    intervalDays: number;
    intervalLabel: string;
    destination: 'phc' | 'specialist' | 'urgent_specialist';
    destinationLabel: string;
    actionExplanation: string;
    purpose: string;
    isReferralRequired: boolean;
    isUrgent: boolean;
  }
> = {
  0: {
    gradeLabel: 'Grade 0 — No Diabetic Retinopathy',
    intervalDays: 365,
    intervalLabel: '12 Months (1 Year)',
    destination: 'phc',
    destinationLabel: 'Return to Primary Health Centre (PHC)',
    actionExplanation:
      'Maintain annual routine diabetic retinal screening and optimal blood glucose/HbA1c control.',
    purpose: 'Annual Routine Diabetic Retinal Re-screening',
    isReferralRequired: false,
    isUrgent: false,
  },
  1: {
    gradeLabel: 'Grade 1 — Mild Non-Proliferative DR',
    intervalDays: 180,
    intervalLabel: '6 Months',
    destination: 'phc',
    destinationLabel: 'Return to Primary Health Centre (PHC)',
    actionExplanation:
      'Schedule 6-month PHC follow-up screening to monitor microaneurysm progression and ensure glycaemic stability.',
    purpose: '6-Month Mild DR Progression Follow-up',
    isReferralRequired: false,
    isUrgent: false,
  },
  2: {
    gradeLabel: 'Grade 2 — Moderate Non-Proliferative DR',
    intervalDays: 90,
    intervalLabel: '3 Months',
    destination: 'phc',
    destinationLabel: 'Return to Primary Health Centre (PHC)',
    actionExplanation:
      'Schedule 3-month PHC re-evaluation and ophthalmology tele-consultation to verify macular involvement.',
    purpose: 'Moderate DR 3-Month Follow-up Check',
    isReferralRequired: false,
    isUrgent: false,
  },
  3: {
    gradeLabel: 'Grade 3 — Severe Non-Proliferative DR',
    intervalDays: 30,
    intervalLabel: '1 Month or sooner (within 30 days)',
    destination: 'specialist',
    destinationLabel: 'Ophthalmologist / District Hospital Referral',
    actionExplanation:
      'Specialist referral required for comprehensive dilated fundus examination, OCT imaging, and management of pre-proliferative vascular changes.',
    purpose: 'Specialist Ophthalmology Referral Assessment',
    isReferralRequired: true,
    isUrgent: false,
  },
  4: {
    gradeLabel: 'Grade 4 — Proliferative Diabetic Retinopathy (PDR)',
    intervalDays: 7,
    intervalLabel: 'Within 1 Week (7 Days)',
    destination: 'urgent_specialist',
    destinationLabel: 'URGENT Retina Specialist / Tertiary Eye Care Hospital',
    actionExplanation:
      'Urgent referral required for immediate vitreoretinal evaluation, pan-retinal photocoagulation (PRP) laser, or anti-VEGF injection to prevent vision loss.',
    purpose: 'URGENT Retina Specialist Intervention Assessment',
    isReferralRequired: true,
    isUrgent: true,
  },
};

export function getFollowUpRecommendation(
  grade: number = 0,
  screeningDateStr?: string
): FollowUpRecommendation {
  const rule = DR_FOLLOW_UP_RULES[grade] ?? DR_FOLLOW_UP_RULES[0];
  const baseDate = screeningDateStr ? new Date(screeningDateStr) : new Date();
  const targetDate = new Date(baseDate.getTime() + rule.intervalDays * 24 * 60 * 60 * 1000);
  const suggestedDate = targetDate.toISOString().split('T')[0];

  const destinationText = rule.isReferralRequired
    ? 'referral consultation with an eye specialist / hospital'
    : 'follow-up check at your Primary Health Centre';

  return {
    grade,
    gradeLabel: rule.gradeLabel,
    intervalDays: rule.intervalDays,
    intervalLabel: rule.intervalLabel,
    suggestedDate,
    destination: rule.destination,
    destinationLabel: rule.destinationLabel,
    actionExplanation: rule.actionExplanation,
    purpose: rule.purpose,
    isReferralRequired: rule.isReferralRequired,
    isUrgent: rule.isUrgent,
    smsInstructionText: destinationText,
  };
}
