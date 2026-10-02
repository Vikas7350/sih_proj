'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  RefreshCw,
  Info,
  ShieldAlert,
  ArrowLeft,
  Sliders,
  Sparkles,
  Printer,
  ShieldCheck,
  Activity,
  Layers,
  Sparkle,
  Maximize2,
  CalendarClock,
  CalendarCheck,
  Clock,
} from 'lucide-react';
import { getScreeningResult, getAiExplanation } from '@/lib/api/screening';
import { getReminders } from '@/lib/api/reminders';
import { getPatientById } from '@/lib/api/patients';
import { ScreeningResult, DRGrade, AIExplanation, PatientReminder, Patient } from '@/lib/api/types';
import { getFollowUpRecommendation } from '@/lib/utils/followUp';
import {
  Building2,
  Phone,
  Mail,
  ExternalLink,
  AlertCircle,
  Calendar,
  Send,
  UserCheck,
} from 'lucide-react';

function EvidenceImageCard({
  url,
  title,
  countStr,
  description,
  onPreview,
}: {
  url?: string | null;
  title: string;
  countStr?: string;
  description: string;
  onPreview: (data: { url: string; title: string; countStr?: string; description: string }) => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between space-y-2.5">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold text-slate-900 leading-tight">{title}</span>
          {countStr && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 font-bold shrink-0">
              {countStr}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">{description}</p>
      </div>

      <div className="bg-slate-950 rounded-lg overflow-hidden h-36 flex items-center justify-center border border-slate-300 relative group">
        {url && !imgError ? (
          <>
            <img
              src={url}
              alt={title}
              onError={() => setImgError(true)}
              className="max-h-32 object-contain rounded cursor-pointer transition-transform group-hover:scale-105"
              onClick={() => onPreview({ url, title, countStr, description })}
            />
            <button
              type="button"
              onClick={() => onPreview({ url, title, countStr, description })}
              className="absolute bottom-2 right-2 px-2 py-1 bg-slate-900/85 hover:bg-slate-900 text-white text-[10px] font-semibold rounded backdrop-blur-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Enlarge</span>
            </button>
          </>
        ) : (
          <div className="p-3 text-center text-slate-400 space-y-1">
            <Info className="w-5 h-5 mx-auto text-slate-500" />
            <span className="text-xs font-semibold text-slate-500 block">Image not available</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ScreeningResultPage() {
  const pathname = usePathname();
  const screeningId = pathname.split('/').pop() || '';

  const router = useRouter();

  const [screening, setScreening] = useState<ScreeningResult | null>(null);
  const [patientData, setPatientData] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'split' | 'original' | 'heatmap'>('split');
  const [aiExplanation, setAiExplanation] = useState<AIExplanation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [existingReminder, setExistingReminder] = useState<PatientReminder | null>(null);
  const [referralStatus, setReferralStatus] = useState<'pending' | 'referred' | 'attended'>('pending');
  const [referralFacility, setReferralFacility] = useState('District Eye Care Hospital / Tertiary Retina Center');
  const [previewModal, setPreviewModal] = useState<{
    url: string;
    title: string;
    countStr?: string;
    description?: string;
  } | null>(null);
  const [isTechnicalExpanded, setIsTechnicalExpanded] = useState(false);

  const loadRemindersForScreening = async (sId: string) => {
    try {
      const remData = await getReminders({ screeningId: sId });
      if (remData.items && remData.items.length > 0) {
        setExistingReminder(remData.items[0]);
      }
    } catch {
      // Non-blocking
    }
  };

  useEffect(() => {
    async function loadResult() {
      if (!screeningId) return;
      try {
        const data = await getScreeningResult(screeningId);
        setScreening(data);
        loadRemindersForScreening(screeningId);
        if (data?.patientId) {
          try {
            const p = await getPatientById(data.patientId);
            setPatientData(p);
          } catch {
            // Patient details non-blocking
          }
        }
        if (data?.prediction && data?.status !== 'rejected') {
          setAiLoading(true);
          const explanation = await getAiExplanation(screeningId);
          setAiExplanation(explanation);
          setAiLoading(false);
        }
      } catch (err) {
        console.error('Failed to load screening result:', err);
      } finally {
        setLoading(false);
      }
    }
    loadResult();
  }, [screeningId]);

  if (loading) {
    return (
      <div className="p-16 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Loading screening evaluation & safety verification...</p>
      </div>
    );
  }

  if (!screening) {
    return (
      <div className="p-12 bg-white rounded-xl border border-slate-200 text-center space-y-4 max-w-md mx-auto">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Screening Record Not Found</h2>
        <p className="text-xs text-slate-500">The requested screening assessment does not exist or was removed.</p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const { imageQuality, prediction, risk, fundus, qualityDetails, enhancement, decision, action } = screening;

  // Non-Fundus Safety State
  const isNonFundus =
    fundus?.status === 'NON_FUNDUS' ||
    (fundus as { status?: string })?.status === 'UNCERTAIN' ||
    fundus?.isFundus === false ||
    screening.status === 'rejected';
  const isQualityGood = imageQuality.status === 'good' && !isNonFundus;

  const drGrades: { grade: DRGrade; name: string; description: string }[] = [
    { grade: 0, name: 'No DR', description: 'No signs of retinopathy' },
    { grade: 1, name: 'Mild', description: 'Microaneurysms only' },
    { grade: 2, name: 'Moderate', description: 'Hemorrhages & exudates' },
    { grade: 3, name: 'Severe', description: 'Cotton wool spots & vascular changes' },
    { grade: 4, name: 'Proliferative', description: 'Neovascularization' },
  ];

  const findingsForGrade = (grade: DRGrade): string[] => {
    switch (grade) {
      case 0:
        return ['No microaneurysms detected', 'No retinal hemorrhages', 'Optic disc, macula & blood vessels appear within normal limits'];
      case 1:
        return ['Microaneurysms (localized capillary dilations) detected', 'Minimal dot hemorrhages present', 'No hard exudates or venous beading observed'];
      case 2:
        return ['Multiple microaneurysms detected', 'Dot & blot retinal hemorrhages present', 'Hard exudates (lipid deposits) found', 'Mild venous changes possible'];
      case 3:
        return ['Intraretinal hemorrhages in more than 2 quadrants', 'Cotton wool spots (soft exudates) present', 'Venous beading detected', 'Intraretinal microvascular abnormalities (IRMA) present'];
      case 4:
        return ['Neovascularization on the optic disc and/or retina', 'Vitreous / pre-retinal hemorrhage risk', 'Fibrous tissue proliferation detected'];
      default:
        return [];
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 1. TOP HEADER & PATIENT SUMMARY */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span>Screening ID: {screening.screeningId}</span>
            <span>&bull;</span>
            <span>Date: {screening.date ? new Date(screening.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Today'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <span>{screening.patientName || 'Patient'}</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-normal text-slate-600">
              {screening.patientId}
            </span>
          </h1>
          <p className="text-xs text-slate-600">
            {screening.patientAge} Yrs &bull; {screening.patientGender} &bull; Diabetes Duration: <strong>{screening.diabetesDurationYears} Years</strong> &bull; Examined: <strong className="uppercase text-teal-700">{screening.eye} Eye</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/dashboard/screening/new"
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>New Screening</span>
          </Link>

          {!isNonFundus && isQualityGood && (
            <>
              {existingReminder && (
                <Link
                  href="/dashboard/reminders"
                  className="px-3.5 py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <CalendarCheck className="w-4 h-4 text-teal-600" />
                  <span>Auto-Reminder: {existingReminder.scheduledDate}</span>
                </Link>
              )}

              <Link
                href={`/dashboard/reports/${screening.screeningId}`}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <FileText className="w-4 h-4" />
                <span>View Report</span>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* 2. STAGE 0 SAFETY GATE (IF NON-FUNDUS REJECTED) */}
      {isNonFundus && (
        <div className="bg-rose-50 border-2 border-rose-400 rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
                <XCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  Stage 0: Fundus Image Validation Gate
                </div>
                <h2 className="text-xl font-extrabold text-rose-950">
                  NON-FUNDUS IMAGE REJECTED
                </h2>
                <p className="text-xs text-rose-800 font-medium">
                  The uploaded file failed retinal validation. The image does not exhibit biological retinal fundus characteristics.
                </p>
              </div>
            </div>

            <div className="text-right sm:shrink-0 bg-white/80 p-3 rounded-xl border border-rose-200">
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">Decision</span>
              <span className="text-base font-extrabold text-rose-700 uppercase">
                {action || decision || 'REJECT'}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-2">
            <span className="text-xs font-bold text-rose-900 block flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              Rejection Reasons Identified by Stage 0 Safety Pipeline:
            </span>
            <ul className="text-xs text-rose-800 list-disc list-inside space-y-1 pl-1">
              {(fundus?.reasons && fundus.reasons.length > 0 ? fundus.reasons : screening.reasons && screening.reasons.length > 0 ? screening.reasons : ['Image lacks retinal vascular arborization, characteristic hue, or foveal landmarks.']).map((reason, idx) => (
                <li key={idx} className="leading-relaxed font-medium">
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-2">
            <span className="text-xs font-bold text-slate-700 block">Uploaded Image (Rejected Input):</span>
            <div className="bg-slate-900 rounded-xl overflow-hidden p-2 flex items-center justify-center h-64 border border-slate-200">
              <img src={screening.imageUrl} alt="Rejected input image" className="max-h-60 object-contain rounded-lg" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-rose-100/70 rounded-xl border border-rose-300">
            <div className="text-xs text-rose-950 font-medium">
              <strong>Clinical Action Required:</strong> Recapture a genuine retinal fundus photograph. Ensure proper pupil dilation and camera focus.
            </div>

            <Link
              href="/dashboard/screening/new"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shrink-0 transition-colors shadow-sm flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Recapture Retinal Image</span>
            </Link>
          </div>
        </div>
      )}

      {/* 3. PRIMARY OUTCOME BANNER (GRADE + RECOMMENDATION ABOVE THE FOLD) */}
      {!isNonFundus && prediction && (
        <div className="bg-white p-6 sm:p-7 rounded-2xl border-2 border-teal-700/40 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                  AI-Assisted Screening Result
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Not a confirmed diagnosis
                </span>
              </div>

              <div className="flex flex-wrap items-baseline gap-3 pt-1">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {prediction.label}
                </h2>
                <span className="text-sm font-bold font-mono text-teal-800 bg-teal-50 px-3 py-1 rounded-lg border border-teal-200">
                  Grade {prediction.grade}
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                {prediction.description}
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-1.5 shrink-0 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Clinical Review Status
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Pending Clinician Review</span>
              </span>
            </div>
          </div>

          {/* Recommended Next Action Highlight */}
          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-extrabold text-teal-950 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-700" />
                <span>Recommended Next Action (Primary Care Protocol):</span>
              </span>
              <p className="text-teal-900 font-medium leading-relaxed">
                {risk?.actionRequired || (prediction.grade === 0 ? 'Schedule annual routine retinal re-screening in 12 months.' : prediction.grade >= 3 ? 'Urgent specialist referral for dilated ophthalmology evaluation.' : 'Follow-up monitoring and blood glucose review scheduled at PHC.')}
              </p>
            </div>

            <div className="shrink-0">
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider inline-block ${
                action === 'SPECIALIST REFERRAL' || prediction.grade >= 3
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                {action || (prediction.grade >= 3 ? 'SPECIALIST REFERRAL' : 'PHC MONITORING')}
              </span>
            </div>
          </div>

          {/* DR Severity Scale ETDRS Standard */}
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center text-xs font-bold text-slate-600">
              <span>ETDRS Severity Scale</span>
              <span>Predicted Grade: Grade {prediction.grade}</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {drGrades.map((g) => {
                const isSelected = g.grade === prediction.grade;
                return (
                  <div
                    key={g.grade}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-teal-700 text-white border-teal-800 shadow-sm ring-2 ring-teal-500/20'
                        : 'bg-slate-50 text-slate-500 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="text-[11px] font-extrabold">Grade {g.grade}</div>
                    <div className="text-[10px] font-bold truncate">{g.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. IMAGE EVIDENCE & GRAD-CAM VIEWPORT */}
      {!isNonFundus && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Explainable AI (Grad-CAM Saliency Visualization)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Visual attention heatmap indicating neural network feature activations. Not a diagnostic confirmation.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium border border-slate-200 w-fit">
              <button
                type="button"
                onClick={() => setActiveTab('split')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'split' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Side-by-Side
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('original')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'original' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Original Fundus
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('heatmap')}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  activeTab === 'heatmap' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grad-CAM Heatmap
              </button>
            </div>
          </div>

          {/* Visual Display */}
          {activeTab === 'split' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block text-center">Original Retinal Fundus</span>
                <div className="bg-slate-900 rounded-xl overflow-hidden p-2 flex items-center justify-center h-72 border border-slate-200">
                  <img src={screening.imageUrl} alt="Original Fundus" className="max-h-68 object-contain rounded-lg" />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block text-center">Neural Network Grad-CAM Heatmap</span>
                <div className="bg-slate-900 rounded-xl overflow-hidden p-2 flex items-center justify-center h-72 border border-slate-200">
                  {screening.heatmapUrl ? (
                    <img src={screening.heatmapUrl} alt="Grad-CAM Heatmap" className="max-h-68 object-contain rounded-lg" />
                  ) : (
                    <div className="text-slate-400 text-xs text-center p-4">Grad-CAM Heatmap not generated for this scan</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'original' && (
            <div className="bg-slate-900 rounded-xl overflow-hidden p-4 flex items-center justify-center max-h-96 border border-slate-200">
              <img src={screening.imageUrl} alt="Original Fundus" className="max-h-88 object-contain rounded-lg" />
            </div>
          )}

          {activeTab === 'heatmap' && (
            <div className="bg-slate-900 rounded-xl overflow-hidden p-4 flex items-center justify-center max-h-96 border border-slate-200">
              {screening.heatmapUrl ? (
                <img src={screening.heatmapUrl} alt="Grad-CAM Heatmap" className="max-h-88 object-contain rounded-lg" />
              ) : (
                <div className="text-slate-400 text-xs text-center p-4">Grad-CAM Heatmap not generated for this scan</div>
              )}
            </div>
          )}

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <Info className="w-4 h-4 text-teal-600 shrink-0" />
            <span>
              Warm regions (red/yellow) indicate neural network saliency weights. Used as AI visual explanation evidence and does not confirm pathology.
            </span>
          </div>
        </div>
      )}

      {/* 5. MATLAB RETINAL EVIDENCE (COMBINED OVERLAY + CANDIDATE MAPS) */}
      {!isNonFundus && (
        (() => {
          const evidence = screening.evidence || screening.matlabResult?.evidence;
          const ra = evidence?.retinal_analysis;

          const opticDiscStr = ra?.optic_disc?.found
            ? `Located (${Math.round(ra.optic_disc.radius || 0)}px r)`
            : 'Not detected';
          const foveaStr = ra?.fovea?.estimated
            ? 'Estimated'
            : 'Not located';
          const vesselStr = ra?.vessels?.density != null
            ? `${(ra.vessels.density * 100).toFixed(1)}% density`
            : ra?.vessels
            ? 'Segmented'
            : 'Not available';
          const maCount = ra?.microaneurysm?.candidate_count;
          const maStr = maCount != null
            ? (maCount > 0 ? `${maCount} candidate${maCount > 1 ? 's' : ''}` : '0 detected')
            : 'Not available';
          const exudateCount = ra?.exudates?.candidate_count;
          const exudateStr = exudateCount != null
            ? (exudateCount > 0 ? `${exudateCount} candidate${exudateCount > 1 ? 's' : ''}` : '0 detected')
            : 'Not available';
          const hemCount = ra?.hemorrhage?.candidate_count;
          const hemStr = hemCount != null
            ? (hemCount > 0 ? `${hemCount} candidate${hemCount > 1 ? 's' : ''}` : '0 detected')
            : 'Not available';
          const nvScore = ra?.neovascularization?.score;
          const nvStr = nvScore != null
            ? `Score: ${nvScore.toFixed(2)}`
            : 'Not evaluated';

          const combinedOverlayUrl = ra?.retinal_analysis_overlay_image || ra?.retinal_analysis_overlay_image_url || ra?.anatomy_overlay_image || ra?.anatomy_overlay_image_url;

          return (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-teal-600" />
                    <span>MATLAB Retinal Evidence</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Structural retinal morphology extraction &amp; lesion candidate maps.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                  MATLAB Pipeline
                </span>
              </div>

              {/* Primary: Combined Retinal Analysis Overlay */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-teal-600" />
                    <span>Combined Retinal Analysis Overlay (Primary Evidence)</span>
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">Click to enlarge</span>
                </div>
                <div
                  className="bg-slate-950 rounded-xl overflow-hidden p-3 flex flex-col items-center justify-center min-h-[220px] border border-slate-300 relative group cursor-pointer"
                  onClick={() => combinedOverlayUrl && setPreviewModal({
                    url: combinedOverlayUrl,
                    title: "Combined Retinal Analysis Overlay",
                    description: "Multi-layer composite visualizing vessel arborization (green), candidate microaneurysms (red), exudates (yellow), hemorrhages (magenta), optic disc boundary (yellow), and fovea (+)."
                  })}
                >
                  {combinedOverlayUrl ? (
                    <>
                      <img
                        src={combinedOverlayUrl}
                        alt="Combined Retinal Analysis Overlay"
                        className="max-h-80 object-contain rounded-lg transition-transform group-hover:scale-[1.01]"
                      />
                      <div className="absolute top-3 right-3 px-2.5 py-1 bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg backdrop-blur-xs flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Full Preview</span>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center text-slate-400 space-y-1">
                      <Info className="w-6 h-6 mx-auto text-slate-500" />
                      <span className="text-xs font-medium block">Combined Retinal Analysis Overlay image not available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Secondary: Individual Candidate Maps (2x2 Grid) */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-teal-600" />
                    <span>Individual Lesion Candidate Maps</span>
                  </h4>
                  <span className="text-[10px] text-slate-500 font-semibold">4 Candidate Maps</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <EvidenceImageCard
                    url={ra?.microaneurysm?.mask_image || ra?.microaneurysm?.mask_url}
                    title="Microaneurysm Candidate Map"
                    countStr={maStr}
                    description="Capillary microaneurysm candidates in green channel."
                    onPreview={setPreviewModal}
                  />
                  <EvidenceImageCard
                    url={ra?.exudates?.mask_image || ra?.exudates?.mask_url}
                    title="Hard Exudate Candidate Map"
                    countStr={exudateStr}
                    description="Bright lipid and protein intraretinal deposits."
                    onPreview={setPreviewModal}
                  />
                  <EvidenceImageCard
                    url={ra?.hemorrhage?.mask_image || ra?.hemorrhage?.mask_url}
                    title="Hemorrhage Candidate Map"
                    countStr={hemStr}
                    description="Dark intraretinal blot and flame hemorrhage candidates."
                    onPreview={setPreviewModal}
                  />
                  <EvidenceImageCard
                    url={ra?.vessels?.mask_image || ra?.vessels?.mask_url}
                    title="Vessel Segmentation"
                    countStr={vesselStr}
                    description="Binary retinal vascular structure segmentation."
                    onPreview={setPreviewModal}
                  />
                </div>
              </div>

              {/* Candidate Disclaimer */}
              <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  <strong>Clinical Notice:</strong> Algorithmic candidate evidence is assistive feature extraction and does not confirm disease without clinician review.
                </span>
              </div>
            </div>
          );
        })()
      )}

      {/* 6. COLLAPSIBLE TECHNICAL DETAILS (COLLAPSED BY DEFAULT) */}
      {!isNonFundus && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setIsTechnicalExpanded(!isTechnicalExpanded)}
            className="w-full p-5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Technical Details &amp; Pipeline Execution Trace</h3>
                <p className="text-[11px] text-slate-500">Model outputs, quality scores, MATLAB measurements, and calibration notes</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-3 py-1 rounded-lg border border-teal-200">
              {isTechnicalExpanded ? 'Hide Details ▲' : 'Show Details ▼'}
            </span>
          </button>

          {isTechnicalExpanded && (
            <div className="p-6 border-t border-slate-200 space-y-5 bg-slate-50/50 animate-in fade-in text-xs">
              {/* Model Confidence Details */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider">
                  Raw Model Softmax Output (Uncalibrated)
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-black font-mono text-teal-800">{prediction?.confidence}%</span>
                  <span className="text-slate-500">Raw softmax confidence value</span>
                </div>
                <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  <strong>Caveat:</strong> Raw softmax confidence is a mathematical output of the neural network and is NOT a calibrated medical probability of disease.
                </p>
              </div>

              {/* Quality Checklist & CLAHE */}
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider">
                  Stage 1: Physical Image Quality Assessment
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {Object.entries(imageQuality.checks).map(([key, val]) => (
                    <div
                      key={key}
                      className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 capitalize ${
                        val ? 'bg-emerald-50 border-emerald-200 text-emerald-900 font-semibold' : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      {val ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                      <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-slate-600">
                  Overall Quality Score: <strong>{imageQuality.score}/100</strong> &bull; CLAHE Enhancement: <strong>{enhancement?.applied ? 'Applied' : 'Bypassed (Diagnostic Quality Scan)'}</strong>
                </div>
              </div>

              {/* MATLAB Retinal Metrics Summary */}
              {(() => {
                const ra = (screening.evidence || screening.matlabResult?.evidence)?.retinal_analysis;
                if (!ra) return null;
                return (
                  <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider">
                      Stage 3: MATLAB Retinal Morphology Metrics
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-500 uppercase block">Optic Disc</span>
                        <span className="font-bold text-slate-800">{ra.optic_disc?.found ? `Found (${Math.round(ra.optic_disc.radius || 0)}px)` : 'Not detected'}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-500 uppercase block">Fovea</span>
                        <span className="font-bold text-slate-800">{ra.fovea?.estimated ? 'Estimated' : 'Not located'}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-500 uppercase block">Vessel Density</span>
                        <span className="font-bold text-slate-800">{ra.vessels?.density != null ? `${(ra.vessels.density * 100).toFixed(1)}%` : 'N/A'}</span>
                      </div>
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <span className="text-[10px] text-slate-500 uppercase block">Neovascularization</span>
                        <span className="font-bold text-slate-800">{ra.neovascularization?.score != null ? ra.neovascularization.score.toFixed(2) : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* 7. PATIENT / CHO ASSISTIVE EXPLANATION */}
      {!isNonFundus && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Patient-Facing Clinical Guidance</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Plain-language summary of findings for patient counseling.
              </p>
            </div>

            {aiExplanation && (
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200 shrink-0">
                {aiExplanation.source === 'llm' ? 'Assistive AI' : 'Standard Protocol'}
              </span>
            )}
          </div>

          {aiLoading ? (
            <div className="flex items-center gap-3 text-sm text-slate-600 py-4">
              <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <span>Generating clinical explanation...</span>
            </div>
          ) : aiExplanation ? (
            <div className="space-y-4 text-xs">
              <p className="text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-medium">
                {aiExplanation.explanation}
              </p>

              {aiExplanation.precautions && aiExplanation.precautions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-500 block">
                    Recommended Patient Precautions
                  </span>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {aiExplanation.precautions.map((p, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-3 font-medium"
                      >
                        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-2">
              Detailed explanation is currently unavailable. Review the image evidence and clinical result above.
            </p>
          )}
        </div>
      )}

      {/* ── FOLLOW-UP RECOMMENDATION & REFERRAL NOTIFICATION SECTION ── */}
      {screening.status === 'completed' && screening.prediction && (
        (() => {
          const followUp = getFollowUpRecommendation(screening.prediction?.grade ?? 0, screening.createdAt);
          const hasPhone = Boolean(patientData?.contactNumber);

          return (
            <div className="bg-white rounded-2xl border-2 border-teal-600/30 p-6 sm:p-7 shadow-xs space-y-6">
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
                      <CalendarClock className="w-5 h-5 text-teal-700" />
                    </span>
                    <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                      Post-Screening Follow-up &amp; Referral Recommendation
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500">
                    Calculated automatically from detected DR severity ({followUp.gradeLabel}) &bull; Primary Health Centre Protocol
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    followUp.isUrgent
                      ? 'bg-rose-50 text-rose-700 border-rose-300 animate-pulse'
                      : followUp.isReferralRequired
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  }`}>
                    {followUp.isUrgent ? '🚨 URGENT SPECIALIST REFERRAL' : followUp.isReferralRequired ? '⚠️ SPECIALIST REFERRAL REQUIRED' : '✅ PHC FOLLOW-UP'}
                  </span>
                </div>
              </div>

              {/* Core Recommendation Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Recommended Interval */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Recommended Interval
                  </span>
                  <div className="text-lg font-black text-slate-900">
                    {followUp.intervalLabel}
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium">From screening date</p>
                </div>

                {/* 2. Suggested Appointment Date */}
                <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800">
                    Suggested Target Date
                  </span>
                  <div className="text-lg font-black text-teal-950 font-mono">
                    {new Date(followUp.suggestedDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <p className="text-[11px] text-teal-800 font-medium">Auto-computed schedule</p>
                </div>

                {/* 3. Follow-up Destination */}
                <div className={`p-4 rounded-xl border space-y-1 ${
                  followUp.isReferralRequired
                    ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                }`}>
                  <span className="text-[11px] font-bold uppercase tracking-wider block opacity-80">
                    Follow-Up Destination
                  </span>
                  <div className="text-sm font-bold flex items-center gap-1.5 leading-snug">
                    <Building2 className="w-4 h-4 shrink-0" />
                    <span>{followUp.destinationLabel}</span>
                  </div>
                </div>

                {/* 4. Patient Notification Contact */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Mobile SMS Contact
                  </span>
                  <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{patientData?.contactNumber || 'No mobile saved'}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {hasPhone ? '✅ Ready for SMS reminders' : '⚠️ No mobile on patient file'}
                  </p>
                </div>
              </div>

              {/* Action Explanation / Clinical Guidance Box */}
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                  <UserCheck className="w-4 h-4 text-teal-700" />
                  <span>Clinical Action &amp; Protocol:</span>
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {followUp.actionExplanation}
                </p>
              </div>

              {/* Referral Guidance Tracking (When Referral Required: Grade 3 or 4) */}
              {followUp.isReferralRequired && (
                <div className={`p-5 rounded-xl border-2 space-y-3 ${
                  followUp.isUrgent ? 'bg-rose-50/70 border-rose-300 text-rose-950' : 'bg-amber-50/70 border-amber-300 text-amber-950'
                }`}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`w-5 h-5 ${followUp.isUrgent ? 'text-rose-600' : 'text-amber-600'}`} />
                      <h4 className="text-sm font-extrabold tracking-tight">
                        {followUp.isUrgent ? 'Urgent Vitreoretinal Specialist Referral Protocol' : 'Ophthalmology Referral Protocol'}
                      </h4>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-white border border-slate-300 text-slate-700">
                      Referral Action Tracking
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed opacity-90">
                    Patient presents with <strong>{followUp.gradeLabel}</strong>. In accordance with National Health Mission DR Guidelines, refer to an ophthalmology unit for dilated slit-lamp biomicroscopy and optical coherence tomography (OCT).
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">Referral Destination Facility</label>
                      <input
                        type="text"
                        value={referralFacility}
                        onChange={(e) => setReferralFacility(e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-800 mb-1">Referral Attendance Status</label>
                      <select
                        value={referralStatus}
                        onChange={(e) => setReferralStatus(e.target.value as any)}
                        className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-bold"
                      >
                        <option value="pending">⏳ Referral Pending / Scheduled</option>
                        <option value="referred">📋 Patient Formally Referred &amp; Counseled</option>
                        <option value="attended">✅ Patient Attended Specialist Visit</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Automated Reminder Dispatch & Follow-up Tracking Bar */}
              <div className="p-4 sm:p-5 rounded-xl bg-petrol-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-300 flex items-center gap-1.5">
                      <CalendarCheck className="w-4 h-4 text-teal-400" />
                      Automated DR Follow-Up &amp; SMS Protocol
                    </span>
                    {existingReminder ? (
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                        existingReminder.notificationStatus === 'sent'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : existingReminder.notificationStatus === 'no_contact'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                      }`}>
                        {existingReminder.reminderId} &bull; {existingReminder.notificationStatus.toUpperCase()}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        AUTO-GENERATED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {existingReminder ? (
                      existingReminder.notificationStatus === 'sent' ? (
                        <>✅ Follow-up scheduled for <strong>{existingReminder.scheduledDate}</strong>. Automated SMS notification dispatched to <strong>{existingReminder.patientPhone || patientData?.contactNumber}</strong>.</>
                      ) : existingReminder.notificationStatus === 'no_contact' ? (
                        <>⚠️ Follow-up recorded for <strong>{existingReminder.scheduledDate}</strong>. Mobile number missing on patient file; update contact in reminders dashboard to dispatch SMS.</>
                      ) : (
                        <>Follow-up appointment scheduled for <strong>{existingReminder.scheduledDate}</strong> ({followUp.destinationLabel}).</>
                      )
                    ) : (
                      <>Automated follow-up calculated for <strong>{new Date(followUp.suggestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong> ({followUp.intervalLabel}). Managed automatically via NetraCare protocol.</>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/dashboard/reminders"
                    className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <span>Manage in Follow-Up Dashboard &rarr;</span>
                  </Link>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* PREVIEW MODAL */}
      {previewModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{previewModal.title}</h3>
                {previewModal.countStr && (
                  <span className="text-xs text-teal-700 font-semibold block mt-0.5">{previewModal.countStr}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 flex items-center justify-center flex-1 min-h-[300px] overflow-auto">
              <img
                src={previewModal.url}
                alt={previewModal.title}
                className="max-h-[60vh] object-contain rounded-lg"
              />
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-2 text-xs">
              {previewModal.description && (
                <p className="text-slate-700 font-medium">{previewModal.description}</p>
              )}
              <p className="text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 leading-relaxed">
                <strong>Disclaimer:</strong> Algorithmic candidate evidence is not clinically confirmed pathology. Final diagnosis requires clinical examination by a qualified ophthalmologist.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

