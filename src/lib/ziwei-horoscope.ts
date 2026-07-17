/**
 * Zi Wei horoscope (运限) — 十年大限 / 流年 / 流月 via iztro.
 *
 * All fields come straight out of `IFunctionalAstrolabe.horoscope(date)`
 * — `iztro@2.5.8`. We surface only what the library actually returns
 * (heavenlyStem, earthlyBranch, palaceNames rotation, mutagen list) and
 * refuse to invent anything else.
 *
 * We deliberately do NOT expose:
 *   - 流日 / 流时 — iztro can return them, but we have no requirement
 *     for daily/hourly readings in the deep report; kept unavailable.
 */
import { astro } from "iztro";
import { hourToTimeIndex, type ZiweiGender } from "./ziwei";

export type ZiweiHoroscopeItem = {
  /** iztro palace index 0..11 the item currently occupies. */
  index: number;
  name: string;
  heavenly_stem: string;
  earthly_branch: string;
  /** 12 palace names rotated to start at `index`. */
  palace_names: string[];
  /** Mutagen list (order: 化禄, 化权, 化科, 化忌) — surfaced verbatim from iztro. */
  mutagen: string[];
};

export type ZiweiDecadal = ZiweiHoroscopeItem & {
  /** Age range this 大限 covers. */
  age_range: [number, number];
};

export type ZiweiHoroscope = {
  source: string;
  /** The calendar day the horoscope was evaluated for (YYYY-MM-DD). */
  as_of_date: string;
  solar_date: string;
  lunar_date: string;
  decadal: ZiweiDecadal;
  yearly: ZiweiHoroscopeItem & {
    /** 岁前十二神 / 将前十二神 — iztro's yearly-cycle helpers. */
    sui_qian_12: string[];
    jiang_qian_12: string[];
  };
  monthly: ZiweiHoroscopeItem;
};

/** Modules we refuse to compute locally (no library-backed source). */
export const ZIWEI_HOROSCOPE_UNAVAILABLE = ["ziwei_liu_ri", "ziwei_liu_shi"] as const;

type Palace = { heavenlyStem?: string; earthlyBranch?: string };
type Horoscope = {
  lunarDate: string;
  solarDate: string;
  decadal: { index: number; name: string; heavenlyStem: string; earthlyBranch: string; palaceNames: string[]; mutagen: string[] };
  yearly: {
    index: number; name: string; heavenlyStem: string; earthlyBranch: string; palaceNames: string[]; mutagen: string[];
    yearlyDecStar: { jiangqian12: string[]; suiqian12: string[] };
  };
  monthly: { index: number; name: string; heavenlyStem: string; earthlyBranch: string; palaceNames: string[]; mutagen: string[] };
};

/**
 * Compute the 运限 snapshot for a given calendar day.
 * `asOfDate` — a YYYY-MM-DD string (defaults to today). This is NOT part
 * of the immutable birth chart; callers may cache it separately.
 */
export function computeZiweiHoroscope(opts: {
  birth_solar_date: string;
  birth_time: string;
  gender: ZiweiGender;
  as_of_date: string;  // YYYY-MM-DD
}): ZiweiHoroscope | null {
  const idx = hourToTimeIndex(opts.birth_time);
  if (idx == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.as_of_date)) return null;
  try {
    const chart = astro.bySolar(
      opts.birth_solar_date, idx,
      opts.gender === "male" ? "male" : "female",
      true, "zh-CN",
    );
    const h = chart.horoscope(opts.as_of_date) as Horoscope;
    // iztro's Decadal type carries range on palace but the returned
    // HoroscopeItem for decadal doesn't include it directly. We look
    // up the current 大限 palace on the astrolabe to grab its range.
    const decadalPalace = chart.palaces?.[h.decadal.index] as (Palace & { decadal?: { range?: [number, number] } }) | undefined;
    const range = decadalPalace?.decadal?.range as [number, number] | undefined;
    return {
      source: "iztro@2.5.8 horoscope()",
      as_of_date: opts.as_of_date,
      solar_date: h.solarDate,
      lunar_date: h.lunarDate,
      decadal: {
        index: h.decadal.index,
        name: h.decadal.name,
        heavenly_stem: h.decadal.heavenlyStem,
        earthly_branch: h.decadal.earthlyBranch,
        palace_names: h.decadal.palaceNames,
        mutagen: h.decadal.mutagen,
        age_range: range ?? [0, 0],
      },
      yearly: {
        index: h.yearly.index,
        name: h.yearly.name,
        heavenly_stem: h.yearly.heavenlyStem,
        earthly_branch: h.yearly.earthlyBranch,
        palace_names: h.yearly.palaceNames,
        mutagen: h.yearly.mutagen,
        sui_qian_12: h.yearly.yearlyDecStar?.suiqian12 ?? [],
        jiang_qian_12: h.yearly.yearlyDecStar?.jiangqian12 ?? [],
      },
      monthly: {
        index: h.monthly.index,
        name: h.monthly.name,
        heavenly_stem: h.monthly.heavenlyStem,
        earthly_branch: h.monthly.earthlyBranch,
        palace_names: h.monthly.palaceNames,
        mutagen: h.monthly.mutagen,
      },
    };
  } catch (e) {
    console.warn("ziwei horoscope compute failed", e);
    return null;
  }
}
