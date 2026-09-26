'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Printer, Download, Eye, ArrowLeft, Building2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { getScreeningReport } from '@/lib/api/reports';
import { ScreeningReport } from '@/lib/api/types';

export default function ScreeningReportPage() {
  const pathname = usePathname();
  const screeningId = pathname.split('/').pop() || '';

  const [report, setReport] = useState<ScreeningReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReport() {
      if (!screeningId) return;
      try {
        const data = await getScreeningReport(screeningId);
        setReport(data);
      } catch (err) {
        console.error('Failed to load report:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [screeningId]);

  if (loading) {
    return (
      <div className="p-16 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Generating official screening report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-12 bg-white rounded-xl border border-slate-200 text-center space-y-4 max-w-md mx-auto">
        <p className="text-sm font-bold text-slate-900">Report Not Found</p>
        <Link href="/dashboard" className="inline-block px-4 py-2 bg-teal-600 text-white text-xs font-semibold rounded-lg">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Bar Actions (Hidden during print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <Link
          href={`/dashboard/screening/${report.screeningId}`}
          className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg w-fit flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Screening Result</span>
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Official Report</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Printable Report Document Sheet */}
      <div className="bg-white p-8 sm:p-12 rounded-2xl border border-slate-300 shadow-lg text-slate-900 space-y-8 print:border-none print:shadow-none print:p-0">
        {/* Header Header branding */}
        <div className="flex items-start justify-between pb-6 border-b-2 border-slate-900">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold">
                <Eye className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-slate-900">
                NetraCare PHC Screening
              </span>
            </div>
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              AI-Powered Early Diabetic Retinopathy Screening System
            </p>
            <p className="text-xs text-slate-600">
              National Health Mission &bull; Primary Health Care Division
            </p>
          </div>

          <div className="text-right text-xs space-y-0.5">
            <h3 className="font-bold text-slate-900 text-sm">{report.phcName}</h3>
            <p className="text-slate-600 font-mono">Code: {report.phcCode}</p>
            <p className="text-slate-600">{report.district}, {report.state}</p>
            <p className="text-slate-500 font-mono text-[11px] pt-1">Generated: {new Date(report.reportGeneratedAt).toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Patient & Exam Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
          <div>
            <span className="text-slate-500 block font-medium">Patient Name</span>
            <span className="font-bold text-slate-900 text-sm">{report.patientName}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Patient ID</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{report.patientId}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Age / Gender</span>
            <span className="font-semibold text-slate-900">{report.patientAge} Yrs / {report.patientGender}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Diabetes Duration</span>
            <span className="font-bold text-teal-800">{report.diabetesDurationYears} Years</span>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Eye Examined</span>
            <span className="font-bold uppercase text-slate-900">{report.eye} Eye (OD/OS)</span>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Screening Date</span>
            <span className="font-medium text-slate-900">{new Date(report.date).toLocaleDateString('en-IN')}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Examiner / CHO</span>
            <span className="font-semibold text-slate-900">{report.healthcareWorkerName}</span>
          </div>
          <div>
            <span className="text-slate-500 block font-medium">Report Status</span>
            <span className="font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Verified
            </span>
          </div>
        </div>

        {/* AI Screening Result Box */}
        <div className="p-6 rounded-xl bg-teal-50/80 border border-teal-200 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs uppercase font-bold text-teal-800 tracking-wider">
                AI Screening Prediction
              </span>
              <h2 className="text-2xl font-extrabold text-teal-950 mt-0.5">
                {report.prediction?.label || 'Quality Failed'}
              </h2>
            </div>
            {report.prediction && (
              <div className="text-right">
                <span className="text-xs text-teal-800 block font-medium">AI Confidence</span>
                <span className="text-xl font-extrabold text-teal-900 font-mono">{report.prediction.confidence}%</span>
              </div>
            )}
          </div>
          <p className="text-xs text-teal-900 leading-relaxed">{report.prediction?.description}</p>
        </div>

        {/* Grad-CAM & Fundus Imagery */}
        <div className="space-y-3 print:break-inside-avoid">
          <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider">
            Retinal Imagery & AI Attention Map
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl p-2 text-center bg-slate-900">
              <span className="text-[11px] font-bold text-slate-300 block mb-1">Fundus Image</span>
              <img src={report.imageUrl} alt="Fundus" className="h-44 mx-auto object-contain rounded-lg" />
            </div>
            <div className="border border-slate-200 rounded-xl p-2 text-center bg-slate-900">
              <span className="text-[11px] font-bold text-slate-300 block mb-1">AI Grad-CAM Heatmap</span>
              <img src={report.heatmapUrl || report.imageUrl} alt="Grad-CAM" className="h-44 mx-auto object-contain rounded-lg" />
            </div>
          </div>
        </div>

        {/* Retinal Structure & Lesion Candidate Evidence (MATLAB) */}
        {(() => {
          const evidence = report.evidence || report.matlabResult?.evidence;
          const ra = evidence?.retinal_analysis;
          if (!ra) return null;

          const combinedOverlayUrl = ra?.retinal_analysis_overlay_image || ra?.retinal_analysis_overlay_image_url || ra?.anatomy_overlay_image || ra?.anatomy_overlay_image_url;

          const maCount = ra?.microaneurysm?.candidate_count;
          const maStr = maCount != null ? `Microaneurysms: ${maCount} candidate${maCount !== 1 ? 's' : ''}` : 'Microaneurysms: 0 candidates';
          const maUrl = ra?.microaneurysm?.mask_image || ra?.microaneurysm?.mask_url;

          const exudateCount = ra?.exudates?.candidate_count;
          const exudateStr = exudateCount != null ? `Exudates: ${exudateCount} candidate${exudateCount !== 1 ? 's' : ''}` : 'Exudates: 0 candidates';
          const exudateUrl = ra?.exudates?.mask_image || ra?.exudates?.mask_url;

          const hemCount = ra?.hemorrhage?.candidate_count;
          const hemStr = hemCount != null ? `Hemorrhages: ${hemCount} candidate${hemCount !== 1 ? 's' : ''}` : 'Hemorrhages: 0 candidates';
          const hemUrl = ra?.hemorrhage?.mask_image || ra?.hemorrhage?.mask_url;

          const vesselDensity = ra?.vessels?.density;
          const vesselStr = vesselDensity != null ? `Vessels: ${(vesselDensity * 100).toFixed(1)}% density` : (ra?.vessels ? 'Vessels: Segmented' : 'Vessels: Not available');
          const vesselUrl = ra?.vessels?.mask_image || ra?.vessels?.mask_url;

          const candidateMaps = [
            { title: "Microaneurysm Candidate Map", metric: maStr, url: maUrl },
            { title: "Exudate Candidate Map", metric: exudateStr, url: exudateUrl },
            { title: "Hemorrhage Candidate Map", metric: hemStr, url: hemUrl },
            { title: "Vessel Segmentation Mask", metric: vesselStr, url: vesselUrl },
          ].filter(m => !!m.url);

          return (
            <div className="space-y-4 print:break-inside-avoid">
              <div className="border-b border-slate-200 pb-1">
                <h3 className="text-xs uppercase font-bold text-slate-700 tracking-wider">
                  Retinal Structure &amp; Lesion Candidate Evidence
                </h3>
              </div>

              {/* Combined Retinal Analysis Overlay */}
              {combinedOverlayUrl && (
                <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-950 text-center space-y-1">
                  <span className="text-[11px] font-bold text-slate-300 block">Combined Retinal Analysis Overlay</span>
                  <img
                    src={combinedOverlayUrl}
                    alt="Combined Retinal Analysis Overlay"
                    className="h-44 mx-auto object-contain rounded-lg"
                    onError={(e) => { (e.target as HTMLElement).parentElement!.style.display = 'none'; }}
                  />
                </div>
              )}

              {/* Individual Candidate Maps (2-column layout) */}
              {candidateMaps.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {candidateMaps.map((map, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl p-2 bg-slate-900 text-center space-y-1">
                      <span className="text-[11px] font-bold text-slate-200 block">{map.title}</span>
                      <span className="text-[10px] font-semibold text-teal-300 block">{map.metric}</span>
                      <img
                        src={map.url}
                        alt={map.title}
                        className="h-36 mx-auto object-contain rounded-lg"
                        onError={(e) => { (e.target as HTMLElement).parentElement!.style.display = 'none'; }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Candidate Disclaimer */}
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 leading-snug">
                Algorithmic candidate evidence is not clinically confirmed pathology. Final diagnosis requires clinical examination by a qualified ophthalmologist.
              </div>
            </div>
          );
        })()}

        {/* Risk Triage & Referral */}
        <div className="p-5 rounded-xl bg-slate-900 text-white space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">Triage Level</span>
            <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500 text-white">
              {report.risk?.level}
            </span>
          </div>
          <p className="text-sm font-bold text-amber-300">{report.risk?.recommendation}</p>
          <p className="text-xs text-slate-300">{report.risk?.actionRequired}</p>
        </div>

        {/* Disclaimer & Signature Footer */}
        <div className="pt-6 border-t border-slate-200 space-y-6">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              <strong>Medical Disclaimer:</strong> This AI screening assessment is generated for decision support in rural primary health centres. It is not an autonomous clinical diagnosis. A comprehensive dilated retinal exam by an ophthalmologist is required for clinical confirmation.
            </span>
          </div>

          <div className="flex justify-between items-end pt-8">
            <div className="text-xs text-slate-500">
              <p className="font-bold text-slate-900">PHC Screening Operator</p>
              <p>{report.healthcareWorkerName}</p>
              <p className="font-mono text-[10px] text-slate-400">Stamp / Signature</p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="font-bold text-slate-900">Ophthalmologist Referral Verification</p>
              <p className="h-8 border-b border-slate-300 w-48 ml-auto"></p>
              <p className="text-[10px] text-slate-400">Doctor Signature & Registration No.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
