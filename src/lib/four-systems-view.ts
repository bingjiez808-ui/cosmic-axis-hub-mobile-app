/**
 * four-systems-view — pure view-model derivations for the switchable
 * "命盘 · 四大体系" visualisation.
 *
 * Every function here is deterministic and free of DOM/React so the
 * geometry can be unit-tested. Real numbers come from the calculation
 * snapshot (western / vedic / bazi / ziwei); when a system cannot be
 * computed (missing time, place or gender) the caller renders an
 * explicit "not available" state instead of inventing data.
 */
import type { CalculationSnapshot } from "@/lib/calc-snapshot";
import type { VedicChart } from "@/lib/vedic";
import type { ZiweiChart } from "@/lib/ziwei";

export type SystemKey = "western" | "vedic" | "bazi" | "ziwei";

export const SYSTEM_TABS: Array<{ key: SystemKey; zh: string; en: string; hintZh: string; hintEn: string }> = [
  { key: "western", zh: "西方星盘", en: "Western wheel", hintZh: "十二宫 · 行星落位", hintEn: "12 houses · planets" },
  { key: "vedic", zh: "印度曼陀罗", en: "Vedic mandala", hintZh: "恒星黄道 · 二十七宿", hintEn: "Sidereal · 27 nakshatras" },
  { key: "bazi", zh: "四柱五行", en: "BaZi & Wu Xing", hintZh: "年月日时 · 五行强弱", hintEn: "Four pillars · elements" },
  { key: "ziwei", zh: "紫微十二宫", en: "Zi Wei palaces", hintZh: "命宫 · 十四主星", hintEn: "Soul palace · 14 stars" },
];

export const SIGNS: Array<{ g: string; en: string; zh: string }> = [
  { g: "♈", en: "Aries", zh: "白羊" },
  { g: "♉", en: "Taurus", zh: "金牛" },
  { g: "♊", en: "Gemini", zh: "双子" },
  { g: "♋", en: "Cancer", zh: "巨蟹" },
  { g: "♌", en: "Leo", zh: "狮子" },
  { g: "♍", en: "Virgo", zh: "处女" },
  { g: "♎", en: "Libra", zh: "天秤" },
  { g: "♏", en: "Scorpio", zh: "天蝎" },
  { g: "♐", en: "Sagittarius", zh: "射手" },
  { g: "♑", en: "Capricorn", zh: "摩羯" },
  { g: "♒", en: "Aquarius", zh: "水瓶" },
  { g: "♓", en: "Pisces", zh: "双鱼" },
];

const VEDIC_GLYPH: Record<string, string> = {
  sun: "☉",
  moon: "☽",
  mercury: "☿",
  venus: "♀",
  mars: "♂",
  jupiter: "♃",
  saturn: "♄",
  rahu: "☊",
  ketu: "☋",
};

export type VedicView = {
  planets: Array<{
    key: string;
    glyph: string;
    name: [string, string]; // [en, zh]
    lon: number;            // sidereal longitude 0–360
    sign: number;
    degInSign: number;
    retro: boolean | null;
  }>;
  ascLon: number | null;
  ascSign: number | null;
  nakshatra: { index: number; en: string; zh: string; pada: number } | null;
  ayanamsa: number;
};

export function vedicView(chart: VedicChart | null): VedicView | null {
  if (!chart) return null;
  return {
    planets: chart.planets.map((p) => ({
      key: p.key,
      glyph: VEDIC_GLYPH[p.key] ?? "•",
      name: [p.name_en, p.name_zh],
      lon: p.sid_lon,
      sign: p.sign,
      degInSign: p.deg_in_sign,
      retro: p.retro,
    })),
    ascLon: chart.ascendant?.sid_lon ?? null,
    ascSign: chart.ascendant?.sign ?? null,
    nakshatra: chart.moon
      ? {
          index: chart.moon.nakshatra_index,
          en: chart.moon.nakshatra_en,
          zh: chart.moon.nakshatra_zh,
          pada: chart.moon.pada,
        }
      : null,
    ayanamsa: chart.ayanamsa_deg,
  };
}

