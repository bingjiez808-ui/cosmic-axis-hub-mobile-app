/**
 * Cross-tradition CALCULATION SNAPSHOT.
 *
 * A single structured record of the birth-chart values that our four
 * tradition surfaces are allowed to cite. Every downstream reader
 * (free web report, premium AI report, admin QA, tests) must ground
 * evidence text in this snapshot — never in a hard-coded template.
 *
 * Status per system:
 *   - western: OK — tropical Sun sign + element derived from birth date.
 *   - bazi:    OK — four pillars via lunar-javascript, day-master + element.
 *   - vedic:   UNAVAILABLE — no sidereal / Nakshatra / Bhava calculator.
 *   - ziwei:   UNAVAILABLE — no Zi Wei Dou Shu palace calculator.
 *
 * Isomorphic: safe to import from client, server functions, and tests.
 */
import { solarToLunarInfo } from "@/lib/lunar";

export const CALCULATION_VERSION = "calc_snapshot_v1.0.0";

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
    reason: string;
  };
  ziwei: {
    status: SystemStatus;
    source: string;
    reason: string;
  };
};

export type SnapshotInput = {
  date?: string | null;
  time?: string | null;
  place?: string | null;
  lang?: "en" | "zh";
};

export function buildCalculationSnapshot(input: SnapshotInput): CalculationSnapshot {
  const date = (input.date ?? null) || null;
  const time = (input.time ?? null) || null;
  const place = (input.place ?? null) || null;
  const lang = input.lang === "zh" ? "zh" : "en";

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

  return {
    calculation_version: CALCULATION_VERSION,
    generated_at: new Date().toISOString(),
    input: { date, time, place, lang },
    western,
    bazi,
    vedic: {
      status: "unavailable",
      source: "not_implemented",
      reason: "no_sidereal_calculator",
    },
    ziwei: {
      status: "unavailable",
      source: "not_implemented",
      reason: "no_ziwei_calculator",
    },
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

export function systemDisplayName(sys: RequiredSystem, lang: "en" | "zh"): string {
  const map: Record<RequiredSystem, [string, string]> = {
    western: ["Western astrology", "西方占星"],
    bazi: ["BaZi four pillars", "八字四柱"],
    vedic: ["Vedic Jyotish", "印度占星"],
    ziwei: ["Zi Wei Dou Shu", "紫微斗数"],
  };
  return map[sys][lang === "zh" ? 1 : 0];
}
