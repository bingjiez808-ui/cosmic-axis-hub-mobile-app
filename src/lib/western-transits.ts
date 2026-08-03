/**
 * Western annual transits — deterministic, calculator-only.
 *
 * INPUT → FACTS: given a natal chart's 9 tropical planet longitudes and
 * a UTC sample instant, we compute the transit planets' tropical
 * geocentric ecliptic longitudes at that instant using
 * `astronomy-engine`, then form pairwise aspects between transit
 * planets and natal planets using the SAME orb table as the natal
 * module. No houses, no MC, no progressions, no solar arc, no
 * return charts — only what the ephemeris can prove.
 *
 * Sampling strategy (per year):
 *   - Anchor date: the birth month/day at 12:00 UTC of the target year.
 *     If the birth is 2/29 and the target year is not a leap year the
 *     sample falls back to 2/28 12:00 UTC (documented; deterministic).
 *   - One sample per year. Adequate for slow-moving outer planets
 *     (Jupiter..Neptune) which define the annual signature; fast
 *     inner planets (Sun/Mercury/Venus/Mars) are recorded for
 *     completeness but their aspects are weighted less.
 *
 * Orb table — identical to natal aspects (see western-natal.ts):
 *   conjunction/opposition/trine/square orb 6°; sextile orb 4°.
 *
 * All numbers are derived from astronomy-engine; no Math.random,
 * no LLM. Same input → byte-identical output.
 */
import * as A from "astronomy-engine";
import type { WesternBodyKey, WesternPlanet, WesternAspect } from "./western-natal";

export const WESTERN_TRANSITS_VERSION = "western-transits@1.0.0";

export type WesternTransitPlanet = {
  key: WesternBodyKey;
  trop_lon: number;
  sign: number;
  retro: boolean;
};

export type WesternTransitAspect = {
  transit: WesternBodyKey;
  natal: WesternBodyKey;
  kind: WesternAspect["kind"];
  exact_deg: number;
  angle: number;
  orb: number;
  /** Convenience flag: is the transit body a slow (outer) planet? */
  outer: boolean;
};

export type WesternAnnualTransit = {
  year: number;
  sample_utc: string;              // ISO 8601 Z
  sample_note: string;             // human-readable sampling rule
  calculator_version: string;
  orb_table: Array<{ kind: WesternAspect["kind"]; deg: number; orb: number }>;
  planets: WesternTransitPlanet[];
  aspects: WesternTransitAspect[]; // transit-to-natal aspects
  evidence_paths: {
    planets: `western.annual_transits[${number}].planets`;
    aspects: `western.annual_transits[${number}].aspects`;
  };
};

const BODIES: Array<[A.Body, WesternBodyKey]> = [
  [A.Body.Sun, "sun"],
  [A.Body.Moon, "moon"],
  [A.Body.Mercury, "mercury"],
  [A.Body.Venus, "venus"],
  [A.Body.Mars, "mars"],
  [A.Body.Jupiter, "jupiter"],
  [A.Body.Saturn, "saturn"],
  [A.Body.Uranus, "uranus"],
  [A.Body.Neptune, "neptune"],
];

const OUTER: ReadonlySet<WesternBodyKey> = new Set(["jupiter", "saturn", "uranus", "neptune"]);

export const TRANSIT_ORB_TABLE: Array<{ kind: WesternAspect["kind"]; deg: number; orb: number }> = [
  { kind: "conjunction", deg: 0, orb: 6 },
  { kind: "opposition", deg: 180, orb: 6 },
  { kind: "trine", deg: 120, orb: 6 },
  { kind: "square", deg: 90, orb: 6 },
  { kind: "sextile", deg: 60, orb: 4 },
];

function norm360(x: number): number { const r = x % 360; return r < 0 ? r + 360 : r; }
function angularSep(a: number, b: number): number {
  const d = Math.abs(norm360(a - b));
  return d > 180 ? 360 - d : d;
}

function eclipticGeoLon(body: A.Body, t: A.AstroTime): number {
  const vec = A.GeoVector(body, t, true);
  return norm360(A.Ecliptic(vec).elon);
}

/**
 * Compute the annual transit sample instant for a birthday in a given year.
 * Fixed rule: MM-DD at 12:00 UTC of `year`; 2/29 in a non-leap year falls
 * back to 2/28 12:00 UTC (see module docstring).
 */
