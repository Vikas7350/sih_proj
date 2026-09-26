'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Mail, MapPin, Phone, User, Loader2, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { completeProfile } from '@/lib/api/backendClient';
import { onboardingSchema } from '@/lib/validations';

interface OnboardingFormProps {
  initialName: string;
  initialEmail: string;
}

export default function OnboardingForm({ initialName, initialEmail }: OnboardingFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: initialName,
    phcName: '',
    phcCode: '',
    state: 'Maharashtra',
    district: 'Pune',
    address: '',
    contactNumber: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const validationResult = onboardingSchema.safeParse(formData);
    if (!validationResult.success) {
      const formattedErrors: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (path && !formattedErrors[path]) {
          formattedErrors[path] = issue.message;
        }
      });
      setFieldErrors(formattedErrors);
      setError(validationResult.error.issues[0]?.message || 'Please fix validation errors');
      return;
    }

    try {
      setIsLoading(true);
      // Backend attaches the PHC, clears needs_profile, and refreshes the
      // session cookie in its response — the dashboard takes over from there.
      await completeProfile(formData);
      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const inputCls =
    'w-full p-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20';

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <div>
              <h1 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Complete Your Profile
              </h1>
              <p className="text-xs text-slate-500 font-normal normal-case tracking-normal">
                One last step before you can use the dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
            <Mail className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-600 truncate">
              Signed in with Google as <strong>{initialEmail}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-slate-700 mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Dr. Ramesh Kumar"
                  className={`${inputCls} pl-9`}
                />
              </div>
              {fieldErrors.name && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="phcCode" className="block text-xs font-bold text-slate-700 mb-1">
                PHC Code *
              </label>
              <input
                id="phcCode"
                name="phcCode"
                type="text"
                required
                value={formData.phcCode}
                onChange={handleChange}
                placeholder="e.g. PHC-MH-PN-042"
                className={`${inputCls} font-mono`}
              />
              {fieldErrors.phcCode && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.phcCode}</p>}
            </div>

            <div>
              <label htmlFor="phcName" className="block text-xs font-bold text-slate-700 mb-1">
                PHC Name *
              </label>
              <input
                id="phcName"
                name="phcName"
                type="text"
                required
                value={formData.phcName}
                onChange={handleChange}
                placeholder="e.g. Alandi Rural PHC"
                className={inputCls}
              />
              {fieldErrors.phcName && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.phcName}</p>}
            </div>

            <div>
              <label htmlFor="state" className="block text-xs font-bold text-slate-700 mb-1">
                State *
              </label>
              <input
                id="state"
                name="state"
                type="text"
                required
                value={formData.state}
                onChange={handleChange}
                placeholder="e.g. Maharashtra"
                className={inputCls}
              />
              {fieldErrors.state && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.state}</p>}
            </div>

            <div>
              <label htmlFor="district" className="block text-xs font-bold text-slate-700 mb-1">
                District *
              </label>
              <input
                id="district"
                name="district"
                type="text"
                required
                value={formData.district}
                onChange={handleChange}
                placeholder="e.g. Pune"
                className={inputCls}
              />
              {fieldErrors.district && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.district}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="address" className="block text-xs font-bold text-slate-700 mb-1">
                Address *
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <textarea
                  id="address"
                  name="address"
                  rows={2}
                  required
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="Khed Taluka, Near Bus Stand, Alandi, Pune - 412105"
                  className={`${inputCls} pl-9`}
                />
              </div>
              {fieldErrors.address && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.address}</p>}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="contactNumber" className="block text-xs font-bold text-slate-700 mb-1">
                Contact Phone Number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  id="contactNumber"
                  name="contactNumber"
                  type="tel"
                  required
                  value={formData.contactNumber}
                  onChange={handleChange}
                  placeholder="+91 98230 11223"
                  className={`${inputCls} pl-9 font-mono`}
                />
              </div>
              {fieldErrors.contactNumber && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.contactNumber}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-teal-50 border border-teal-100 text-teal-700">
            <Building2 className="w-4 h-4 shrink-0" />
            <p className="text-xs">
              This links you to your Primary Health Centre. If the PHC code already exists, you&apos;ll be joined to
              it; otherwise a new PHC record is created.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          suppressHydrationWarning
          className="w-full py-4 px-6 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Setting Up Your Workspace...</span>
            </>
          ) : (
            <>
              <span>Finish Setup</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={async () => {
          await fetch('/api/backend/auth/logout', { method: 'POST' }).catch(() => {});
          router.push('/login');
          router.refresh();
        }}
        className="mx-auto block text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
      >
        Not you? Sign in with a different account
      </button>
    </div>
  );
}