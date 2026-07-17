/**
 * BaZi luck pillars (大运) + yearly cycles (流年) via lunar-javascript.
 *
 * Uses `EightChar.getYun(genderCode, sect?)` — a documented, deterministic
 * API in `lunar-javascript@1.7.7`. Nothing here is invented; when the
 * library refuses (invalid date/time), we return null and callers mark
 * the module unavailable rather than filling in fake pillars.
 *
 * Gender mapping (lunar-javascript convention):
 *   1 = male, 0 = female. Forward/backward order is determined jointly
 *   by gender and year-stem yin/yang; we just read `Yun.isForward()`.
 *
 * We deliberately do NOT expose:
 *   - 流月 / 流日 / 流时 — the DaYun object has no getLiuYue/getLiuRi
 *     method in this library version. See BAZI_UNAVAILABLE below.
 */
// @ts-expect-error lunar-javascript ships without types
import { Solar } from "lunar-javascript";

export type BaZiGender = "male" | "female";

export type BaZiLiuNian = {
  year: number;
  gan_zhi: string;
  nominal_age: number;
};

export type BaZiLuckPillar = {
  /** 0-based order inside `pillars`. Index 0 is the *first real* DaYun
   * (the pre-luck child period is exposed separately under `pre_luck`). */
  index: number;
  gan_zhi: string;
  start_year: number;
  end_year: number;
  start_age: number;
  end_age: number;
  /** 旬 (60-cycle group) and 旬空 (empty branches) — bonus classical fields. */
  xun: string | null;
  xun_kong: string | null;
  /** Liu-nian entries covering this decade of luck. */
  liu_nian: BaZiLiuNian[];
};

export type BaZiLuck = {
  source: string;
  gender: BaZiGender;
  /** Whether the DaYun sequence runs forward (顺行) or backward (逆行). */
  forward_order: boolean;
  /** 起运 — when the luck cycles begin, from birth. */
  start: {
    solar_date: string;   // YYYY-MM-DD
    year: number;
    month: number;
    day: number;
    /** How many solar years from birth until the first luck pillar begins. */
    offset_years: number;
    offset_months: number;
    offset_days: number;
    /** 起运虚岁 — Chinese nominal age at start. */
    nominal_start_age: number;
  };
  /** Pre-luck (起运前) period between birth and start_solar_date. */
  pre_luck: null | {
    start_year: number;
    end_year: number;
    start_age: number;
    end_age: number;
  };
  pillars: BaZiLuckPillar[];
};

/** Modules that BaZi cannot yet resolve locally from lunar-javascript. */
export const BAZI_UNAVAILABLE = ["bazi_liu_yue", "bazi_liu_ri", "bazi_liu_shi"] as const;

type YunLike = {
  getStartSolar: () => { toYmd: () => string; getYear: () => number; getMonth: () => number; getDay: () => number };
  getStartYear: () => number;
  getStartMonth: () => number;
  getStartDay: () => number;
  isForward: () => boolean;
  getDaYun: () => Array<{
    getIndex: () => number;
    getGanZhi: () => string;
    getStartYear: () => number;
    getEndYear: () => number;
    getStartAge: () => number;
    getEndAge: () => number;
    getXun: () => string;
    getXunKong: () => string;
    getLiuNian: () => Array<{ getYear: () => number; getGanZhi: () => string; getAge: () => number }>;
  }>;
};

/**
 * Compute DaYun / LiuNian for a birth. `time` is required — without an
 * hour pillar lunar-javascript still fills a default zi-time, but the
 * classical 起运 rule reads the hour, so we refuse silently instead of
 * returning misleading data.
 */
export function computeBaZiLuck(opts: {
  date: string;        // YYYY-MM-DD (solar local)
  time: string;        // HH:MM (24h local)
  gender: BaZiGender;
}): BaZiLuck | null {
  const dm = opts.date.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const tm = opts.time.match(/^(\d{1,2}):(\d{2})$/);
  if (!dm || !tm) return null;
  const [, y, mo, d] = dm;
  const [, hh, mm] = tm;
  try {
    const solar = Solar.fromYmdHms(+y, +mo, +d, +hh, +mm, 0);
    const ec = solar.getLunar().getEightChar();
    const genderCode = opts.gender === "male" ? 1 : 0;
    const yun: YunLike = ec.getYun(genderCode);
    const startSolar = yun.getStartSolar();
    const startYear = startSolar.getYear();
    const startMonth = startSolar.getMonth();
    const startDay = startSolar.getDay();
    const forward = !!yun.isForward();

    const all = yun.getDaYun();
    // Index 0 in lunar-javascript is the pre-luck child period (ganZhi empty).
    // Real DaYun start at index 1. We surface both explicitly.
    const preRaw = all[0];
    let pre_luck: BaZiLuck["pre_luck"] = null;
    if (preRaw && preRaw.getGanZhi() === "") {
      pre_luck = {
        start_year: preRaw.getStartYear(),
        end_year: preRaw.getEndYear(),
        start_age: preRaw.getStartAge(),
        end_age: preRaw.getEndAge(),
      };
    }
    const startIndex = pre_luck ? 1 : 0;
    const realPillars = all.slice(startIndex);
    const pillars: BaZiLuckPillar[] = realPillars.map((p, i) => ({
      index: i,
      gan_zhi: p.getGanZhi(),
      start_year: p.getStartYear(),
      end_year: p.getEndYear(),
      start_age: p.getStartAge(),
      end_age: p.getEndAge(),
      xun: safeCall(() => p.getXun()),
      xun_kong: safeCall(() => p.getXunKong()),
      liu_nian: p.getLiuNian().map((ln) => ({
        year: ln.getYear(),
        gan_zhi: ln.getGanZhi(),
        nominal_age: ln.getAge(),
      })),
    }));

    const firstPillar = pillars[0];
    const nominal_start_age = firstPillar?.start_age ?? preRaw?.getEndAge?.() ?? 0;

    return {
      source: "lunar-javascript@1.7.7 EightChar.getYun",
      gender: opts.gender,
      forward_order: forward,
      start: {
        solar_date: startSolar.toYmd(),
        year: startYear,
        month: startMonth,
        day: startDay,
        offset_years: yun.getStartYear(),
        offset_months: yun.getStartMonth(),
        offset_days: yun.getStartDay(),
        nominal_start_age,
      },
      pre_luck,
      pillars,
    };
  } catch (e) {
    console.warn("bazi luck compute failed", e);
    return null;
  }
}

function safeCall<T>(fn: () => T): T | null {
  try {
    const v = fn();
    return v == null || v === "" ? null : v;
  } catch {
    return null;
  }
}

/**
 * Find the luck pillar covering a given calendar year. Returns null when
 * the year is before 起运 (falls in `pre_luck`) or beyond the last pillar.
 */
export function luckPillarForYear(luck: BaZiLuck, year: number): BaZiLuckPillar | null {
  for (const p of luck.pillars) {
    if (year >= p.start_year && year <= p.end_year) return p;
  }
  return null;
}

/** Total years spanned by all real luck pillars (should be 10 × pillars.length). */
export function totalLuckYears(luck: BaZiLuck): number {
  return luck.pillars.reduce((s, p) => s + (p.end_year - p.start_year + 1), 0);
}
