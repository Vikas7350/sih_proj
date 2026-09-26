'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export type FaqItem = { q: string; a: string };

/**
 * Accessible accordion (design.md §3.8 / §5.4 — shared by How It Works & Contact).
 * Keyboard: each item is a <button> toggling aria-expanded; chevron rotates.
 */
export default function FAQAccordion({
  items,
  className = '',
}: {
  items: FaqItem[];
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className={`divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/5 ${className}`}>
      {items.map((item, i) => {
        const isOpen = open === i;
        const panelId = `faq-panel-${i}`;
        const btnId = `faq-btn-${i}`;
        return (
          <div key={item.q} className="px-6">
            <h3>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 py-5 text-left focus-visible:outline-2 focus-visible:outline-electric"
              >
                <span className="font-display text-base font-semibold text-white sm:text-lg">
                  {item.q}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-electric transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={btnId}
              hidden={!isOpen}
              className="grid transition-[grid-template-rows] duration-200"
              style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
            >
              <div className="overflow-hidden">
                <p className="pb-5 text-sm leading-relaxed text-white/75">{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
