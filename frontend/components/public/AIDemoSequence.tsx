'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, CheckCircle2, Loader2, Activity } from 'lucide-react';

type Mode = 'auto' | 'interactive';

type Scene = 'idle' | 'analyzing' | 'detecting' | 'ready' | 'action';

const SCENE_TIME: Record<Exclude<Scene, 'idle'>, number> = {
  analyzing: 1200,
  detecting: 1300,
  ready: 1500,
  action: 9999,
};

const DETECTED = ['Microaneurysm', 'Hemorrhage', 'Exudate'];

const MEDICAL_DISCLAIMER =
  'AI-assisted screening result. Not a standalone medical diagnosis. Clinical decisions should be made by qualified healthcare professionals.';

/**
 * Shared AI demo sequence (design.md §6). Frontend-only — never calls a backend.
 *  - mode="auto": loops through scenes (static Home visualization).
 *  - mode="interactive": idle until user presses Start, then runs scenes once
 *    and stops at the final "recommended action" scene.
 */

function RetinaPanel({ scene }: { scene: Scene }) {
  const scanning = scene === 'analyzing' || scene === 'detecting';
  return (
    <div className="relative overflow-hidden rounded-xl bg-navy/60">
      <div className="flex aspect-[4/3] items-center justify-center">
        <svg viewBox="0 0 200 150" className="h-full w-full" aria-hidden="true">
          <defs>
            <radialGradient id="retinaBg" cx="50%" cy="50%" r="60%">
              <stop offset="0%" stopColor="#1b3b4f" />
              <stop offset="100%" stopColor="#071A2B" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="75" r="55" fill="url(#retinaBg)" stroke="#00C9B7" strokeWidth="2" />
          <g stroke="#4DE8FF" strokeWidth="1" opacity="0.6">
            <path d="M100 20 C 120 55, 120 95, 100 130" fill="none" />
            <path d="M46 60 C 75 70, 125 70, 154 60" fill="none" />
            <path d="M60 40 C 80 65, 130 55, 148 30" fill="none" />
          </g>
          <circle cx="100" cy="75" r="10" fill="#4DE8FF" opacity="0.9" />
          {(scene === 'detecting' || scene === 'ready' || scene === 'action') && (
            <g>
              <circle cx="76" cy="58" r="5" fill="#FFCA6B" />
              <circle cx="124" cy="92" r="4.5" fill="#FFCA6B" />
              <circle cx="112" cy="52" r="4" fill="#FFCA6B" />
            </g>
          )}
        </svg>
      </div>
      <div className="border-t border-white/10 bg-navy/80 px-4 py-3 text-center text-[11px] font-semibold tracking-widest text-white/50">
        RETINAL ANALYSIS
      </div>
      {/* scan line */}
      {scanning && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-0 right-0 h-10 bg-gradient-to-b from-transparent via-electric/40 to-transparent animate-scan-y" />
        </div>
      )}
    </div>
  );
}

