import { motion } from "framer-motion";
import { useState } from "react";

/* ─────────────────────────────────────────────────────────────
 * ZodiacWheel — interactive 12-sign wheel with rotating rings.
 * Hovering a sign highlights it and reveals its glyph/name.
 * ────────────────────────────────────────────────────────── */

const ZODIAC = [
  { g: "♈", en: "Aries", zh: "白羊" },
  { g: "♉", en: "Taurus", zh: "金牛" },
  { g: "♊", en: "Gemini", zh: "双子" },
  { g: "♋", en: "Cancer", zh: "巨蟹" },
  { g: "♌", en: "Leo", zh: "狮子" },
  { g: "♍", en: "Virgo", zh: "处女" },
  { g: "♎", en: "Libra", zh: "天秤" },
  { g: "♏", en: "Scorpio", zh: "天蝎" },
  { g: "♐", en: "Sagittarius", zh: "射手" },
  { g: "♑", en: "Capricorn", zh: "摩羯" },
  { g: "♒", en: "Aquarius", zh: "水瓶" },
  { g: "♓", en: "Pisces", zh: "双鱼" },
];

export function ZodiacWheel({
  lang = "en",
  highlighted,
  size = 360,
}: {
  lang?: "en" | "zh";
  highlighted?: number;
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? highlighted ?? -1;
  const r1 = size / 2 - 4;
  const r2 = size / 2 - 42;
  const r3 = size / 2 - 78;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* rotating outer scaffold */}
      <div className="absolute inset-0 animate-slow-rotate">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
          <circle cx={cx} cy={cy} r={r1} fill="none" stroke="currentColor" strokeOpacity="0.08" />
          {Array.from({ length: 72 }).map((_, i) => {
            const a = (i * 5 * Math.PI) / 180;
            const long = i % 6 === 0;
            const x1 = cx + Math.cos(a) * (r1 - (long ? 12 : 5));
            const y1 = cy + Math.sin(a) * (r1 - (long ? 12 : 5));
            const x2 = cx + Math.cos(a) * r1;
            const y2 = cy + Math.sin(a) * r1;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeOpacity={long ? 0.5 : 0.2}
                strokeWidth={long ? 1 : 0.5}
              />
            );
          })}
        </svg>
      </div>

      {/* zodiac ring — counter-rotating */}
      <div className="absolute inset-0 animate-slow-rotate-reverse">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
          <circle
            cx={cx}
            cy={cy}
            r={r2}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.14"
          />
          {ZODIAC.map((_, i) => {
            const a = ((i * 30 - 90) * Math.PI) / 180;
            const x = cx + Math.cos(a) * r2;
            const y = cy + Math.sin(a) * r2;
            const x0 = cx + Math.cos(a - Math.PI / 12) * r2;
            const y0 = cy + Math.sin(a - Math.PI / 12) * r2;
            return (
              <line
                key={i}
                x1={cx}
                y1={cy}
                x2={x0}
                y2={y0}
                stroke="currentColor"
                strokeOpacity="0.08"
              />
            );
          })}
          {ZODIAC.map((z, i) => {
            const a = ((i * 30 + 15 - 90) * Math.PI) / 180;
            const x = cx + Math.cos(a) * r2;
            const y = cy + Math.sin(a) * r2;
            const isActive = i === active;
            return (
              <g
                key={z.en}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <circle cx={x} cy={y} r={16} fill="transparent" />
                <text
                  x={x}
                  y={y + 8}
                  textAnchor="middle"
                  fontSize="22"
                  fill={isActive ? "var(--gold-light)" : "var(--gold-dust)"}
                  opacity={isActive ? 1 : 0.7}
                  style={{ transition: "all 0.3s ease" }}
                >
                  {z.g}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* inner glowing core */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <svg width={r3 * 2} height={r3 * 2} viewBox={`0 0 ${r3 * 2} ${r3 * 2}`}>
          <defs>
            <radialGradient id="core">
              <stop offset="0%" stopColor="var(--gold-dust)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--gold-dust)" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx={r3} cy={r3} r={r3} fill="url(#core)" />
          <circle
            cx={r3}
            cy={r3}
            r={r3 - 6}
            fill="none"
            stroke="var(--gold-dust)"
            strokeOpacity="0.25"
          />
        </svg>
      </div>

      {/* center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {active >= 0 ? (
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-[10px] uppercase tracking-[0.4em] text-gold-dust/70">
              {lang === "zh" ? "星座" : "Sign"}
            </p>
            <p className="mt-2 font-serif text-3xl italic text-stone-warm">
              {lang === "zh" ? ZODIAC[active].zh : ZODIAC[active].en}
            </p>
            <p className="mt-1 text-4xl text-gold-light">{ZODIAC[active].g}</p>
          </motion.div>
        ) : (
          <div>
            <p className="text-[10px] uppercase tracking-[0.4em] text-gold-dust/70">
              {lang === "zh" ? "悬停探索" : "Hover a sign"}
            </p>
            <p className="mt-3 font-serif text-2xl italic text-stone-warm/60">
              {lang === "zh" ? "十二宫图" : "The Wheel"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
 * StrengthRadar — one small polar chart per dimension showing
 * how strongly each of the four traditions supports the reading.
 * Values 0..1.
 * ────────────────────────────────────────────────────────── */

export function StrengthRadar({
  values,
  labels,
  size = 200,
}: {
  values: [number, number, number, number];
  labels: readonly [string, string, string, string];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 30;
  const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  const pts = values.map((v, i) => {
    const a = angles[i];
    return [cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v] as const;
  });
  const poly = pts.map((p) => p.join(",")).join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {/* rings */}
      {[0.33, 0.66, 1].map((k) => (
        <circle
          key={k}
          cx={cx}
          cy={cy}
          r={r * k}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.08}
        />
      ))}
      {/* axes */}
      {angles.map((a, i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={cx + Math.cos(a) * r}
          y2={cy + Math.sin(a) * r}
          stroke="currentColor"
          strokeOpacity={0.1}
        />
      ))}
      {/* filled polygon */}
      <motion.polygon
        initial={{ opacity: 0, scale: 0.6 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
        points={poly}
        fill="var(--gold-dust)"
        fillOpacity={0.18}
        stroke="var(--gold-dust)"
        strokeWidth={1.2}
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.2} fill="var(--gold-light)" />
      ))}
      {/* labels */}
      {angles.map((a, i) => {
        const lx = cx + Math.cos(a) * (r + 16);
        const ly = cy + Math.sin(a) * (r + 16);
        return (
          <text
            key={i}
            x={lx}
            y={ly + 3}
            textAnchor="middle"
            fontSize="9"
            fill="var(--stone-warm)"
            opacity={0.55}
            style={{ letterSpacing: "0.15em", textTransform: "uppercase" }}
          >
            {labels[i]}
          </text>
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
 * FiveElements — interactive Wu Xing pentagon.
 * ────────────────────────────────────────────────────────── */

const ELEMENTS = [
  { en: "Wood", zh: "木", color: "#8fbf7f" },
  { en: "Fire", zh: "火", color: "#e07a5f" },
  { en: "Earth", zh: "土", color: "#d4a373" },
  { en: "Metal", zh: "金", color: "#e6c88a" },
  { en: "Water", zh: "水", color: "#7fa9c9" },
];

export function FiveElements({
  strengths,
  lang = "en",
  size = 260,
}: {
  strengths: [number, number, number, number, number];
  lang?: "en" | "zh";
  size?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 40;
  const pts = ELEMENTS.map((_, i) => {
    const a = (i * 72 - 90) * (Math.PI / 180);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {/* generating cycle: pentagon perimeter */}
      <polygon
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.15}
      />
      {/* controlling cycle: inner star */}
      <polygon
        points={[pts[0], pts[2], pts[4], pts[1], pts[3]].map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="var(--gold-dust)"
        strokeOpacity={0.25}
        strokeDasharray="2 4"
      />
      {ELEMENTS.map((el, i) => {
        const [x, y] = pts[i];
        const s = strengths[i];
        const active = hover === i;
        return (
          <g
            key={el.en}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "pointer" }}
          >
            <motion.circle
              initial={{ r: 0 }}
              whileInView={{ r: 6 + s * 22 }}
              viewport={{ once: true }}
              transition={{ duration: 0.9, delay: i * 0.08 }}
              cx={x}
              cy={y}
              fill={el.color}
              fillOpacity={active ? 0.9 : 0.55}
              stroke={el.color}
              strokeOpacity={0.9}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              fontSize="14"
              fontFamily="var(--font-serif)"
              fill="var(--obsidian)"
              style={{ pointerEvents: "none" }}
            >
              {el.zh}
            </text>
            <text
              x={x}
              y={y + 40}
              textAnchor="middle"
              fontSize="9"
              fill="var(--stone-warm)"
              opacity={active ? 1 : 0.5}
              style={{ letterSpacing: "0.2em", textTransform: "uppercase" }}
            >
              {lang === "zh" ? el.zh : el.en}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
