'use client';

import { useEffect, useRef, useState } from 'react';

/** Floating analysis labels that appear once scanning begins. */
const LABELS = [
  { text: 'VESSEL PATTERN', top: '12%', left: '-4%' },
  { text: 'IMAGE QUALITY', bottom: '30%', left: '-10%' },
  { text: 'FEATURE ANALYSIS', top: '8%', right: '-6%' },
  { text: 'RISK ASSESSMENT', bottom: '22%', right: '-8%' },
];

/**
 * Animated hero eye (design.md §A.2, upgraded for the visual redesign).
 * SVG stroke-dashoffset draw → retina → scanning ring → detection markers →
 * "AI ANALYSIS READY". Adds CSS-3D cursor tilt and floating analysis labels.
 * Respects prefers-reduced-motion (shows final state, no tilt).
 */
export default function HeroEye() {
  const [phase, setPhase] = useState<'draw' | 'retina' | 'scan' | 'detect' | 'ready'>('draw');
  const [hovered, setHovered] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setPhase('ready');
      return;
    }
    const seq: typeof phase[] = ['draw', 'retina', 'scan', 'detect', 'ready'];
    const delays = [1200, 600, 1600, 1500, 0];
    let i = 0;
    const step = () => {
      if (i >= seq.length) return;
      setPhase(seq[i]);
      if (i < seq.length - 1) {
        timers.current.push(setTimeout(() => { i++; step(); }, delays[i]));
      }
    };
    timers.current.push(setTimeout(step, 400));
    const cleanup = [...timers.current];
    return () => cleanup.forEach(clearTimeout);
  }, []);

  // Cursor-follow 3D tilt (desktop only). Small range so it stays calm.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = frame.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `perspective(1100px) rotateY(${px * 10}deg) rotateX(${py * -8}deg)`;
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transform = 'perspective(1100px) rotateY(0deg) rotateX(0deg)';
    };
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  const scanning = phase === 'scan' || phase === 'detect';
  const showMarkers = phase === 'detect' || phase === 'ready';
  const strokeColor = scanning ? '#4DE8FF' : '#F7FAFC';

  return (
    <div
      className="relative mx-auto aspect-[5/3] w-full max-w-lg select-none"
      style={{ perspective: '1100px' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div ref={frame} className="relative h-full w-full transition-transform duration-300 ease-out will-change-transform">
        {/* faint glow behind the eye */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              'radial-gradient(ellipse 55% 55% at 50% 55%, #00C9B726 0%, transparent 70%)',
          }}
        />

        <svg viewBox="0 0 200 120" className="relative h-full w-full" aria-hidden="true">
          <defs>
            <radialGradient id="heroRetina" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#1b3b4f" />
              <stop offset="100%" stopColor="#071A2B" />
            </radialGradient>
            {/* subtle vessel streaks inside the retina */}
            <pattern id="vessels" width="14" height="14" patternUnits="userSpaceOnUse">
              <path d="M0 7 Q4 3 7 6 T14 5" fill="none" stroke="#0b2b3b" strokeWidth="0.7" />
            </pattern>
          </defs>
          {/* eye outline — draws itself */}
          <path
            d="M100 30 C 145 30, 185 60, 100 90 C 15 60, 55 30, 100 30 Z"
            fill="none"
            stroke={strokeColor}
            strokeWidth="3"
            strokeLinecap="round"
            className="scanner-draw"
          />
          {/* retina (appears after draw) */}
          {phase !== 'draw' && (
            <>
              <circle cx="100" cy="60" r="22" fill="url(#heroRetina)" stroke="#00C9B7" strokeWidth="2" />
              <circle cx="100" cy="60" r="20" fill="url(#vessels)" opacity="0.6" />
              <circle cx="100" cy="60" r="10" fill="none" stroke="#4DE8FF" strokeOpacity="0.35" />
              <circle cx="100" cy="60" r="9" fill="#4DE8FF" className={scanning ? 'animate-pulse-soft' : ''} />
            </>
          )}
          {/* detection markers */}
          {showMarkers && (
            <g>
              <circle cx="82" cy="50" r="4" fill="#E6A85C" className="animate-blink" />
              <circle cx="118" cy="72" r="3.5" fill="#E6A85C" className="animate-blink" style={{ animationDelay: '0.3s' }} />
              <circle cx="108" cy="46" r="3" fill="#E6A85C" className="animate-blink" style={{ animationDelay: '0.6s' }} />
            </g>
          )}
        </svg>

        {/* scanning ring */}
        {scanning && (
          <>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[42%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-electric animate-pulse-ring"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-[42%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-vision animate-spin-slow"
            />
          </>
        )}

        {/* status label */}
        <div
          className={`absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-widest transition-all duration-500 ${
            phase === 'ready'
              ? 'border-electric bg-electric/20 text-vision'
              : scanning
              ? 'border-white/20 bg-white/5 text-honey'
              : 'border-white/20 bg-white/5 text-white/70'
          }`}
          style={{ opacity: phase === 'draw' ? 0.4 : 1 }}
        >
          {phase === 'ready'
            ? '● AI ANALYSIS READY'
            : scanning
            ? '◌ SCANNING RETINA'
            : '● READING RETINAL IMAGE'}
        </div>

        {/* floating analysis labels (appear as scanning starts) */}
        {scanning &&
          LABELS.map((l) => (
            <span
              key={l.text}
              aria-hidden="true"
              className="animate-fade-in absolute rounded-md border border-white/10 bg-navy/70 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-vision backdrop-blur-sm"
              style={{ ...(l.top ? { top: l.top } : {}), ...(l.bottom ? { bottom: l.bottom } : {}), ...(l.left ? { left: l.left } : {}), ...(l.right ? { right: l.right } : {}) }}
            >
              {l.text}
            </span>
          ))}
      </div>

      {/* hover reveal */}
      <div
        className={`absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-navy/80 transition-opacity duration-300 ${
          hovered ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <p className="px-6 text-center text-sm leading-relaxed text-white/90">
          <span className="font-semibold text-vision">AI CAN SEE MORE</span>
          <br />
          but healthcare professionals decide what happens next.
        </p>
      </div>
    </div>
  );
}
