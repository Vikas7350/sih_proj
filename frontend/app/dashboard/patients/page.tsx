'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Search, UserPlus, Eye, Calendar, ArrowRight } from 'lucide-react';
import { getPatients } from '@/lib/api/patients';
import { Patient } from '@/lib/api/types';
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue';

export default function PatientsListPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const list = await getPatients(debouncedSearch);
        setPatients(list);
      } catch (err) {
        console.error('Failed to load patients:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [debouncedSearch]);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line-200">
        <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight flex items-center gap-2">
            <span>PHC patient management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Registered diabetic patients at Alandi Rural Primary Health Centre.
          </p>
        </div>

        <Link
          href="/dashboard/patients/register"
          className="px-4 py-2.5 bg-petrol-600 hover:bg-[#0c595c] text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Register new patient</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="bg-paper-0 p-4 rounded-xl border border-line-200">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search patient by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 text-ink-900"
          />
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-paper-0 rounded-xl border border-line-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-8 h-8 border-3 border-petrol-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium">Loading patients directory...</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-ink-900">No patients found</p>
            <Link
              href="/dashboard/patients/register"
              className="inline-block px-4 py-2 bg-petrol-600 text-white text-xs font-semibold rounded-lg"
            >
              + Register first patient
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-mist-100 text-slate-600 text-xs font-semibold border-b border-line-200">
                  <th className="py-2.5 px-4">Patient name</th>
                  <th className="py-2.5 px-4">Patient ID</th>
                  <th className="py-2.5 px-4">Age / Gender</th>
                  <th className="py-2.5 px-4">Diabetes history</th>
                  <th className="py-2.5 px-4">Contact</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-200">
                {patients.map((p) => (
                  <tr key={p.id} className="hover:bg-mist-100/60 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-ink-900">
                      <Link href={`/dashboard/patients/${p.id}`} className="hover:text-petrol-600">
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4 text-xs font-mono text-slate-500">
                      {p.patientId}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700 font-medium">
                      {p.age} Yrs &bull; {p.gender}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-petrol-600 font-semibold">
                      {p.diabetesDurationYears} years
                    </td>
                    <td className="py-2.5 px-4 text-xs font-mono text-slate-500">
                      {p.contactNumber || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right space-x-2">
                      <Link
                        href={`/dashboard/screening/new?patientId=${p.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-petrol-600 bg-mist-100 hover:bg-slate-200 px-3 py-1 rounded-md border border-line-200 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-petrol-600" />
                        <span>Start screening</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
