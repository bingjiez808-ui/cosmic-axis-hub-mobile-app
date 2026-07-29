/**
 * HomeCardVisual — tiny inline SVG "vignette" per card. Each visual is
 * self-contained, does its own subtle animation via CSS variables, and
 * respects prefers-reduced-motion (animation disabled globally by the
 * root document class if needed). Kept intentionally lightweight; the
 * page-wide interior video already carries the atmosphere.
 */
import type { HomeCardVisual } from "@/lib/home-guide-cards";

export function HomeCardVisual({ kind }: { kind: HomeCardVisual }) {
  switch (kind) {
    case "concern":
      return <ConcernVisual />;
    case "chart":
      return <ChartVisual />;
    case "report":
      return <ReportVisual />;
    case "timeline":
      return <TimelineVisual />;
    case "tarot":
      return <TarotVisual />;
    case "commons":
      return <CommonsVisual />;
    case "rooms":
      return <RoomsVisual />;
  }
}

const GOLD = "rgba(220,180,90,0.85)";
const GOLD_SOFT = "rgba(220,180,90,0.35)";

function ConcernVisual() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <defs>
        <radialGradient id="cg1" cx="50%" cy="50%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.9" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="70" fill="url(#cg1)" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle
          key={a}
          cx={100 + 55 * Math.cos((a * Math.PI) / 180)}
          cy={100 + 55 * Math.sin((a * Math.PI) / 180)}
          r="5"
          fill={GOLD}
        />
      ))}
      <circle cx="100" cy="100" r="70" fill="none" stroke={GOLD_SOFT} />
    </svg>
  );
}

function ChartVisual() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <circle cx="100" cy="100" r="80" fill="none" stroke={GOLD_SOFT} />
      <circle cx="100" cy="100" r="55" fill="none" stroke={GOLD_SOFT} />
      {[...Array(12)].map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={100 + 55 * Math.cos(a)}
            y1={100 + 55 * Math.sin(a)}
            x2={100 + 80 * Math.cos(a)}
            y2={100 + 80 * Math.sin(a)}
            stroke={GOLD}
            strokeWidth="0.8"
          />
        );
      })}
      <circle cx="100" cy="100" r="6" fill={GOLD} />
    </svg>
  );
}

function ReportVisual() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <rect x="55" y="40" width="90" height="120" rx="4" fill="rgba(20,15,25,0.6)" stroke={GOLD_SOFT} />
      {[60, 75, 90, 105, 120, 135, 150].map((y) => (
        <line key={y} x1="65" y1={y} x2="135" y2={y} stroke={GOLD_SOFT} strokeWidth="0.8" />
      ))}
      <circle cx="100" cy="100" r="18" fill="none" stroke={GOLD} strokeWidth="1.2" />
      <circle cx="100" cy="100" r="3" fill={GOLD} />
    </svg>
  );
}

function TimelineVisual() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      <line x1="20" y1="100" x2="180" y2="100" stroke={GOLD_SOFT} />
      {[35, 65, 100, 135, 170].map((x, i) => (
        <g key={x}>
          <circle cx={x} cy="100" r={i === 2 ? 6 : 4} fill={GOLD} opacity={i === 2 ? 1 : 0.7} />
          <line x1={x} y1="100" x2={x} y2={100 - (10 + i * 6)} stroke={GOLD_SOFT} />
        </g>
      ))}
    </svg>
  );
}

function TarotVisual() {
  return (
    <svg viewBox="0 0 200 200" className="h-full w-full">
      {[-24, 0, 24].map((r, i) => (
        <g key={r} transform={`translate(100 105) rotate(${r})`}>
          <rect
            x={-24}
            y={-40}
            width="48"
            height="80"
            rx="4"
            fill="rgba(20,15,25,0.85)"
            stroke={GOLD_SOFT}
            opacity={i === 1 ? 1 : 0.85}
          />
          {i === 1 && (
            <>
              <circle cx="0" cy="-10" r="6" fill="none" stroke={GOLD} />
              <path d="M-10 15 L0 5 L10 15" fill="none" stroke={GOLD} />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

function CommonsVisual() {
  const cells = [
    { x: 20, y: 20, label: "数" },
    { x: 80, y: 20, label: "语" },
    { x: 140, y: 20, label: "地" },
    { x: 20, y: 80, label: "物" },
    { x: 80, y: 80, label: "经" },
    { x: 140, y: 80, label: "生" },
  ];
  return (
    <svg viewBox="0 0 200 140" className="h-full w-full">
      {cells.map((c, i) => (
        <g key={c.label}>
          <rect
            x={c.x}
            y={c.y}
            width="40"
            height="40"
            rx="4"
            fill="rgba(20,15,25,0.75)"
            stroke={i < 2 ? GOLD : GOLD_SOFT}
          />
          <text
            x={c.x + 20}
            y={c.y + 26}
            textAnchor="middle"
            fill={i < 2 ? GOLD : "rgba(220,200,160,0.5)"}
            fontSize="16"
            fontFamily="serif"
          >
            {c.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function RoomsVisual() {
  return (
    <svg viewBox="0 0 200 140" className="h-full w-full">
      {[
        { x: 30, label: "Sage" },
        { x: 110, label: "Oracle" },
      ].map((d) => (
        <g key={d.label}>
          <path
            d={`M${d.x} 120 L${d.x} 40 Q${d.x + 30} 15 ${d.x + 60} 40 L${d.x + 60} 120 Z`}
            fill="rgba(15,10,20,0.85)"
            stroke={GOLD_SOFT}
          />
          <circle cx={d.x + 30} cy={80} r="3" fill={GOLD} />
          <text
            x={d.x + 30}
            y={135}
            textAnchor="middle"
            fill="rgba(220,200,160,0.7)"
            fontSize="10"
            letterSpacing="2"
          >
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
