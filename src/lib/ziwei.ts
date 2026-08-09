/**
 * Zi Wei Dou Shu (紫微斗数) calculator, backed by the `iztro` library
 * (SylarLong, MIT). iztro implements the classical 三合派 rules: 五行局,
 * 命宫/身宫/紫微 placement, 14 主星 distribution, 四化, plus solar↔lunar
 * conversion via its bundled lunar calendar.
 *
 * We expose only the fields we cite in evidence, and record source/version
 * so consumers can audit which computation produced the palace layout.
 */
import { astro } from "iztro";

export type ZiweiGender = "male" | "female";

export type ZiweiPalace = {
  index: number;                // 0..11 in iztro order
  name: string;                 // 命宫 / 兄弟 / … / 父母
  heavenly_stem: string;
  earthly_branch: string;
  is_body_palace: boolean;
  major_stars: Array<{ name: string; mutagen: string | null; brightness: string | null }>;
  minor_stars: string[];
};

export type ZiweiChart = {
  source: string;
  solar_date: string;      // YYYY-MM-DD (solar birth date)
  lunar_date: string;      // rendered lunar date
  time_index: number;      // 0..11 iztro time slot
  gender: ZiweiGender;
  soul: string;            // 命宫主星
  body: string;            // 身宫主星
  five_elements_class: string; // 五行局
  palaces: ZiweiPalace[];
  /** The palace that hosts 命宫 — index into `palaces`. */
  soul_palace_index: number;
};

/**
 * iztro time-slot convention:
 *   0 = 早子 (00:00–00:59)
 *   1 = 丑 (01:00–02:59)
 *   2 = 寅 (03:00–04:59)
 *   3 = 卯 (05:00–06:59)
 *   4 = 辰 (07:00–08:59)
 *   5 = 巳 (09:00–10:59)
 *   6 = 午 (11:00–12:59)
 *   7 = 未 (13:00–14:59)
 *   8 = 申 (15:00–16:59)
 *   9 = 酉 (17:00–18:59)
 *  10 = 戌 (19:00–20:59)
 *  11 = 亥 (21:00–22:59)
 *  12 = 晚子 (23:00–23:59) — iztro accepts this
 */
export function hourToTimeIndex(timeHM: string): number | null {
  const m = timeHM.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = +m[1];
  if (hh < 0 || hh > 23) return null;
  if (hh === 23) return 12;
  return Math.floor((hh + 1) / 2);
}

export function computeZiweiChart(opts: {
  solarDate: string;   // YYYY-MM-DD (local solar)
  timeHM: string;      // HH:MM (local)
  gender: ZiweiGender;
  lang?: "en" | "zh";
}): ZiweiChart | null {
  const idx = hourToTimeIndex(opts.timeHM);
  if (idx == null) return null;
  try {
    const chart = astro.bySolar(
      opts.solarDate,
      idx,
      opts.gender === "male" ? "male" : "female",
      true,             // fixLeap
      "zh-CN",
    );
    const palaces: ZiweiPalace[] = chart.palaces.map((p: {
      name: string;
      heavenlyStem: string;
      earthlyBranch: string;
      isBodyPalace: boolean;
      majorStars: Array<{ name: string; mutagen?: string; brightness?: string }>;
      minorStars: Array<{ name: string }>;
    }, i: number) => ({
      index: i,
      name: p.name,
      heavenly_stem: p.heavenlyStem,
      earthly_branch: p.earthlyBranch,
      is_body_palace: !!p.isBodyPalace,
      major_stars: (p.majorStars ?? []).map((s) => ({
        name: s.name,
        mutagen: s.mutagen && s.mutagen.length > 0 ? s.mutagen : null,
        brightness: s.brightness ?? null,
      })),
      minor_stars: (p.minorStars ?? []).map((s) => s.name),
    }));
    const soulIdx = palaces.findIndex((p) => p.name === "命宫");
    return {
      source: "iztro@2 (三合派)",
      solar_date: opts.solarDate,
      lunar_date: chart.lunarDate,
      time_index: idx,
      gender: opts.gender,
      soul: chart.soul,
      body: chart.body,
      five_elements_class: chart.fiveElementsClass,
      palaces,
      soul_palace_index: soulIdx,
    };
  } catch (e) {
    console.warn("ziwei compute failed", e);
    return null;
  }
}

export function soulPalaceMajorStars(chart: ZiweiChart): string[] {
  const p = chart.palaces[chart.soul_palace_index];
  if (!p) return [];
  return p.major_stars.map((s) => s.name);
}
