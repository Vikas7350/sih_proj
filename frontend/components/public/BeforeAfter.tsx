'use client';

import { ArrowDown, X, Check } from 'lucide-react';
import Reveal from './Reveal';
import SectionHeading from './SectionHeading';

const TRADITIONAL = ['Patient', 'Travel to hospital', 'Hospital queue', 'Specialist', 'Waiting weeks'];

const NETRACARE = ['Patient', 'Nearby PHC', 'Retinal image', 'AI-assisted screen', 'Doctor review + referral'];

/**
 * Before / after side-by-side pathway (design §14). Reveal-animated columns with
 * flowing arrows. Represents the patient journey, not a live simulation.
 */
export default function BeforeAfter() {
  return (
    <section className="bg-warm-mint py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The Journey"
          title="How screening reaches the patient"
          lede="The difference isn't just speed — it's that screening starts where the patient already is."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Traditional */}
          <Reveal>
            <div className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-100 text-rose-600"><X className="h-4 w-4" /></span>
                <h3 className="font-display text-lg font-bold text-ink">Traditional Pathway</h3>
              </div>
              <ol className="mt-5 space-y-0">
                {TRADITIONAL.map((step, i) => (
                  <li key={step} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 bg-slate-50 text-xs font-bold text-slate-500">
                        {i + 1}
                      </span>
                      {i < TRADITIONAL.length - 1 && (
                        <ArrowDown className="my-1 h-4 w-4 text-slate-300" />
                      )}
                    </div>
                    <span className="pt-1.5 text-sm text-ink-soft">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">
                Many patients drop off at travel, cost, or time — before ever reaching a specialist.
              </p>
            </div>
          </Reveal>

          {/* NetraCare */}
          <Reveal delay={150}>
            <div className="card-plane h-full rounded-3xl border border-electric/30 bg-navy p-6 shadow-lg">
              <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-electric text-navy"><Check className="h-4 w-4" /></span>
                <h3 className="font-display text-lg font-bold text-white">NetraCare Pathway</h3>
              </div>
              <ol className="mt-5 space-y-0">
                {NETRACARE.map((step, i) => (
                  <li key={step} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-electric/40 bg-electric/15 text-xs font-bold text-electric">
                        {i + 1}
                      </span>
                      {i < NETRACARE.length - 1 && (
                        <ArrowDown className="my-1 h-4 w-4 text-electric/50" />
                      )}
                    </div>
                    <span className="pt-1.5 text-sm text-white/85">{step}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 rounded-xl bg-electric/10 p-3 text-xs text-electric/90">
                Screening at the PHC keeps care close — and refers only patients who need closer attention.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
