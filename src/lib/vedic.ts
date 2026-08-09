/**
 * Vedic Jyotish (sidereal) calculator.
 *
 * Sources:
 *  - Planet longitudes: astronomy-engine (Don Cross), heliocentric VSOP87
 *    + light-time correction; geocentric ecliptic longitudes in tropical J2000.
 *    Cross-checks against Swiss Ephemeris typically within ~1 arcminute.
 *  - Sidereal shift: Lahiri (Chitra-paksha) ayanamsa
 *      ay = 23.85675° + (JD − J2000)/365.25 · (50.288″/year)/3600
 *    Matches Swiss Ephemeris SE_SIDM_LAHIRI within ~10″ in the modern era.
 *  - Nakshatra span: 360° / 27 = 13°20'; pada = one quarter of that.
 *  - Vimshottari dasha: classical 120-year cycle with the nine dasa lords
 *    keyed by Moon's nakshatra; balance-of-dasa at birth is proportional
 *    to the unspent fraction of the current nakshatra.
 *  - Ascendant: LST from astronomy-engine SiderealTime; obliquity of date
 *    from IAU 2006 mean value approximated as 23.4392911° − 0.0130042°·T.
 *    The tropical Ascendant is then shifted by ayanamsa to give sidereal Asc.
 *  - Bhava (whole-sign): each of the 12 houses spans one full sidereal sign,
 *    starting at the Ascendant sign — the classical Indian Bhāva convention.
 *
 * Unavailable systems (planet-fail, no place, no time) return null so the
 * snapshot marks Vedic as `unavailable` and downstream paywall is blocked.
 */
import * as A from "astronomy-engine";

export type VedicPlanet = {
  key: "sun" | "moon" | "mercury" | "venus" | "mars" | "jupiter" | "saturn" | "rahu" | "ketu";
  name_en: string;
  name_zh: string;
  /** Sidereal ecliptic longitude, 0–360°. */
  sid_lon: number;
  /** Sidereal sign index 0=Aries … 11=Pisces. */
  sign: number;
  /** Degree within sign (0–30). */
  deg_in_sign: number;
  /** Retrograde flag (Moon/Rahu/Ketu treated as N/A). */
  retro: boolean | null;
};

export const NAKSHATRAS: Array<{ en: string; zh: string; lord: DashaLord }> = [
  { en: "Ashwini",       zh: "娄宿",   lord: "Ketu" },
  { en: "Bharani",       zh: "胃宿",   lord: "Venus" },
  { en: "Krittika",      zh: "昴宿",   lord: "Sun" },
  { en: "Rohini",        zh: "毕宿",   lord: "Moon" },
  { en: "Mrigashira",    zh: "觜宿",   lord: "Mars" },
  { en: "Ardra",         zh: "参宿",   lord: "Rahu" },
  { en: "Punarvasu",     zh: "井宿",   lord: "Jupiter" },
  { en: "Pushya",        zh: "鬼宿",   lord: "Saturn" },
  { en: "Ashlesha",      zh: "柳宿",   lord: "Mercury" },
  { en: "Magha",         zh: "星宿",   lord: "Ketu" },
  { en: "Purva Phalguni",zh: "张宿",   lord: "Venus" },
  { en: "Uttara Phalguni",zh:"翼宿",  lord: "Sun" },
  { en: "Hasta",         zh: "轸宿",   lord: "Moon" },
  { en: "Chitra",        zh: "角宿",   lord: "Mars" },
  { en: "Swati",         zh: "亢宿",   lord: "Rahu" },
  { en: "Vishakha",      zh: "氐宿",   lord: "Jupiter" },
  { en: "Anuradha",      zh: "房宿",   lord: "Saturn" },
  { en: "Jyeshtha",      zh: "心宿",   lord: "Mercury" },
  { en: "Mula",          zh: "尾宿",   lord: "Ketu" },
  { en: "Purva Ashadha", zh: "箕宿",   lord: "Venus" },
  { en: "Uttara Ashadha",zh: "斗宿",   lord: "Sun" },
  { en: "Shravana",      zh: "牛宿",   lord: "Moon" },
  { en: "Dhanishta",     zh: "女宿",   lord: "Mars" },
  { en: "Shatabhisha",   zh: "虚宿",   lord: "Rahu" },
  { en: "Purva Bhadrapada",zh:"危宿", lord: "Jupiter" },
  { en: "Uttara Bhadrapada",zh:"室宿",lord: "Saturn" },
  { en: "Revati",        zh: "壁宿",   lord: "Mercury" },
];

export const SIDEREAL_SIGN: Array<{ en: string; zh: string }> = [
  { en: "Aries", zh: "白羊" },
  { en: "Taurus", zh: "金牛" },
  { en: "Gemini", zh: "双子" },
  { en: "Cancer", zh: "巨蟹" },
  { en: "Leo", zh: "狮子" },
  { en: "Virgo", zh: "处女" },
  { en: "Libra", zh: "天秤" },
  { en: "Scorpio", zh: "天蝎" },
  { en: "Sagittarius", zh: "射手" },
  { en: "Capricorn", zh: "摩羯" },
  { en: "Aquarius", zh: "水瓶" },
  { en: "Pisces", zh: "双鱼" },
];

