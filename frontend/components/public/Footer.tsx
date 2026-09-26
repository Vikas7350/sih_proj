import Link from 'next/link';
import { Eye } from 'lucide-react';

const columns: { title: string; links: { label: string; href: string; placeholder?: boolean }[] }[] = [
  {
    title: 'Platform',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Features', href: '/features' },
      { label: 'How It Works', href: '/how-it-works' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  // Privacy / Terms / Documentation are CONTENT NEEDED (pages.md §1.13) —
  // placeholder links until real pages exist.
  {
    title: 'Resources',
    links: [
      { label: 'Documentation', href: '#', placeholder: true },
      { label: 'Privacy', href: '#', placeholder: true },
      { label: 'Terms', href: '#', placeholder: true },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-navy text-white">
      {/* subtle network deco */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, #00C9B7 0, transparent 120px), radial-gradient(circle at 80% 60%, #4DE8FF 0, transparent 140px)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-electric text-navy">
                <Eye className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="font-display text-lg font-bold">NetraCare</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">
              AI-assisted retinal screening for primary healthcare.
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-white/50">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.href === '#' ? (
                      <span
                        title="Placeholder — page not built yet (pages.md §1.13 CONTENT NEEDED)"
                        className="cursor-not-allowed text-white/60"
                      >
                        {l.label}
                      </span>
                    ) : (
                      <Link href={l.href} className="text-white/75 transition-colors hover:text-white">
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-sm text-white/60">© 2026 NetraCare</p>
          <p className="text-xs text-white/60">Built for accessible healthcare.</p>
          <p className="text-xs font-medium text-electric">
            AI-assisted screening • Human-led care
          </p>
        </div>
      </div>
    </footer>
  );
}
