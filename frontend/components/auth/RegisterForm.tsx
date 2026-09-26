'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Lock,
  User,
  Building2,
  Phone,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { registerSchema } from '@/lib/validations';

export interface DemoFacility {
  facility_id: string;
  name: string;
  type: string;
  state: string;
  district: string;
  address: string;
  status: string;
  demo: boolean;
}

export default function RegisterForm() {
  const router = useRouter();

  const [registry, setRegistry] = useState<DemoFacility[]>([]);
  const [registryLoading, setRegistryLoading] = useState(true);
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('');
  const [selectedFacility, setSelectedFacility] = useState<DemoFacility | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    facilityId: '',
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

  useEffect(() => {
    async function loadRegistry() {
      try {
        setRegistryLoading(true);
        const res = await fetch('/api/phc/registry');
        const json = await res.json();
        if (res.ok && json.data && Array.isArray(json.data)) {
          setRegistry(json.data);
          if (json.data.length > 0) {
            const defaultFac = json.data[0];
            setSelectedFacilityId(defaultFac.facility_id);
            setSelectedFacility(defaultFac);
            setFormData((prev) => ({
              ...prev,
              facilityId: defaultFac.facility_id,
              phcName: defaultFac.name,
              phcCode: defaultFac.facility_id,
              state: defaultFac.state,
              district: defaultFac.district,
              address: defaultFac.address,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load PHC registry:', err);
      } finally {
        setRegistryLoading(false);
      }
    }
    loadRegistry();
  }, []);

  const handleFacilitySelect = (facilityId: string) => {
    setSelectedFacilityId(facilityId);
    setError(null);
    const match = registry.find((f) => f.facility_id === facilityId);
    if (match) {
      setSelectedFacility(match);
      setFormData((prev) => ({
        ...prev,
        facilityId: match.facility_id,
        phcName: match.name,
        phcCode: match.facility_id,
        state: match.state,
        district: match.district,
        address: match.address,
      }));
    } else {
      setSelectedFacility(null);
      setFormData((prev) => ({ ...prev, facilityId }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
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

    if (!formData.facilityId && !formData.phcCode) {
      setError('Please select or enter a registered PHC Facility ID.');
      return;
    }

    const validationResult = registerSchema.safeParse(formData);
    if (!validationResult.success) {
      const formattedErrors: Record<string, string> = {};
      validationResult.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (path && !formattedErrors[path]) {
          formattedErrors[path] = issue.message;
        }
      });
      setFieldErrors(formattedErrors);
      setError(
        validationResult.error.issues[0]?.message || 'Please fix validation errors'
      );
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Account registration failed');
      }

      // Redirect to email verification with OTP
      router.push(
        `/verify-email?email=${encodeURIComponent(formData.email.toLowerCase())}`
      );
    } catch (err: any) {
      setError(
        err.message || 'An unexpected error occurred during registration'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {error && (
        <div className="p-4 rounded-xl bg-saffron-500/10 border border-saffron-500/30 text-[#B36615] text-xs flex items-center gap-2.5 font-medium">
          <AlertCircle className="w-4 h-4 text-saffron-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Select Registered PHC (Demo Facility Registry) */}
        <div className="bg-paper-0 p-6 rounded-xl border border-line-200 space-y-4">
          <div className="flex items-center justify-between border-l-[3px] border-petrol-600 pl-3 py-0.5">
            <h2 className="text-sm font-bold text-ink-900">
              Select Registered PHC
            </h2>
            <span className="text-[10px] font-semibold text-petrol-600 bg-petrol-600/10 px-2 py-0.5 rounded-full border border-petrol-600/20">
              Demo Facility Registry
            </span>
          </div>

          {!manualMode ? (
            <div className="space-y-3">
              <label
                htmlFor="facilitySelect"
                className="block text-xs font-semibold text-ink-900"
              >
                Registered Primary Health Centre *
              </label>

              {registryLoading ? (
                <div className="p-3 bg-mist-100/50 border border-line-200 rounded-lg text-xs text-slate-500 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-petrol-600" />
                  <span>Loading registered demo facilities...</span>
                </div>
              ) : (
                <select
                  id="facilitySelect"
                  value={selectedFacilityId}
                  onChange={(e) => handleFacilitySelect(e.target.value)}
                  className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 text-ink-900 font-medium"
                >
                  <option value="">-- Select Registered PHC --</option>
                  {registry.map((f) => (
                    <option key={f.facility_id} value={f.facility_id}>
                      {f.name} — {f.district}, {f.state}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setManualMode(true)}
                  className="text-xs text-petrol-600 hover:underline font-medium"
                >
                  Already have a Facility ID? Enter manually &rarr;
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="phcCode"
                  className="block text-xs font-semibold text-ink-900"
                >
                  Facility ID / PHC Code *
                </label>
                <button
                  type="button"
                  onClick={() => setManualMode(false)}
                  className="text-xs text-petrol-600 hover:underline font-medium"
                >
                  &larr; Select from Demo Registry
                </button>
              </div>
              <input
                id="phcCode"
                name="phcCode"
                type="text"
                required
                value={formData.phcCode}
                onChange={(e) => {
                  handleChange(e);
                  handleFacilitySelect(e.target.value);
                }}
                placeholder="e.g. DEMO-PHC-PUNE-001"
                className="w-full p-2.5 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 text-ink-900 font-mono uppercase"
              />
            </div>
          )}

          {/* Read-Only Verified Facility Card */}
          {selectedFacility && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-emerald-800 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>✓ Facility Verified</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold tracking-wider uppercase">
                  {selectedFacility.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <div>
                  <span className="text-slate-500">Facility ID:</span>{' '}
                  <span className="font-mono font-bold text-ink-900">
                    {selectedFacility.facility_id}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">PHC Name:</span>{' '}
                  <span className="font-semibold text-ink-900">
                    {selectedFacility.name}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">State:</span>{' '}
                  <span className="font-medium text-ink-900">
                    {selectedFacility.state}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">District:</span>{' '}
                  <span className="font-medium text-ink-900">
                    {selectedFacility.district}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500">Address:</span>{' '}
                  <span className="font-medium text-ink-900">
                    {selectedFacility.address}
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-500 italic border-t border-emerald-500/10 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-petrol-600 shrink-0" />
                <span>
                  Verified facility information is read-only and locked for security.
                </span>
              </div>
            </div>
          )}

          {/* Prototype / Registry Disclaimer Note */}
          <div className="p-3 rounded-lg bg-mist-100 border border-line-200 text-[11px] text-slate-600 space-y-0.5">
            <p className="font-semibold text-ink-900">
              Demo Facility Registry — prototype data
            </p>
            <p className="text-slate-500">
              In production, facility verification can be connected to the appropriate official facility registry.
            </p>
          </div>
        </div>

        {/* SECTION 2: Authorized User / Healthcare Worker Account */}
        <div className="bg-paper-0 p-6 rounded-xl border border-line-200 space-y-4">
          <div className="border-l-[3px] border-petrol-600 pl-3 py-0.5">
            <h2 className="text-sm font-bold text-ink-900">
              Authorized User Credentials
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="name"
                className="block text-xs font-semibold text-ink-900 mb-1"
              >
                Full name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  suppressHydrationWarning
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Dr. Ramesh Kumar"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
                />
              </div>
              {fieldErrors.name && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {fieldErrors.name}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-ink-900 mb-1"
              >
                Email address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  suppressHydrationWarning
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="healthworker@phc.gov.in"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="contactNumber"
                className="block text-xs font-semibold text-ink-900 mb-1"
              >
                Contact phone number *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  id="contactNumber"
                  name="contactNumber"
                  type="tel"
                  required
                  suppressHydrationWarning
                  value={formData.contactNumber}
                  onChange={handleChange}
                  placeholder="+91 98230 11223"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 font-mono text-ink-900"
                />
              </div>
              {fieldErrors.contactNumber && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {fieldErrors.contactNumber}
                </p>
              )}
            </div>

            <div />

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-ink-900 mb-1"
              >
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  suppressHydrationWarning
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="At least 8 characters"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
                />
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold text-ink-900 mb-1"
              >
                Confirm password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  suppressHydrationWarning
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-mist-100/50 border border-line-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 text-ink-900"
                />
              </div>
              {fieldErrors.confirmPassword && (
                <p className="text-[11px] text-rose-600 mt-1">
                  {fieldErrors.confirmPassword}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        <button
          type="submit"
          disabled={isLoading || !formData.facilityId}
          suppressHydrationWarning
          className={`w-full py-3.5 px-6 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isLoading || !formData.facilityId
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-petrol-600 hover:bg-[#0c595c] text-white'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Verifying Facility & Creating PHC Account...</span>
            </>
          ) : (
            <>
              <span>Create PHC account & Send OTP</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
