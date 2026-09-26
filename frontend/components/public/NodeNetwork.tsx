'use client';

import { useEffect, useState } from 'react';

/**
 * Self-connecting node network (design.md §A.2 §1.12). Decorative wow element
 * at page bottom. Hover a node → label appears.
 */

type Node = { x: number; y: number; label: string };

const NODES: Node[] = [
  { x: 15, y: 30, label: 'Village PHC' },
  { x: 35, y: 55, label: 'Primary Health Centre' },
  { x: 55, y: 25, label: 'Community Health Centre' },
  { x: 72, y: 50, label: 'District Hospital' },
  { x: 88, y: 30, label: 'Specialist Centre' },
  { x: 25, y: 75, label: 'Anganwadi Centre' },
  { x: 60, y: 75, label: 'Sub-District Hospital' },
  { x: 45, y: 42, label: 'SCREENING NODE' },
];

const EDGES: [number, number][] = [
  [0, 1], [1, 4], [2, 3], [3, 4], [0, 5], [5, 6], [6, 3], [1, 7], [7, 3], [2, 7], [5, 1],
];

export default function NodeNetwork() {
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setReady(true), reduced ? 0 : 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="relative overflow-hidden bg-navy py-20 sm:py-28" aria-hidden="true">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="relative aspect-[2/1] w-full" onMouseLeave={() => setHovered(null)}>
          {/* edges */}
          <svg className="absolute inset-0 h-full w-full">
            {EDGES.map(([a, b], i) => (
              <line
                key={i}
                x1={`${NODES[a].x}%`}
                y1={`${NODES[a].y}%`}
                x2={`${NODES[b].x}%`}
                y2={`${NODES[b].y}%`}
                stroke="#00C9B7"
                strokeWidth="1"
                opacity={ready ? 0.3 : 0}
                className="transition-opacity duration-700"
                style={{ transitionDelay: `${i * 80}ms` }}
              />
            ))}
          </svg>

          {/* nodes */}
          {NODES.map((node, i) => (
            <div
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
              onMouseEnter={() => setHovered(i)}
            >
              <span
                className={`block h-3 w-3 rounded-full transition-all duration-300 ${
                  i === 7
                    ? 'bg-vision shadow-[0_0_12px_#4DE8FF] scale-125'
                    : 'bg-electric shadow-[0_0_8px_#00C9B7]'
                } ${ready ? 'opacity-100' : 'opacity-0'}`}
                style={{ transitionDelay: `${200 + i * 100}ms` }}
              />
              {hovered === i && (
                <span className="absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/20 bg-navy/95 px-3 py-1 text-[10px] font-semibold tracking-wider text-white/80 backdrop-blur-sm">
                  {node.label}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