export type DashaLord =
  | "Ketu" | "Venus" | "Sun" | "Moon" | "Mars" | "Rahu" | "Jupiter" | "Saturn" | "Mercury";

/** Classical Vimshottari sequence and each dasa's total years (sum = 120). */
export const DASHA_ORDER: DashaLord[] = [
  "Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury",
];
export const DASHA_YEARS: Record<DashaLord, number> = {
  Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17,
};

export type VimshottariMahadasha = {
  lord: DashaLord;
  start: string; // ISO date
  end: string;
  years: number;
};

export type VedicChart = {
  source: string;
  ayanamsa_deg: number;
  planets: VedicPlanet[];
  moon: {
    sid_lon: number;
    nakshatra_index: number;
    nakshatra_en: string;
    nakshatra_zh: string;
    pada: 1 | 2 | 3 | 4;
    lord: DashaLord;
  };
  ascendant: null | {
    sid_lon: number;
    sign: number;
    sign_en: string;
    sign_zh: string;
    deg_in_sign: number;
    bhava: Array<{ house: number; sign: number; sign_en: string; sign_zh: string }>;
  };
  vimshottari: VimshottariMahadasha[];
};

/* ---------------- helpers ---------------- */

function norm360(x: number): number {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
}

function lahiriAyanamsaDeg(t: A.AstroTime): number {
  // Days since J2000.0 TT
  const days = t.tt;
  const years = days / 365.25;
  // Modern Lahiri (Chitra-paksha) reference ≈ 23°51'24.4" at J2000
  return 23.85675 + (years * 50.288) / 3600;
}

function meanObliquityDeg(t: A.AstroTime): number {
  // IAU 2006 mean obliquity, low-precision (0.001" over centuries):
  // ε = 23°26'21.448" − 46.8150"·T − 0.00059"·T² + 0.001813"·T³
  const T = t.tt / 36525;
  const arcsec = 23 * 3600 + 26 * 60 + 21.448
    - 46.815 * T - 0.00059 * T * T + 0.001813 * T * T * T;
  return arcsec / 3600;
}

function eclipticGeoLon(body: A.Body, t: A.AstroTime): number {
  // Geocentric apparent ecliptic longitude in tropical of date.
  const vec = A.GeoVector(body, t, true);
  const ecl = A.Ecliptic(vec);
  return norm360(ecl.elon);
}

/** Moon's mean ascending node (Rahu) longitude — Meeus ch. 47 low-precision. */
function meanRahuLongitudeDeg(t: A.AstroTime): number {
  const T = t.tt / 36525;
  // Ω = 125.04452 − 1934.136261·T + 0.0020708·T² + T³/450000
  const omega = 125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000;
  return norm360(omega);
}

function toDeg(rad: number): number { return (rad * 180) / Math.PI; }
function toRad(deg: number): number { return (deg * Math.PI) / 180; }

function ascendantTropicalDeg(lst_deg: number, lat_deg: number, eps_deg: number): number {
  const RAMC = toRad(lst_deg);
  const eps = toRad(eps_deg);
  const phi = toRad(lat_deg);
  // Meeus 13.6 / classical: tan(Asc) = cos(RAMC) / (−sin(RAMC)·cos(ε) − tan(φ)·sin(ε))
  const asc = Math.atan2(
    Math.cos(RAMC),
    -Math.sin(RAMC) * Math.cos(eps) - Math.tan(phi) * Math.sin(eps),
  );
  return norm360(toDeg(asc));
}

/* ---------------- main entry ---------------- */

