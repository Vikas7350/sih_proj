'use client';

import { useEffect, useState } from 'react';
import PublicLayout from '@/components/public/PublicLayout';
import SectionHeading from '@/components/public/SectionHeading';
import CTAButton from '@/components/public/CTAButton';
import Reveal from '@/components/public/Reveal';
import FAQAccordion from '@/components/public/FAQAccordion';
import AIDemoSequence from '@/components/public/AIDemoSequence';
import { useInView } from '@/lib/hooks/useInView';
import { ArrowRight } from 'lucide-react';

const FAQ = [
  { q: 'Is the AI a replacement for doctors?', a: 'No. It is designed as a screening support tool.' },
  { q: 'Who is the platform designed for?', a: 'Primary healthcare environments and healthcare workers.' },
  { q: 'Does the system diagnose diabetic retinopathy?', a: 'The system provides AI-assisted screening/risk information. Clinical diagnosis should remain with qualified healthcare professionals.' },
  { q: 'Can it work in rural PHCs?', a: 'The product is specifically designed around PHC workflows and constrained access to specialists.' },
  { q: 'What happens after a high-risk result?', a: 'The result should support appropriate clinical review and referral according to the healthcare workflow.' },
  { q: 'What image formats and sizes are supported?', a: 'JPG, JPEG, and PNG images up to 10MB.' },
  { q: 'What happens if my photo quality is poor?', a: 'The system flags quality issues and provides recapture guidance before analysis.' },
];

/* ─── Step visuals ─── */

