/**
 * HomeCardVisual — the small vignette on the right side of every guide card.
 *
 * Each visual is a self-contained inline SVG with an idle "living" loop
 * (slow orbits, breathing halo, sequential highlights) that amplifies on
 * hover / focus / touch, plus a light pointer parallax on the whole group.
 * All motion is declared in home-card-visual.css so `data-motion="stable"`
 * (reduced-motion users and low-end devices) can switch it off wholesale.
 */
import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { HomeCardVisual as HomeCardVisualKind } from "@/lib/home-guide-cards";
import { useStableMotion } from "@/lib/motion-preference";
import "./home-card-visual.css";

const GOLD = "rgba(220,180,90,0.9)";
const GOLD_SOFT = "rgba(220,180,90,0.35)";

export function HomeCardVisual({ kind }: { kind: HomeCardVisualKind }) {
  const { stable } = useStableMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const node = rootRef.current;
      if (!node || stable) return;
      const rect = node.getBoundingClientRect();
      const dx = (event.clientX - rect.left) / rect.width - 0.5;
      const dy = (event.clientY - rect.top) / rect.height - 0.5;
      node.style.setProperty("--hcv-px", `${(dx * 12).toFixed(2)}px`);
      node.style.setProperty("--hcv-py", `${(dy * 12).toFixed(2)}px`);
    },
    [stable],
  );

  const reset = useCallback(() => {
    const node = rootRef.current;
    setActive(false);
    if (!node) return;
    node.style.setProperty("--hcv-px", "0px");
    node.style.setProperty("--hcv-py", "0px");
    node.style.setProperty("--hcv-scale", "1");
  }, []);

  const engage = useCallback(() => {
    setActive(true);
    rootRef.current?.style.setProperty("--hcv-scale", stable ? "1" : "1.04");
  }, [stable]);

  return (
    <div
      ref={rootRef}
      className="hcv"
      data-active={active ? "true" : "false"}
      data-motion={stable ? "stable" : "live"}
      tabIndex={0}
      role="img"
      aria-label={ariaLabel(kind)}
      onPointerEnter={engage}
      onPointerMove={onPointerMove}
      onPointerLeave={reset}
      onPointerDown={engage}
      onFocus={engage}
      onBlur={reset}
    >
      <span aria-hidden className="hcv-halo" />
      {renderVisual(kind)}
    </div>
  );
}

function ariaLabel(kind: HomeCardVisualKind) {
  switch (kind) {
    case "concern":
      return "Question orbit";
    case "chart":
      return "Astrolabe dial";
    case "report":
      return "Reading panorama";
    case "timeline":
      return "Life timeline";
    case "tarot":
      return "Tarot spread";
    case "commons":
      return "Six halls grid";
    case "rooms":
      return "Reading rooms";
  }
}

