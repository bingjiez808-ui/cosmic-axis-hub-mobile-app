/**
 * DailyDestinyCompass — six-dimensional destiny compass SVG.
 *
 * Presentation-only: receives already-computed DailyDomainScore, never
 * fabricates numbers. Renders a hexagonal radar of the six reading
 * rooms (overall centre + 5 life domains). Radius per dimension is a
 * linear map of score∈[0..100] onto the ring radius. Keyboard/click
 * selects a dimension; the active label is announced via aria-live.
 *
 * Reduced-motion: skips the neutral→real spring on mount.
 */
import { useEffect, useMemo, useState } from "react";

import type { DailyDomainScore, DomainKey } from "@/lib/daily-domain-score";
import { useReducedMotion } from "@/experiences/library-v2/motion/reduced-motion";

export type CompassAxis = "overall" | DomainKey;

const AXES: CompassAxis[] = ["overall", "love", "study", "career", "body_mind", "finance"];

type Props = {
  score: DailyDomainScore;
  labels: Record<CompassAxis, string>;
  bandLabels: Record<string, string>;
  centreCaption: string;
  activeAxis?: CompassAxis;
  onSelectAxis?: (axis: CompassAxis) => void;
};

const BAND_STROKE: Record<string, string> = {
  supportive: "#6ee7b7",
  neutral: "#fcd34d",
  mixed: "#fbbf24",
  caution: "#fda4af",
};

/** Return {x,y} for axis i at radius r on a hex centred at (cx,cy). */
function pointFor(i: number, total: number, r: number, cx: number, cy: number) {
  // Top-anchored, clockwise.
  const angle = (Math.PI * 2 * i) / total - Math.PI / 2;
  return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
}