function StepCapture({ active }: { active: boolean }) {
  const [fill, setFill] = useState(0);
  useEffect(() => {
    if (!active) { setFill(0); return; }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setFill(96); return; }
    let frame: number;
    const start = performance.now();
    const animate = (now: number) => {
      const t = Math.min((now - start) / 1200, 1);
      setFill(Math.round(96 * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  return (
    <div className="flex flex-col items-center gap-4">
      <svg viewBox="0 0 120 90" className="w-full max-w-[200px]" aria-hidden="true">
        <g stroke="#00C9B7" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M10 25 L10 10 L25 10" className={`transition-all duration-500 ${active ? 'opacity-100' : 'opacity-30'}`} />
          <path d="M95 10 L110 10 L110 25" className={`transition-all duration-500 ${active ? 'opacity-100' : 'opacity-30'}`} />
          <path d="M110 65 L110 80 L95 80" className={`transition-all duration-500 ${active ? 'opacity-100' : 'opacity-30'}`} />
          <path d="M25 80 L10 80 L10 65" className={`transition-all duration-500 ${active ? 'opacity-100' : 'opacity-30'}`} />
        </g>
        <circle cx="60" cy="45" r="18" fill="none" stroke="#4DE8FF" strokeWidth="1.5" opacity={active ? 0.6 : 0.2} />
      </svg>
      <div className="w-full max-w-[200px]">
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold tracking-wider text-ink-muted">
          <span>IMAGE QUALITY</span>
          <span className="text-electric">{fill}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-electric transition-[width] duration-100" style={{ width: `${fill}%` }} />
        </div>
      </div>
    </div>
  );
}

function StepUpload({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3 text-sm">
      <span className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${active ? 'border-electric text-electric' : 'border-slate-200 text-ink-muted'}`}>DEVICE</span>
      <span className={`flex items-center gap-1 ${active ? 'text-electric' : 'text-slate-300'}`}>
        {[0, 0.2, 0.4].map((d) => (
          <span key={d} className={`inline-block h-1.5 w-1.5 rounded-full ${active ? 'bg-electric animate-blink' : 'bg-slate-300'}`} style={{ animationDelay: `${d}s` }} />
        ))}
      </span>
      <span className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${active ? 'border-vision bg-vision/10 text-vision' : 'border-slate-200 text-ink-muted'}`}>◉ SERVER</span>
    </div>
  );
}

function StepAnalysis({ active }: { active: boolean }) {
  const steps = ['vessel detection', 'feature extraction', 'classification', 'risk estimation'];
  return (
    <div className="space-y-3">
      <p className="text-center text-xs font-semibold tracking-wider text-ink-muted">RETINAL IMAGE</p>
      <div className="relative overflow-hidden rounded-xl bg-navy/5 p-4">
        {active && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
            <div className="absolute left-0 right-0 h-8 bg-gradient-to-b from-transparent via-electric/30 to-transparent animate-scan-y" />
          </div>
        )}
        <svg viewBox="0 0 200 120" className="w-full" aria-hidden="true">
          <circle cx="100" cy="60" r="40" fill="#071A2B" stroke="#00C9B7" strokeWidth="1.5" />
          <g stroke="#4DE8FF" strokeWidth="0.8" opacity={active ? 0.7 : 0.3}>
            <path d="M100 20 C 115 50, 115 70, 100 100" fill="none" />
            <path d="M60 50 C 80 58, 120 58, 140 50" fill="none" />
            <path d="M70 35 C 85 55, 115 50, 135 30" fill="none" />
          </g>
          <circle cx="100" cy="60" r="6" fill="#4DE8FF" opacity="0.9" />
        </svg>
      </div>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={s} className={`flex items-center gap-2 text-sm transition-colors duration-300 ${active ? 'text-ink' : 'text-ink-muted'}`} style={{ transitionDelay: `${i * 150}ms` }}>
            <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold transition-colors ${active ? 'border-electric bg-electric/10 text-electric' : 'border-slate-200 text-ink-muted'}`}>{i + 1}</span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepResult() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="mb-3 text-[10px] font-semibold tracking-widest text-ink-muted">SCREENING RESULT</p>
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between rounded-lg bg-snow px-3 py-2">
          <span className="text-ink-soft">Risk Category</span>
          <span className="font-semibold rounded-md bg-honey/20 px-2 py-0.5 text-honey">Moderate</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-snow px-3 py-2">
          <span className="text-ink-soft">AI Confidence</span>
          <span className="font-semibold text-ink">94%</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-snow px-3 py-2">
          <span className="text-ink-soft">Indicators</span>
          <span className="font-semibold text-ink">3 detected</span>
        </div>
      </div>
      <p className="mt-3 rounded-lg border border-electric/30 bg-electric/5 px-3 py-2 text-xs font-medium text-electric">
        Action: Specialist review recommended
      </p>
      <p className="mt-3 text-center text-[10px] font-semibold tracking-wider text-ink-muted">DEMO RESULT — NOT A MEDICAL DIAGNOSIS</p>
    </div>
  );
}

function StepReferral() {
  const nodes = ['PHC', 'Screening', 'Risk detected', 'Doctor review', 'Referral', 'Specialist'];
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-semibold text-ink-soft">
      {nodes.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          <span className={`rounded-lg border px-3 py-1.5 ${i === nodes.length - 1 ? 'border-honey/40 bg-honey/10 text-honey' : 'border-slate-200 bg-white text-ink'}`}>{n}</span>
          {i < nodes.length - 1 && <ArrowRight className="h-3 w-3 text-slate-300" />}
        </span>
      ))}
    </div>
  );
}

/* ─── Timeline step — tracks its own active state via useInView ─── */
function TimelineStep({
  num,
  title,
  desc,
  children,
}: {
  num: string;
  title: string;
  desc?: string;
  children: (active: boolean) => React.ReactNode;
}) {
  const { ref, inView } = useInView({ threshold: 0.4 });
  return (
    <div ref={ref} className="relative grid gap-8 md:grid-cols-[60px_1fr] md:gap-12">
      <div className="hidden md:flex md:flex-col md:items-center">
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition-all duration-300 ${
            inView ? 'border-electric bg-electric text-navy shadow-lg shadow-electric/20' : 'border-slate-200 bg-white text-ink-muted'
          }`}
        >
          {num}
        </span>
      </div>
      <div className={`rounded-2xl border p-6 transition-all duration-300 ${
        inView ? 'border-electric/30 bg-white shadow-md' : 'border-slate-200 bg-white'
      }`}>
        <div className="mb-1 flex items-center gap-3 md:hidden">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-xs font-bold ${
            inView ? 'border-electric bg-electric text-navy' : 'border-slate-200 bg-white text-ink-muted'
          }`}>{num}</span>
          <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        </div>
        <h3 className="hidden font-display text-lg font-semibold text-ink md:block">{title}</h3>
        {desc && <p className="mt-1 text-sm text-ink-soft">{desc}</p>}
        <div className="mt-5">{children(inView)}</div>
      </div>
    </div>
  );
}

/* ─── Page ─── */
export default function HowItWorksPage() {
  return (
    <PublicLayout>
      {/* §3.1 Hero */}
      <section className="relative overflow-hidden bg-navy pt-24 pb-16 sm:pt-32 sm:pb-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #00C9B720 0%, transparent 70%)' }} />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl">Five Steps. One Screening Workflow.</h1>
          </Reveal>
        </div>
      </section>

      {/* §3.2–§3.6 Scroll-activated timeline */}
      <section className="bg-snow py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="relative">
            <div className="absolute left-[29px] top-0 bottom-0 hidden w-0.5 bg-slate-200 md:block" />
            <div className="space-y-12">
              <TimelineStep num="01" title="Capture" desc="Capture a clear retinal image using the available imaging setup.">
                {(active) => <StepCapture active={active} />}
              </TimelineStep>
              <TimelineStep num="02" title="Upload">
                {(active) => <StepUpload active={active} />}
              </TimelineStep>
              <TimelineStep num="03" title="AI Analysis">
                {(active) => <StepAnalysis active={active} />}
              </TimelineStep>
              <TimelineStep num="04" title="Result">
                {() => <StepResult />}
              </TimelineStep>
              <TimelineStep num="05" title="Referral">
                {() => <StepReferral />}
              </TimelineStep>
            </div>
          </div>
        </div>
      </section>

      {/* §3.7 Interactive Simulation */}
      <section className="bg-navy py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Try It"
            title={<span className="text-white">Interactive Simulation</span>}
            lede="Click start to walk through the AI screening workflow. This is a frontend-only demonstration — no real backend call."
            className="[&_*]:text-white/70 [&_h2]:text-white"
          />
          <div className="mt-12">
            <AIDemoSequence mode="interactive" />
          </div>
        </div>
      </section>

      {/* §3.8 FAQ */}
      <section className="bg-navy py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Questions"
            title={<span className="text-white">Frequently Asked Questions</span>}
            className="[&_*]:text-white/70 [&_h2]:text-white"
          />
          <div className="mt-12">
            <FAQAccordion items={FAQ} />
          </div>
        </div>
      </section>

      {/* §3.9 CTA */}
      <section className="bg-navy-surface py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Ready to See It in Action?</h2>
          </Reveal>
          <Reveal delay={100}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <CTAButton href="/register" variant="primary">Start Screening <ArrowRight className="h-4 w-4" /></CTAButton>
              <CTAButton href="/features" variant="secondary">Explore Features</CTAButton>
            </div>
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  );
}
