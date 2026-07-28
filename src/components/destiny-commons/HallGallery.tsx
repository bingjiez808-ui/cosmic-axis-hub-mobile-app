/**
 * HallGallery — small looping SVG animation per hall.
 *
 * Overlays the hero image inside HallDetailModal. Each hall id maps to a
 * distinct visual metaphor: math=function curves, literature=orbital word
 * ribbon, geography=migration arcs on a globe grid, physics=standing wave,
 * economics=flowing candles, biology=double helix. All are pure inline SVG
 * with CSS keyframes — no libraries, no canvas, SSR-safe.
 *
 * Smooth cross-hall transition: we key the root on `hallId` so switching
 * halls fades the previous gallery out and fades the new one in via the
 * `animate-fade-in` utility already defined in tailwind config.
 */

import { useMemo } from "react";

import type { DestinyCommonsHall } from "@/lib/destiny-commons";

type Props = {
  hallId: DestinyCommonsHall["id"];
  /** Coming-soon halls render at reduced intensity. */
  dim?: boolean;
};

export function HallGallery({ hallId, dim = false }: Props) {
  const Gallery = useMemo(() => GALLERY_BY_ID[hallId] ?? MathGallery, [hallId]);
  return (
    <div
      key={hallId}
      aria-hidden
      className={`pointer-events-none absolute inset-0 animate-fade-in ${
        dim ? "opacity-35" : "opacity-70"
      }`}
      style={{ mixBlendMode: "screen" }}
    >
      <Gallery />
      <style>{SHARED_KEYFRAMES}</style>
    </div>
  );
}

const SHARED_KEYFRAMES = `
@keyframes hg-drift-x { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-6%); } }
@keyframes hg-dash    { to { stroke-dashoffset: -400; } }
@keyframes hg-dash-slow { to { stroke-dashoffset: -800; } }
@keyframes hg-orbit   { to { transform: rotate(360deg); } }
@keyframes hg-twinkle { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
@keyframes hg-wave    { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
@keyframes hg-helix-a { 0% { transform: translateX(0); } 100% { transform: translateX(-40px); } }
@keyframes hg-candle  { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.15); } }
`;

/* ------------------------------- Mathematics ------------------------------ */

function MathGallery() {
  // Two overlaid sine-ish curves drifting sideways — "life curve" bending.
  return (
    <svg viewBox="0 0 400 200" className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="mg-a" x1="0" x2="1">
          <stop offset="0%" stopColor="#B478FF" stopOpacity="0" />
          <stop offset="50%" stopColor="#B478FF" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#B478FF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="mg-b" x1="0" x2="1">
          <stop offset="0%" stopColor="#E0B65A" stopOpacity="0" />
          <stop offset="50%" stopColor="#E0B65A" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#E0B65A" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* faint grid */}
      <g stroke="rgba(255,255,255,0.06)" strokeWidth="0.5">
        {[40, 80, 120, 160].map((y) => (
          <line key={y} x1="0" x2="400" y1={y} y2={y} />
        ))}
      </g>
      <g style={{ animation: "hg-drift-x 14s ease-in-out infinite" }}>
        <path
          d="M-100 130 Q 0 40, 100 110 T 300 100 T 500 130 T 700 90"
          fill="none"
          stroke="url(#mg-a)"
          strokeWidth="1.6"
          strokeDasharray="6 6"
          style={{ animation: "hg-dash 12s linear infinite" }}
        />
        <path
          d="M-100 100 Q 0 160, 100 90 T 300 130 T 500 80 T 700 120"
          fill="none"
          stroke="url(#mg-b)"
          strokeWidth="1.4"
          strokeDasharray="3 8"
          style={{ animation: "hg-dash-slow 18s linear infinite" }}
        />
      </g>
    </svg>
  );
}

/* -------------------------------- Literature ------------------------------ */

function LiteratureGallery() {
  // Slowly rotating star ring with twinkles — "lines you read again later".
  return (
    <svg viewBox="0 0 400 200" className="h-full w-full" preserveAspectRatio="none">
      <g
        style={{
          transformOrigin: "200px 100px",
          animation: "hg-orbit 60s linear infinite",
        }}
      >
        <ellipse
          cx="200"
          cy="100"
          rx="150"
          ry="42"
          fill="none"
          stroke="rgba(224,182,90,0.35)"
          strokeWidth="0.6"
          strokeDasharray="2 6"
        />
        <ellipse
          cx="200"
          cy="100"
          rx="120"
          ry="30"
          fill="none"
          stroke="rgba(224,182,90,0.22)"
          strokeWidth="0.5"
          strokeDasharray="1 5"
        />
      </g>
      {STAR_POSITIONS.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={s.r}
          fill="#E0B65A"
          style={{
            animation: `hg-twinkle ${3 + (i % 5)}s ease-in-out ${i * 0.3}s infinite`,
          }}
        />
      ))}
    </svg>
  );
}

const STAR_POSITIONS = [
  { x: 60, y: 40, r: 1.2 }, { x: 120, y: 70, r: 0.8 }, { x: 180, y: 30, r: 1.5 },
  { x: 240, y: 60, r: 1 },  { x: 300, y: 45, r: 1.2 }, { x: 350, y: 80, r: 0.9 },
  { x: 80, y: 140, r: 1 },  { x: 160, y: 160, r: 1.4 }, { x: 240, y: 145, r: 0.9 },
  { x: 320, y: 165, r: 1.2 }, { x: 40, y: 100, r: 0.7 }, { x: 380, y: 110, r: 1 },
];

