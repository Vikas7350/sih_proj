import PublicLayout from '@/components/public/PublicLayout';
import Hero from '@/components/public/Hero';
import SectionHeading from '@/components/public/SectionHeading';
import CTAButton from '@/components/public/CTAButton';
import Reveal from '@/components/public/Reveal';
import ProblemSolution from '@/components/public/ProblemSolution';
import AIDemoSequence from '@/components/public/AIDemoSequence';
import ImpactNumbers from '@/components/public/ImpactNumbers';
import NodeNetwork from '@/components/public/NodeNetwork';
import PhcJourney from '@/components/public/PhcJourney';
import BeforeAfter from '@/components/public/BeforeAfter';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  Lock,
  Eye,
  Users,
  Stethoscope,
  HeartPulse,
  Camera,
  BrainCircuit,
  BarChart3,
  ClipboardCheck,
  Send,
  MapPin,
} from 'lucide-react';

/* ─── Trust Strip items ─── */
const TRUST = [
  { icon: Stethoscope, text: 'Designed for PHCs' },
  { icon: BrainCircuit, text: 'AI-Assisted' },
  { icon: Zap, text: 'Fast Screening' },
  { icon: Lock, text: 'Secure Patient Data' },
  { icon: ClipboardCheck, text: 'Human Review' },
  { icon: HeartPulse, text: 'Rural-Ready' },
];

/* ─── Problem cards (§1.4) ─── */
const PROBLEMS = [
  {
    icon: Users,
    title: 'Specialist Access',
    desc: 'Retinal specialists aren\'t available everywhere. (~1 ophthalmologist per 100,000 rural population.)',
  },
  {
    icon: Eye,
    title: 'Screening Delays',
    desc: 'Damage often occurs before symptoms appear. By the time vision changes are noticed, intervention may be too late.',
  },
  {
    icon: MapPin,
    title: 'Rural Distance',
    desc: 'Patients travel long distances to reach a specialist, and many don\'t make the journey in time.',
  },
  {
    icon: ShieldCheck,
    title: 'Manual Bottlenecks',
    desc: 'Manual screening can\'t scale to match demand. 77M+ diabetic adults in India need regular eye screening.',
  },
];

/* ─── Solution pipeline (§1.6) ─── */
const PIPELINE = [
  { icon: Camera, label: 'Capture', color: 'text-electric' },
  { icon: BrainCircuit, label: 'Analyze', color: 'text-vision' },
  { icon: BarChart3, label: 'Classify', color: 'text-honey' },
  { icon: ClipboardCheck, label: 'Review', color: 'text-electric' },
  { icon: Send, label: 'Refer', color: 'text-vision' },
];

/* ─── Who Benefits (§1.9) ─── */
const PERSONAS = [
  {
    role: 'Healthcare Worker',
    desc: 'Capture the retinal image and run the screening at the PHC.',
    flow: ['Capture', 'Upload', 'Screen'],
    img: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=700&q=70',
    alt: 'Healthcare worker attending to a patient at a primary health centre',
  },
  {
    role: 'Doctor',
    desc: 'Review the AI-assisted finding, interpret it, and decide the next step.',
    flow: ['Review', 'Interpret', 'Refer'],
    img: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=700&q=70',
    alt: 'Doctor reviewing a medical result',
  },
  {
    role: 'Patient',
    desc: 'Get screened close to home, understand the result, and act earlier.',
    flow: ['Screen', 'Understand', 'Act Earlier'],
    img: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=700&q=70',
    alt: 'Patient in a warm, caring healthcare setting',
  },
];

