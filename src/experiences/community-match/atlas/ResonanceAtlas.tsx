/**
 * Resonance Atlas — an orbital star map of the current user's Top K
 * anonymous candidates. Deterministic positions from
 * {@link layoutAtlas}; slow orbital motion via CSS transform on a
 * wrapper group. Every candidate point is keyboard-focusable and
 * emits `onFocus`/`onSelect` events; the caller renders the detail
 * drawer.
 *
 * `prefers-reduced-motion` disables both the orbital rotation and the
 * candidate pulse.
 */
import { useMemo } from "react";

import { useReducedMotion } from "@/experiences/library-v2/motion/reduced-motion";
import { BookmarkGlyphIcon } from "./BookmarkGlyph";
import { layoutAtlas, type AtlasPoint } from "./bookmark";

export type AtlasCandidate = {
  alias: string;
  overall: number;
  overallBand: string;
  pending?: boolean;
};

type Props = {
  self: { alias: string };
  candidates: AtlasCandidate[];
  focusedAlias: string | null;
  onSelect: (alias: string) => void;
  labelYou: string;
  labelPending: string;
  emptyLabel: string;
};

export function ResonanceAtlas({
  self,
  candidates,
  focusedAlias,
  onSelect,
  labelYou,
  labelPending,
  emptyLabel,
}: Props) {
  const reduced = useReducedMotion();
  const points = useMemo(() => layoutAtlas(candidates), [candidates]);

  const size = 520;
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 2 - 30;

  return (
    <div className="relative mx-auto w-full max-w-[560px]" data-testid="resonance-atlas">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role="group"
        aria-label={emptyLabel && candidates.length === 0 ? emptyLabel : "Resonance atlas"}
        className="w-full"
      >
        <defs>
          <radialGradient id="atlas-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(76, 29, 149, 0.35)" />
            <stop offset="65%" stopColor="rgba(15, 10, 30, 0.9)" />
            <stop offset="100%" stopColor="rgba(0, 0, 0, 1)" />
          </radialGradient>
          <radialGradient id="atlas-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(253, 224, 71, 0.95)" />
            <stop offset="100%" stopColor="rgba(253, 224, 71, 0)" />
          </radialGradient>
          <filter id="atlas-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={size / 2 - 4} fill="url(#atlas-bg)" />

        {/* zodiacal tick ring */}
        <g opacity="0.35">
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2;
            const r1 = size / 2 - 18;
            const r2 = r1 - (i % 5 === 0 ? 10 : 4);
            const x1 = cx + Math.cos(a) * r1;
            const y1 = cy + Math.sin(a) * r1;
            const x2 = cx + Math.cos(a) * r2;
            const y2 = cy + Math.sin(a) * r2;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="rgba(253, 230, 138, 0.35)"
                strokeWidth={i % 5 === 0 ? 0.9 : 0.5}
              />
            );
          })}
        </g>

        {/* orbits */}
        <g className={reduced ? undefined : "cmp-orbit-slow"} style={{ transformOrigin: `${cx}px ${cy}px` }}>
          <circle cx={cx} cy={cy} r={scale * 0.55} fill="none" stroke="rgba(196, 181, 253, 0.18)" strokeDasharray="1 5" />
          <circle cx={cx} cy={cy} r={scale * 0.88} fill="none" stroke="rgba(196, 181, 253, 0.14)" strokeDasharray="1 6" />
        </g>

        {/* stardust */}
        <g opacity="0.6">
          {Array.from({ length: 36 }).map((_, i) => {
            // Deterministic sprinkle
            const a = (i * 137.508) % 360;
            const r = 30 + ((i * 53) % (size / 2 - 40));
            const rad = (a * Math.PI) / 180;
            return (
              <circle
                key={i}
                cx={cx + Math.cos(rad) * r}
                cy={cy + Math.sin(rad) * r}
                r={0.7 + (i % 3) * 0.3}
                fill="rgba(253, 230, 138, 0.55)"
              />
            );
          })}
        </g>

        {/* self core */}
        <g>
          <circle cx={cx} cy={cy} r={26} fill="url(#atlas-core)" filter="url(#atlas-glow)" />
          <circle cx={cx} cy={cy} r={10} fill="rgba(253, 224, 71, 0.95)" />
          <text
            x={cx}
            y={cy + 42}
            textAnchor="middle"
            fontSize={10}
            fill="rgba(253, 230, 138, 0.85)"
          >
            {labelYou} · {self.alias}
          </text>
        </g>

        {/* candidate points */}
        {points.map((p) => (
          <CandidatePoint
            key={p.alias}
            p={p}
            cx={cx}
            cy={cy}
            scale={scale}
            focused={focusedAlias === p.alias}
            pending={
              candidates.find((c) => c.alias === p.alias)?.pending ?? false
            }
            onSelect={onSelect}
            reduced={reduced}
            labelPending={labelPending}
          />
        ))}
      </svg>

      {candidates.length === 0 && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-xs text-amber-200/70"
          role="status"
        >
          <span className="max-w-[240px] rounded-full border border-amber-400/25 bg-black/40 px-3 py-1.5">
            {emptyLabel}
          </span>
        </div>
      )}

      <style>{`
        @keyframes cmp-orbit-rot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .cmp-orbit-slow { animation: cmp-orbit-rot 180s linear infinite; }
        @keyframes cmp-pulse { 0%,100% { opacity: 0.55; } 50% { opacity: 1; } }
        .cmp-pulse { animation: cmp-pulse 3.2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}

function CandidatePoint({
  p,
  cx,
  cy,
  scale,
  focused,
  pending,
  onSelect,
  reduced,
  labelPending,
}: {
  p: AtlasPoint;
  cx: number;
  cy: number;
  scale: number;
  focused: boolean;
  pending: boolean;
  onSelect: (alias: string) => void;
  reduced: boolean;
  labelPending: string;
}) {
  const x = cx + p.x * scale;
  const y = cy + p.y * scale;
  const r = 8 + p.size * 6;
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${p.alias}${pending ? ` · ${labelPending}` : ""}`}
      onClick={() => onSelect(p.alias)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(p.alias);
        }
      }}
      className="cursor-pointer outline-none focus-visible:[&_circle:first-of-type]:stroke-amber-200"
      data-alias={p.alias}
    >
      <circle
        cx={x}
        cy={y}
        r={r + 6}
        fill={`rgba(253, 224, 71, ${0.05 + p.glow * 0.18})`}
        filter="url(#atlas-glow)"
        stroke={focused ? "rgba(253, 230, 138, 0.9)" : "transparent"}
        strokeWidth={1.5}
        className={!reduced && pending ? "cmp-pulse" : undefined}
      />
      <circle
        cx={x}
        cy={y}
        r={r}
        fill={focused ? "rgba(253, 224, 71, 0.95)" : "rgba(230, 195, 130, 0.85)"}
      />
      <foreignObject x={x - 10} y={y - 10} width={20} height={20} aria-hidden>
        <div className="flex h-5 w-5 items-center justify-center text-[#1a0e2e]">
          <BookmarkGlyphIcon glyph={p.glyph} size={14} />
        </div>
      </foreignObject>
    </g>
  );
}
