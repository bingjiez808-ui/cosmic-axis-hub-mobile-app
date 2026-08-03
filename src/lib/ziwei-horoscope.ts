/**
 * Zi Wei horoscope (运限) — 十年大限 / 流年 / 流月 / 流日 / 流时 via iztro.
 *
 * All fields come straight out of `IFunctionalAstrolabe.horoscope(date, timeIndex)`
 * — `iztro@2.5.8`. We surface only what the library actually returns and
 * refuse to invent anything else.
 *
 * v4 adds `daily` (流日) and `hourly` (流时). `hourly` is populated only
 * when a target time index is supplied via `as_of_time`; otherwise we fall
 * back to the birth time index for daily so it stays chronologically
 * consistent with the natal chart, and leave `hourly` null.
 */
import { astro } from "iztro";
import { hourToTimeIndex, type ZiweiGender } from "./ziwei";

export type ZiweiHoroscopeItem = {
  index: number;
  name: string;
  heavenly_stem: string;
  earthly_branch: string;
  palace_names: string[];
  mutagen: string[];
};

export type ZiweiDecadal = ZiweiHoroscopeItem & {
  age_range: [number, number];
};

export type ZiweiHoroscope = {
  source: string;
  as_of_date: string;
  /** Target time index (0..11, 子..亥). Null when hourly not evaluated. */
  as_of_time_index: number | null;
  solar_date: string;
  lunar_date: string;
  decadal: ZiweiDecadal;
  yearly: ZiweiHoroscopeItem & {
    sui_qian_12: string[];
    jiang_qian_12: string[];
  };
  monthly: ZiweiHoroscopeItem;
  /** v4: 流日 — populated straight from iztro horoscope.daily. */
  daily: ZiweiHoroscopeItem | null;
  /** v4: 流时 — populated only when as_of_time is supplied. */
  hourly: ZiweiHoroscopeItem | null;
};

type Palace = { heavenlyStem?: string; earthlyBranch?: string };
type HoroscopeItemRaw = {
  index: number; name: string;
  heavenlyStem: string; earthlyBranch: string;
  palaceNames: string[]; mutagen: string[];
};
type Horoscope = {
  lunarDate: string;
  solarDate: string;
  decadal: HoroscopeItemRaw;
  yearly: HoroscopeItemRaw & { yearlyDecStar: { jiangqian12: string[]; suiqian12: string[] } };
  monthly: HoroscopeItemRaw;
  daily?: HoroscopeItemRaw;
  hourly?: HoroscopeItemRaw;
};

function projectItem(raw: HoroscopeItemRaw | undefined): ZiweiHoroscopeItem | null {
  if (!raw) return null;
  return {
    index: raw.index,
    name: raw.name,
    heavenly_stem: raw.heavenlyStem,
    earthly_branch: raw.earthlyBranch,
    palace_names: raw.palaceNames,
    mutagen: raw.mutagen,
  };
}

export function computeZiweiHoroscope(opts: {
  birth_solar_date: string;
  birth_time: string;
  gender: ZiweiGender;
  as_of_date: string;
  as_of_time?: string | null;
}): ZiweiHoroscope | null {
  const idx = hourToTimeIndex(opts.birth_time);
  if (idx == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.as_of_date)) return null;
  const targetIdx = opts.as_of_time ? hourToTimeIndex(opts.as_of_time) : null;
  const effectiveTargetIdx = targetIdx ?? idx;
  try {
    const chart = astro.bySolar(
      opts.birth_solar_date, idx,
      opts.gender === "male" ? "male" : "female",
      true, "zh-CN",
    );
    const h = chart.horoscope(opts.as_of_date, effectiveTargetIdx) as Horoscope;
    const decadalPalace = chart.palaces?.[h.decadal.index] as (Palace & { decadal?: { range?: [number, number] } }) | undefined;
    const range = decadalPalace?.decadal?.range as [number, number] | undefined;
    return {
      source: "iztro@2.5.8 horoscope()",
      as_of_date: opts.as_of_date,
      as_of_time_index: targetIdx,
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
      monthly: projectItem(h.monthly)!,
      daily: projectItem(h.daily),
      hourly: targetIdx == null ? null : projectItem(h.hourly),
    };
  } catch (e) {
    console.warn("ziwei horoscope compute failed", e);
    return null;
  }
}
