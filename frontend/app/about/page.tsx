import PublicLayout from '@/components/public/PublicLayout';
import SectionHeading from '@/components/public/SectionHeading';
import CTAButton from '@/components/public/CTAButton';
import Reveal from '@/components/public/Reveal';
import { ArrowRight, Accessibility, Lightbulb, Eye, Users } from 'lucide-react';

/* §2.3 — verbatim from pages.md / design.md */
const PRINCIPLES = [
  { icon: Accessibility, title: 'Accessibility', desc: 'Designed for Primary Health Centres with limited specialist access.' },
  { icon: Lightbulb, title: 'Simplicity', desc: 'Built so healthcare workers require zero prior technical expertise.' },
  { icon: Eye, title: 'Explainability', desc: 'Communicates clear visual reasons why a result requires attention.' },
  { icon: Users, title: 'Human-in-the-loop', desc: 'AI assists triage while clinicians retain full responsibility for care.' },
];

/* §2.5 Team — Team Debug Thugs */
const TEAM = [
  { role: 'AI / ML', label: 'Model Development', name: 'AI Vision Lead', oneLiner: 'Fundus classification models & Grad-CAM heatmaps.' },
  { role: 'BACKEND', label: 'APIs & Infrastructure', name: 'Backend Systems Lead', oneLiner: 'FastAPI, MongoDB Atlas & secure authentication.' },
  { role: 'FRONTEND', label: 'Healthcare UX', name: 'Frontend Architect', oneLiner: 'Next.js 15 App Router & clinical triage workflows.' },
  { role: 'INTEGRATION', label: 'System Architecture', name: 'Full-Stack Integrator', oneLiner: 'End-to-end integration, performance & safety.' },
];

