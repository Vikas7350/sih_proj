'use client';

import { useState, useEffect } from 'react';
import { Building2, Save, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getPHCProfile, updatePHCProfile } from '@/lib/api/phc';
import { PHCProfile } from '@/lib/api/types';

export default function PHCProfilePage() {
  const [profile, setProfile] = useState<PHCProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function loadPHC() {
      try {
        const data = await getPHCProfile();
        setProfile(data);
      } catch (err) {
        console.error('Failed to load PHC profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPHC();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);
    setSavedSuccess(false);

    try {
      const updated = await updatePHCProfile(profile);
      setProfile(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Failed to update PHC profile:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center space-y-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-700">Loading PHC Profile details...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="pb-4 border-b border-line-200">
        <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
          <h1 className="text-2xl font-bold text-ink-900 tracking-tight flex items-center gap-2">
            <span>PHC profile & settings</span>
          </h1>
        </div>
        <p className="text-xs text-slate-500 mt-1 pl-3">
          View and update institutional information for your associated Primary Health Centre.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>PHC details updated successfully!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-paper-0 p-6 rounded-xl border border-line-200 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">PHC name *</label>
            <input
              type="text"
              required
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">PHC institutional code *</label>
            <input
              type="text"
              required
              value={profile.code}
              onChange={(e) => setProfile({ ...profile, code: e.target.value })}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 font-mono uppercase text-ink-900"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">State *</label>
            <input
              type="text"
              required
              value={profile.state}
              onChange={(e) => setProfile({ ...profile, state: e.target.value })}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">District *</label>
            <input
              type="text"
              required
              value={profile.district}
              onChange={(e) => setProfile({ ...profile, district: e.target.value })}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
            />
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">Full address *</label>
            <textarea
              rows={2}
              required
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">Contact phone number *</label>
            <input
              type="tel"
              required
              value={profile.contactNumber}
              onChange={(e) => setProfile({ ...profile, contactNumber: e.target.value })}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 font-mono text-ink-900"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-ink-900 mb-1">Healthcare worker / CHO name</label>
            <input
              type="text"
              value={profile.healthcareWorkerName || ''}
              onChange={(e) => setProfile({ ...profile, healthcareWorkerName: e.target.value })}
              className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
            />
          </div>
        </div>

        <div className="p-3.5 rounded-lg bg-mist-100 border border-line-200 text-xs text-slate-600 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-petrol-600 shrink-0" />
          <span>PHC credentials and institutional code are attached to all generated AI screening reports.</span>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 px-6 bg-petrol-600 hover:bg-[#0c595c] text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving changes...' : 'Save changes'}</span>
        </button>
      </form>
    </div>
  );
}
