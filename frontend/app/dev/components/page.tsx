import PublicLayout from '@/components/public/PublicLayout';
import CTAButton from '@/components/public/CTAButton';
import SectionHeading from '@/components/public/SectionHeading';
import FAQAccordion from '@/components/public/FAQAccordion';
import RetinaScanner from '@/components/public/RetinaScanner';
import AIDemoSequence from '@/components/public/AIDemoSequence';
import Reveal from '@/components/public/Reveal';
import { ArrowRight } from 'lucide-react';

const FAQ_ITEMS = [
  { q: 'Is the AI a replacement for doctors?', a: 'No. It is designed as a screening support tool.' },
  {
    q: 'What image formats and sizes are supported?',
    a: 'The platform accepts JPG, JPEG and PNG images up to 10MB.',
  },
  {
    q: 'What happens if my photo quality is poor?',
    a: 'The system flags quality issues and provides recapture guidance before analysis.',
  },
];

export default function DevComponentsPage() {
  return (
    <PublicLayout>
      <section className="bg-navy px-4 py-20 text-white">
        <div className="mx-auto max-w-5xl space-y-16">
          <div className="text-center">
            <h1 className="font-display text-4xl font-bold">Shared Component Showcase</h1>
            <p className="mt-3 text-white/60">Temporary dev route — render &amp; review in isolation.</p>
          </div>

          {/* Navbar already rendered via PublicLayout */}

          {/* CTAButton */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold text-electric">CTAButton</h2>
            <div className="flex flex-wrap gap-4">
              <CTAButton href="/register" variant="primary">Get Started <ArrowRight className="h-4 w-4" /></CTAButton>
              <CTAButton href="/how-it-works" variant="secondary">See How It Works</CTAButton>
              <CTAButton href="/features" variant="tertiary">Explore Features</CTAButton>
            </div>
          </div>

          {/* SectionHeading */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold text-electric">SectionHeading</h2>
            <SectionHeading
              eyebrow="Why it matters"
              title="The Bottleneck Isn't Patients. It's Screening."
              lede="Retinal specialists aren't available everywhere, and manual screening can't scale to match demand."
            />
          </div>

          {/* FAQAccordion */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold text-electric">FAQAccordion</h2>
            <FAQAccordion items={FAQ_ITEMS} />
          </div>

          {/* RetinaScanner (auto) */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold text-electric">RetinaScanner (auto)</h2>
            <RetinaScanner />
          </div>

          {/* RetinaScanner (fixed complete) */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold text-electric">RetinaScanner (fixed: complete)</h2>
            <RetinaScanner state="complete" />
          </div>

          {/* AIDemoSequence auto */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold text-electric">AIDemoSequence (auto)</h2>
            <AIDemoSequence mode="auto" />
          </div>

          {/* AIDemoSequence interactive */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold text-electric">AIDemoSequence (interactive)</h2>
            <AIDemoSequence mode="interactive" />
          </div>

          {/* Reveal */}
          <div className="space-y-4">
            <h2 className="font-display text-2xl font-semibold text-electric">Reveal</h2>
            <Reveal className="max-w-md rounded-xl border border-white/10 bg-white/5 p-6">
              <p className="text-white/80">
                This block fades and slides up when it scrolls into view. Try scrolling away and back.
              </p>
            </Reveal>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
