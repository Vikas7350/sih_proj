import Link from 'next/link';
import type { ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary';

const styles: Record<Variant, string> = {
  primary:
    'bg-electric text-navy hover:brightness-105 shadow-lg shadow-electric/20 focus-visible:outline-electric',
  secondary:
    'bg-transparent border border-white/40 text-white hover:bg-white/10 focus-visible:outline-white',
  tertiary:
    'bg-transparent text-electric hover:text-vision underline-offset-4 hover:underline focus-visible:outline-electric',
};

/**
 * Shared CTA link (design.md §2.5). Renders an <a>/<Link>. Add `href="..."` to
 * every usage; renders a <span> when `href` is omitted (e.g. disabled/demo).
 */
export default function CTAButton({
  href,
  variant = 'primary',
  children,
  className = '',
}: {
  href?: string;
  variant?: Variant;
  children: ReactNode;
  className?: string;
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 ${styles[variant]} ${className}`;

  if (!href) {
    return <span className={classes}>{children}</span>;
  }
  if (href.startsWith('/api') || href.startsWith('http')) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