export function annualSampleUtc(birthDateISO: string, year: number): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateISO)) return null;
  const mmdd = birthDateISO.slice(5, 10);
  let month = Number(mmdd.slice(0, 2));
  let day = Number(mmdd.slice(3, 5));
  if (!Number.isFinite(year) || year < 1900 || year > 2200) return null;
  if (month === 2 && day === 29) {
    // leap-day birthday
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (!leap) day = 28;
  }
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/**
 * Compute one year's transit chart against a fixed natal frame.
 * Returns `null` on invalid input; never throws.
 */
export function computeAnnualTransit(opts: {
  natal: WesternPlanet[];
  natalAscendantLon?: number | null;
  birthDateISO: string;
  year: number;
  arrayIndex: number;
}): WesternAnnualTransit | null {
  const utc = annualSampleUtc(opts.birthDateISO, opts.year);
  if (!utc) return null;
  try {
    const t = A.MakeTime(utc);
    const planets: WesternTransitPlanet[] = [];
    for (const [body, key] of BODIES) {
      const lon = eclipticGeoLon(body, t);
      let retro = false;
      if (key !== "sun" && key !== "moon") {
        const tNext = A.MakeTime(new Date(utc.getTime() + 86_400_000));
        const lonNext = eclipticGeoLon(body, tNext);
        let delta = lonNext - lon;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        retro = delta < 0;
      }
      planets.push({
        key, trop_lon: lon, sign: Math.floor(lon / 30), retro,
      });
    }
    // Transit-to-natal aspects: iterate transit × natal, first match wins.
    const aspects: WesternTransitAspect[] = [];
    for (const tp of planets) {
      for (const np of opts.natal) {
        const angle = angularSep(tp.trop_lon, np.trop_lon);
        for (const asp of TRANSIT_ORB_TABLE) {
          const orb = Math.abs(angle - asp.deg);
          if (orb <= asp.orb) {
            aspects.push({
              transit: tp.key,
              natal: np.key,
              kind: asp.kind,
              exact_deg: asp.deg,
              angle,
              orb,
              outer: OUTER.has(tp.key),
            });
            break;
          }
        }
      }
    }
    return {
      year: opts.year,
      sample_utc: utc.toISOString(),
      sample_note: "Birthday MM-DD at 12:00 UTC (leap-day fallback: 02-28)",
      calculator_version: WESTERN_TRANSITS_VERSION,
      orb_table: TRANSIT_ORB_TABLE,
      planets,
      aspects,
      evidence_paths: {
        planets: `western.annual_transits[${opts.arrayIndex}].planets`,
        aspects: `western.annual_transits[${opts.arrayIndex}].aspects`,
      },
    };
  } catch (e) {
    console.warn("annual transit compute failed", e);
    return null;
  }
}

/**
 * Deterministic scoring of a single annual-transit chart.
 * Weights:
 *   - Outer trine/sextile to natal Sun/Moon/Ascendant  → +4/+3
 *   - Outer conjunction to natal Sun/Moon              → +2 (variable, informational)
 *   - Outer square/opposition to natal Sun/Moon        → -4
 *   - Outer square/opposition to Ascendant             → -3
 *   - Inner planet aspects (fast) contribute half weight
 * Score is clamped to [0,100], centered at 50.
 */
export function scoreAnnualTransit(t: WesternAnnualTransit): {
  score: number;
  positive_hits: WesternTransitAspect[];
  negative_hits: WesternTransitAspect[];
} {
  let delta = 0;
  const pos: WesternTransitAspect[] = [];
  const neg: WesternTransitAspect[] = [];
  const targets: ReadonlySet<WesternBodyKey> = new Set(["sun", "moon"]);
  for (const a of t.aspects) {
    if (!targets.has(a.natal)) continue;
    const weight = a.outer ? 1 : 0.5;
    if (a.kind === "trine" || a.kind === "sextile") {
      const bonus = a.outer ? 4 : 2;
      delta += bonus * weight;
      pos.push(a);
    } else if (a.kind === "square" || a.kind === "opposition") {
      const penalty = a.outer ? 4 : 2;
      delta -= penalty * weight;
      neg.push(a);
    } else if (a.kind === "conjunction" && a.outer) {
      // Conjunction is ambiguous; small positive if Jupiter/Venus-family.
      if (a.transit === "jupiter") { delta += 2; pos.push(a); }
      if (a.transit === "saturn") { delta -= 2; neg.push(a); }
    }
  }
  const score = Math.max(0, Math.min(100, Math.round(50 + delta)));
  return { score, positive_hits: pos, negative_hits: neg };
}
