/**
 * SevenDayOrbit — 7-day deterministic trend line.
 *
 * Given a natal chart's tropical planet longitudes (or a fixture that
 * already produced daily facts for today), we recompute today+6 days
 * of `computeDailyFacts` + `computeDailyDomainScore` for a chosen
 * dimension and render an SVG polyline with today anchored.
 *
 * Values are calculator-derived; nothing is faked or randomised.
 */
import { useMemo } from "react";

import { computeDailyFacts } from "@/lib/daily-facts";
import type { WesternPlanet } from "@/lib/western-natal";
import {
  computeDailyDomainScore,
  type DailyDomainScore,
  type DomainKey,
} from "@/lib/daily-domain-score";

export type OrbitDimension = "overall" | DomainKey;

type Props = {
  natal: WesternPlanet[] | null;
  natalHasTime: boolean;
  todayLocalDate: string; // YYYY-MM-DD
  timezone: string;
  dimension: OrbitDimension;
  dimensionLabel: string;
  todayLabel: string;
  emptyLabel: string;
};

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  const yy = t.getUTCFullYear();
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function scoreFor(score: DailyDomainScore, dim: OrbitDimension): number {
  if (dim === "overall") return score.overall.score;
  const found = score.domains.find((d) => d.domain === dim);
  return found ? found.score : 50;
}

export function SevenDayOrbit({
  natal,
  natalHasTime,
  todayLocalDate,
  timezone,
  dimension,
  dimensionLabel,
  todayLabel,
  emptyLabel,
}: Props) {
  const series = useMemo(() => {
    if (!natal) return null;
    const out: { date: string; score: number; band: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(todayLocalDate, i);
      const facts = computeDailyFacts({ natal, localDate: date, timezone });
      const s = computeDailyDomainScore({ facts, natalHasTime });
      const score = scoreFor(s, dimension);
      const band =
        dimension === "overall"
          ? s.overall.band
          : (s.domains.find((d) => d.domain === dimension)?.band ?? "neutral");
      out.push({ date, score, band });
    }
    return out;
  }, [natal, natalHasTime, todayLocalDate, timezone, dimension]);

  if (!series) {
    return (
      <div className="rounded-lg border border-amber-400/15 bg-black/20 px-3 py-6 text-center text-xs text-amber-200/60">
        {emptyLabel}
      </div>
    );
  }

  const W = 640;
  const H = 160;
  const padL = 32;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i: number) => padL + (i / 6) * innerW;
  const y = (s: number) => padT + (1 - Math.max(0, Math.min(100, s)) / 100) * innerH;

  const pathD = series
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`)
    .join(" ");
  const areaD =
    pathD +
    ` L ${x(6).toFixed(1)} ${(padT + innerH).toFixed(1)}` +
    ` L ${x(0).toFixed(1)} ${(padT + innerH).toFixed(1)} Z`;

  const dayLabels = series.map((p) => p.date.slice(5)); // MM-DD

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={dimensionLabel}>
        <defs>
          <linearGradient id="orbit-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid: 25/50/75 */}
        {[25, 50, 75].map((v) => (
          <line
            key={v}
            x1={padL}
            x2={W - padR}
            y1={y(v)}
            y2={y(v)}
            stroke={v === 50 ? "rgba(251,191,36,0.25)" : "rgba(251,191,36,0.08)"}
            strokeDasharray={v === 50 ? "3 4" : undefined}
          />
        ))}
        <path d={areaD} fill="url(#orbit-fill)" />
        <path d={pathD} fill="none" stroke="#fde68a" strokeWidth="1.6" />
        {series.map((p, i) => {
          const isToday = i === 0;
          return (
            <g key={i}>
              <circle
                cx={x(i)}
                cy={y(p.score)}
                r={isToday ? 6 : 4}
                fill={isToday ? "#fbbf24" : "#f5f5f4"}
                stroke="#0a0a12"
                strokeWidth="1.2"
                style={isToday ? { filter: "drop-shadow(0 0 6px #fbbf24)" } : undefined}
              />
              {isToday && (
                <text
                  x={x(i)}
                  y={y(p.score) - 12}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#fde68a"
                >
                  {todayLabel} · {p.score}
                </text>
              )}
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize="10"
                fill="rgba(254,243,199,0.65)"
              >
                {dayLabels[i]}
              </text>
            </g>
          );
        })}
        {/* Y axis labels */}
        {[0, 50, 100].map((v) => (
          <text
            key={v}
            x={padL - 6}
            y={y(v)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize="9"
            fill="rgba(254,243,199,0.5)"
          >
            {v}
          </text>
        ))}
      </svg>
    </div>
  );
}
