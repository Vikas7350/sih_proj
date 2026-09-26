'use client';

import { useState } from 'react';
import PublicLayout from '@/components/public/PublicLayout';
import SectionHeading from '@/components/public/SectionHeading';
import Reveal from '@/components/public/Reveal';
import FAQAccordion from '@/components/public/FAQAccordion';
import { Mail, HelpCircle, Handshake, Loader2, CheckCircle2 } from 'lucide-react';

const FAQ = [
  { q: 'Is the AI a replacement for doctors?', a: 'No. It is designed as a screening support tool.' },
  { q: 'Who is the platform designed for?', a: 'Primary healthcare environments and healthcare workers.' },
  { q: 'Does the system diagnose diabetic retinopathy?', a: 'The system provides AI-assisted screening/risk information. Clinical diagnosis should remain with qualified healthcare professionals.' },
  { q: 'Can it work in rural PHCs?', a: 'The product is specifically designed around PHC workflows and constrained access to specialists.' },
  { q: 'What happens after a high-risk result?', a: 'The result should support appropriate clinical review and referral according to the healthcare workflow.' },
  { q: 'What image formats and sizes are supported?', a: 'JPG, JPEG, and PNG images up to 10MB.' },
  { q: 'What happens if my photo quality is poor?', a: 'The system flags quality issues and provides recapture guidance before analysis.' },
];

/* §5.2 Contact Options Grid */
const OPTIONS = [
  { icon: HelpCircle, title: 'General Questions', desc: 'Project information, usage guidelines, and general platform inquiries.' },
  { icon: Mail, title: 'Technical Support', desc: 'API integration, backend configuration, and technical assistance.' },
  { icon: Handshake, title: 'Collaboration', desc: 'Clinical research, healthcare institutions, and PHC partnerships.' },
];

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function ContactPage() {
  const [status, setStatus] = useState<Status>('idle');
  const [form, setForm] = useState({ name: '', email: '', organization: '', reason: '', message: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setStatus('sent');
      setForm({ name: '', email: '', organization: '', reason: '', message: '' });
    } catch {
      setStatus('error');
    }
  }

  const field =
    'w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-2 focus:outline-electric';

  return (
    <PublicLayout>
      {/* §5.1 Hero */}
      <section className="relative overflow-hidden bg-navy pt-24 pb-16 sm:pt-32 sm:pb-24">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(ellipse 60% 50% at 50% 0%, #00C9B720 0%, transparent 70%)' }} />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h1 className="font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
              Have a Question About the Platform?
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/70">
              Talk to the team building AI-assisted screening for primary healthcare.
            </p>
          </Reveal>
        </div>
      </section>

      {/* §5.2 Contact Options Grid */}
      <section className="bg-snow py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3 items-stretch">
            {OPTIONS.map((o, i) => (
              <Reveal key={o.title} delay={i * 80} className="h-full">
                <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:border-electric/30 hover:shadow-md">
                  <div>
                    <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl bg-electric/10 text-electric">
                      <o.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-lg font-semibold text-ink">{o.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">{o.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* §5.3 Contact Form */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
          <SectionHeading eyebrow="Contact Us" title="Send a Message" />
          <form onSubmit={handleSubmit} className="mt-10 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Name</span>
                <input required className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink">Email</span>
                <input required type="email" className={field} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Organization</span>
              <input className={field} value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} placeholder="Organization (optional)" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Reason for contacting</span>
              <select className={field} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}>
                <option value="">Select a reason</option>
                <option>General Question</option>
                <option>Technical Support</option>
                <option>Collaboration</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Message</span>
              <textarea required rows={5} className={field} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="How can we help?" />
            </label>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-electric px-6 py-3 text-sm font-semibold text-navy transition-all hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric disabled:opacity-60"
            >
              {status === 'sending' ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</>
              ) : status === 'sent' ? (
                <><CheckCircle2 className="h-4 w-4" /> ✓ Message received</>
              ) : (
                'Send Message'
              )}
            </button>
            {status === 'error' && (
              <p className="text-center text-sm text-red-600">Something went wrong. Please try again.</p>
            )}
          </form>
        </div>
      </section>

      {/* §5.4 FAQ */}
      <section className="bg-navy py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Questions"
            title={<span className="text-white">Frequently Asked Questions</span>}
            className="[&_*]:text-white/70 [&_h2]:text-white"
          />
          <div className="mt-10">
            <FAQAccordion items={FAQ} />
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