/* ------------------------------------------------------------------ */
/* BaZi                                                                */
/* ------------------------------------------------------------------ */

export type WuXing = "wood" | "fire" | "earth" | "metal" | "water";

/** Index into the FiveElements pentagon: [wood, fire, earth, metal, water]. */
export const WUXING_ORDER: WuXing[] = ["wood", "fire", "earth", "metal", "water"];

export const WUXING_LABEL: Record<WuXing, { zh: string; en: string; color: string }> = {
  wood: { zh: "木", en: "Wood", color: "#8fbf7f" },
  fire: { zh: "火", en: "Fire", color: "#e07a5f" },
  earth: { zh: "土", en: "Earth", color: "#d4a373" },
  metal: { zh: "金", en: "Metal", color: "#e6c88a" },
  water: { zh: "水", en: "Water", color: "#7fa9c9" },
};

const STEM_WUXING: Record<string, WuXing> = {
  甲: "wood", 乙: "wood",
  丙: "fire", 丁: "fire",
  戊: "earth", 己: "earth",
  庚: "metal", 辛: "metal",
  壬: "water", 癸: "water",
};

const BRANCH_WUXING: Record<string, WuXing> = {
  子: "water", 丑: "earth", 寅: "wood", 卯: "wood",
  辰: "earth", 巳: "fire", 午: "fire", 未: "earth",
  申: "metal", 酉: "metal", 戌: "earth", 亥: "water",
};

const BRANCH_ANIMAL: Record<string, { zh: string; en: string }> = {
  子: { zh: "鼠", en: "Rat" }, 丑: { zh: "牛", en: "Ox" },
  寅: { zh: "虎", en: "Tiger" }, 卯: { zh: "兔", en: "Rabbit" },
  辰: { zh: "龙", en: "Dragon" }, 巳: { zh: "蛇", en: "Snake" },
  午: { zh: "马", en: "Horse" }, 未: { zh: "羊", en: "Goat" },
  申: { zh: "猴", en: "Monkey" }, 酉: { zh: "鸡", en: "Rooster" },
  戌: { zh: "狗", en: "Dog" }, 亥: { zh: "猪", en: "Pig" },
};

export type BaziPillarView = {
  slot: "year" | "month" | "day" | "hour";
  label: [string, string];
  stem: string;
  branch: string;
  stemElement: WuXing | null;
  branchElement: WuXing | null;
  animal: { zh: string; en: string } | null;
  isDayMaster: boolean;
};

export type BaziView = {
  pillars: BaziPillarView[];
  /** Normalised 0–1 strengths in WUXING_ORDER, for the pentagon. */
  strengths: [number, number, number, number, number];
  counts: Record<WuXing, number>;
  dayMaster: { stem: string; element: WuXing | null } | null;
  missing: WuXing[];
};

export function baziView(bazi: CalculationSnapshot["bazi"]): BaziView | null {
  const p = bazi.pillars;
  if (!p) return null;
  const slots: Array<{ slot: BaziPillarView["slot"]; gz: string | null; label: [string, string] }> = [
    { slot: "year", gz: p.year, label: ["Year", "年柱"] },
    { slot: "month", gz: p.month, label: ["Month", "月柱"] },
    { slot: "day", gz: p.day, label: ["Day", "日柱"] },
    { slot: "hour", gz: p.hour, label: ["Hour", "时柱"] },
  ];
  const counts: Record<WuXing, number> = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
  const pillars: BaziPillarView[] = [];
  for (const s of slots) {
    if (!s.gz) continue;
    const stem = s.gz.charAt(0);
    const branch = s.gz.charAt(1);
    const se = STEM_WUXING[stem] ?? null;
    const be = BRANCH_WUXING[branch] ?? null;
    if (se) counts[se] += 1;
    if (be) counts[be] += 1;
    pillars.push({
      slot: s.slot,
      label: s.label,
      stem,
      branch,
      stemElement: se,
      branchElement: be,
      animal: BRANCH_ANIMAL[branch] ?? null,
      isDayMaster: s.slot === "day",
    });
  }
  if (pillars.length === 0) return null;
  const max = Math.max(1, ...WUXING_ORDER.map((k) => counts[k]));
  const strengths = WUXING_ORDER.map((k) => counts[k] / max) as [number, number, number, number, number];
  return {
    pillars,
    strengths,
    counts,
    dayMaster: bazi.day_master
      ? { stem: bazi.day_master.stem, element: (bazi.day_master.element as WuXing) ?? null }
      : null,
    missing: WUXING_ORDER.filter((k) => counts[k] === 0),
  };
}

