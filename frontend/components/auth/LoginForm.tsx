'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Mail, Lock, AlertCircle, Eye, ArrowRight } from 'lucide-react';
import { loginSchema } from '@/lib/validations';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';
  const urlError = searchParams.get('error');

  const verifiedParam = searchParams.get('verified');
  const resetParam = searchParams.get('reset');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(
    urlError ? 'Authentication failed. Please check your credentials.' : null
  );
  const [successMessage] = useState<string | null>(
    verifiedParam === 'true'
      ? 'Email verified successfully! You can now sign in.'
      : resetParam === 'true'
      ? 'Password reset successfully! You can now sign in.'
      : null
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = loginSchema.safeParse(formData);
    if (!validation.success) {
      const firstErr = validation.error.issues[0]?.message || 'Invalid input';
      setErrorMessage(firstErr);
      return;
    }

    try {
      setIsLoading(true);

      // POST straight to the backend through the /api/backend rewrite. The
      // backend owns the session: it sets the httpOnly dr_token cookie in the
      // response, which the browser stores automatically (same origin).
      const res = await fetch('/api/backend/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email.toLowerCase(),
          password: formData.password,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg =
          data?.detail?.message ||
          data?.detail ||
          data?.message ||
          'Invalid email or password';
        setErrorMessage(typeof msg === 'string' ? msg : 'Invalid email or password');
        setIsLoading(false);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      console.error('Login form submit error:', err);
      setErrorMessage('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-paper-0 border border-line-200 rounded-2xl p-8">
      {/* Header & Logo */}
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-petrol-600 text-white mb-3 shadow-xs">
          <Eye className="w-5 h-5" />
        </div>
        <h1 className="text-2xl font-bold text-ink-900 tracking-tight">
          Sign in to NetraCare
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          PHC Diabetic Retinopathy Screening Assistant
        </p>

        {/* Tricolor Accent Line (NPCB/NPDR National Program Nod) */}
        <div className="flex h-0.5 w-16 my-3 rounded-full overflow-hidden">
          <span className="w-1/3 bg-[#FF9933]" />
          <span className="w-1/3 bg-white" />
          <span className="w-1/3 bg-[#138808]" />
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3">
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="mb-6 p-4 rounded-xl bg-saffron-500/10 border border-saffron-500/30 text-[#B36615] text-xs flex flex-col gap-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
          {errorMessage.toLowerCase().includes('verify your email') && (
            <Link
              href={`/verify-email?email=${encodeURIComponent(formData.email)}`}
              className="text-xs font-semibold text-petrol-600 hover:underline self-end"
            >
              Verify Email Now &rarr;
            </Link>
          )}
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-semibold text-ink-900 mb-1"
          >
            Email address
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              suppressHydrationWarning
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="w-full pl-10 pr-4 py-2.5 bg-mist-100/50 border border-line-200 rounded-lg text-sm text-ink-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="password"
              className="block text-xs font-semibold text-ink-900"
            >
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-petrol-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              suppressHydrationWarning
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 bg-mist-100/50 border border-line-200 rounded-lg text-sm text-ink-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-petrol-600/20 focus:border-petrol-600 transition-all"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          suppressHydrationWarning
          className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 bg-petrol-600 hover:bg-[#0c595c] text-white text-sm font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-petrol-600 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Signing in...</span>
            </>
          ) : (
            <>
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer Link */}
      <p className="mt-8 text-center text-xs text-slate-500">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-semibold text-petrol-600 hover:underline"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
