/**
 * Resonance radar — a four-axis SVG chart comparing the current user's
 * facet profile (warm gold) with an anonymous candidate (cool violet).
 *
 * The score labels animate from 0 → target on mount, unless
 * `prefers-reduced-motion` is set, in which case they render the final
 * value immediately. All content is purely presentational; every input
 * is a pre-computed integer score, never PII.
 */
import { useEffect, useMemo, useState } from "react";

import { useReducedMotion } from "@/experiences/library-v2/motion/reduced-motion";

export type RadarFacet = {
  key: string;
  label: string;
  self: number; // 0-100
  other: number; // 0-100
};

type Props = {
  facets: RadarFacet[];
  size?: number;
  selfLabel: string;
  otherLabel: string;
  disclaimer?: string;
};

/** Text-equivalent readout for screen readers. */
export function radarSummary(facets: RadarFacet[]): string {
  return facets
    .map((f) => `${f.label}: self ${Math.round(f.self)}, other ${Math.round(f.other)}`)
    .join("; ");
}

function polar(cx: number, cy: number, radius: number, angle: number): [number, number] {
  return [cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius];
}

export function ResonanceRadar({
  facets,
  size = 260,
  selfLabel,
  otherLabel,
  disclaimer,
}: Props) {
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
      // easeOutCubic
      setT(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, facets]);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 32;
  const axes = useMemo(
    () =>
      facets.map((_, i) => {
        // Start at the top and go clockwise.
        return (-Math.PI / 2) + (i * (Math.PI * 2)) / facets.length;
      }),
    [facets],
  );

  const rings = [0.25, 0.5, 0.75, 1];

  const selfPoints = facets
    .map((f, i) => {
      const r = (Math.max(0, Math.min(100, f.self)) / 100) * radius * t;
      const [x, y] = polar(cx, cy, r, axes[i]);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const otherPoints = facets
    .map((f, i) => {
      const r = (Math.max(0, Math.min(100, f.other)) / 100) * radius * t;
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
        aria-label={`${selfLabel} vs ${otherLabel}: ${radarSummary(facets)}`}
      >
        <defs>
          <radialGradient id="cmp-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 220, 140, 0.35)" />
            <stop offset="100%" stopColor="rgba(255, 220, 140, 0)" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={radius} fill="url(#cmp-halo)" opacity="0.6" />
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
        {/* other = violet */}
        <polygon
          points={otherPoints}
          fill="rgba(167, 139, 250, 0.22)"
          stroke="rgba(196, 181, 253, 0.85)"
          strokeWidth={1.4}
        />
        {/* self = gold */}
        <polygon
          points={selfPoints}
          fill="rgba(251, 191, 36, 0.16)"
          stroke="rgba(253, 224, 71, 0.9)"
          strokeWidth={1.6}
        />
        {facets.map((f, i) => {
          const [lx, ly] = polar(cx, cy, radius + 18, axes[i]);
          return (
            <text
              key={f.key}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill="rgba(253, 230, 138, 0.9)"
            >
              {f.label}
            </text>
          );
        })}
      </svg>
      <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-amber-100/70">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-amber-300/80" /> {selfLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-sm bg-violet-300/80" /> {otherLabel}
        </span>
      </div>
      {disclaimer && (
        <figcaption className="max-w-sm text-center text-[11px] text-amber-200/60">
          {disclaimer}
        </figcaption>
      )}
    </figure>
  );
}
