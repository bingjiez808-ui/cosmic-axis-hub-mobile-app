/**
 * Cross-tradition CALCULATION SNAPSHOT.
 *
 * A single structured record of the birth-chart values that our four
 * tradition surfaces are allowed to cite. Every downstream reader
 * (free web report, premium AI report, admin QA, tests) must ground
 * evidence text in this snapshot — never in a hard-coded template.
 *
 * Sources per system:
 *   - western: tropical Sun sign from the solar date (boundary-safe table).
 *   - bazi:    four pillars + day-master via lunar-javascript.
 *   - vedic:   astronomy-engine (VSOP87) + Lahiri (Chitra-paksha) ayanamsa;
 *              9-graha sidereal longitudes, Moon nakshatra+pada, Vimshottari
 *              mahadasha; ascendant + bhava when lat/lng resolvable.
 *   - ziwei:   iztro (三合派) — 命宫/身宫, 五行局, 十二宫 with 14 主星 + 四化.
 *              Requires gender.
 *
 * Isomorphic: safe to import from client, server functions, and tests.
 */
import { solarToLunarInfo } from "@/lib/lunar";
import { lookupCityGeo, localBirthToUTC, type CityGeo } from "@/lib/city-geo";
import { computeVedicChart, type VedicChart } from "@/lib/vedic";
import { computeZiweiChart, soulPalaceMajorStars, type ZiweiChart, type ZiweiGender } from "@/lib/ziwei";

export const CALCULATION_VERSION = "calc_snapshot_v2.0.0";

export type SystemStatus = "ok" | "unavailable";
export type Element = "fire" | "earth" | "air" | "water";
export type BaZiElement = "wood" | "fire" | "earth" | "metal" | "water";

/* ------------------------------------------------------------------ */
/* Tropical Sun sign — from the solar date, boundary-safe.            */
/* ------------------------------------------------------------------ */

/** Zodiac sign index 0=Aries … 11=Pisces. Returns null when the date is missing/invalid. */
export function tropicalSunSignFromDate(dateISO: string | undefined | null): number | null {
  if (!dateISO) return null;
  const m = dateISO.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const mo = +m[2];
  const d = +m[3];
  // Tropical sign boundaries (Western astrology; last-day-of-sign inclusive).
  const table: Array<[number, number, number]> = [
    [1, 20, 10], // Aquarius from Jan 20
    [2, 19, 11], // Pisces from Feb 19
    [3, 21, 0],  // Aries from Mar 21
    [4, 20, 1],  // Taurus
    [5, 21, 2],  // Gemini
    [6, 21, 3],  // Cancer
    [7, 23, 4],  // Leo
    [8, 23, 5],  // Virgo
    [9, 23, 6],  // Libra
    [10, 23, 7], // Scorpio
    [11, 22, 8], // Sagittarius
    [12, 22, 9], // Capricorn
  ];
  // Default: before Jan 20 = Capricorn.
  let sign = 9;
  for (const [bm, bd, s] of table) {
    if (mo > bm || (mo === bm && d >= bd)) sign = s;
  }
  return sign;
}

const SIGN_ELEMENT: Element[] = [
  "fire", "earth", "air", "water",
  "fire", "earth", "air", "water",
  "fire", "earth", "air", "water",
];

