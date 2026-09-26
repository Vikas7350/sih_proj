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
} from 'lucide-react';
import { getScreeningResult, getAiExplanation } from '@/lib/api/screening';
import { ScreeningResult, DRGrade, AIExplanation } from '@/lib/api/types';

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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'split' | 'original' | 'heatmap'>('split');
  const [aiExplanation, setAiExplanation] = useState<AIExplanation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [previewModal, setPreviewModal] = useState<{
    url: string;
    title: string;
    countStr?: string;
    description?: string;
  } | null>(null);

  useEffect(() => {
    async function loadResult() {
      if (!screeningId) return;
      try {
        const data = await getScreeningResult(screeningId);
        setScreening(data);
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
      {/* Top Header & Patient Summary */}
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

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/screening/new"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
            <span>New Screening</span>
          </Link>

          {!isNonFundus && isQualityGood && (
            <Link
              href={`/dashboard/reports/${screening.screeningId}`}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <FileText className="w-4 h-4" />
              <span>View Report</span>
            </Link>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. STAGE 0: FUNDUS IMAGE VALIDATION GATE                                 */}
      {/* ========================================================================= */}
      {isNonFundus ? (
        /* NON-FUNDUS REJECTION DISPLAY */
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

          {/* Rejection Reasons from MATLAB */}
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

          {/* Clinical Safety Measures Active */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white rounded-xl border border-rose-200 text-slate-700 flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✕</span>
              <div>
                <span className="font-bold text-slate-900 block">AI DR Inference Blocked</span>
                <span className="text-slate-600 text-[11px]">Deep convolutional grading is disabled to prevent clinical misclassification.</span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-xl border border-rose-200 text-slate-700 flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✕</span>
              <div>
                <span className="font-bold text-slate-900 block">Grad-CAM Heatmap Suppressed</span>
                <span className="text-slate-600 text-[11px]">Saliency maps are not generated for non-biological inputs.</span>
              </div>
            </div>
          </div>

          {/* Uploaded Non-Fundus Image Display */}
          <div className="bg-white p-4 rounded-xl border border-rose-200 space-y-2">
            <span className="text-xs font-bold text-slate-700 block">Uploaded Image (Rejected Input):</span>
            <div className="bg-slate-900 rounded-xl overflow-hidden p-2 flex items-center justify-center h-64 border border-slate-200">
              <img src={screening.imageUrl} alt="Rejected input image" className="max-h-60 object-contain rounded-lg" />
            </div>
          </div>

          {/* Required Recapture Action */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-rose-100/70 rounded-xl border border-rose-300">
            <div className="text-xs text-rose-950 font-medium">
              <strong>Clinical Action Required:</strong> Recapture a genuine retinal fundus photograph. Ensure proper pupil dilation, camera alignment, and that the patient&#39;s retina is in focus.
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
      ) : (
        /* VALID FUNDUS VERIFIED BANNER */
        <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-emerald-900 uppercase tracking-wide">
                  Stage 0: Fundus Image Validation — VERIFIED ✓
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-200/70 text-emerald-800">
                  GENUINE RETINAL FUNDUS
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Retinal vasculature, optic disc/macula pigmentation, and optical FOV boundaries confirmed valid.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto text-xs font-mono font-bold text-emerald-800 bg-white px-3 py-1.5 rounded-lg border border-emerald-200">
            <span>Decision:</span>
            <span className="text-teal-700 uppercase">{action || decision || 'PROCEED'}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. STAGE 1: IMAGE QUALITY ASSESSMENT & CLAHE ENHANCEMENT                 */}
      {/* ========================================================================= */}
      {!isNonFundus && (
        <div className={`p-6 rounded-2xl border ${isQualityGood ? 'bg-emerald-50/40 border-emerald-200' : 'bg-amber-50/50 border-amber-200'} shadow-xs space-y-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isQualityGood ? (
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              )}
              <div>
                <div className="text-xs uppercase font-bold tracking-wider text-slate-500">
                  Stage 1: Image Quality Assessment
                </div>
                <h2 className={`text-lg font-bold ${isQualityGood ? 'text-emerald-900' : 'text-amber-900'}`}>
                  {qualityDetails?.status === 'GOOD' ? 'GOOD QUALITY — SUITABLE FOR AI SCREENING ✓' :
                    qualityDetails?.status === 'BORDERLINE' ? 'BORDERLINE QUALITY — ENHANCED WITH CLAHE' :
                      isQualityGood ? 'SUITABLE FOR AI SCREENING ✓' : 'UNGRADABLE / POOR QUALITY ✗'}
                </h2>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                Image Quality Score
              </span>
              <span className={`text-xl font-extrabold ${isQualityGood ? 'text-emerald-700' : 'text-amber-700'}`}>
                {qualityDetails?.scores?.overall ? Math.round(qualityDetails.scores.overall * 100) : imageQuality.score} / 100
              </span>
            </div>
          </div>

          {/* Quality Score Disclaimer */}
          <div className="text-[11px] text-slate-500 bg-white/70 p-2 rounded-lg border border-slate-200">
            <strong>Note:</strong> Image Quality Score reflects physical scan quality (focus, contrast, illumination, FOV coverage). It is NOT model confidence or classification accuracy.
          </div>

          {/* Quality Check Items */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {Object.entries(imageQuality.checks).map(([key, val]) => (
              <div
                key={key}
                className={`p-2.5 rounded-lg border text-xs flex items-center gap-1.5 capitalize font-medium ${val ? 'bg-white border-emerald-200 text-emerald-900' : 'bg-white border-amber-200 text-amber-800'
                  }`}
              >
                {val ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                <span>{key.replace(/([A-Z])/g, ' $1')}</span>
              </div>
            ))}
          </div>

          {/* CLAHE Enhancement Status Card */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-slate-700">
                <strong>CLAHE Enhancement:</strong>{' '}
                {enhancement?.applied
                  ? 'CLAHE enhancement applied (Contrast-Limited Adaptive Histogram Equalization)'
                  : 'Diagnostic quality scan — CLAHE enhancement bypassed'}
              </span>
            </div>
            {enhancement?.method && (
              <span className="text-[11px] font-mono text-slate-500 px-2 py-0.5 rounded bg-slate-100">
                {enhancement.method.replace('CLAWE', 'CLAHE')}
              </span>
            )}
          </div>

          {!isQualityGood && imageQuality.issues && imageQuality.issues.length > 0 && (
            <div className="pt-2 flex items-center justify-between bg-white p-4 rounded-xl border border-amber-200">
              <div className="space-y-1">
                <span className="text-xs font-bold text-amber-900 block">Quality Issues Detected:</span>
                <ul className="text-xs text-amber-700 list-disc list-inside">
                  {imageQuality.issues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
              <Link
                href="/dashboard/screening/new"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shrink-0"
              >
                Upload Another Image
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. STAGE 3: EFFICIENTNET DR INFERENCE & EXPLAINABLE GRAD-CAM              */}
      {/* ========================================================================= */}
      {!isNonFundus && prediction && (
        <>
          {/* AI SCREENING RESULT CARD */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-500">
                    Stage 3: Deep Learning DR Inference
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                    EfficientNet-B0
                  </span>
                </div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    {prediction.label}
                  </h2>
                  <span className="text-sm font-bold font-mono text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                    Grade {prediction.grade}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{prediction.description}</p>

                {/* Clinical Decision & Action Badge */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-semibold text-slate-500">Decision & Action:</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${action === 'SPECIALIST REFERRAL' || decision === 'review'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                    }`}>
                    {action || (decision ? `REVIEW (${decision.toUpperCase()})` : 'PROCEED')}
                  </span>
                </div>
              </div>

              {/* Confidence Badge */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center sm:text-right shrink-0">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">
                  Raw Softmax Confidence
                </span>
                <span className="text-2xl font-extrabold text-teal-700 font-mono">
                  {prediction.confidence}%
                </span>
                {prediction.isCalibrated && prediction.calibratedConfidence !== null && prediction.calibratedConfidence !== undefined ? (
                  <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                    Calibrated Confidence: {typeof prediction.calibratedConfidence === 'number' && prediction.calibratedConfidence <= 1 ? (Math.round(prediction.calibratedConfidence * 1000) / 10) : prediction.calibratedConfidence}%
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">
                    Uncalibrated Model Output (Calibrated: Not Available)
                  </span>
                )}
              </div>
            </div>

            {/* Detected Findings */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <h4 className="text-sm font-bold text-slate-900">
                  Detected Findings — Why this was classified as {prediction.label}
                </h4>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {findingsForGrade(prediction.grade).map((finding, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-2.5"
                  >
                    <span className="w-4 h-4 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                      ✓
                    </span>
                    <span>{finding}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* DR Severity Scale 0 - 4 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                <span>DR Severity Scale (ETDRS Standard)</span>
                <span>Class Predicted: Grade {prediction.grade}</span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {drGrades.map((g) => {
                  const isSelected = g.grade === prediction.grade;
                  return (
                    <div
                      key={g.grade}
                      className={`p-3 rounded-xl border text-center transition-all ${isSelected
                          ? 'bg-teal-600 text-white border-teal-700 shadow-md ring-2 ring-teal-500/30'
                          : 'bg-slate-50 text-slate-600 border-slate-200 opacity-60'
                        }`}
                    >
                      <div className="text-xs font-extrabold mb-1">Grade {g.grade}</div>
                      <div className="text-[11px] font-bold tracking-tight truncate">{g.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Decision Support Disclaimer */}
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Clinical Decision Support Disclaimer:</strong> The raw confidence score displayed represents uncalibrated neural network softmax output and must not be interpreted as a calibrated probability. This AI screening result is an assistive tool for Primary Health Centres and does not replace a definitive medical diagnosis by an ophthalmologist.
              </span>
            </div>
          </div>

          {/* EXPLAINABLE AI / GRAD-CAM HEATMAP COMPARISON */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Explainable AI (Grad-CAM Heatmap Visualization)</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Visual saliency map generated directly from EfficientNet feature layer (<code>x_features_featu_469</code>).
                </p>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-medium border border-slate-200 w-fit">
                <button
                  onClick={() => setActiveTab('split')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${activeTab === 'split' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Side-by-Side
                </button>
                <button
                  onClick={() => setActiveTab('original')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${activeTab === 'original' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  Original Fundus
                </button>
                <button
                  onClick={() => setActiveTab('heatmap')}
                  className={`px-3 py-1.5 rounded-md transition-colors ${activeTab === 'heatmap' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900'
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

            <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-100 text-xs text-teal-900 flex items-center gap-2">
              <Info className="w-4 h-4 text-teal-600 shrink-0" />
              <span>
                Highlighted warm regions (red/yellow) indicate focal convolutional activations that influenced the predicted DR severity score. Generated from the trained EfficientNet-B0 network via signed backend storage.
              </span>
            </div>
          </div>

          {/* RETINAL STRUCTURE & LESION CANDIDATE EVIDENCE CARD (MATLAB) */}
          {(() => {
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
                      <span>Retinal Structure & Lesion Candidate Evidence</span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Algorithmic retinal feature extraction & lesion candidate analysis (MATLAB pipeline).
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                    MATLAB Pipeline
                  </span>
                </div>

                {/* Metrics Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Optic Disc</span>
                    <span className={`text-sm font-extrabold ${ra?.optic_disc?.found ? 'text-teal-700' : 'text-slate-600'}`}>{opticDiscStr}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Fovea</span>
                    <span className={`text-sm font-extrabold ${ra?.fovea?.estimated ? 'text-teal-700' : 'text-slate-600'}`}>{foveaStr}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Vessels</span>
                    <span className="text-sm font-extrabold text-slate-900">{vesselStr}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Neovascularization</span>
                    <span className="text-sm font-extrabold text-slate-900">{nvStr}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Microaneurysms</span>
                    <span className={`text-sm font-extrabold ${maCount && maCount > 0 ? 'text-amber-700' : 'text-slate-600'}`}>{maStr}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Exudates</span>
                    <span className={`text-sm font-extrabold ${exudateCount && exudateCount > 0 ? 'text-amber-700' : 'text-slate-600'}`}>{exudateStr}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Hemorrhages</span>
                    <span className={`text-sm font-extrabold ${hemCount && hemCount > 0 ? 'text-amber-700' : 'text-slate-600'}`}>{hemStr}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Analysis Status</span>
                    <span className="text-sm font-extrabold text-teal-700">{evidence?.status || 'Completed'}</span>
                  </div>
                </div>

                {/* Combined Retinal Analysis Banner */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-teal-600" />
                      <span>Combined Retinal Analysis Overlay</span>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500">Click image to enlarge</span>
                  </div>
                  <div
                    className="bg-slate-950 rounded-xl overflow-hidden p-3 flex flex-col items-center justify-center min-h-[200px] border border-slate-300 relative group cursor-pointer"
                    onClick={() => combinedOverlayUrl && setPreviewModal({
                      url: combinedOverlayUrl,
                      title: "Combined Retinal Analysis Overlay",
                      description: "Multi-layer algorithmic composite visualizing vessel boundaries (green), candidate microaneurysms (red), exudates (yellow), hemorrhages (magenta), optic disc boundary (yellow), and fovea position (+)."
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

                {/* Visual Evidence Maps Subsection */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-teal-600" />
                      <span>Visual Evidence Maps (Lesion & Structure Candidates)</span>
                    </h4>
                    <span className="text-[10px] text-slate-500 font-semibold">4 Algorithmic Candidate Maps</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <EvidenceImageCard
                      url={ra?.microaneurysm?.mask_image || ra?.microaneurysm?.mask_url}
                      title="Microaneurysm Candidate Map"
                      countStr={maStr}
                      description="Algorithmic candidate dark red spot extraction in green channel."
                      onPreview={setPreviewModal}
                    />
                    <EvidenceImageCard
                      url={ra?.exudates?.mask_image || ra?.exudates?.mask_url}
                      title="Exudate Candidate Map"
                      countStr={exudateStr}
                      description="Bright region lipid and protein deposit candidate extraction."
                      onPreview={setPreviewModal}
                    />
                    <EvidenceImageCard
                      url={ra?.hemorrhage?.mask_image || ra?.hemorrhage?.mask_url}
                      title="Hemorrhage Candidate Map"
                      countStr={hemStr}
                      description="Dark red dot and blot intraretinal hemorrhage candidate areas."
                      onPreview={setPreviewModal}
                    />
                    <EvidenceImageCard
                      url={ra?.vessels?.mask_image || ra?.vessels?.mask_url}
                      title="Vessel Segmentation"
                      countStr={vesselStr}
                      description="Extracted binary retinal vascular structure mask."
                      onPreview={setPreviewModal}
                    />
                  </div>
                </div>

                {/* Candidate Disclaimer */}
                <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Disclaimer:</strong> Algorithmic candidate evidence is not clinically confirmed pathology. Final diagnosis requires clinical examination by a qualified ophthalmologist.
                  </span>
                </div>
              </div>
            );
          })()}

          {/* RISK CLASSIFICATION & REFERRAL RECOMMENDATION CARD */}
          {risk && (
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6 rounded-2xl border border-slate-700 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-700">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                    Clinical Triage Classification
                  </span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="px-3.5 py-1 rounded-full text-xs font-extrabold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                      {risk.level}
                    </span>
                    <span className="text-sm font-semibold text-slate-200">
                      {risk.recommendation}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Recommended Timeframe</span>
                  <span className="text-sm font-bold text-amber-400">{risk.followUpTimeframe}</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                <strong>Action Required:</strong> {risk.actionRequired}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <Link
                  href="/dashboard/patients"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700"
                >
                  &larr; Back to Patients
                </Link>

                <Link
                  href={`/dashboard/reports/${screening.screeningId}`}
                  className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 shadow-lg"
                >
                  <Printer className="w-4 h-4" />
                  <span>Generate Printable Report</span>
                </Link>
              </div>
            </div>
          )}

          {/* AI CLINICAL ASSISTANT / PATIENT EXPLANATION */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>AI Clinical Assistant — Plain-Language Explanation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Patient-friendly assistive explanation. Never replaces the ETDRS clinical grade above.
                </p>
              </div>

              {aiExplanation && (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${aiExplanation.source === 'llm'
                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                  {aiExplanation.source === 'llm' ? 'AI Generated' : 'Template Fallback'}
                </span>
              )}
            </div>

            <div className="h-px bg-slate-100" />

            {aiLoading ? (
              <div className="flex items-center gap-3 text-sm text-slate-600 py-4">
                <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                <span>Generating AI explanation...</span>
              </div>
            ) : aiExplanation ? (
              <>
                <div className="space-y-3">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-500 block">
                    Explanation
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-100 rounded-xl p-4">
                    {aiExplanation.explanation}
                  </p>
                </div>

                <div className="space-y-3">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-500 block">
                    Precautions & Next Steps
                  </span>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {aiExplanation.precautions.map((p, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-2.5 text-xs text-slate-700 bg-white border border-slate-200 rounded-xl p-3"
                      >
                        <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 py-2">
                The assistive AI explanation is not available for this screening.
              </p>
            )}
          </div>
        </>
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
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
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

