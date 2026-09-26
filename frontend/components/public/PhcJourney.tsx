'use client';

import type { CSSProperties } from 'react';
import Reveal from './Reveal';
import SectionHeading from './SectionHeading';

const NODES = [
  { label: 'Community', sub: 'Villages nearby', x: 15, y: 78 },
  { label: 'PHC', sub: 'Retinal screening', x: 40, y: 50, accent: true },
  { label: 'AI Assistance', sub: 'Automated analysis', x: 60, y: 28 },
  { label: 'Doctor Review', sub: 'Clinical decision', x: 80, y: 50 },
  { label: 'Specialist', sub: 'Hospital referral', x: 92, y: 78 },
];

/**
 * Immersive PHC story (§1.5 / §12). An Indian primary health centre image with
 * an animated SVG route: Community → PHC → AI → Doctor → Specialist. The route
 * line draws itself via stroke-dashoffset. Conceptual illustration, not coverage.
 */
export default function PhcJourney() {
  return (
    <section id="phc" className="relative overflow-hidden bg-navy pt-20 sm:pt-28 pb-20 sm:pb-28">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 60% 45% at 50% 0%, #00C9B71a 0%, transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Built for PHCs"
          title={
            <span className="text-white">Built for where specialists aren&apos;t.</span>
          }
          lede="Primary Health Centres are already closer to patients than any specialist ever will be. AI helps them screen effectively — and refer only when it matters."
          className="[&_p]:text-white/70"
        />

        <div className="mt-14 grid items-center gap-12 lg:grid-cols-2">
          {/* Indian PHC image */}
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl depth-shadow">
              <img
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1000&q=70"
                alt="Community healthcare worker at a rural primary health centre in India"
                loading="lazy"
                className="aspect-[4/3] w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/85 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <p className="font-display text-lg font-bold text-white">Screening at the community level</p>
                <p className="mt-1 text-sm text-white/70">Trained personnel + retinal imaging, with remote specialist support.</p>
              </div>
            </div>
          </Reveal>

          {/* Animated route */}
          <Reveal delay={150}>
            <div className="relative rounded-3xl border border-white/10 bg-navy-surface/60 p-6 backdrop-blur-sm">
              <svg viewBox="0 0 100 100" className="w-full" aria-hidden="true" style={{ overflow: 'visible' }}>
                {/* route lines (draw on appear) */}
                <path
                  d="M15 78 L40 50 L60 28 L80 50 L92 78"
                  fill="none"
                  stroke="#00C9B7"
                  strokeWidth="0.7"
                  strokeLinecap="round"
                  strokeDasharray="140"
                  className="scanner-draw"
                  style={{ '--draw-ms': '2200ms' } as CSSProperties}
                />
                {NODES.map((n, i) => (
                  <g key={n.label}>
                    <circle cx={n.x} cy={n.y} r="4" fill="#071A2B" stroke={n.accent ? '#00C9B7' : '#4DE8FF'} strokeWidth="0.8" />
                    <circle cx={n.x} cy={n.y} r="1.4" fill={n.accent ? '#00C9B7' : '#4DE8FF'} className={n.accent ? 'animate-pulse-soft' : ''} />
                  </g>
                ))}
              </svg>

              {/* labels overlaying the svg */}
              <div className="pointer-events-none absolute inset-0">
                {NODES.map((n) => (
                  <div
                    key={n.label}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${n.x}%`, top: `${n.y}%`, marginTop: n.sub ? '10px' : '0' }}
                  >
                    <p className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-white">{n.label}</p>
                    <p className="whitespace-nowrap text-[9px] text-white/50">{n.sub}</p>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-center text-[11px] text-white/40">
              Conceptual healthcare network — not a representation of live coverage.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
