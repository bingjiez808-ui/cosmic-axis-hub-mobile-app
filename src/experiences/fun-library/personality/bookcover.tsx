/**
 * Fun Library · parametric SVG book cover.
 *
 * Uses the 4 axis normalized scores to modulate texture density,
 * spine tint, sigil shape, halo strength and border ornament.
 * Purely presentational — no data derives from it.
 */
import type { PersonalityResult } from "./types";

export function BookCover({
  result,
  size = 260,
  title,
}: {
  result: PersonalityResult;
  size?: number;
  title: string;
}) {
  const { axes, code } = result;
  const w = size;
  const h = Math.round(size * 1.4);
  const gold = "#c8a45c";
  const goldSoft = "#8b6d3a";
  const ink = "#0c0a12";

  // Axis-driven variables
  const grain = Math.round(axes.ML.normalized / 8) + 6; // vertical grain lines
  const spineHue = axes.ET.normalized; // 0..100 tilts spine tone
  const sigil = axes.AC.normalized > 50 ? "circle" : "square";
  const haloOpacity = 0.15 + (axes.FO.normalized / 100) * 0.35;

  const grainLines = Array.from({ length: grain }).map((_, i) => {
    const x = (i + 1) * (w / (grain + 1));
    return (
      <line
        key={i}
        x1={x}
        y1={20}
        x2={x}
        y2={h - 24}
        stroke={goldSoft}
        strokeOpacity={0.18 + (i % 3) * 0.05}
        strokeWidth={0.6}
      />
    );
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      role="img"
      aria-label={title}
      className="drop-shadow-[0_18px_36px_rgba(0,0,0,0.55)]"
    >
      <defs>
        <linearGradient id={`cover-${code}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={ink} />
          <stop offset="100%" stopColor="#181322" />
        </linearGradient>
        <radialGradient id={`halo-${code}`} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor={gold} stopOpacity={haloOpacity} />
          <stop offset="100%" stopColor={gold} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} rx={10} fill={`url(#cover-${code})`} />
      {/* Halo */}
      <rect x={0} y={0} width={w} height={h} rx={10} fill={`url(#halo-${code})`} />
      {/* Spine */}
      <rect
        x={w - 14}
        y={0}
        width={14}
        height={h}
        fill={`hsl(${34 + spineHue * 0.4}, 42%, 34%)`}
        opacity={0.72}
      />
      {/* Grain */}
      {grainLines}
      {/* Border ornament */}
      <rect
        x={12}
        y={12}
        width={w - 24}
        height={h - 24}
        fill="none"
        stroke={gold}
        strokeOpacity={0.55}
        strokeWidth={1}
      />
      <rect
        x={18}
        y={18}
        width={w - 36}
        height={h - 36}
        fill="none"
        stroke={gold}
        strokeOpacity={0.22}
        strokeWidth={0.6}
      />
      {/* Sigil */}
      {sigil === "circle" ? (
        <circle cx={w / 2} cy={h / 2 - 10} r={26} fill="none" stroke={gold} strokeWidth={1.4} />
      ) : (
        <rect
          x={w / 2 - 26}
          y={h / 2 - 36}
          width={52}
          height={52}
          fill="none"
          stroke={gold}
          strokeWidth={1.4}
        />
      )}
      <text
        x={w / 2}
        y={h / 2 - 8}
        textAnchor="middle"
        fontFamily="serif"
        fontSize={22}
        fill={gold}
        letterSpacing={4}
      >
        {code}
      </text>
      <text
        x={w / 2}
        y={h - 32}
        textAnchor="middle"
        fontFamily="serif"
        fontSize={11}
        fill={gold}
        opacity={0.7}
      >
        FUN LIBRARY · Nº {(parseInt(code, 36) % 900) + 100}
      </text>
    </svg>
  );
}