function renderVisual(kind: HomeCardVisualKind): ReactNode {
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

function ConcernVisual() {
  const motes = [0, 60, 120, 180, 240, 300];
  return (
    <svg viewBox="0 0 200 200">
      <defs>
        <radialGradient id="hcv-concern" cx="50%" cy="50%">
          <stop offset="0%" stopColor={GOLD} stopOpacity="0.9" />
          <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="62" fill="url(#hcv-concern)" className="hcv-float" />
      <circle cx="100" cy="100" r="78" fill="none" stroke={GOLD_SOFT} className="hcv-dash" />
      <g className="hcv-spin">
        {motes.map((a, i) => (
          <circle
            key={a}
            className="hcv-mote"
            cx={100 + 55 * Math.cos((a * Math.PI) / 180)}
            cy={100 + 55 * Math.sin((a * Math.PI) / 180)}
            r={i % 2 ? 3.5 : 5}
            fill={GOLD}
            opacity={0.7}
          />
        ))}
      </g>
      <g className="hcv-spin-rev">
        <circle cx="100" cy="62" r="2.5" fill={GOLD} />
        <circle cx="138" cy="128" r="2.5" fill={GOLD} />
        <circle cx="62" cy="128" r="2.5" fill={GOLD} />
      </g>
      <text
        x="100"
        y="108"
        textAnchor="middle"
        fill={GOLD}
        fontSize="30"
        fontFamily="serif"
        className="hcv-twinkle"
      >
        ?
      </text>
    </svg>
  );
}

function ChartVisual() {
  return (
    <svg viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="82" fill="none" stroke={GOLD_SOFT} className="hcv-dash" />
      <g className="hcv-spin">
        <circle cx="100" cy="100" r="62" fill="none" stroke={GOLD_SOFT} />
        {[...Array(12)].map((_, i) => {
          const a = (i * 30 * Math.PI) / 180;
          return (
            <line
              key={i}
              className="hcv-tick"
              style={{ animationDelay: `${i * 0.18}s` }}
              x1={100 + 62 * Math.cos(a)}
              y1={100 + 62 * Math.sin(a)}
              x2={100 + 82 * Math.cos(a)}
              y2={100 + 82 * Math.sin(a)}
              stroke={GOLD}
              strokeWidth="1.1"
            />
          );
        })}
      </g>
      <g className="hcv-spin-rev">
        <path d="M100 58 L124 118 L76 118 Z" fill="none" stroke={GOLD_SOFT} strokeWidth="1" />
        <path d="M100 142 L76 82 L124 82 Z" fill="none" stroke={GOLD_SOFT} strokeWidth="1" />
      </g>
      <circle cx="100" cy="100" r="7" fill={GOLD} className="hcv-twinkle" />
    </svg>
  );
}

function ReportVisual() {
  const lines = [62, 76, 90, 104, 118, 132, 146];
  return (
    <svg viewBox="0 0 200 200">
      <rect x="52" y="38" width="96" height="126" rx="5" fill="rgba(20,15,25,0.65)" stroke={GOLD_SOFT} />
      {lines.map((y, i) => (
        <line
          key={y}
          className="hcv-line"
          style={{ animationDelay: `${i * 0.26}s` }}
          x1="64"
          y1={y}
          x2="136"
          y2={y}
          stroke={GOLD_SOFT}
          strokeWidth="1.6"
        />
      ))}
      <g className="hcv-spin">
        <circle cx="100" cy="100" r="22" fill="none" stroke={GOLD} strokeWidth="1.2" strokeDasharray="6 8" />
      </g>
      <circle cx="100" cy="100" r="3.5" fill={GOLD} className="hcv-twinkle" />
      <rect className="hcv-sweep" x="52" y="94" width="96" height="12" fill="url(#hcv-sweep-grad)" />
      <defs>
        <linearGradient id="hcv-sweep-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(220,180,90,0)" />
          <stop offset="50%" stopColor="rgba(220,180,90,0.5)" />
          <stop offset="100%" stopColor="rgba(220,180,90,0)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function TimelineVisual() {
  const marks = [35, 65, 100, 135, 170];
  return (
    <svg viewBox="0 0 200 200">
      <line x1="18" y1="110" x2="182" y2="110" stroke={GOLD_SOFT} className="hcv-dash" />
      {marks.map((x, i) => (
        <g key={x}>
          <line x1={x} y1="110" x2={x} y2={110 - (14 + i * 8)} stroke={GOLD_SOFT} />
          <circle
            cx={x}
            cy={110 - (14 + i * 8)}
            r={i === 2 ? 5 : 3.5}
            fill={GOLD}
            className="hcv-twinkle"
            style={{ animationDelay: `${i * 0.35}s` }}
          />
          <circle cx={x} cy="110" r="2.5" fill={GOLD} opacity="0.7" />
        </g>
      ))}
      <g className="hcv-head">
        <line x1="100" y1="62" x2="100" y2="132" stroke={GOLD} strokeWidth="1" opacity="0.6" />
        <circle cx="100" cy="110" r="7" fill="none" stroke={GOLD} strokeWidth="1.4" />
        <circle cx="100" cy="110" r="2.5" fill={GOLD} />
      </g>
    </svg>
  );
}

function TarotVisual() {
  return (
    <svg viewBox="0 0 200 200">
      {[-14, 0, 14].map((r, i) => (
        <g key={r} className="hcv-card" data-i={i} transform={`translate(100 105) rotate(${r})`}>
          <rect
            x={-26}
            y={-42}
            width="52"
            height="84"
            rx="5"
            fill="rgba(20,15,25,0.9)"
            stroke={i === 1 ? GOLD : GOLD_SOFT}
          />
          {i === 1 ? (
            <>
              <circle cx="0" cy="-12" r="7" fill="none" stroke={GOLD} className="hcv-twinkle" />
              <path d="M-12 18 L0 6 L12 18" fill="none" stroke={GOLD} />
              <line x1="-14" y1="30" x2="14" y2="30" stroke={GOLD_SOFT} />
            </>
          ) : (
            <>
              <line x1="-14" y1="-6" x2="14" y2="-6" stroke={GOLD_SOFT} strokeWidth="0.8" />
              <line x1="-14" y1="6" x2="14" y2="6" stroke={GOLD_SOFT} strokeWidth="0.8" />
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

function CommonsVisual() {
  const cells = [
    { x: 18, y: 16, label: "数" },
    { x: 80, y: 16, label: "语" },
    { x: 142, y: 16, label: "地" },
    { x: 18, y: 78, label: "物" },
    { x: 80, y: 78, label: "经" },
    { x: 142, y: 78, label: "生" },
  ];
  return (
    <svg viewBox="0 0 200 140">
      {cells.map((c, i) => (
        <g key={c.label} className="hcv-cell" style={{ animationDelay: `${i * 0.32}s` }}>
          <rect
            x={c.x}
            y={c.y}
            width="42"
            height="42"
            rx="5"
            fill="rgba(20,15,25,0.75)"
            stroke={GOLD_SOFT}
          />
          <text
            x={c.x + 21}
            y={c.y + 28}
            textAnchor="middle"
            fill={GOLD}
            fontSize="17"
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
    <svg viewBox="0 0 200 140">
      {[
        { x: 24, label: "Sage" },
        { x: 108, label: "Oracle" },
      ].map((d, i) => (
        <g key={d.label}>
          <path
            d={`M${d.x} 118 L${d.x} 38 Q${d.x + 34} 12 ${d.x + 68} 38 L${d.x + 68} 118 Z`}
            fill="rgba(255,220,150,0.08)"
            stroke={GOLD_SOFT}
          />
          <g className="hcv-door">
            <path
              d={`M${d.x + 6} 116 L${d.x + 6} 42 Q${d.x + 34} 20 ${d.x + 62} 42 L${d.x + 62} 116 Z`}
              fill="rgba(15,10,20,0.92)"
              stroke={GOLD_SOFT}
            />
            <circle cx={d.x + 52} cy={80} r="3" fill={GOLD} />
          </g>
          <circle
            cx={d.x + 34}
            cy={30}
            r="3.5"
            fill={GOLD}
            className="hcv-lamp"
            style={{ animationDelay: `${i * 0.6}s` }}
          />
          <text
            x={d.x + 34}
            y={134}
            textAnchor="middle"
            fill="rgba(220,200,160,0.75)"
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
