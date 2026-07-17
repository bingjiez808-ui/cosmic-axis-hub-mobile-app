/**
 * Western tropical natal chart — 9 luminaries + major aspects.
 *
 * Uses `astronomy-engine` for geocentric apparent ecliptic longitudes
 * (tropical, of date), and a low-precision IAU obliquity for Ascendant.
 * Nothing is invented — when lat/lng is missing, Ascendant + houses
 * remain `null` and the facts layer marks them unavailable.
 *
 * Aspect orbs are the classical widely-used defaults:
 *   conjunction 0°, opposition 180°, trine 120°, square 90° — orb 6°.
 *   sextile 60° — orb 4°.
 * These are hard-coded so the AI cannot widen orbs to justify claims.
 *
 * Retrograde is detected geocentrically over a 24-hour window; Sun and
 * Moon are never retrograde by definition and are reported `retro:false`.
 */
import * as A from "astronomy-engine";

export type WesternBodyKey =
  | "sun" | "moon" | "mercury" | "venus" | "mars"
  | "jupiter" | "saturn" | "uranus" | "neptune";

export type WesternPlanet = {
  key: WesternBodyKey;
  name_en: string;
  name_zh: string;
  /** Tropical geocentric ecliptic longitude, 0–360°. */
  trop_lon: number;
  sign: number;         // 0=Aries … 11=Pisces
  sign_en: string;
  sign_zh: string;
  deg_in_sign: number;
  retro: boolean;
};

export type WesternAspect = {
  a: WesternBodyKey;
  b: WesternBodyKey;
  kind: "conjunction" | "opposition" | "trine" | "square" | "sextile";
  exact_deg: number;    // 0 / 60 / 90 / 120 / 180
  angle: number;        // observed separation 0–180°
  orb: number;          // |angle − exact_deg|
};

export type WesternAscendant = {
  trop_lon: number;
  sign: number;
  sign_en: string;
  sign_zh: string;
  deg_in_sign: number;
};

export type WesternChart = {
  source: string;
  obliquity_deg: number;
  planets: WesternPlanet[];
  aspects: WesternAspect[];
  ascendant: WesternAscendant | null;
  /** House cusps are not computed here (Placidus etc. requires more work). */
  houses: null;
};

const SIGN_NAMES: Array<{ en: string; zh: string }> = [
  { en: "Aries", zh: "白羊" }, { en: "Taurus", zh: "金牛" }, { en: "Gemini", zh: "双子" },
  { en: "Cancer", zh: "巨蟹" }, { en: "Leo", zh: "狮子" }, { en: "Virgo", zh: "处女" },
  { en: "Libra", zh: "天秤" }, { en: "Scorpio", zh: "天蝎" }, { en: "Sagittarius", zh: "射手" },
  { en: "Capricorn", zh: "摩羯" }, { en: "Aquarius", zh: "水瓶" }, { en: "Pisces", zh: "双鱼" },
];

const BODIES: Array<[A.Body, WesternBodyKey, string, string]> = [
  [A.Body.Sun, "sun", "Sun", "太阳"],
  [A.Body.Moon, "moon", "Moon", "月亮"],
  [A.Body.Mercury, "mercury", "Mercury", "水星"],
  [A.Body.Venus, "venus", "Venus", "金星"],
  [A.Body.Mars, "mars", "Mars", "火星"],
  [A.Body.Jupiter, "jupiter", "Jupiter", "木星"],
  [A.Body.Saturn, "saturn", "Saturn", "土星"],
  [A.Body.Uranus, "uranus", "Uranus", "天王星"],
  [A.Body.Neptune, "neptune", "Neptune", "海王星"],
];

const ASPECT_TABLE: Array<{ kind: WesternAspect["kind"]; deg: number; orb: number }> = [
  { kind: "conjunction", deg: 0, orb: 6 },
  { kind: "opposition", deg: 180, orb: 6 },
  { kind: "trine", deg: 120, orb: 6 },
  { kind: "square", deg: 90, orb: 6 },
  { kind: "sextile", deg: 60, orb: 4 },
];

