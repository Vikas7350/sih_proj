'use client';

import { useEffect, useState } from 'react';

export type ScannerState = 'idle' | 'scanning' | 'processing' | 'complete';

const CYCLE_MS = 3800;
const SCANNING_MS = 1600;
const PROCESSING_MS = 1500;

/**
 * Animated retinal scanner (design.md §4.2). Draws the eye via SVG
 * stroke-dashoffset, then shows a scanning ring → detection markers →
 * "AI ANALYSIS READY".
 *
 * Two modes:
 *  - autoplay (default): loops slowly for the hero.
 *  - fixed: driven by an external `state` + `onComplete` (used by AIDemoSequence).
 * Respects prefers-reduced-motion (renders final state, no looping).
 */

function EyeGlyph({ scanning }: { scanning: boolean }) {
  const strokeColor = scanning ? '#4DE8FF' : '#F7FAFC';
  return (
    <svg viewBox="0 0 200 120" className="h-full w-full" aria-hidden="true">
      <path
        d="M100 30 C 145 30, 185 60, 100 90 C 15 60, 55 30, 100 30 Z"
        fill="none"
        stroke={strokeColor}
        strokeWidth="3"
        strokeLinecap="round"
        className="scanner-draw"
      />
      <circle cx="100" cy="60" r="22" fill="none" stroke="#00C9B7" strokeWidth="2" />
      <circle cx="100" cy="60" r="9" fill="#4DE8FF" />
    </svg>
  );
}

export default function RetinaScanner({
  state,
  onComplete,
  label = 'AI ANALYSIS READY',
  className = '',
}: {
  state?: ScannerState;
  onComplete?: () => void;
  label?: string;
  className?: string;
}) {
  const [internal, setInternal] = useState<ScannerState>('idle');
  const active: ScannerState = state ?? internal;

  // autoplay loop when no external state is provided
  useEffect(() => {
    if (state) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setInternal('complete');
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const run = () => {
      setInternal('scanning');
      t = setTimeout(() => setInternal('processing'), SCANNING_MS);
      t = setTimeout(() => setInternal('complete'), SCANNING_MS + PROCESSING_MS);
      t = setTimeout(() => setInternal('idle'), CYCLE_MS);
    };
    run();
    const iv = setInterval(run, CYCLE_MS + 600);
    return () => {
      clearInterval(iv);
      clearTimeout(t);
    };
  }, [state]);

  // notify external driver when scanning completes
  useEffect(() => {
    if (active === 'complete' && state && onComplete) onComplete();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // force complete when reduced-motion for fixed mode
  useEffect(() => {
    if (state && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const t = setTimeout(() => setInternal('complete'), 150);
      return () => clearTimeout(t);
    }
  }, [state]);

  const statusText =
    active === 'idle'
      ? 'READY'
      : active === 'scanning'
      ? 'SCANNING'
      : active === 'processing'
      ? 'PROCESSING'
      : label;

  return (
    <div className={`relative aspect-[5/3] w-full max-w-lg select-none ${className}`}>
      <div className="absolute inset-0">
        <EyeGlyph scanning={active === 'scanning'} />
      </div>

      {/* scanning ring */}
      {(active === 'scanning' || active === 'processing') && (
        <>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-electric animate-pulse-ring"
            style={{ transform: 'translate(-50%, -50%)' }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-vision animate-spin-slow"
          />
        </>
      )}

      {/* detection markers (appear in complete/processing) */}
      {(active === 'processing' || active === 'complete') && (
        <span aria-hidden="true" className="pointer-events-none absolute left-[38%] top-[42%] h-2.5 w-2.5 animate-blink rounded-full bg-honey shadow-[0_0_12px_#FFCA6B]" />
      )}

      {/* status label */}
      <div
        className={`absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-widest transition-all duration-500 ${
          active === 'complete'
            ? 'border-electric bg-electric/20 text-vision'
            : active === 'processing'
            ? 'border-honey/60 bg-honey/10 text-honey'
            : 'border-white/20 bg-white/5 text-white/70'
        }`}
        style={{ opacity: active === 'idle' ? 0.6 : 1 }}
      >
        <span className="mr-1.5 inline-block animate-blink" aria-hidden="true">●</span>
        {statusText}
      </div>
    </div>
  );
}
