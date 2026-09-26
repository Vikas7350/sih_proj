'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from '@/lib/hooks/useInView';

type Stat = { value: string; num: number; suffix: string; label: string };

const STATS: Stat[] = [
  { value: '77M+', num: 77, suffix: 'M+', label: 'Diabetic adults in India' },
  { value: '~18%', num: 18, suffix: '%', label: 'Affected by Diabetic Retinopathy' },
  { value: '90%', num: 90, suffix: '%', label: 'Of vision loss preventable with early screening' },
  { value: '1:100,000', num: 100000, suffix: '', label: 'Ophthalmologist-to-rural-population ratio' },
];

function formatStat(s: Stat, current: number): string {
  if (s.num === 100000) return `1:${current.toLocaleString()}`;
  return `${current}${s.suffix}`;
}

/**
 * Animated impact counters (design.md §A.2 §1.10). Only the four real stats
 * from pages.md §0 — no invented fifth stat.
 */
export default function ImpactNumbers() {
  const { ref, inView } = useInView({ threshold: 0.3 });
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const animated = useRef(false);

  useEffect(() => {
    if (!inView || animated.current) return;
    animated.current = true;
    const duration = 1800;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setCounts(STATS.map((s) => Math.round(s.num * ease)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView]);

  return (
    <section ref={ref} className="bg-navy py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-3xl font-bold text-electric sm:text-4xl lg:text-5xl">
                {formatStat(s, counts[i])}
              </p>
              <p className="mt-2 text-sm text-white/60">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