export default function AboutPage() {
  return (
    <PublicLayout>
      {/* §2.1 About Hero — design.md §A.3 verbatim */}
      <section className="relative overflow-hidden bg-navy pt-24 pb-16 sm:pt-32 sm:pb-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #00C9B720 0%, transparent 70%)' }}
        />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h1 className="font-display text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              Technology should reduce the distance between a patient and the right care
            </h1>
          </Reveal>
          {/* animated path: Patient → PHC → AI → Healthcare Professional → Specialist */}
          <Reveal delay={200} className="mt-10">
            <div className="mx-auto flex max-w-lg flex-wrap items-center justify-center gap-2 text-xs font-semibold tracking-wider text-white/50 sm:gap-3 sm:text-sm">
              {['Patient', 'PHC', 'AI', 'Healthcare Professional', 'Specialist'].map((step, i) => (
                <span key={step} className="flex items-center gap-2">
                  <span className="text-electric">{step}</span>
                  {i < 4 && <span className="text-white/30">→</span>}
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* §2.2 The Why — split layout per pages.md */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-start gap-12 lg:grid-cols-[1fr_2fr]">
            <Reveal>
              <p className="font-display text-3xl font-bold text-ink sm:text-4xl">
                WHY WE BUILT THIS
              </p>
            </Reveal>
            <Reveal delay={100}>
              <div className="text-base leading-relaxed text-ink-soft">
                <p>
                  Diabetic retinopathy can progress silently. In India, screening access
                  is deeply uneven — with roughly one ophthalmologist for every 100,000 people
                  in rural areas, mass manual screening isn&apos;t feasible. Primary Health Centres
                  are already closer to patients than any specialist ever will be. AI can help
                  close that gap — flagging risk early enough to matter, and explaining why,
                  so a healthcare worker or doctor can act with confidence. AI should support
                  clinical decisions, never replace them.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* §2.3 Design Principles — verbatim from design.md */}
      <section className="bg-snow py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Our Approach" title="Design Principles" />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
            {PRINCIPLES.map((p, i) => (
              <Reveal key={p.title} delay={i * 80} className="h-full">
                <div className="group flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:border-electric/30 hover:shadow-md">
                  <div>
                    <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-electric/10 text-electric transition-colors group-hover:bg-electric group-hover:text-navy">
                      <p.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-ink">{p.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">{p.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* §2.4 Technology Architecture */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Architecture" title="How It All Connects" />
          <Reveal className="mx-auto mt-12 max-w-3xl">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-navy p-6 shadow-sm sm:p-10">
              <div className="grid gap-8 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center sm:gap-4">
                {/* FRONTEND */}
                <div className="text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-electric text-navy shadow-lg shadow-electric/20 animate-scale-in">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8">
                      <rect x="3" y="4" width="18" height="12" rx="2" />
                      <path d="M8 20h8M12 16v4" />
                    </svg>
                  </div>
                  <p className="mt-3 font-display text-sm font-bold text-white">FRONTEND</p>
                  <p className="mt-1 text-xs text-white/50">Next.js · TypeScript</p>
                </div>

                {/* connector */}
                <div className="hidden items-center sm:flex" aria-hidden="true">
                  <span className="h-0.5 w-10 animate-pulse-soft rounded bg-electric/70" />
                  <ArrowRight className="h-4 w-4 -ml-1 text-electric" />
                </div>

                {/* BACKEND */}
                <div className="text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-vision/15 text-vision ring-1 ring-vision/40 animate-scale-in" style={{ animationDelay: '150ms' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-8 w-8">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <path d="M8 21h8M12 17v4M6 7h.01M10 7h.01" />
                    </svg>
                  </div>
                  <p className="mt-3 font-display text-sm font-bold text-white">BACKEND</p>
                  <p className="mt-1 text-xs text-white/50">FastAPI · Python</p>
                </div>

                {/* connector */}
                <div className="hidden items-center sm:flex" aria-hidden="true">
                  <span className="h-0.5 w-10 animate-pulse-soft rounded bg-vision/70" style={{ animationDelay: '300ms' }} />
                  <ArrowRight className="h-4 w-4 -ml-1 text-vision" />
                </div>

                {/* AI MODEL + DATABASE */}
                <div className="text-center">
                  <div className="mx-auto grid gap-2">
                    <div className="grid h-12 items-center rounded-xl bg-white px-4 animate-scale-in" style={{ animationDelay: '300ms' }}>
                      <span className="font-display text-xs font-bold text-navy">AI MODEL</span>
                    </div>
                    <div className="grid h-12 items-center rounded-xl bg-snow px-4 ring-1 ring-slate-200 animate-scale-in" style={{ animationDelay: '450ms' }}>
                      <span className="font-display text-xs font-bold text-ink">DATABASE</span>
                    </div>
                  </div>
                  <p className="mt-3 font-display text-sm font-bold text-white">MODEL + STORAGE</p>
                  <p className="mt-1 text-xs text-white/50">PyTorch · MongoDB</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* §2.5 Team Mission Wall */}
      <section className="bg-navy py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-electric">Our Team</p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">The Mission Wall</h2>
            <p className="mt-3 text-sm text-white/60">Engineered by Team Debug Thugs for Smart India Hackathon.</p>
          </Reveal>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
            {TEAM.map((t, i) => (
              <Reveal key={t.role} delay={i * 80} className="h-full">
                <div className="group flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-300 hover:border-electric/30 hover:bg-white/10">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-widest text-electric">{t.role}</span>
                    <p className="mt-1 text-xs text-white/50">{t.label}</p>
                    <p className="mt-4 text-base font-bold text-white">{t.name}</p>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-white/70">{t.oneLiner}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* §2.6 CTA */}
      <section className="bg-navy-surface py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Want to Learn More?
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <CTAButton href="/how-it-works" variant="primary">
                See How It Works <ArrowRight className="h-4 w-4" />
              </CTAButton>
              <CTAButton href="/contact" variant="secondary">
                Contact the Team
              </CTAButton>
            </div>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  );
}
