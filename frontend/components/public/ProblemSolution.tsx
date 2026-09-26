'use client';

import { useInView } from '@/lib/hooks/useInView';

/**
 * Problem → Solution transformation animation (design.md §A.2 §1.5).
 * Shows the broken path first, then morphs into the product path on scroll.
 */
export default function ProblemSolution() {
  const { ref, inView } = useInView({ threshold: 0.3 });

  return (
    <section ref={ref} className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Broken path (left) */}
          <div className={`space-y-4 transition-all duration-700 ${inView ? 'opacity-100' : 'opacity-40'}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-muted">Current Reality</p>
            <div className="flex items-center gap-3 text-sm text-ink-soft">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-red-50 text-xs font-bold text-red-600">1</span>
              Patient notices vision issue
            </div>
            <div className="ml-4 border-l-2 border-dashed border-red-200 py-1 pl-6 text-sm text-ink-muted">
              Travel to district hospital
            </div>
            <div className="flex items-center gap-3 text-sm text-ink-soft">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-red-50 text-xs font-bold text-red-600">2</span>
              Wait for specialist availability
            </div>
            <div className="ml-4 border-l-2 border-dashed border-red-200 py-1 pl-6 text-sm text-ink-muted">
              Days to weeks of delay
            </div>
            <div className="flex items-center gap-3 text-sm text-ink-soft">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-red-50 text-xs font-bold text-red-600">3</span>
              <span className="text-red-600 font-medium">Damage may already be irreversible</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <div className={`grid h-12 w-12 place-items-center rounded-full bg-electric text-navy shadow-lg transition-all duration-500 delay-500 ${inView ? 'scale-100 opacity-100' : 'scale-75 opacity-0'}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Solution path (right) */}
          <div className={`space-y-4 transition-all duration-700 delay-300 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-electric">With NetraCare</p>
            {[
              { n: '1', label: 'PHC healthcare worker captures retinal image' },
              { n: '2', label: 'AI analyzes in seconds — risk flagged instantly' },
              { n: '3', label: 'Doctor reviews, refers specialist if needed' },
              { n: '4', label: 'Earlier action, vision preserved' },
            ].map((s) => (
              <div key={s.n} className="flex items-center gap-3 text-sm text-ink">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-electric/10 text-xs font-bold text-electric">{s.n}</span>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