export function DailyDestinyCompass({
  score,
  labels,
  bandLabels,
  centreCaption,
  activeAxis: activeProp,
  onSelectAxis,
}: Props) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const [activeLocal, setActiveLocal] = useState<CompassAxis>("overall");
  const active = activeProp ?? activeLocal;
  const setActive = (a: CompassAxis) => {
    if (!activeProp) setActiveLocal(a);
    onSelectAxis?.(a);
  };

  const size = 360;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 132;

  const values: Record<CompassAxis, { score: number; band: string; confidence?: string }> = useMemo(() => {
    const map: Record<string, { score: number; band: string; confidence?: string }> = {
      overall: { score: score.overall.score, band: score.overall.band },
    };
    for (const d of score.domains) {
      map[d.domain] = { score: d.score, band: d.band, confidence: d.confidence };
    }
    return map as Record<CompassAxis, { score: number; band: string; confidence?: string }>;
  }, [score]);

  // For axes ring, the 5 outer dimensions are placed around; overall lives at centre.
  const outerAxes = AXES.filter((a) => a !== "overall");
  const scaleR = (s: number) => 28 + (Math.max(0, Math.min(100, s)) / 100) * (maxR - 28);
  // Animate radius from neutral 50 → real on first paint.
  const animR = (s: number) => (mounted ? scaleR(s) : scaleR(50));

  const polygonPoints = outerAxes
    .map((axis, i) => {
      const r = animR(values[axis].score);
      const p = pointFor(i, outerAxes.length, r, cx, cy);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  const advice =
    score.overall.band === "supportive" || score.overall.band === "neutral"
      ? bandLabels.push
      : score.overall.band === "mixed"
        ? bandLabels.observe
        : bandLabels.pause;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const order: CompassAxis[] = ["overall", ...outerAxes];
    const idx = order.indexOf(active);
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setActive(order[(idx + 1) % order.length]);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive(order[(idx - 1 + order.length) % order.length]);
    } else if (e.key === "Home") {
      setActive("overall");
    }
  };

  return (
    <div
      className="relative select-none"
      role="group"
      aria-label="Daily Destiny Compass"
      onKeyDown={onKeyDown}
      tabIndex={0}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        className="max-w-[420px] mx-auto block"
        role="img"
      >
        <defs>
          <radialGradient id="compass-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.28" />
            <stop offset="65%" stopColor="#f59e0b" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#0a0a12" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="compass-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={maxR + 18} fill="url(#compass-glow)" />
        {/* Concentric rings 25/50/75/100 */}
        {[0.25, 0.5, 0.75, 1].map((k) => (
          <circle
            key={k}
            cx={cx}
            cy={cy}
            r={scaleR(k * 100)}
            fill="none"
            stroke={k === 0.5 ? "rgba(251,191,36,0.35)" : "rgba(251,191,36,0.12)"}
            strokeDasharray={k === 0.5 ? "2 3" : undefined}
          />
        ))}
        {/* Axis spokes + labels */}
        {outerAxes.map((axis, i) => {
          const outer = pointFor(i, outerAxes.length, maxR + 4, cx, cy);
          const labelP = pointFor(i, outerAxes.length, maxR + 26, cx, cy);
          const isActive = active === axis;
          return (
            <g key={axis}>
              <line
                x1={cx}
                y1={cy}
                x2={outer.x}
                y2={outer.y}
                stroke={isActive ? "#fde68a" : "rgba(251,191,36,0.18)"}
                strokeWidth={isActive ? 1.4 : 1}
              />
              <text
                x={labelP.x}
                y={labelP.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="11"
                fill={isActive ? "#fde68a" : "rgba(254,243,199,0.8)"}
                style={{ letterSpacing: "0.08em" }}
              >
                {labels[axis]}
              </text>
            </g>
          );
        })}
        {/* Radar polygon */}
        <polygon
          points={polygonPoints}
          fill="url(#compass-fill)"
          stroke="rgba(253,224,71,0.7)"
          strokeWidth="1.3"
          style={{
            transition: reduced ? "none" : "all 700ms cubic-bezier(0.22,0.61,0.36,1)",
          }}
        />
        {/* Nodes */}
        {outerAxes.map((axis, i) => {
          const r = animR(values[axis].score);
          const p = pointFor(i, outerAxes.length, r, cx, cy);
          const isActive = active === axis;
          return (
            <g
              key={`node-${axis}`}
              style={{ cursor: "pointer" }}
              onClick={() => setActive(axis)}
              role="button"
              aria-label={`${labels[axis]} ${values[axis].score}`}
              aria-pressed={isActive}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={isActive ? 8 : 5}
                fill={BAND_STROKE[values[axis].band] ?? "#fcd34d"}
                stroke="#0a0a12"
                strokeWidth="1.5"
                style={{
                  transition: reduced ? "none" : "all 500ms ease-out",
                  filter: isActive ? "drop-shadow(0 0 6px currentColor)" : undefined,
                }}
              />
              {isActive && (
                <text
                  x={p.x}
                  y={p.y - 14}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#fde68a"
                >
                  {values[axis].score}
                </text>
              )}
            </g>
          );
        })}
        {/* Centre — overall */}
        <g
          onClick={() => setActive("overall")}
          style={{ cursor: "pointer" }}
          role="button"
          aria-label={`${labels.overall} ${values.overall.score}`}
          aria-pressed={active === "overall"}
        >
          <circle
            cx={cx}
            cy={cy}
            r={active === "overall" ? 30 : 26}
            fill="rgba(10,10,18,0.85)"
            stroke={BAND_STROKE[values.overall.band] ?? "#fcd34d"}
            strokeWidth="1.6"
            style={{
              transition: reduced ? "none" : "all 500ms ease-out",
              filter:
                active === "overall"
                  ? "drop-shadow(0 0 10px rgba(253,224,71,0.6))"
                  : undefined,
            }}
          />
          <text
            x={cx}
            y={cy - 3}
            textAnchor="middle"
            fontSize="18"
            fontFamily="serif"
            fill="#fde68a"
          >
            {values.overall.score}
          </text>
          <text
            x={cx}
            y={cy + 12}
            textAnchor="middle"
            fontSize="8"
            fill="rgba(253,230,138,0.75)"
            style={{ letterSpacing: "0.12em" }}
          >
            {advice}
          </text>
        </g>
      </svg>
      <div
        aria-live="polite"
        className="mt-3 text-center text-xs text-amber-100/80"
      >
        <span className="text-amber-300/70">{labels[active]} · </span>
        <span className="text-amber-100">
          {values[active].score} · {bandLabels[values[active].band] ?? values[active].band}
        </span>
        {values[active].confidence && (
          <span className="ml-2 text-amber-300/60">
            {bandLabels[values[active].confidence!] ?? values[active].confidence}
          </span>
        )}
      </div>
      <p className="mt-1 text-center text-[11px] text-amber-200/50">{centreCaption}</p>
    </div>
  );
}