const SIGN_NAMES: Array<{ en: string; zh: string }> = [
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

export const ELEMENT_LABEL_ZH: Record<Element, string> = {
  fire: "火象", earth: "土象", air: "风象", water: "水象",
};
export const ELEMENT_LABEL_EN: Record<Element, string> = {
  fire: "fiery", earth: "earthy", air: "airy", water: "watery",
};

export function elementForSign(signIdx: number): Element {
  return SIGN_ELEMENT[((signIdx % 12) + 12) % 12];
}

/* ------------------------------------------------------------------ */
/* BaZi day-master element                                             */
/* ------------------------------------------------------------------ */

const STEM_ELEMENT: Record<string, BaZiElement> = {
  甲: "wood", 乙: "wood",
  丙: "fire", 丁: "fire",
  戊: "earth", 己: "earth",
  庚: "metal", 辛: "metal",
  壬: "water", 癸: "water",
};

/* ------------------------------------------------------------------ */
/* Snapshot                                                            */
/* ------------------------------------------------------------------ */

export type CalculationSnapshot = {
  calculation_version: string;
  generated_at: string;
  input: {
    date: string | null;
    time: string | null;
    place: string | null;
    lang: "en" | "zh";
  };
  western: {
    status: SystemStatus;
    source: string;
    sun: null | {
      sign_index: number;
      sign_en: string;
      sign_zh: string;
      element: Element;
    };
    notes?: string[];
  };
  bazi: {
    status: SystemStatus;
    source: string;
    pillars: null | { year: string; month: string; day: string; hour: string | null };
    day_master: null | { stem: string; element: BaZiElement };
    zodiac: null | { zh: string; en: string };
  };
  vedic: {
    status: SystemStatus;
    source: string;
    reason?: string;
    chart: VedicChart | null;
  };
  ziwei: {
    status: SystemStatus;
    source: string;
    reason?: string;
    chart: ZiweiChart | null;
  };
  /** Resolved geolocation for the birthplace (null when place unknown). */
  geo: (CityGeo & { place: string }) | null;
};

export type SnapshotInput = {
  date?: string | null;
  time?: string | null;
  place?: string | null;
  lang?: "en" | "zh";
  /** Required to compute Zi Wei Dou Shu; absent → ziwei unavailable. */
  gender?: ZiweiGender | null;
};

export function buildCalculationSnapshot(input: SnapshotInput): CalculationSnapshot {
  const date = (input.date ?? null) || null;
  const time = (input.time ?? null) || null;
  const place = (input.place ?? null) || null;
  const lang = input.lang === "zh" ? "zh" : "en";
  const gender = input.gender ?? null;

  // Geolocation lookup (used by Vedic + potentially for future Bazi true solar time).
  const cityGeo = lookupCityGeo(place);
  const geo = cityGeo && place ? { ...cityGeo, place } : null;

  // Western — tropical Sun sign from the solar date.
  const sunIdx = tropicalSunSignFromDate(date);
  const western: CalculationSnapshot["western"] =
    sunIdx == null
      ? {
          status: "unavailable",
          source: "tropical_sun_by_date",
          sun: null,
          notes: ["missing_or_invalid_birth_date"],
        }
      : {
          status: "ok",
          source: "tropical_sun_by_date",
          sun: {
            sign_index: sunIdx,
            sign_en: SIGN_NAMES[sunIdx].en,
            sign_zh: SIGN_NAMES[sunIdx].zh,
            element: elementForSign(sunIdx),
          },
        };

  // BaZi — via lunar-javascript. Requires date; hour pillar requires time.
  let bazi: CalculationSnapshot["bazi"] = {
    status: "unavailable",
    source: "lunar-javascript",
    pillars: null,
    day_master: null,
    zodiac: null,
  };
  if (date) {
    const info = solarToLunarInfo(date, time ?? undefined);
    if (info) {
      const dayStem = (info.ganzhiDay ?? "").charAt(0);
      const el = STEM_ELEMENT[dayStem] ?? null;
      bazi = {
        status: el ? "ok" : "unavailable",
        source: "lunar-javascript",
        pillars: {
          year: info.ganzhiYear,
          month: info.ganzhiMonth,
          day: info.ganzhiDay,
          hour: info.ganzhiHour ?? null,
        },
        day_master: el ? { stem: dayStem, element: el } : null,
        zodiac: { zh: info.zodiac, en: info.zodiacEn },
      };
    }
  }

  // Vedic — needs date + time + timezone (from place).
  let vedic: CalculationSnapshot["vedic"];
  if (!date || !time) {
    vedic = { status: "unavailable", source: "not_computed", reason: "missing_date_or_time", chart: null };
  } else if (!cityGeo) {
    vedic = { status: "unavailable", source: "not_computed", reason: "birthplace_unresolved", chart: null };
  } else {
    const utc = localBirthToUTC(date, time, cityGeo.tz);
    if (!utc) {
      vedic = { status: "unavailable", source: "not_computed", reason: "invalid_date_or_time", chart: null };
    } else {
      const chart = computeVedicChart({ utc, lat: cityGeo.lat, lng: cityGeo.lng });
      vedic = chart
        ? {
            status: "ok",
            source: chart.source,
            chart,
          }
        : { status: "unavailable", source: "compute_failed", reason: "ephemeris_error", chart: null };
    }
  }

  // Ziwei — needs date + time + gender (no lat/lng needed).
  let ziwei: CalculationSnapshot["ziwei"];
  if (!date || !time) {
    ziwei = { status: "unavailable", source: "not_computed", reason: "missing_date_or_time", chart: null };
  } else if (!gender) {
    ziwei = { status: "unavailable", source: "iztro", reason: "gender_missing", chart: null };
  } else {
    const chart = computeZiweiChart({ solarDate: date, timeHM: time, gender });
    ziwei = chart
      ? { status: "ok", source: chart.source, chart }
      : { status: "unavailable", source: "compute_failed", reason: "ziwei_error", chart: null };
  }

  return {
    calculation_version: CALCULATION_VERSION,
    generated_at: new Date().toISOString(),
    input: { date, time, place, lang },
    western,
    bazi,
    vedic,
    ziwei,
    geo,
  };
}

/* ------------------------------------------------------------------ */
/* Consistency validator                                               */
/* ------------------------------------------------------------------ */

export type ValidationIssue = {
  code: string;
  severity: "warning" | "error";
  message: string;
};

/**
 * Check evidence text against the snapshot.
 * Currently enforces:
 *   - the Sun-element claim in Chinese evidence ("太阳落火象" etc.) must
 *     match the tropical Sun's element from the birth date.
 *   - the BaZi day-master stem cited must appear in the computed pillars.
 */
export function validateEvidenceAgainstSnapshot(
  snap: CalculationSnapshot,
  evidence: { tradition: string; note: string }[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const sunEl = snap.western.sun?.element ?? null;
  if (sunEl) {
    const zhLabel = ELEMENT_LABEL_ZH[sunEl];
    for (const ev of evidence) {
      const note = ev.note ?? "";
      if (!/太阳/.test(note)) continue;
      // Any 火象/水象/土象/风象 mention in a Sun claim must match sunEl.
      const m = note.match(/(火象|水象|土象|风象)/);
      if (m && m[1] !== zhLabel) {
        issues.push({
          code: "sun_element_mismatch",
          severity: "error",
          message: `Sun element claim "${m[1]}" contradicts snapshot Sun in ${snap.western.sun?.sign_zh} (${zhLabel}).`,
        });
      }
    }
  }
  const dayStem = snap.bazi.day_master?.stem ?? null;
  const dayPillar = snap.bazi.pillars?.day ?? null;
  if (dayStem && dayPillar) {
    for (const ev of evidence) {
      if (!/日主|Day Master/i.test(ev.note ?? "")) continue;
      const cited = (ev.note.match(/[甲乙丙丁戊己庚辛壬癸]/) ?? [null])[0];
      if (cited && cited !== dayStem) {
        issues.push({
          code: "day_master_mismatch",
          severity: "error",
          message: `Day-master stem "${cited}" cited in evidence does not match computed day pillar ${dayPillar}.`,
        });
      }
    }
  }

  // Moon Nakshatra check — any 宿/Nakshatra citation must match the snapshot's
  // computed nakshatra (Chinese lunar-mansion name or English name).
  const vedicChart = snap.vedic.chart;
  if (vedicChart) {
    const nakZh = vedicChart.moon.nakshatra_zh;
    const nakEn = vedicChart.moon.nakshatra_en;
    for (const ev of evidence) {
      const note = ev.note ?? "";
      if (!/月亮|Moon|Nakshatra|星宿/i.test(note)) continue;
      const zhCite = note.match(/([\u4e00-\u9fff]{1,2})宿/);
      if (zhCite && zhCite[0] !== nakZh) {
        issues.push({
          code: "moon_nakshatra_mismatch",
          severity: "error",
          message: `Nakshatra claim "${zhCite[0]}" contradicts snapshot Moon Nakshatra ${nakZh} (${nakEn}).`,
        });
      }
      // English form: match one of the 27 names against a citation.
      const enCite = note.match(/\b(Ashwini|Bharani|Krittika|Rohini|Mrigashira|Ardra|Punarvasu|Pushya|Ashlesha|Magha|Purva Phalguni|Uttara Phalguni|Hasta|Chitra|Swati|Vishakha|Anuradha|Jyeshtha|Mula|Purva Ashadha|Uttara Ashadha|Shravana|Dhanishta|Shatabhisha|Purva Bhadrapada|Uttara Bhadrapada|Revati)\b/);
      if (enCite && enCite[1] !== nakEn) {
        issues.push({
          code: "moon_nakshatra_mismatch",
          severity: "error",
          message: `Nakshatra claim "${enCite[1]}" contradicts snapshot Moon Nakshatra ${nakEn}.`,
        });
      }
    }
  }

  // Ziwei 命宫主星 check — any 命宫 claim naming a 主星 must appear in the
  // computed soul-palace major-star list.
  const zw = snap.ziwei.chart;
  if (zw) {
    const soulStars = soulPalaceMajorStars(zw);
    const STARS_14 = ["紫微","天机","太阳","武曲","天同","廉贞","天府","太阴","贪狼","巨门","天相","天梁","七杀","破军"];
    for (const ev of evidence) {
      const note = ev.note ?? "";
      if (!/命宫/.test(note)) continue;
      const cited = STARS_14.filter((s) => note.includes(s));
      for (const c of cited) {
        if (!soulStars.includes(c)) {
          issues.push({
            code: "ziwei_soul_star_mismatch",
            severity: "error",
            message: `命宫主星 "${c}" cited in evidence does not match computed soul palace stars [${soulStars.join(", ") || "空宫"}].`,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Server-side hard gate: which systems must be OK before a paid deep-report
 * is allowed. Any system in this list that comes back "unavailable" means
 * the visitor sees "计算模块尚未完成" and cannot unlock or generate.
 */
export const REQUIRED_SYSTEMS = ["western", "bazi", "vedic", "ziwei"] as const;
export type RequiredSystem = (typeof REQUIRED_SYSTEMS)[number];

export function missingSystems(snap: CalculationSnapshot): RequiredSystem[] {
  const out: RequiredSystem[] = [];
  if (snap.western.status !== "ok") out.push("western");
  if (snap.bazi.status !== "ok") out.push("bazi");
  if (snap.vedic.status !== "ok") out.push("vedic");
  if (snap.ziwei.status !== "ok") out.push("ziwei");
  return out;
}

/** Structured reason per missing system, for precise UI messaging. */
export type MissingReason =
  | "gender_missing"
  | "birthplace_unresolved"
  | "missing_date_or_time"
  | "invalid_date_or_time"
  | "missing_or_invalid_birth_date"
  | "ephemeris_error"
  | "ziwei_error"
  | "compute_failed"
  | "unknown";

export function missingSystemDetails(
  snap: CalculationSnapshot,
): Array<{ system: RequiredSystem; reason: MissingReason }> {
  const out: Array<{ system: RequiredSystem; reason: MissingReason }> = [];
  const norm = (r: string | undefined): MissingReason => {
    switch (r) {
      case "gender_missing":
      case "birthplace_unresolved":
      case "missing_date_or_time":
      case "invalid_date_or_time":
      case "missing_or_invalid_birth_date":
      case "ephemeris_error":
      case "ziwei_error":
      case "compute_failed":
        return r;
      default:
        return "unknown";
    }
  };
  if (snap.western.status !== "ok")
    out.push({ system: "western", reason: norm(snap.western.notes?.[0]) });
  if (snap.bazi.status !== "ok")
    out.push({ system: "bazi", reason: "missing_or_invalid_birth_date" });
  if (snap.vedic.status !== "ok") out.push({ system: "vedic", reason: norm(snap.vedic.reason) });
  if (snap.ziwei.status !== "ok") out.push({ system: "ziwei", reason: norm(snap.ziwei.reason) });
  return out;
}

export function systemDisplayName(sys: RequiredSystem, lang: "en" | "zh"): string {
  const map: Record<RequiredSystem, [string, string]> = {
    western: ["Western astrology", "西方占星"],
    bazi: ["BaZi four pillars", "八字四柱"],
    vedic: ["Vedic Jyotish", "印度占星"],
    ziwei: ["Zi Wei Dou Shu", "紫微斗数"],
  };
  return map[sys][lang === "zh" ? 1 : 0];
}

export function missingReasonMessage(reason: MissingReason, lang: "en" | "zh"): string {
  const map: Record<MissingReason, [string, string]> = {
    gender_missing: [
      "Add birth gender to unlock the Zi Wei calculation.",
      "补充出生性别即可完成紫微斗数计算。",
    ],
    birthplace_unresolved: [
      "Birthplace could not be located — pick a nearby major city to enable this system.",
      "无法解析出生地经纬度，请选择邻近的主要城市以启用该体系。",
    ],
    missing_date_or_time: [
      "Add a precise birth time to enable this time-sensitive system.",
      "请补充准确的出生时间以启用该时辰敏感体系。",
    ],
    invalid_date_or_time: [
      "Birth date or time is invalid — please correct it.",
      "出生日期或时间无效，请核对后重新提交。",
    ],
    missing_or_invalid_birth_date: [
      "Birth date is missing or invalid.",
      "出生日期缺失或无效。",
    ],
    ephemeris_error: [
      "Astronomy engine returned no result. You can retry.",
      "天文引擎暂时未返回结果，可稍后重试。",
    ],
    ziwei_error: [
      "Zi Wei engine failed. You can retry.",
      "紫微引擎返回失败，可稍后重试。",
    ],
    compute_failed: ["Calculation failed. You can retry.", "计算失败，可稍后重试。"],
    unknown: ["Not available yet.", "暂时不可用。"],
  };
  return map[reason][lang === "zh" ? 1 : 0];
}