/* -------------------------------- Geography ------------------------------- */

function GeographyGallery() {
  // Longitude/latitude grid with a slow migration arc.
  return (
    <svg viewBox="0 0 400 200" className="h-full w-full" preserveAspectRatio="none">
      <g stroke="rgba(120,180,255,0.18)" strokeWidth="0.5" fill="none">
        {[40, 80, 120, 160].map((y) => (
          <path key={`lat-${y}`} d={`M0 ${y} Q 200 ${y - 10} 400 ${y}`} />
        ))}
        {[80, 160, 240, 320].map((x) => (
          <line key={`lon-${x}`} x1={x} x2={x} y1="0" y2="200" />
        ))}
      </g>
      <path
        d="M50 150 Q 200 20 360 130"
        fill="none"
        stroke="#7DB8FF"
        strokeWidth="1.6"
        strokeDasharray="4 6"
        style={{ animation: "hg-dash 8s linear infinite" }}
      />
      <circle cx="50" cy="150" r="3" fill="#7DB8FF" />
      <circle cx="360" cy="130" r="3" fill="#E0B65A" style={{ animation: "hg-twinkle 2.5s ease-in-out infinite" }} />
    </svg>
  );
}

/* --------------------------------- Physics -------------------------------- */

function PhysicsGallery() {
  // Standing wave with a subtle bob.
  return (
    <svg viewBox="0 0 400 200" className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pg-a" x1="0" x2="1">
          <stop offset="0%" stopColor="#5EE0C4" stopOpacity="0" />
          <stop offset="50%" stopColor="#5EE0C4" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#5EE0C4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g style={{ animation: "hg-wave 5s ease-in-out infinite" }}>
        {[70, 100, 130].map((y, i) => (
          <path
            key={y}
            d={`M0 ${y} Q 50 ${y - 20} 100 ${y} T 200 ${y} T 300 ${y} T 400 ${y}`}
            fill="none"
            stroke="url(#pg-a)"
            strokeWidth={1.4 - i * 0.3}
            opacity={0.9 - i * 0.25}
            strokeDasharray="8 4"
            style={{ animation: `hg-dash ${9 + i * 2}s linear infinite` }}
          />
        ))}
      </g>
    </svg>
  );
}

/* -------------------------------- Economics ------------------------------- */

function EconomicsGallery() {
  // Candlestick-like bars pulsing to hint volatility & flow.
  const bars = Array.from({ length: 18 }, (_, i) => {
    const h = 30 + ((i * 37) % 70);
    const y = 100 - h / 2;
    const up = i % 3 !== 0;
    return { x: 20 + i * 20, y, h, up };
  });
  return (
    <svg viewBox="0 0 400 200" className="h-full w-full" preserveAspectRatio="none">
      <line x1="0" x2="400" y1="100" y2="100" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
      {bars.map((b, i) => (
        <g
          key={i}
          style={{
            transformOrigin: `${b.x + 3}px 100px`,
            animation: `hg-candle ${4 + (i % 4)}s ease-in-out ${i * 0.15}s infinite`,
          }}
        >
          <line x1={b.x + 3} x2={b.x + 3} y1={b.y - 8} y2={b.y + b.h + 8} stroke={b.up ? "#7DE5A8" : "#E58080"} strokeWidth="0.6" opacity="0.6" />
          <rect x={b.x} y={b.y} width="6" height={b.h} fill={b.up ? "#7DE5A8" : "#E58080"} opacity="0.75" rx="1" />
        </g>
      ))}
    </svg>
  );
}

/* --------------------------------- Biology -------------------------------- */

function BiologyGallery() {
  // Double helix scrolling horizontally.
  const strandA: string[] = [];
  const strandB: string[] = [];
  const rungs: { x: number; y1: number; y2: number }[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = i * 12;
    const yA = 100 + Math.sin(i * 0.5) * 40;
    const yB = 100 + Math.sin(i * 0.5 + Math.PI) * 40;
    strandA.push(`${i === 0 ? "M" : "L"}${x} ${yA}`);
    strandB.push(`${i === 0 ? "M" : "L"}${x} ${yB}`);
    if (i % 2 === 0) rungs.push({ x, y1: yA, y2: yB });
  }
  return (
    <svg viewBox="0 0 400 200" className="h-full w-full" preserveAspectRatio="none">
      <g style={{ animation: "hg-helix-a 12s linear infinite" }}>
        <path d={strandA.join(" ")} fill="none" stroke="#B478FF" strokeWidth="1.4" opacity="0.85" />
        <path d={strandB.join(" ")} fill="none" stroke="#E0B65A" strokeWidth="1.4" opacity="0.85" />
        {rungs.map((r, i) => {
          const near = Math.abs(r.y1 - r.y2) < 20;
          return (
            <line
              key={i}
              x1={r.x}
              x2={r.x}
              y1={r.y1}
              y2={r.y2}
              stroke="rgba(255,255,255,0.28)"
              strokeWidth={near ? 0.4 : 0.9}
              opacity={near ? 0.35 : 0.7}
            />
          );
        })}
      </g>
    </svg>
  );
}

/* ---------------------------------- Map ----------------------------------- */

const GALLERY_BY_ID: Record<DestinyCommonsHall["id"], () => React.ReactElement> = {
  mathematics: MathGallery,
  literature: LiteratureGallery,
  geography: GeographyGallery,
  physics: PhysicsGallery,
  economics: EconomicsGallery,
  biology: BiologyGallery,
};

