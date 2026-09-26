import { Suspense } from 'react';
import Image from 'next/image';
import LoginForm from '@/components/auth/LoginForm';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  return (
    <main className="min-h-screen w-full flex flex-col lg:flex-row bg-mist-100 text-ink-900 overflow-x-hidden">
      {/* Left ~40% Form Container */}
      <div className="w-full lg:w-[42%] flex flex-col justify-between p-6 sm:p-10 lg:px-16 lg:py-12 min-h-screen bg-mist-100">
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-8 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        {/* National Health Program Nod */}
        <div className="pt-6 border-t border-line-200 text-[11px] text-slate-500 flex items-center justify-between">
          <span>NPCB / NPDR National Screening Program</span>
          <span>v1.0.0 PHC</span>
        </div>
      </div>

      {/* Right ~60% Full-Bleed Duotone Hero Panel */}
      <div className="hidden lg:flex w-[58%] relative overflow-hidden bg-petrol-900 flex-col justify-between p-12 text-white">
        <Image
          src="/images/phc_hero.jpg"
          alt="PHC Retinal Screening Exam"
          fill
          priority
          sizes="58vw"
          className="object-cover opacity-40 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-petrol-900 via-petrol-900/40 to-transparent" />

        {/* Top Header Logo on Right */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Operational at Rural PHCs</span>
          </div>
          <span className="text-xs text-teal-200/80 font-mono">CHO Clinical Portal</span>
        </div>

        {/* Hero Overlay Copy */}
        <div className="relative z-10 max-w-lg space-y-4 my-auto">
          <h2 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
            AI-assisted diabetic retinopathy screening for rural Primary Health Centres.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Empowering Community Health Officers with instant, high-accuracy AI triage, fundus image quality verification, and specialist referral workflows.
          </p>

          <div className="pt-4 flex flex-wrap gap-4 text-xs font-medium text-teal-200">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 border border-white/10">
              <span>✓ eHospital / ORS Compatible</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 border border-white/10">
              <span>✓ EfficientNet Grad-CAM AI</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pt-6 border-t border-white/10 text-xs text-slate-400 flex items-center justify-between">
          <span>Tele-Ophthalmology Network</span>
          <span>Aravind / Sankara Nethralaya Clinical Guidelines</span>
        </div>
      </div>
    </main>
  );
}