function AIPanel({ scene }: { scene: Scene }) {
  const analyzing = scene === 'analyzing' || scene === 'detecting';
  const done = scene === 'ready' || scene === 'action';
  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold tracking-widest text-white/50">
        <Activity className="h-3.5 w-3.5 text-electric" /> AI ANALYSIS
      </div>

      {/* progress status */}
      <div className="mb-5 min-h-[3.5rem]">
        {scene === 'idle' && (
          <span className="inline-flex items-center gap-2 text-sm text-white/60">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-white/20">
              <Play className="h-3 w-3" />
            </span>
            Ready to analyze
          </span>
        )}
        {analyzing && (
          <span className="inline-flex items-center gap-2 text-sm text-vision">
            <Loader2 className="h-4 w-4 animate-spin" /> {scene === 'analyzing' ? 'Analyzing image...' : 'Detecting features...'}
          </span>
        )}
        {done && (
          <span className="inline-flex items-center gap-2 text-sm text-electric">
            <CheckCircle2 className="h-4 w-4" /> Analysis complete
          </span>
        )}
      </div>

      {scene === 'ready' || scene === 'action' ? (
        <>
          <div className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-white/70">Risk Level</span>
              <span className="font-semibold rounded-md bg-honey/20 px-2 py-0.5 text-honey">Moderate</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="text-white/70">Confidence</span>
              <span className="font-semibold text-white">94.2%</span>
            </div>
            <div className="rounded-lg bg-white/5 px-3 py-2">
              <span className="text-white/70">Detected Indicators</span>
              <ul className="mt-2 space-y-1">
                {DETECTED.map((d) => (
                  <li key={d} className="flex items-center gap-2 text-white/85">
                    <span className="h-1.5 w-1.5 rounded-full bg-honey" /> {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-4 rounded-lg border border-vision/30 bg-vision/10 px-3 py-2.5 text-sm font-medium text-vision">
            {scene === 'action'
              ? 'Recommended action: Specialist review recommended.'
              : 'Recommendation: Specialist review recommended.'}
          </p>
        </>
      ) : (
        <div className="space-y-2 text-sm">
          {['Vessel detection', 'Feature extraction', 'Risk estimation'].map((step, i) => (
            <div key={step} className="flex items-center gap-2 text-white/60">
              <span className="grid h-5 w-5 place-items-center rounded-full border border-white/15 text-[10px]">{i + 1}</span>
              {step}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AIDemoSequence({
  mode = 'auto',
  className = '',
}: {
  mode?: Mode;
  className?: string;
}) {
  const [scene, setScene] = useState<Scene>('idle');
  const [demoLabel, setDemoLabel] = useState<string>('DEMO VISUALIZATION — NOT A MEDICAL DIAGNOSIS');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const play = (loop: boolean) => {
    clearTimers();
    const seq: Exclude<Scene, 'idle'>[] = ['analyzing', 'detecting', 'ready', 'action'];
    let i = 0;
    const step = () => {
      if (i >= seq.length) {
        if (loop) {
          setScene('idle');
          timers.current.push(setTimeout(() => { i = 0; step(); }, 900));
        }
        return;
      }
      const s = seq[i];
      setScene(s);
      const t = s === 'action' ? 1200 : SCENE_TIME[s];
      timers.current.push(setTimeout(() => { i += 1; step(); }, t));
    };
    timers.current.push(setTimeout(step, 600));
  };

  // auto mode loops
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (mode === 'auto') {
      if (reduced) {
        setScene('action');
      } else {
        setDemoLabel('DEMO VISUALIZATION — NOT A MEDICAL DIAGNOSIS');
        play(true);
      }
    } else {
      setDemoLabel('INTERACTIVE DEMONSTRATION');
      setScene('idle');
    }
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const interactive = mode === 'interactive';

  return (
    <div className={`w-full ${className}`}>
      <div className="relative grid gap-5 md:grid-cols-2 md:gap-6">
        <RetinaPanel scene={scene} />
        <AIPanel scene={scene} />
      </div>
      <div className="mt-5 text-center">
        <span className="inline-block rounded-full border border-white/25 bg-white/5 px-4 py-1.5 text-[11px] font-semibold tracking-widest text-white/70">
          {demoLabel}
        </span>
      </div>
      {interactive && scene === 'idle' && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => play(false)}
            className="inline-flex items-center gap-2 rounded-lg bg-electric px-6 py-3 text-sm font-semibold text-navy transition-all hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
          >
            <Play className="h-4 w-4" /> Start Demo
          </button>
          <p className="mt-3 text-xs text-white/50">{MEDICAL_DISCLAIMER}</p>
        </div>
      )}
      {interactive && scene !== 'idle' && (
        <p className="mt-5 text-center text-xs text-white/50">{MEDICAL_DISCLAIMER}</p>
      )}
    </div>
  );
}
