import { motion } from "framer-motion";
import { useState, type ReactElement } from "react";


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

/* ─────────────────────────────────────────────────────────────
 * NatalWheel — user's personal zodiac wheel.
 * Each planet is placed in the sign it "falls in", derived
 * deterministically from birth date/time/place so the same
 * user always sees the same chart. Hovering a planet reveals
 * which sign it sits in and a short interpretation; hovering
 * a sign highlights the sign and the planets it holds.
 * ────────────────────────────────────────────────────────── */

type Planet = {
  key: string;
  glyph: string;
  name: [string, string];
  meaning: [string, string];
};

export const PLANETS: Planet[] = [
  { key: "sun",  glyph: "☉", name: ["Sun", "太阳"], meaning: ["core identity · what you shine as", "核心自我 · 你所闪耀的形状"] },
  { key: "moon", glyph: "☽", name: ["Moon", "月亮"], meaning: ["inner needs · how you feel safe", "内在需要 · 你如何感到安全"] },
  { key: "mer",  glyph: "☿", name: ["Mercury", "水星"], meaning: ["mind · how you think and speak", "心智 · 你如何思考与表达"] },
  { key: "ven",  glyph: "♀", name: ["Venus", "金星"], meaning: ["love · what you find beautiful", "爱与美 · 你被什么吸引"] },
  { key: "mar",  glyph: "♂", name: ["Mars", "火星"], meaning: ["drive · how you take action", "行动力 · 你如何出击"] },
  { key: "jup",  glyph: "♃", name: ["Jupiter", "木星"], meaning: ["growth · where luck expands", "扩张 · 幸运在哪里生长"] },
  { key: "sat",  glyph: "♄", name: ["Saturn", "土星"], meaning: ["discipline · where you must build", "纪律 · 你必须搭建之处"] },
  { key: "ura",  glyph: "♅", name: ["Uranus", "天王星"], meaning: ["awakening · where you break the mold", "觉醒 · 你在何处打破常规"] },
  { key: "nep",  glyph: "♆", name: ["Neptune", "海王星"], meaning: ["dream · where you dissolve into meaning", "梦境 · 你在何处融入意义"] },
  { key: "plu",  glyph: "♇", name: ["Pluto", "冥王星"], meaning: ["transformation · where you are reborn", "蜕变 · 你在何处重生"] },
  { key: "node", glyph: "☊", name: ["North Node", "北交点"], meaning: ["karmic path · what you are growing toward", "业力方向 · 你正在成长为的样子"] },
  { key: "asc",  glyph: "Ⓐ", name: ["Ascendant", "上升"], meaning: ["mask · how the world first sees you", "面具 · 世界如何第一眼看你"] },
  { key: "mc",   glyph: "Ⓜ", name: ["Midheaven", "天顶"], meaning: ["calling · your public direction", "召唤 · 你的公共方向"] },
];

export const ZODIAC_SIGNS = ZODIAC;

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

const D2R = Math.PI / 180;
const norm360 = (x: number) => ((x % 360) + 360) % 360;

// Solve Kepler's equation E − e·sin(E) = M (all in degrees) → E in degrees.
function kepler(M: number, e: number): number {
  const Mr = M * D2R;
  let E = Mr + e * Math.sin(Mr) * (1 + e * Math.cos(Mr));
  for (let k = 0; k < 8; k++) {
    const dE = (E - e * Math.sin(E) - Mr) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-9) break;
  }
  return E / D2R;
}

type OrbEl = { N: number; i: number; w: number; a: number; e: number; M: number };

// Heliocentric ecliptic (x, y, z) in AU (or planet units for Moon) at day d.
// Elements after Paul Schlyter (http://stjarnhimlen.se/comp/ppcomp.html),
// referenced to the day count `d = JD − 2451543.5`.
function helio(el: OrbEl): [number, number, number] {
  const E = kepler(el.M, el.e);
  const Er = E * D2R;
  const xv = el.a * (Math.cos(Er) - el.e);
  const yv = el.a * Math.sqrt(1 - el.e * el.e) * Math.sin(Er);
  const v = (Math.atan2(yv, xv) * 180) / Math.PI;
  const r = Math.sqrt(xv * xv + yv * yv);
  const Nr = el.N * D2R;
  const ir = el.i * D2R;
  const vwr = (v + el.w) * D2R;
  const x =
    r * (Math.cos(Nr) * Math.cos(vwr) - Math.sin(Nr) * Math.sin(vwr) * Math.cos(ir));
  const y =
    r * (Math.sin(Nr) * Math.cos(vwr) + Math.cos(Nr) * Math.sin(vwr) * Math.cos(ir));
  const z = r * Math.sin(vwr) * Math.sin(ir);
  return [x, y, z];
}

