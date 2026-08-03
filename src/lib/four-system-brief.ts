/**
 * four-system-brief — the single canonical contract for "every AI call
 * that reads a natal chart must receive all four systems, and must
 * synthesise across them".
 *
 * Four systems: 西方占星 (western) · 八字 (bazi) · 印度占星/Jyotish (vedic)
 * · 紫微斗数 (ziwei).
 *
 * Two halves:
 *   1. `buildFourSystemFacts` — deterministic, client-side. Turns a
 *      calculation snapshot into the two prose lines (vedic / ziwei)
 *      that the server prompts need, plus a coverage map.
 *   2. `systemCoverageFromFacts` / `coverageDirective` /
 *      `crossSystemDirective` / `concernFocusDirective` — server-side
 *      prompt fragments so every generator (report, outlook, key events,
 *      oracle, premium) enforces the *same* rules.
 *
 * 0 AI tokens are spent here; every string is a literal.
 */
import type { CalculationSnapshot } from "@/lib/calc-snapshot";
import { CONCERNS, isConcernKey, type ConcernKey } from "@/lib/concern-guidance-v1";
import { CONCERN_READING_GUIDES } from "@/lib/concern-reading-guide";

export const FOUR_SYSTEM_KEYS = ["western", "bazi", "vedic", "ziwei"] as const;
export type FourSystemKey = (typeof FOUR_SYSTEM_KEYS)[number];

export type SystemCoverage = Record<FourSystemKey, boolean>;

export type FourSystemFacts = {
  /** Prose line describing the real sidereal chart, or undefined. */
  vedic?: string;
  /** Prose line describing the real Zi Wei chart, or undefined. */
  ziwei?: string;
  coverage: SystemCoverage;
  missing: FourSystemKey[];
  complete: boolean;
};

const SYSTEM_LABEL: Record<FourSystemKey, { zh: string; en: string }> = {
  western: { zh: "西方占星", en: "Western astrology" },
  bazi: { zh: "八字", en: "BaZi" },
  vedic: { zh: "印度占星", en: "Jyotish" },
  ziwei: { zh: "紫微斗数", en: "Zi Wei Dou Shu" },
};

export function systemLabel(key: FourSystemKey, lang: "en" | "zh") {
  return SYSTEM_LABEL[key][lang === "zh" ? "zh" : "en"];
}

/** Client side: derive the two extra prose lines + coverage from a snapshot. */
export function buildFourSystemFacts(snap: CalculationSnapshot): FourSystemFacts {
  const v = snap.vedic.status === "ok" ? snap.vedic.chart : null;
  const z = snap.ziwei.status === "ok" ? snap.ziwei.chart : null;

  const vedic = v
    ? `sidereal Ascendant ${v.ascendant?.sign_en ?? "n/a"}; Moon ${v.moon.nakshatra_en} pada ${v.moon.pada} (lord ${v.moon.lord}); Vimshottari dasa ${v.vimshottari[0]?.lord ?? v.moon.lord}; planets ${v.planets
        .map((p) => `${p.name_en} sign#${p.sign + 1} ${Math.round(p.deg_in_sign)}°`)
        .join(", ")}`
    : undefined;

  const ziwei = z
    ? `five-elements class ${z.five_elements_class}; body star ${z.body}; palaces ${z.palaces
        .map((p) => `${p.name}(${p.earthly_branch}): ${p.major_stars.map((s) => s.name).join("·") || "空宫"}`)
        .join("; ")}`
    : undefined;

  const coverage: SystemCoverage = {
    western: snap.western.status === "ok",
    bazi: snap.bazi.status === "ok",
    vedic: Boolean(vedic),
    ziwei: Boolean(ziwei),
  };
  const missing = FOUR_SYSTEM_KEYS.filter((k) => !coverage[k]);
  return { vedic, ziwei, coverage, missing, complete: missing.length === 0 };
}

/** Server side: the prompt only ever sees strings, so derive coverage from them. */
export function systemCoverageFromFacts(input: {
  planets?: { name: string; sign: string }[] | null;
  bazi?: string | null;
  vedic?: string | null;
  ziwei?: string | null;
}): { coverage: SystemCoverage; missing: FourSystemKey[]; complete: boolean } {
  const coverage: SystemCoverage = {
    western: Array.isArray(input.planets) && input.planets.length > 0,
    bazi: Boolean(input.bazi && input.bazi.trim()),
    vedic: Boolean(input.vedic && input.vedic.trim()),
    ziwei: Boolean(input.ziwei && input.ziwei.trim()),
  };
  const missing = FOUR_SYSTEM_KEYS.filter((k) => !coverage[k]);
  return { coverage, missing, complete: missing.length === 0 };
}

/** A fact line naming exactly which of the four systems are available. */
export function coverageDirective(missing: FourSystemKey[], lang: "en" | "zh") {
  const isZh = lang === "zh";
  const present = FOUR_SYSTEM_KEYS.filter((k) => !missing.includes(k)).map((k) => systemLabel(k, lang));
  if (missing.length === 0) {
    return isZh
      ? `体系覆盖：四大体系齐全（${present.join(" / ")}）。每一段综合都必须同时用到这四套语言。`
      : `System coverage: all four systems are present (${present.join(" / ")}). Every synthesis must draw on all four.`;
  }
  const gone = missing.map((k) => systemLabel(k, lang));
  return isZh
    ? `体系覆盖：可用 ${present.join(" / ") || "无"}；缺失 ${gone.join(" / ")}。缺失体系必须写明「本次缺少 X 排盘，以下为其余体系的合鸣」，绝不可虚构该体系的落位。`
    : `System coverage: available ${present.join(" / ") || "none"}; missing ${gone.join(" / ")}. For a missing system, state plainly that its chart is unavailable this time — never invent placements for it.`;
}

/** The cross-system synthesis contract shared by every generator. */
export function crossSystemDirective(lang: "en" | "zh") {
  return lang === "zh"
    ? `跨体系综合（硬性）：