/* ------------------------------------------------------------------ */
/* Zi Wei — classical 4×4 square layout                                */
/* ------------------------------------------------------------------ */

/**
 * iztro returns palaces indexed by earthly branch starting at 寅 (index 0).
 * The classical square places the twelve branches clockwise around the
 * border of a 4×4 grid. `ZIWEI_GRID_CELLS[i]` is the [col,row] cell for the
 * branch at position i of the 寅-first order.
 */
export const ZIWEI_GRID_CELLS: Array<[number, number]> = [
  [0, 3], // 寅  (bottom-left corner)
  [0, 2], // 卯
  [0, 1], // 辰
  [0, 0], // 巳
  [1, 0], // 午
  [2, 0], // 未
  [3, 0], // 申
  [3, 1], // 酉
  [3, 2], // 戌
  [3, 3], // 亥
  [2, 3], // 子
  [1, 3], // 丑
];

export type ZiweiCell = {
  col: number;
  row: number;
  palace: ZiweiChart["palaces"][number];
  isSoul: boolean;
};

export function ziweiCells(chart: ZiweiChart | null): ZiweiCell[] {
  if (!chart) return [];
  return chart.palaces.slice(0, 12).map((palace, i) => {
    const [col, row] = ZIWEI_GRID_CELLS[i] ?? [0, 0];
    return { col, row, palace, isSoul: i === chart.soul_palace_index };
  });
}

/** Which systems can actually be drawn for this snapshot. */
export function systemAvailability(snapshot: CalculationSnapshot): Record<SystemKey, boolean> {
  return {
    western: Boolean(snapshot.input.date),
    vedic: snapshot.vedic.status === "ok" && !!snapshot.vedic.chart,
    bazi: snapshot.bazi.status === "ok" && !!snapshot.bazi.pillars,
    ziwei: snapshot.ziwei.status === "ok" && !!snapshot.ziwei.chart,
  };
}

/** Human explanation for a system that cannot be drawn. */
export function unavailableReason(
  snapshot: CalculationSnapshot,
  key: SystemKey,
  lang: "en" | "zh",
): string {
  const zh = lang === "zh";
  if (key === "western") {
    return zh ? "需要出生日期才能推算星盘。" : "A birth date is required for the natal wheel.";
  }
  if (key === "bazi") {
    return zh ? "需要出生日期才能排四柱。" : "A birth date is required for the four pillars.";
  }
  const reason = key === "vedic" ? snapshot.vedic.reason : snapshot.ziwei.reason;
  switch (reason) {
    case "missing_date_or_time":
      return zh ? "需要出生日期与出生时刻。" : "Birth date and time are required.";
    case "birthplace_unresolved":
      return zh ? "需要可识别的出生地（用于时区与上升）。" : "A recognised birthplace is required (timezone & ascendant).";
    case "gender_missing":
      return zh ? "紫微斗数需要性别参数。" : "Zi Wei Dou Shu requires the gender field.";
    default:
      return zh ? "这一体系暂时无法推算。" : "This system cannot be computed right now.";
  }
}