/**
 * Compute the tropical zodiac sign (0..11 = Aries..Pisces) each of the
 * PLANETS falls in, from a seed formatted as
 *   `${name}|${YYYY-MM-DD}|${HH:MM}|${place}`.
 *
 * Uses Paul Schlyter's low-precision orbital elements (Kepler solved to
 * machine precision) with proper heliocentric → geocentric conversion.
 * Accuracy: typically < 1° for Sun / inner planets, < 2° for outer bodies,
 * which is more than enough to identify a 30°-wide zodiac sign.
 *
 * Ascendant / MC still use a GMST approximation (equator, geographic
 * longitude unknown) — placement is indicative, not clinical.
 *
 * If the seed doesn't contain a parseable date, we fall back to the older
 * deterministic hash so the wheel still renders.
 */
export function computePlanetSigns(seed: string): number[] {
  const parts = (seed || "").split("|");
  const dateStr = parts[1] ?? "";
  const timeStr = parts[2] ?? "";
  const dm = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const tm = timeStr.match(/^(\d{1,2}):(\d{2})/);

  if (!dm) {
    const base = hashString(seed || "anonymous");
    return PLANETS.map((_, i) => {
      const h = hashString(`${seed}::${PLANETS[i].key}::${base}`);
      return h % 12;
    });
  }

  const y = +dm[1];
  const mo = +dm[2];
  const da = +dm[3];
  const hh = tm ? +tm[1] : 12;
  const mi = tm ? +tm[2] : 0;

  // Julian Day Number (proleptic Gregorian).
  const A = Math.floor((14 - mo) / 12);
  const yy = y + 4800 - A;
  const mm = mo + 12 * A - 3;
  const JDN =
    da +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045;
  // Treat the given clock time as UT (birth-place timezone offset unknown
  // in the seed). For sign-level accuracy this only matters for the Moon
  // near a cusp — everything else is unaffected.
  const JD = JDN + (hh - 12) / 24 + mi / 1440;
  // Schlyter's day count is measured from 2000 Jan 0.0 UT = JD 2451543.5.
  const d = JD - 2451543.5;
  // For MC/GMST we use J2000.0 (JD 2451545.0).
  const dJ2 = JD - 2451545.0;

  // ── Orbital elements ────────────────────────────────────────────────────
  const sunEl: OrbEl = {
    N: 0,
    i: 0,
    w: 282.9404 + 4.70935e-5 * d,
    a: 1.0,
    e: 0.016709 - 1.151e-9 * d,
    M: norm360(356.047 + 0.9856002585 * d),
  };
  const moonEl: OrbEl = {
    N: norm360(125.1228 - 0.0529538083 * d),
    i: 5.1454,
    w: norm360(318.0634 + 0.1643573223 * d),
    a: 60.2666,
    e: 0.0549,
    M: norm360(115.3654 + 13.0649929509 * d),
  };
  const merEl: OrbEl = {
    N: norm360(48.3313 + 3.24587e-5 * d),
    i: 7.0047 + 5.0e-8 * d,
    w: norm360(29.1241 + 1.01444e-5 * d),
    a: 0.387098,
    e: 0.205635 + 5.59e-10 * d,
    M: norm360(168.6562 + 4.0923344368 * d),
  };
  const venEl: OrbEl = {
    N: norm360(76.6799 + 2.4659e-5 * d),
    i: 3.3946 + 2.75e-8 * d,
    w: norm360(54.891 + 1.38374e-5 * d),
    a: 0.72333,
    e: 0.006773 - 1.302e-9 * d,
    M: norm360(48.0052 + 1.6021302244 * d),
  };
  const marEl: OrbEl = {
    N: norm360(49.5574 + 2.11081e-5 * d),
    i: 1.8497 - 1.78e-8 * d,
    w: norm360(286.5016 + 2.92961e-5 * d),
    a: 1.523688,
    e: 0.093405 + 2.516e-9 * d,
    M: norm360(18.6021 + 0.5240207766 * d),
  };
  const jupEl: OrbEl = {
    N: norm360(100.4542 + 2.76854e-5 * d),
    i: 1.303 - 1.557e-7 * d,
    w: norm360(273.8777 + 1.64505e-5 * d),
    a: 5.20256,
    e: 0.048498 + 4.469e-9 * d,
    M: norm360(19.895 + 0.0830853001 * d),
  };
  const satEl: OrbEl = {
    N: norm360(113.6634 + 2.3898e-5 * d),
    i: 2.4886 - 1.081e-7 * d,
    w: norm360(339.3939 + 2.97661e-5 * d),
    a: 9.55475,
    e: 0.055546 - 9.499e-9 * d,
    M: norm360(316.967 + 0.0334442282 * d),
  };
  const uraEl: OrbEl = {
    N: norm360(74.0005 + 1.3978e-5 * d),
    i: 0.7733 + 1.9e-8 * d,
    w: norm360(96.6612 + 3.0565e-5 * d),
    a: 19.18171 - 1.55e-8 * d,
    e: 0.047318 + 7.45e-9 * d,
    M: norm360(142.5905 + 0.011725806 * d),
  };
  const nepEl: OrbEl = {
    N: norm360(131.7806 + 3.0173e-5 * d),
    i: 1.77 - 2.55e-7 * d,
    w: norm360(272.8461 - 6.027e-6 * d),
    a: 30.05826 + 3.313e-8 * d,
    e: 0.008606 + 2.15e-9 * d,
    M: norm360(260.2471 + 0.005995147 * d),
  };

  // Sun geocentric = negative of Earth's heliocentric position, but easier:
  // compute Sun's geocentric ecliptic longitude directly from its "orbital
  // elements" (which describe the Earth's orbit as seen from the Sun's frame).
  const sunE = kepler(sunEl.M, sunEl.e) * D2R;
  const xvS = Math.cos(sunE) - sunEl.e;
  const yvS = Math.sqrt(1 - sunEl.e * sunEl.e) * Math.sin(sunE);
  const vS = (Math.atan2(yvS, xvS) * 180) / Math.PI;
  const sunLon = norm360(vS + sunEl.w);
  // Sun geocentric rectangular (used to shift heliocentric planet vectors
  // into geocentric):
  const rS = Math.sqrt(xvS * xvS + yvS * yvS);
  const sunLonRad = sunLon * D2R;
  const xs = rS * Math.cos(sunLonRad);
  const ys = rS * Math.sin(sunLonRad);

  function geoLon(el: OrbEl): number {
    const [xh, yh] = helio(el);
    // planet geocentric = heliocentric + (Sun geocentric) since
    // Earth heliocentric = − Sun geocentric.
    const xg = xh + xs;
    const yg = yh + ys;
    return norm360((Math.atan2(yg, xg) * 180) / Math.PI);
  }

  // Moon: elements are already geocentric.
  function moonLon(): number {
    const [xh, yh] = helio(moonEl);
    return norm360((Math.atan2(yh, xh) * 180) / Math.PI);
  }

  const sun = sunLon;
  const moon = moonLon();
  const mer = geoLon(merEl);
  const ven = geoLon(venEl);
  const mar = geoLon(marEl);
  const jup = geoLon(jupEl);
  const sat = geoLon(satEl);
  const ura = geoLon(uraEl);
  const nep = geoLon(nepEl);
  // Pluto: mean longitude approximation (period ≈ 247.94 y ⇒ 0.003968 °/day).
  // Anchor at J2000 mean longitude ≈ 250.44°.
  const plu = norm360(250.44 + 0.003968 * dJ2);
  // North Node = longitude of Moon's ascending node.
  const node = norm360(moonEl.N);

  // Greenwich Mean Sidereal Time as a longitude (approx equator plane).
  const gmst = norm360(280.46061837 + 360.98564736629 * dJ2);
  const mc = gmst;
  const asc = norm360(gmst + 90);

  // Order MUST match PLANETS.
  const longitudes = [sun, moon, mer, ven, mar, jup, sat, ura, nep, plu, node, asc, mc];
  return longitudes.map((L) => Math.floor(L / 30) % 12);
}

