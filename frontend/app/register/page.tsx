import RegisterForm from '@/components/auth/RegisterForm';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function RegisterPage() {
  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-mist-100 text-ink-900 overflow-x-hidden">
      {/* Left ~42% Form Container */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between p-6 sm:p-10 lg:px-12 lg:py-10 min-h-screen bg-mist-100">
        <div className="space-y-6 max-w-xl mx-auto w-full">
          <div className="flex items-center justify-between">
            <Link
              href="/login"
              className="text-xs font-semibold text-petrol-600 hover:text-petrol-900 bg-paper-0 px-3 py-1.5 rounded-lg border border-line-200 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </Link>
          </div>

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-ink-900 tracking-tight">
              Register Primary Health Centre
            </h1>
            <p className="text-xs text-slate-500">
              Set up your PHC credentials and healthcare worker account for AI DR screening.
            </p>
          </div>

          <RegisterForm />
        </div>

        <div className="pt-6 border-t border-line-200 text-[11px] text-slate-500 flex items-center justify-between">
          <span>NetraCare PHC Registration</span>
          <span>NPCB / NPDR Program</span>
        </div>
      </div>

      {/* Right ~58% Full-Bleed Duotone Hero Panel */}
      <div className="hidden lg:flex w-[55%] relative overflow-hidden bg-petrol-900 flex-col justify-between p-12 text-white">
        <Image
          src="/images/phc_hero.jpg"
          alt="PHC Retinal Screening Exam"
          fill
          priority
          sizes="55vw"
          className="object-cover opacity-40 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-petrol-900 via-petrol-900/40 to-transparent" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>CHO Registration Portal</span>
          </div>
          <span className="text-xs text-teal-200/80 font-mono">Government PHC Network</span>
        </div>

        <div className="relative z-10 max-w-lg space-y-4 my-auto">
          <h2 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
            High-efficiency diabetic eye care at the primary health level.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Register your facility to enable automated fundus quality analysis, deep learning DR grading, and structured specialist referral documentation.
          </p>

          <div className="pt-4 flex flex-wrap gap-4 text-xs font-medium text-teal-200">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 border border-white/10">
              <span>✓ Instant Account Setup</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 border border-white/10">
              <span>✓ Automated Case Logs</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 pt-6 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
          <span>Tele-Ophthalmology Network</span>
          <span>District Health Society</span>
        </div>
      </div>
    </main>
  );
}