export default function HomePage() {
  return (
    <PublicLayout>
      {/* ════════════════════════════════════════
          §1.2 HERO
          ════════════════════════════════════════ */}
      <Hero />

      {/* ════════════════════════════════════════
          §1.3 TRUST STRIP
          ════════════════════════════════════════ */}
      <section className="border-b border-slate-100 bg-white py-6">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {TRUST.map((t) => (
              <Reveal key={t.text} className="flex items-center gap-2 text-sm text-ink-soft">
                <t.icon className="h-4 w-4 text-electric" />
                {t.text}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          §1.4 THE PROBLEM
          ════════════════════════════════════════ */}
      <section className="bg-snow py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Large Indian healthcare image */}
            <Reveal className="order-2 lg:order-1">
              <div className="relative overflow-hidden rounded-3xl depth-shadow">
                <img
                  src="https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=1000&q=70"
                  alt="Indian healthcare worker providing care in a rural primary health centre"
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover sm:aspect-[3/4]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/80 to-transparent" />
                <div className="absolute bottom-5 left-5 right-5">
                  <p className="font-display text-xl font-bold text-white">Specialists shouldn&apos;t be the only place</p>
                  <p className="mt-1 text-sm text-white/80">where screening begins.</p>
                </div>
              </div>
            </Reveal>

            {/* 4 problems */}
            <div className="order-1 lg:order-2">
              <SectionHeading
                eyebrow="The Challenge"
                title="The Bottleneck Isn't Patients. It's Screening."
                lede="Millions of diabetic patients in rural India need regular eye screening — but the infrastructure to deliver it doesn't exist at scale."
              />
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {PROBLEMS.map((p, i) => (
                  <Reveal key={p.title} delay={i * 90}>
                    <div className="group h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                      <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-electric/10 text-electric transition-colors group-hover:bg-electric group-hover:text-navy">
                        <p.icon className="h-5 w-5" />
                      </div>
                      <h3 className="font-display text-base font-semibold text-ink">
                        <span className="mr-1.5 text-xs font-bold text-electric">0{i + 1}</span>
                        {p.title}
                      </h3>
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">{p.desc}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          §1.5 PROBLEM → SOLUTION TRANSFORMATION
          ════════════════════════════════════════ */}
      <ProblemSolution />

      {/* ════════════════════════════════════════
          §1.6 SOLUTION PIPELINE
          ════════════════════════════════════════ */}
      <section className="bg-snow py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="The Workflow"
            title="From Retinal Image to Actionable Insight"
          />
          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-0">
            {PIPELINE.map((step, i) => (
              <Reveal key={step.label} delay={i * 120} className="flex items-center">
                <div className="flex flex-col items-center gap-2 px-4 sm:px-6">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:border-electric/40 hover:shadow-md">
                    <step.icon className={`h-6 w-6 ${step.color}`} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                    {step.label}
                  </span>
                </div>
                {i < PIPELINE.length - 1 && (
                  <ArrowRight className="hidden h-5 w-5 shrink-0 text-slate-300 sm:block" />
                )}
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          §1.7 LIVE AI VISUALIZATION
          ════════════════════════════════════════ */}
      <section className="bg-navy py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Live Demo"
            title={
              <span className="text-white">See the AI in Action</span>
            }
            lede="This is an illustrated demonstration of the screening workflow. The actual system analyzes real retinal fundus images."
            className="[&_*]:text-white/70 [&_h2]:text-white"
          />
          <div className="mt-12">
            <AIDemoSequence mode="auto" />
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          §1.8 BEFORE / AFTER PATHWAY
          ════════════════════════════════════════ */}
      <BeforeAfter />

      {/* ════════════════════════════════════════
          §1.9 WHO BENEFITS
          ════════════════════════════════════════ */}
      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Who Benefits"
            title="Built for Everyone in the Chain"
            lede="From the healthcare worker capturing the image to the patient receiving earlier care."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {PERSONAS.map((p, i) => (
              <Reveal key={p.role} delay={i * 100}>
                <div className="group card-plane overflow-hidden rounded-3xl border border-slate-200 bg-snow shadow-sm transition-shadow hover:shadow-lg">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={p.img}
                      alt={p.alt}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy/80 to-transparent" />
                    <div className="absolute bottom-3 left-4">
                      <p className="font-display text-lg font-bold text-white">{p.role}</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-sm leading-relaxed text-ink-soft">{p.desc}</p>
                    <div className="mt-4 flex items-center gap-2">
                      {p.flow.map((step, j) => (
                        <span key={step} className="flex items-center gap-2 text-[11px] font-semibold text-ink">
                          <span className="rounded-full border border-electric/30 bg-electric/10 px-2.5 py-1 text-electric">
                            {step}
                          </span>
                          {j < p.flow.length - 1 && <span className="h-px w-2 bg-slate-300" />}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════
          §1.9 RURAL PHC NETWORK STORY
          ════════════════════════════════════════ */}
      <PhcJourney />

      {/* ════════════════════════════════════════
          §1.10 IMPACT NUMBERS
          ════════════════════════════════════════ */}
      <ImpactNumbers />

      {/* ════════════════════════════════════════
          §1.11 FINAL CTA
          ════════════════════════════════════════ */}
      <section className="bg-navy-surface py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">
              Make Early Eye Screening Part of Primary Care
            </h2>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-4 text-base text-white/60">
              AI can help identify risk. Healthcare professionals make the decision.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <CTAButton href="/features" variant="primary">
                Explore the Platform
              </CTAButton>
              <CTAButton href="/how-it-works" variant="secondary">
                See How It Works
              </CTAButton>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════════════
          §1.12 PHC NETWORK WOW ELEMENT
          ════════════════════════════════════════ */}
      <NodeNetwork />
    </PublicLayout>
  );
}
