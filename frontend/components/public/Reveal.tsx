'use client';

import type { ReactNode } from 'react';
import { useInView } from '@/lib/hooks/useInView';

/** Scroll-reveal wrapper (design.md §A.1). Respects prefers-reduced-motion. */
export default function Reveal({
  children,
  className = '',
  delay = 0,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: 'div' | 'section' | 'li' | 'article' | 'p' | 'h2' | 'h3';
}) {
  const { ref, inView } = useInView();
  return (
    <Tag
      ref={ref as never}
      className={`reveal ${inView ? 'revealed' : ''} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}
