'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Search, Printer, Calendar, ArrowRight } from 'lucide-react';
import { getScreeningHistory } from '@/lib/api/screening';
import { ScreeningResult } from '@/lib/api/types';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';

export default function ReportsIndexPage() {
  const [screenings, setScreenings] = useState<ScreeningResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { items } = await getScreeningHistory({ search: debouncedSearch });
        setScreenings(items);
      } catch (err) {
        console.error('Failed to load reports:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [debouncedSearch]);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-line-200">
        <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight flex items-center gap-2">
            <span>Screening reports archive</span>
          </h1>
        </div>
        <p className="text-xs text-slate-500 mt-1 pl-3">
          Official printable screening reports for PHC patients and specialist referrals.
        </p>
      </div>

      {/* Search */}
      <div className="bg-paper-0 p-4 rounded-xl border border-line-200">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search reports by patient name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 text-ink-900"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-paper-0 rounded-xl border border-line-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-3 border-petrol-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium">Loading screening reports...</p>
          </div>
        ) : screenings.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-ink-900">No reports found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-mist-100 text-slate-600 text-xs font-semibold border-b border-line-200">
                  <th className="py-2.5 px-4">Patient</th>
                  <th className="py-2.5 px-4">Screening ID</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">DR prediction</th>
                  <th className="py-2.5 px-4 w-40 text-right pr-6">Risk triage</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-200">
                {screenings.map((s) => {
                  const isElevatedRisk = s.risk?.level !== 'LOW RISK';

                  return (
                    <tr key={s.screeningId} className="hover:bg-mist-100/60 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-ink-900">
                        {s.patientName}
                        <span className="block text-[11px] font-mono font-normal text-slate-400">{s.patientId}</span>
                      </td>
                      <td className="py-2.5 px-4 text-xs font-mono text-slate-500">
                        {s.screeningId}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 font-mono">
                        {new Date(s.date).toLocaleDateString('en-IN')}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-ink-900">
                        {s.prediction?.label || 'Quality Issue'}
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
                          href={`/dashboard/reports/${s.screeningId}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-petrol-600 bg-mist-100 hover:bg-slate-200 px-3 py-1 rounded-md border border-line-200"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print report</span>
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
