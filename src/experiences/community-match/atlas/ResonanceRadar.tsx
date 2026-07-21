/**
 * Resonance radar — a four-axis SVG chart showing the pair's facet
 * compatibility scores (communication, emotional support, action
 * rhythm, shared growth). Score labels animate from 0 → target on
 * mount, unless `prefers-reduced-motion` is set.
 *
 * All input scores are pre-computed integers; no PII flows through
 * this component.
 */
import { useEffect, useState } from "react";

import { useReducedMotion } from "@/experiences/library-v2/motion/reduced-motion";

export type RadarFacet = {
  key: string;
  label: string;
  score: number; // 0-100
};

type Props = {
  facets: RadarFacet[];
  size?: number;
  disclaimer?: string;
  ariaLabel?: string;
};

/** Text-equivalent readout for screen readers and tests. */
export function radarSummary(facets: RadarFacet[]): string {
  return facets.map((f) => `${f.label}: ${Math.round(f.score)}`).join("; ");
}

function polar(cx: number, cy: number, radius: number, angle: number): [number, number] {
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
}

export function ResonanceRadar({ facets, size = 260, disclaimer, ariaLabel }: Props) {
  const reduced = useReducedMotion();
  const [t, setT] = useState(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      setT(1);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, facets]);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 34;
  const axes = facets.map(
    (_, i) => -Math.PI / 2 + (i * (Math.PI * 2)) / facets.length,
  );
  const rings = [0.25, 0.5, 0.75, 1];

  const points = facets
    .map((f, i) => {
      const r = (Math.max(0, Math.min(100, f.score)) / 100) * radius * t;
      const [x, y] = polar(cx, cy, r, axes[i]);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <figure className="flex flex-col items-center gap-3">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={ariaLabel ?? radarSummary(facets)}
      >
        <defs>
          <radialGradient id="cmp-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(167, 139, 250, 0.28)" />
            <stop offset="100%" stopColor="rgba(167, 139, 250, 0)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={radius} fill="url(#cmp-halo)" opacity="0.7" />
        {rings.map((f) => (
          <circle
            key={f}
            cx={cx}
            cy={cy}
            r={radius * f}
            fill="none"
            stroke="rgba(214, 168, 74, 0.18)"
            strokeDasharray={f === 1 ? undefined : "2 4"}
          />
        ))}
        {axes.map((a, i) => {
          const [x, y] = polar(cx, cy, radius, a);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(214, 168, 74, 0.22)"
            />
          );
        })}
        <polygon
          points={points}
          fill="rgba(251, 191, 36, 0.18)"
          stroke="rgba(253, 224, 71, 0.9)"
          strokeWidth={1.6}
        />
        {facets.map((f, i) => {
          const [lx, ly] = polar(cx, cy, radius + 20, axes[i]);
          return (
            <g key={f.key}>
              <text
                x={lx}
                y={ly - 6}
                textAnchor="middle"
                fontSize={11}
                fill="rgba(253, 230, 138, 0.92)"
              >
                {f.label}
              </text>
              <text
                x={lx}
                y={ly + 8}
                textAnchor="middle"
                fontSize={11}
                fill="rgba(196, 181, 253, 0.9)"
              >
                {Math.round(f.score)}
              </text>
            </g>
          );
        })}
      </svg>
      {disclaimer && (
        <figcaption className="max-w-sm text-center text-[11px] text-amber-200/60">
          {disclaimer}
        </figcaption>
      )}
    </figure>
  );
}
