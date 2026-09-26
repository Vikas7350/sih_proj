'use client';

import Link from 'next/link';
import { ArrowRight, MapPin, ScanLine, Activity } from 'lucide-react';
import Reveal from './Reveal';
import CTAButton from './CTAButton';
import HeroEye from './HeroEye';

/**
 * Home hero (visual redesign). Left: editorial headline + CTAs.
 * Right: layered composite — an Indian healthcare worker photograph with a
 * floating 3D-CSS retina and an India→PHC→Specialist connection hint.
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy pt-24 pb-16 sm:pt-32 sm:pb-24">
      {/* layered depth glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 55% 45% at 22% 0%, #00C9B718 0%, transparent 70%), radial-gradient(ellipse 45% 40% at 90% 90%, #46D9E814 0%, transparent 70%)',
        }}
      />
      {/* faint India silhouette suggestion (abstract nodes, not geography) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 18% 40%, #E6A85C55 1.5px, transparent 2px), radial-gradient(circle at 30% 55%, #46D9E855 1.5px, transparent 2px), radial-gradient(circle at 45% 48%, #00C9B755 1.5px, transparent 2px), radial-gradient(circle at 60% 60%, #E6A85C44 1.5px, transparent 2px), radial-gradient(circle at 72% 50%, #46D9E844 1.5px, transparent 2px)',
          backgroundSize: '360px 360px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-12">
          {/* ── LEFT: copy ── */}
          <div className="space-y-6 text-center lg:text-left">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-vision">
                <ScanLine className="h-3.5 w-3.5" />
                AI-assisted retinal screening for primary healthcare
              </span>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="font-display text-4xl font-bold leading-[1.05] text-white sm:text-5xl lg:text-6xl">
                See diabetic retinopathy risk,
                <span className="mt-1 block text-transparent bg-clip-text bg-gradient-to-r from-electric to-vision">
                  before vision changes.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mx-auto max-w-lg text-base leading-relaxed text-white/70 sm:text-lg lg:mx-0">
                AI-assisted retinal screening designed to bring earlier detection
                closer to patients — through the Primary Health Centres already
                near them.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="flex flex-wrap items-center justify-center gap-4 lg:justify-start">
                <CTAButton href="/register" variant="primary">
                  Start Screening <ArrowRight className="h-4 w-4" />
                </CTAButton>
                <CTAButton href="/how-it-works" variant="secondary">
                  How It Works
                </CTAButton>
              </div>
            </Reveal>
          </div>

          {/* ── RIGHT: layered image + floating retina ── */}
          <Reveal delay={250} className="relative">
            {/* Indian healthcare worker photo card */}
            <div className="relative mx-auto max-w-md overflow-hidden rounded-3xl depth-shadow">
              <div className="aspect-[4/3] w-full">
                <img
                  src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=900&q=70"
                  alt="Healthcare professional attending to a patient in an Indian primary care setting"
                  loading="eager"
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/90 via-navy/10 to-transparent" />
              </div>
              {/* on-image caption */}
              <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 text-white">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-electric/20 text-electric backdrop-blur-sm border border-electric/30">
                  <Activity className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Primary Health Centre</p>
                  <p className="text-sm font-semibold">Retinal screening, closer to home</p>
                </div>
              </div>
            </div>

            {/* floating retina (overlaps the image bottom) */}
            <div className="absolute -bottom-10 left-1/2 w-[70%] -translate-x-1/2 sm:w-[62%] animate-float-slow drop-shadow-xl">
              <HeroEye />
            </div>

            {/* floating India→Specialist hint */}
            <div className="absolute -right-2 top-6 hidden rounded-xl border border-white/15 bg-navy/75 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-vision backdrop-blur-sm sm:block">
              <span className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> Village → PHC → Specialist</span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