function norm360(x: number): number { const r = x % 360; return r < 0 ? r + 360 : r; }
function toRad(d: number): number { return (d * Math.PI) / 180; }
function toDeg(r: number): number { return (r * 180) / Math.PI; }

function eclipticGeoLon(body: A.Body, t: A.AstroTime): number {
  const vec = A.GeoVector(body, t, true);
  return norm360(A.Ecliptic(vec).elon);
}

function meanObliquityDeg(t: A.AstroTime): number {
  const T = t.tt / 36525;
  const arcsec = 23 * 3600 + 26 * 60 + 21.448
    - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T;
  return arcsec / 3600;
}

function ascendantTropicalDeg(lstDeg: number, latDeg: number, epsDeg: number): number {
  const RAMC = toRad(lstDeg);
  const eps = toRad(epsDeg);
  const phi = toRad(latDeg);
  const asc = Math.atan2(
    Math.cos(RAMC),
    -Math.sin(RAMC) * Math.cos(eps) - Math.tan(phi) * Math.sin(eps),
  );
  return norm360(toDeg(asc));
}

function angularSep(a: number, b: number): number {
  const d = Math.abs(norm360(a - b));
  return d > 180 ? 360 - d : d;
}

export function computeWesternChart(opts: {
  utc: Date;
  lat?: number | null;
  lng?: number | null;
}): WesternChart | null {
  try {
    const t = A.MakeTime(opts.utc);
    const planets: WesternPlanet[] = [];
    for (const [body, key, nEn, nZh] of BODIES) {
      const lon = eclipticGeoLon(body, t);
      let retro = false;
      if (key !== "sun" && key !== "moon") {
        const tNext = A.MakeTime(new Date(opts.utc.getTime() + 86_400_000));
        const lonNext = eclipticGeoLon(body, tNext);
        let delta = lonNext - lon;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        retro = delta < 0;
      }
      const sign = Math.floor(lon / 30);
      planets.push({
        key, name_en: nEn, name_zh: nZh,
        trop_lon: lon, sign,
        sign_en: SIGN_NAMES[sign].en,
        sign_zh: SIGN_NAMES[sign].zh,
        deg_in_sign: lon - sign * 30,
        retro,
      });
    }

    // Aspects — pairwise, first match wins.
    const aspects: WesternAspect[] = [];
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const a = planets[i], b = planets[j];
        const angle = angularSep(a.trop_lon, b.trop_lon);
        for (const asp of ASPECT_TABLE) {
          const orb = Math.abs(angle - asp.deg);
          if (orb <= asp.orb) {
            aspects.push({ a: a.key, b: b.key, kind: asp.kind, exact_deg: asp.deg, angle, orb });
            break;
          }
        }
      }
    }

    // Ascendant (tropical) — only if lat/lng available and out of polar limit.
    let ascendant: WesternAscendant | null = null;
    if (
      typeof opts.lat === "number" && typeof opts.lng === "number" &&
      Number.isFinite(opts.lat) && Number.isFinite(opts.lng) &&
      Math.abs(opts.lat) < 66.5
    ) {
      const gstHours = A.SiderealTime(t);
      const lstDeg = norm360(gstHours * 15 + opts.lng);
      const eps = meanObliquityDeg(t);
      const ascDeg = ascendantTropicalDeg(lstDeg, opts.lat, eps);
      const sign = Math.floor(ascDeg / 30);
      ascendant = {
        trop_lon: ascDeg,
        sign,
        sign_en: SIGN_NAMES[sign].en,
        sign_zh: SIGN_NAMES[sign].zh,
        deg_in_sign: ascDeg - sign * 30,
      };
    }

    return {
      source: "astronomy-engine@2.x tropical geocentric",
      obliquity_deg: meanObliquityDeg(t),
      planets,
      aspects,
      ascendant,
      houses: null,
    };
  } catch (e) {
    console.warn("western natal compute failed", e);
    return null;
  }
}

/** Modules we honestly do not compute locally. */
export const WESTERN_UNAVAILABLE = ["western_house_cusps", "western_progressions", "western_transits"] as const;
