import type { ReactNode } from 'react';
import Reveal from './Reveal';

/** Consistent section heading (eyebrow + H2 + optional lede). */
export default function SectionHeading({
  eyebrow,
  title,
  lede,
  align = 'center',
  className = '',
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: string;
  align?: 'center' | 'left';
  className?: string;
}) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : 'text-left';
  return (
    <Reveal className={`max-w-2xl ${alignCls} ${className}`}>
      {eyebrow && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-electric">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl font-bold leading-tight text-navy sm:text-4xl">
        {title}
      </h2>
      {lede && <p className="mt-4 text-base leading-relaxed text-ink-soft">{lede}</p>}
    </Reveal>
  );
}