/** Whole-sign houses: house 1 is the Ascendant's sign, then anti-clockwise. */
export function houseForSign(signIdx: number, ascSignIdx: number): number {
  return ((signIdx - ascSignIdx + 12) % 12) + 1;
}

export function NatalWheel({
  lang = "en",
  seed = "",
  size = 420,
  selectedPlanet = null,
  onSelectPlanet,
}: {
  lang?: "en" | "zh";
  seed?: string;
  size?: number;
  selectedPlanet?: number | null;
  onSelectPlanet?: (idx: number | null) => void;
}) {
  const [hoverSign, setHoverSign] = useState<number | null>(null);
  const [hoverPlanet, setHoverPlanet] = useState<number | null>(null);
  const signs = computePlanetSigns(seed);

  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 6;
  const rSignRing = size / 2 - 40;
  const rHouseRing = size / 2 - 80;
  const rPlanetBase = size / 2 - 118;
  const rInner = size / 2 - 148;

  // Group planets by sign for stacking
  const bySign: Record<number, number[]> = {};
  signs.forEach((s, i) => {
    bySign[s] = bySign[s] || [];
    bySign[s].push(i);
  });

  const activePlanet = hoverPlanet ?? selectedPlanet;
  const activeSign =
    hoverSign ?? (activePlanet != null ? signs[activePlanet] : null);

  // Ascendant is the second-to-last entry in PLANETS.
  const ascSign = signs[PLANETS.findIndex((p) => p.key === "asc")] ?? 0;

  const centerContent = (() => {
    if (activePlanet != null) {
      const p = PLANETS[activePlanet];
      const s = ZODIAC[signs[activePlanet]];
      const house = houseForSign(signs[activePlanet], ascSign);
      return (
        <>
          <p className="text-[9px] uppercase tracking-[0.32em] text-gold-dust/70">
            {p.name[lang === "zh" ? 1 : 0]}
          </p>
          <p className="mt-1 font-serif text-3xl italic text-gold-light">{p.glyph}</p>
          <p className="mt-2 font-serif text-lg italic text-stone-warm">
            <span className="text-gold-light">{s.g}</span>{" "}
            {lang === "zh" ? s.zh : s.en}
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.28em] text-stone-warm/50">
            {lang === "zh" ? `第 ${house} 宫` : `House ${house}`}
          </p>
        </>
      );
    }
    if (activeSign != null) {
      const s = ZODIAC[activeSign];
      const inhabitants = (bySign[activeSign] ?? []).map((pi) => PLANETS[pi]);
      const house = houseForSign(activeSign, ascSign);
      return (
        <>
          <p className="text-[9px] uppercase tracking-[0.32em] text-gold-dust/70">
            {lang === "zh" ? `第 ${house} 宫` : `House ${house}`}
          </p>
          <p className="mt-2 font-serif text-2xl italic text-stone-warm">
            {lang === "zh" ? s.zh : s.en}
          </p>
          <p className="mt-1 text-3xl text-gold-light">{s.g}</p>
          {inhabitants.length > 0 ? (
            <p className="mx-2 mt-2 text-[10px] uppercase tracking-[0.2em] text-gold-dust/80">
              {inhabitants.map((p) => p.glyph).join(" · ")}
            </p>
          ) : (
            <p className="mt-2 text-[9px] uppercase tracking-[0.24em] text-stone-warm/40">
              {lang === "zh" ? "此宫空落" : "empty"}
            </p>
          )}
        </>
      );
    }
    return (
      <>
        <p className="font-serif text-xl italic leading-tight text-stone-warm md:text-3xl">
          {lang === "zh" ? "你的命盘" : "Your natal chart"}
        </p>
        <p className="mx-2 mt-3 text-[9px] uppercase leading-relaxed tracking-[0.24em] text-stone-warm/40 md:text-[10px] md:tracking-[0.32em]">
          {lang === "zh" ? "点击行星 · 查看落位与相位" : "Tap a planet · placement & aspects"}
        </p>
      </>
    );
  })();

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* rotating outer scaffold */}
      <div className="absolute inset-0 animate-slow-rotate opacity-70">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full">
          <circle cx={cx} cy={cy} r={rOuter} fill="none" stroke="currentColor" strokeOpacity="0.08" />
          {Array.from({ length: 72 }).map((_, i) => {
            const a = (i * 5 * Math.PI) / 180;
            const long = i % 6 === 0;
            const x1 = cx + Math.cos(a) * (rOuter - (long ? 12 : 5));
            const y1 = cy + Math.sin(a) * (rOuter - (long ? 12 : 5));
            const x2 = cx + Math.cos(a) * rOuter;
            const y2 = cy + Math.sin(a) * rOuter;
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="currentColor" strokeOpacity={long ? 0.45 : 0.18} strokeWidth={long ? 1 : 0.5}
              />
            );
          })}
        </svg>
      </div>

      {/* Static sign ring + house dividers */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 h-full w-full"
      >
        {/* rings */}
        <circle cx={cx} cy={cy} r={rSignRing} fill="none" stroke="currentColor" strokeOpacity="0.14" />
        <circle cx={cx} cy={cy} r={rHouseRing} fill="none" stroke="currentColor" strokeOpacity="0.10" />
        <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="currentColor" strokeOpacity="0.10" />

        {/* 12 sign dividers */}
        {ZODIAC.map((_, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          const x1 = cx + Math.cos(a) * rInner;
          const y1 = cy + Math.sin(a) * rInner;
          const x2 = cx + Math.cos(a) * rSignRing;
          const y2 = cy + Math.sin(a) * rSignRing;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="currentColor" strokeOpacity={0.12} />
          );
        })}

        {/* highlighted sign wedge */}
        {activeSign != null && (
          <motion.path
            key={`wedge-${activeSign}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            d={wedgePath(cx, cy, rInner, rSignRing, activeSign)}
            fill="var(--gold-dust)"
            fillOpacity={0.09}
            stroke="var(--gold-dust)"
            strokeOpacity={0.35}
          />
        )}

        {/* sign glyphs */}
        {ZODIAC.map((z, i) => {
          const a = ((i * 30 + 15 - 90) * Math.PI) / 180;
          const x = cx + Math.cos(a) * ((rSignRing + rHouseRing) / 2);
          const y = cy + Math.sin(a) * ((rSignRing + rHouseRing) / 2);
          const isActive = i === activeSign;
          const hasPlanet = (bySign[i] ?? []).length > 0;
          return (
            <g
              key={z.en}
              onMouseEnter={() => setHoverSign(i)}
              onMouseLeave={() => setHoverSign(null)}
              style={{ cursor: "pointer" }}
            >
              <circle cx={x} cy={y} r={18} fill="transparent" />
              <text x={x} y={y + 8} textAnchor="middle" fontSize="22"
                fill={isActive ? "var(--gold-light)" : hasPlanet ? "var(--gold-dust)" : "var(--stone-warm)"}
                opacity={isActive ? 1 : hasPlanet ? 0.85 : 0.35}
                style={{ transition: "all 0.3s ease" }}
              >
                {z.g}
              </text>
            </g>
          );
        })}

        {/* Aspect lines between planets in trine/opposition signs */}
        {(() => {
          const lines: ReactElement[] = [];
          for (let i = 0; i < PLANETS.length; i++) {
            for (let j = i + 1; j < PLANETS.length; j++) {
              const diff = Math.abs(signs[i] - signs[j]);
              const d = Math.min(diff, 12 - diff);
              if (d === 6 || d === 4) {
                const a1 = ((signs[i] * 30 + 15 - 90) * Math.PI) / 180;
                const a2 = ((signs[j] * 30 + 15 - 90) * Math.PI) / 180;
                const rP = rPlanetBase;
                const x1 = cx + Math.cos(a1) * rP;
                const y1 = cy + Math.sin(a1) * rP;
                const x2 = cx + Math.cos(a2) * rP;
                const y2 = cy + Math.sin(a2) * rP;
                lines.push(
                  <line
                    key={`asp-${i}-${j}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={d === 6 ? "var(--nebula-purple)" : "var(--gold-dust)"}
                    strokeOpacity={0.22}
                    strokeDasharray={d === 6 ? "3 4" : undefined}
                    strokeWidth={0.8}
                  />,
                );
              }
            }
          }
          return lines;
        })()}

        {/* planets */}
        {PLANETS.map((p, i) => {
          const sign = signs[i];
          const stackIdx = (bySign[sign] ?? []).indexOf(i);
          const stackCount = (bySign[sign] ?? []).length;
          // Spread multiple planets across the 30° arc of their sign
          const spread = stackCount > 1 ? (stackIdx - (stackCount - 1) / 2) * (22 / stackCount) : 0;
          const a = ((sign * 30 + 15 + spread - 90) * Math.PI) / 180;
          const x = cx + Math.cos(a) * rPlanetBase;
          const y = cy + Math.sin(a) * rPlanetBase;
          const isActive = i === activePlanet;
          return (
            <g
              key={p.key}
              onMouseEnter={() => setHoverPlanet(i)}
              onMouseLeave={() => setHoverPlanet(null)}
              onClick={() => onSelectPlanet?.(selectedPlanet === i ? null : i)}
              style={{ cursor: "pointer" }}
            >
              {/* tick from ring to planet */}
              <line
                x1={cx + Math.cos(a) * rHouseRing}
                y1={cy + Math.sin(a) * rHouseRing}
                x2={x}
                y2={y}
                stroke="var(--gold-dust)"
                strokeOpacity={isActive ? 0.6 : 0.18}
              />
              <motion.circle
                cx={x} cy={y}
                initial={{ r: 0, opacity: 0 }}
                animate={{
                  r: isActive ? 18 : 13,
                  opacity: 1,
                }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1], delay: i * 0.06 }}
                fill="var(--obsidian)"
                stroke={isActive ? "var(--gold-light)" : "var(--gold-dust)"}
                strokeOpacity={isActive ? 1 : 0.55}
              />
              {isActive && (
                <motion.circle
                  cx={x} cy={y}
                  initial={{ r: 12, opacity: 0.7 }}
                  animate={{ r: 30, opacity: 0 }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  fill="none"
                  stroke="var(--gold-light)"
                  strokeOpacity={0.5}
                />
              )}
              <text x={x} y={y + 5} textAnchor="middle" fontSize="14"
                fill={isActive ? "var(--gold-light)" : "var(--gold-dust)"}
                style={{ pointerEvents: "none", fontFamily: "var(--font-serif)" }}
              >
                {p.glyph}
              </text>
            </g>
          );
        })}

        {/* inner core glow */}
        <defs>
          <radialGradient id="natal-core">
            <stop offset="0%" stopColor="var(--gold-dust)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--gold-dust)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx={cx} cy={cy} r={rInner - 4} fill="url(#natal-core)" />
      </svg>

      {/* center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          key={`${activePlanet}-${activeSign}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="max-w-[58%]"
        >
          {centerContent}
        </motion.div>
      </div>
    </div>
  );
}

function wedgePath(
  cx: number,
  cy: number,
  rIn: number,
  rOut: number,
  signIdx: number,
): string {
  const a1 = ((signIdx * 30 - 90) * Math.PI) / 180;
  const a2 = (((signIdx + 1) * 30 - 90) * Math.PI) / 180;
  const x1o = cx + Math.cos(a1) * rOut;
  const y1o = cy + Math.sin(a1) * rOut;
  const x2o = cx + Math.cos(a2) * rOut;
  const y2o = cy + Math.sin(a2) * rOut;
  const x1i = cx + Math.cos(a1) * rIn;
  const y1i = cy + Math.sin(a1) * rIn;
  const x2i = cx + Math.cos(a2) * rIn;
  const y2i = cy + Math.sin(a2) * rIn;
  return `M ${x1o} ${y1o} A ${rOut} ${rOut} 0 0 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${rIn} ${rIn} 0 0 0 ${x1i} ${y1i} Z`;
}

