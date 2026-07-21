/**
 * daily-facts-v1 — deterministic per-day transit facts.
 *
 * INPUT → FACTS: given a natal chart's 9 tropical planet longitudes plus a
 * local date + IANA timezone, produce the transit planets' tropical
 * geocentric ecliptic longitudes at *local noon → UTC*, and form pairwise
 * aspects between transit planets and natal planets using the same orb
 * table as `western-natal.ts` / `western-transits.ts`.
 *
 * This is a **calculator only** module. It never calls the AI. Same input
 * → byte-identical output.
 *
 * Sampling: `noonUtcForLocalDate(date, tz)` returns the UTC instant that
 * corresponds to 12:00 in the given timezone on the given calendar date.
 * Noon is chosen because it minimises Moon-sign drift within the tz's day
 * relative to the user's waking window; picking either midnight would
 * straddle a sign transition more often.
 *
 * NOTE: Vedic per-day, BaZi per-day 干支/日运, and Ziwei per-day/per-hour
 * panels are *not* computed here. The daily-domain-score layer folds in
 * only the slower cycles the project can prove (Dasha / 大运 / 大限 /
 * 流年 / 流月), and marks the rest as `missing_facts`.
 */
import * as A from "astronomy-engine";
import type { WesternBodyKey, WesternPlanet, WesternAspect } from "./western-natal";

export const DAILY_FACTS_VERSION = "daily-facts-v1";

export type DailyTransitPlanet = {
  key: WesternBodyKey;
  trop_lon: number;
  sign: number;
  retro: boolean;
};

export type DailyTransitAspect = {
  transit: WesternBodyKey;
  natal: WesternBodyKey;
  kind: WesternAspect["kind"];
  exact_deg: number;
  angle: number;
  orb: number;
  outer: boolean;
};

export type MoonPhase =
  | "new_moon"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full_moon"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

export type DailyFacts = {
  calculator_version: typeof DAILY_FACTS_VERSION;
  local_date: string;   // YYYY-MM-DD in the user's tz
  timezone: string;     // IANA tz id
  sample_utc: string;   // ISO-8601 Z
  transit_planets: DailyTransitPlanet[];
  transit_to_natal_aspects: DailyTransitAspect[];
  moon: {
    trop_lon: number;
    sign: number;
    phase: MoonPhase;
    illumination_pct: number;
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

const ORB_TABLE: Array<{ kind: WesternAspect["kind"]; deg: number; orb: number }> = [
  { kind: "conjunction", deg: 0, orb: 6 },
  { kind: "opposition", deg: 180, orb: 6 },
  { kind: "trine", deg: 120, orb: 6 },
  { kind: "square", deg: 90, orb: 6 },
  { kind: "sextile", deg: 60, orb: 4 },
];

function norm360(x: number) { const r = x % 360; return r < 0 ? r + 360 : r; }
function angularSep(a: number, b: number) {
  const d = Math.abs(norm360(a - b));
  return d > 180 ? 360 - d : d;
}

function eclipticGeoLon(body: A.Body, t: A.AstroTime): number {
  return norm360(A.Ecliptic(A.GeoVector(body, t, true)).elon);
}

/**
 * Return the UTC instant corresponding to 12:00 local time on `localDate`
 * in `timezone`. Uses `Intl.DateTimeFormat` to derive the tz offset for
 * that day (which correctly handles DST); does not depend on the caller's
 * system tz.
 *
 * `localDate` must be YYYY-MM-DD. Invalid inputs return `null`.
 */
export function noonUtcForLocalDate(localDate: string, timezone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) return null;
  // Start from the UTC guess of that calendar noon.
  const [y, m, d] = localDate.split("-").map(Number);
  const guessUtc = Date.UTC(y, m - 1, d, 12, 0, 0);
  // Ask Intl what the local wall-time is for that UTC instant in `timezone`.
  let offsetMinutes: number;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(guessUtc));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const localAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
    offsetMinutes = Math.round((localAsUtc - guessUtc) / 60_000);
  } catch {
    return null;
  }
  // If local wall-time is 12:00 - offset, we want local to be exactly 12:00,
  // so adjust: real_utc = guessUtc - offsetMinutes*60_000.
  const realUtc = guessUtc - offsetMinutes * 60_000;
  return new Date(realUtc);
}

function moonPhaseFromAngle(angleDeg: number): MoonPhase {
  const a = norm360(angleDeg);
  if (a < 22.5 || a >= 337.5) return "new_moon";
  if (a < 67.5) return "waxing_crescent";
  if (a < 112.5) return "first_quarter";
  if (a < 157.5) return "waxing_gibbous";
  if (a < 202.5) return "full_moon";
  if (a < 247.5) return "waning_gibbous";
  if (a < 292.5) return "last_quarter";
  return "waning_crescent";
}

/**
 * Compute deterministic daily facts. Returns `null` on invalid input.
 */
export function computeDailyFacts(opts: {
  natal: WesternPlanet[];
  localDate: string;
  timezone: string;
}): DailyFacts | null {
  const sampleUtc = noonUtcForLocalDate(opts.localDate, opts.timezone);
  if (!sampleUtc) return null;
  try {
    const t = A.MakeTime(sampleUtc);
    const planets: DailyTransitPlanet[] = [];
    let sunLon = 0;
    let moonLon = 0;
    for (const [body, key] of BODIES) {
      const lon = eclipticGeoLon(body, t);
      if (key === "sun") sunLon = lon;
      if (key === "moon") moonLon = lon;
      let retro = false;
      if (key !== "sun" && key !== "moon") {
        const tNext = A.MakeTime(new Date(sampleUtc.getTime() + 86_400_000));
        const lonNext = eclipticGeoLon(body, tNext);
        let delta = lonNext - lon;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        retro = delta < 0;
      }
      planets.push({ key, trop_lon: lon, sign: Math.floor(lon / 30), retro });
    }
    // Transit-to-natal aspects — first match wins per pair.
    const aspects: DailyTransitAspect[] = [];
    for (const tp of planets) {
      for (const np of opts.natal) {
        const angle = angularSep(tp.trop_lon, np.trop_lon);
        for (const asp of ORB_TABLE) {
          const orb = Math.abs(angle - asp.deg);
          if (orb <= asp.orb) {
            aspects.push({
              transit: tp.key, natal: np.key, kind: asp.kind,
              exact_deg: asp.deg, angle, orb, outer: OUTER.has(tp.key),
            });
            break;
          }
        }
      }
    }
    const sunMoonAngle = norm360(moonLon - sunLon);
    const illumination = (1 - Math.cos((sunMoonAngle * Math.PI) / 180)) / 2;
    return {
      calculator_version: DAILY_FACTS_VERSION,
      local_date: opts.localDate,
      timezone: opts.timezone,
      sample_utc: sampleUtc.toISOString(),
      transit_planets: planets,
      transit_to_natal_aspects: aspects,
      moon: {
        trop_lon: moonLon,
        sign: Math.floor(moonLon / 30),
        phase: moonPhaseFromAngle(sunMoonAngle),
        illumination_pct: Math.round(illumination * 1000) / 10,
      },
    };
  } catch (e) {
    console.warn("daily facts compute failed", e);
    return null;
  }
}