export function computeVedicChart(opts: {
  utc: Date;
  lat?: number | null;
  lng?: number | null;
}): VedicChart | null {
  try {
    const t = A.MakeTime(opts.utc);
    const ay = lahiriAyanamsaDeg(t);

    const bodyMap: Array<[A.Body, VedicPlanet["key"], string, string]> = [
      [A.Body.Sun, "sun", "Sun", "太阳"],
      [A.Body.Moon, "moon", "Moon", "月亮"],
      [A.Body.Mercury, "mercury", "Mercury", "水星"],
      [A.Body.Venus, "venus", "Venus", "金星"],
      [A.Body.Mars, "mars", "Mars", "火星"],
      [A.Body.Jupiter, "jupiter", "Jupiter", "木星"],
      [A.Body.Saturn, "saturn", "Saturn", "土星"],
    ];

    const planets: VedicPlanet[] = [];
    for (const [body, key, nEn, nZh] of bodyMap) {
      const tropLon = eclipticGeoLon(body, t);
      const sid = norm360(tropLon - ay);
      const sign = Math.floor(sid / 30);
      // Retrograde: compare geocentric longitude ~1 day apart.
      let retro: boolean | null = null;
      if (key !== "sun" && key !== "moon") {
        const tNext = A.MakeTime(new Date(opts.utc.getTime() + 86400_000));
        const lonNext = eclipticGeoLon(body, tNext);
        // Direct motion increases longitude in geocentric ecliptic; account wrap.
        let delta = lonNext - tropLon;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        retro = delta < 0;
      }
      planets.push({
        key, name_en: nEn, name_zh: nZh,
        sid_lon: sid, sign, deg_in_sign: sid - sign * 30, retro,
      });
    }
    // Rahu / Ketu — mean nodes, retrograde by convention.
    const rahuTrop = meanRahuLongitudeDeg(t);
    const rahuSid = norm360(rahuTrop - ay);
    const rahuSign = Math.floor(rahuSid / 30);
    planets.push({
      key: "rahu", name_en: "Rahu", name_zh: "罗睺",
      sid_lon: rahuSid, sign: rahuSign, deg_in_sign: rahuSid - rahuSign * 30, retro: true,
    });
    const ketuSid = norm360(rahuSid + 180);
    const ketuSign = Math.floor(ketuSid / 30);
    planets.push({
      key: "ketu", name_en: "Ketu", name_zh: "计都",
      sid_lon: ketuSid, sign: ketuSign, deg_in_sign: ketuSid - ketuSign * 30, retro: true,
    });

    // Moon nakshatra + pada
    const moon = planets.find((p) => p.key === "moon")!;
    const nakSpan = 360 / 27;
    const nakIdx = Math.floor(moon.sid_lon / nakSpan) % 27;
    const withinNak = moon.sid_lon - nakIdx * nakSpan;
    const pada = (Math.floor(withinNak / (nakSpan / 4)) + 1) as 1 | 2 | 3 | 4;
    const nak = NAKSHATRAS[nakIdx];

    // Ascendant + bhava (only if lat/lng)
    let ascendant: VedicChart["ascendant"] = null;
    if (typeof opts.lat === "number" && typeof opts.lng === "number"
        && Number.isFinite(opts.lat) && Number.isFinite(opts.lng)
        && Math.abs(opts.lat) < 66.5) {
      const gstHours = A.SiderealTime(t); // apparent sidereal at Greenwich
      const lstDeg = norm360(gstHours * 15 + opts.lng);
      const eps = meanObliquityDeg(t);
      const ascTropDeg = ascendantTropicalDeg(lstDeg, opts.lat, eps);
      const ascSid = norm360(ascTropDeg - ay);
      const ascSign = Math.floor(ascSid / 30);
      const bhava = Array.from({ length: 12 }, (_, i) => {
        const s = (ascSign + i) % 12;
        return { house: i + 1, sign: s, sign_en: SIDEREAL_SIGN[s].en, sign_zh: SIDEREAL_SIGN[s].zh };
      });
      ascendant = {
        sid_lon: ascSid, sign: ascSign,
        sign_en: SIDEREAL_SIGN[ascSign].en, sign_zh: SIDEREAL_SIGN[ascSign].zh,
        deg_in_sign: ascSid - ascSign * 30,
        bhava,
      };
    }

    // Vimshottari mahadasha
    const balanceFrac = 1 - withinNak / nakSpan;
    const startLord = nak.lord;
    const startIdx = DASHA_ORDER.indexOf(startLord);
    let cursor = new Date(opts.utc);
    const vims: VimshottariMahadasha[] = [];
    // First (partial) dasa
    {
      const yrs = DASHA_YEARS[startLord] * balanceFrac;
      const end = new Date(cursor.getTime() + yrs * 365.2422 * 86400_000);
      vims.push({ lord: startLord, start: cursor.toISOString(), end: end.toISOString(), years: yrs });
      cursor = end;
    }
    // Fill until ~120 years from birth
    for (let i = 1; i < DASHA_ORDER.length + 2; i++) {
      const lord = DASHA_ORDER[(startIdx + i) % DASHA_ORDER.length];
      const yrs = DASHA_YEARS[lord];
      const end = new Date(cursor.getTime() + yrs * 365.2422 * 86400_000);
      vims.push({ lord, start: cursor.toISOString(), end: end.toISOString(), years: yrs });
      cursor = end;
    }

    return {
      source: "astronomy-engine@2.x + Lahiri ayanamsa (Chitra-paksha)",
      ayanamsa_deg: ay,
      planets,
      moon: {
        sid_lon: moon.sid_lon,
        nakshatra_index: nakIdx,
        nakshatra_en: nak.en,
        nakshatra_zh: nak.zh,
        pada,
        lord: nak.lord,
      },
      ascendant,
      vimshottari: vims,
    };
  } catch (e) {
    console.warn("vedic compute failed", e);
    return null;
  }
}