- 每个维度的 evidence 必须四条，依次为西方占星 / 印度占星 / 八字 / 紫微，每条引用一个真实落位（星座宫位、Nakshatra·pada·大运、日主干支十神、宫位主星）。
- synthesis 必须是真正的"综合"：明确点名哪 2–3 个体系在此处**指向同一件事**（共振），以及哪个体系**给出不同侧写**（张力），并给出一句合读结论。禁止把四段各说各话拼在一起。
- 只有单一体系支撑的说法，必须标注"单体系参考"。
- 不虚构缺失体系的排盘。`
    : `Cross-system synthesis (hard rules):
- Each dimension's evidence has exactly four entries, in order: Western astrology / Jyotish / BaZi / Zi Wei, each citing one real placement (sign+house, Nakshatra·pada·dasha, day-master stem & Ten God, palace + main star).
- \`synthesis\` must actually synthesise: name which 2–3 systems **converge** on the same reading here, and which system **reads it differently** (the tension), then give one combined conclusion. Four parallel monologues are not a synthesis.
- Anything supported by only one system must be labelled "single-system reference".
- Never invent a chart for a missing system.`;
}

/**
 * The visitor arrived through "今天你带着什么问题来到这里" and was shown three
 * "这次阅读会帮你分清" cards. The report MUST answer those three, so the
 * promise made on the homepage is the promise the reading keeps.
 */
export function concernFocusDirective(concern: unknown, lang: "en" | "zh"): string {
  if (!isConcernKey(concern)) return "";
  const key = concern as ConcernKey;
  const rec = CONCERNS[key];
  const guide = CONCERN_READING_GUIDES[key];
  const isZh = lang === "zh";
  const l = (b: { zh: string; en: string }) => (isZh ? b.zh : b.en);
  const cards = guide.readingIndexes
    .map((c, i) => `  ${i + 1}. ${l(c.title)} —— ${l(c.description)}`)
    .join("\n");
  return isZh
    ? `\n来访者带着的问题：「${l(rec.question)}」（对应章节：${l(guide.reportSectionLabel)}）
首页已向他承诺「这次阅读会帮你分清」三件事，本次生成必须在正文中逐条给出答案（可分散在 synthesis / plain / details 中，但三条都要被真实回答，且每条至少绑定一个真实命盘事实）：
${cards}\n`
    : `\nThe visitor arrived with this question: "${l(rec.question)}" (mapped chapter: ${l(guide.reportSectionLabel)}).
The homepage already promised them that "this reading will help you tell apart" three things. This generation must answer all three in the body (they may be spread across synthesis / plain / details), each anchored to a real chart fact:
${cards}\n`;
}
