/**
 * Deterministic per-year timeline reading.
 *
 * INPUT → FACTS → INTERPRETATION → ADVICE. The calculators (BaZi luck,
 * Vimshottari, Ziwei horoscope, Western transits) are the ONLY source of
 * truth. We never call an LLM here, and we never fabricate a system when
 * facts are missing — we flag it `available: false` and drop it from
 * the composite weight.
 *
 * Composite requires ≥ 2 available systems, otherwise the row is marked
 * `reference_only` and the UI shows a single-system reference.
 *
 * Safety: interpretation strings are condition-based. No medical, no death,
 * no guaranteed-wealth wording. See ./year-readings.test.ts.
 */
import type { PremiumFacts } from "./premium-facts";

export const YEAR_READING_SKILL_VERSION = "year-reading@1.0.0";
export const YEAR_READING_CALC_VERSION = "calc@1.0.0";

export type Lang = "zh" | "en";
export type Direction = "up" | "stable" | "down";
export type Confidence = "reference_only" | "low" | "mid" | "high";

export type SystemName = "bazi" | "ziwei" | "vedic" | "western";

export type SystemReading = {
  system: SystemName;
  available: boolean;
  score: number | null;       // 0..100 when available
  direction: Direction | null;
  confidence: Confidence;
  evidence_refs: string[];
  brief: string;
  opportunity: string;
  caution: string;
  reason_unavailable?: string;
};

export type YearReading = {
  year: number;
  age: number;
  systems: {
    bazi: SystemReading;
    ziwei: SystemReading;
    vedic: SystemReading;
    western: SystemReading;
  };
  composite_score: number | null;
  composite_direction: Direction | null;
  composite_confidence: Confidence;
  unavailable_systems: SystemName[];
  interpretation: { brief: string; opportunity: string; caution: string };
  advice: { suggestion: string; boundary: string };
  evidence_refs: string[];
  content_hash: string;
};

/* ---------------- FNV-1a hash (stable, no crypto dep) --------------- */

export function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Alphabetised JSON.stringify — order-independent structural hash. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(v as Record<string, unknown>).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson((v as Record<string, unknown>)[k])}`)
    .join(",")}}`;
}

export function hashFactsForYearReading(facts: PremiumFacts, extra: Record<string, unknown> = {}): string {
  const subset = {
    version: facts.version,
    bazi_luck: facts.bazi?.luck ?? null,
    bazi_day_master: facts.bazi?.day_master ?? null,
    ziwei_soul_palace: facts.ziwei?.soul_palace_index ?? null,
    ziwei_horoscope: facts.ziwei?.horoscope ?? null,
    vedic_mahadasha: facts.vedic?.mahadasha ?? null,
    vedic_current: facts.vedic?.current ?? null,
    western_ascendant: facts.western?.ascendant ?? null,
    ...extra,
  };
  return fnv1a(canonicalJson(subset));
}

/* ---------------- BaZi ten-god scoring ---------------- */

const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"] as const;
const STEM_ELEMENTS: Record<string, "wood" | "fire" | "earth" | "metal" | "water"> = {
  甲: "wood", 乙: "wood", 丙: "fire", 丁: "fire", 戊: "earth",
  己: "earth", 庚: "metal", 辛: "metal", 壬: "water", 癸: "water",
};
const STEM_YIN: Record<string, boolean> = {
  甲: false, 乙: true, 丙: false, 丁: true, 戊: false,
  己: true, 庚: false, 辛: true, 壬: false, 癸: true,
};
const GEN_ORDER: Array<"wood" | "fire" | "earth" | "metal" | "water"> = [
  "wood", "fire", "earth", "metal", "water",
];

type TenGod =
  | "比肩" | "劫财" | "食神" | "伤官" | "偏财"
  | "正财" | "七杀" | "正官" | "偏印" | "正印";

export function tenGodOf(dayMasterStem: string, otherStem: string): TenGod | null {
  const dm = STEM_ELEMENTS[dayMasterStem];
  const ot = STEM_ELEMENTS[otherStem];
  if (!dm || !ot) return null;
  const sameYin = STEM_YIN[dayMasterStem] === STEM_YIN[otherStem];
  const dmi = GEN_ORDER.indexOf(dm);
  const oti = GEN_ORDER.indexOf(ot);
  const rel = ((oti - dmi) + 5) % 5;
  // rel: 0 same, 1 dm生other (output), 2 dm克other (wealth), 3 克dm (officer/kill), 4 生dm (resource)
  switch (rel) {
    case 0: return sameYin ? "比肩" : "劫财";
    case 1: return sameYin ? "食神" : "伤官";
    case 2: return sameYin ? "偏财" : "正财";
    case 3: return sameYin ? "七杀" : "正官";
    case 4: return sameYin ? "偏印" : "正印";
    default: return null;
  }
}

const TEN_GOD_DELTA: Record<TenGod, number> = {
  比肩: 4, 劫财: -8, 食神: 12, 伤官: -4,
  偏财: 8, 正财: 12, 七杀: -10, 正官: 10,
  偏印: -2, 正印: 8,
};

const TEN_GOD_ZH: Record<TenGod, { opportunity: string; caution: string }> = {
  比肩: { opportunity: "同伴合作、共同承担", caution: "边界模糊、资源分摊" },
  劫财: { opportunity: "行动力与竞争", caution: "破财、口角、冲动决策" },
  食神: { opportunity: "创作输出、专业深耕", caution: "沉溺舒适、拖延交付" },
  伤官: { opportunity: "才华外显、突破规则", caution: "口舌是非、越权" },
  偏财: { opportunity: "偏门机会、灵活收益", caution: "投机风险、分心" },
  正财: { opportunity: "稳定积累、务实收入", caution: "过度消耗体力" },
  七杀: { opportunity: "关键考验、承担重任", caution: "压力过载、健康预警" },
  正官: { opportunity: "被认可、承担职责", caution: "束缚感、规则冲突" },
  偏印: { opportunity: "灵感与研究", caution: "多疑、孤独" },
  正印: { opportunity: "学习与庇护", caution: "依赖、行动迟缓" },
};

const TEN_GOD_EN: Record<TenGod, { opportunity: string; caution: string }> = {
  比肩: { opportunity: "peers and shared effort", caution: "blurred boundaries" },
  劫财: { opportunity: "competitive drive", caution: "impulsive spending" },
  食神: { opportunity: "creative output, craft", caution: "comfort inertia" },
  伤官: { opportunity: "visible talent, rule-breaking", caution: "verbal friction" },
  偏财: { opportunity: "flexible opportunities", caution: "speculative risk" },
  正财: { opportunity: "steady accumulation", caution: "over-exertion" },
  七杀: { opportunity: "high-stakes responsibility", caution: "burnout risk" },
  正官: { opportunity: "recognition, duty", caution: "feels constrained" },
  偏印: { opportunity: "insight and study", caution: "isolation" },
  正印: { opportunity: "learning, support", caution: "over-reliance" },
};

/* ---------------- Vedic dasha scoring ---------------- */

const VEDIC_LORD_DELTA: Record<string, number> = {
  Jupiter: 12, Venus: 10, Mercury: 6, Moon: 4,
  Sun: 0, Mars: -6, Saturn: -4, Rahu: -8, Ketu: -6,
};

const VEDIC_ZH: Record<string, { opportunity: string; caution: string }> = {
  Jupiter: { opportunity: "扩张、导师、知识", caution: "过度自信" },
  Venus:   { opportunity: "关系、艺术、美感", caution: "沉溺享乐" },
  Mercury: { opportunity: "沟通、学习、商业", caution: "思虑过度" },
  Moon:    { opportunity: "情感联结、家庭", caution: "情绪波动" },
  Sun:     { opportunity: "权威、身份、目标", caution: "自我中心" },
  Mars:    { opportunity: "行动、竞争", caution: "冲突与意外" },
  Saturn:  { opportunity: "长期基础、责任", caution: "延迟与压力" },
  Rahu:    { opportunity: "非常规机会", caution: "执念与迷失" },
  Ketu:    { opportunity: "内省与放下", caution: "疏离与不安" },
};

const VEDIC_EN: Record<string, { opportunity: string; caution: string }> = {
  Jupiter: { opportunity: "expansion, mentors, learning", caution: "over-confidence" },
  Venus:   { opportunity: "relationships, aesthetics", caution: "indulgence" },
  Mercury: { opportunity: "communication, study, trade", caution: "over-thinking" },
  Moon:    { opportunity: "emotional bonds, home", caution: "mood swings" },
  Sun:     { opportunity: "authority, identity", caution: "self-centred focus" },
  Mars:    { opportunity: "action, competition", caution: "conflict, accidents" },
  Saturn:  { opportunity: "long-term foundation", caution: "delay and pressure" },
  Rahu:    { opportunity: "unconventional openings", caution: "obsession" },
  Ketu:    { opportunity: "introspection, letting go", caution: "detachment" },
};

/* ---------------- Per-system evaluators ---------------- */

function directionFromScore(score: number): Direction {
  if (score >= 58) return "up";
  if (score <= 42) return "down";
  return "stable";
}

function clampScore(v: number): number {
  return Math.max(15, Math.min(90, Math.round(v)));
}

export function readBaZiYear(facts: PremiumFacts, year: number, age: number, lang: Lang): SystemReading {
  const bazi = facts.bazi;
  if (!bazi || !bazi.day_master || !bazi.luck || bazi.luck.pillars.length === 0) {
    return {
      system: "bazi",
      available: false,
      score: null,
      direction: null,
      confidence: "reference_only",
      evidence_refs: [],
      brief: lang === "zh" ? "八字资料不完整。" : "BaZi facts incomplete.",
      opportunity: "",
      caution: "",
      reason_unavailable: lang === "zh" ? "缺少日主或大运" : "missing day master or luck timeline",
    };
  }
  const dm = bazi.day_master.stem;
  const pillar = bazi.luck.pillars.find((p) => age >= p.start_age && age <= p.end_age) ?? null;
  const liu = pillar?.liu_nian.find((l) => l.year === year) ?? null;
  if (!pillar || !liu) {
    return {
      system: "bazi",
      available: false,
      score: null,
      direction: null,
      confidence: "reference_only",
      evidence_refs: ["bazi.luck.pillars"],
      brief: lang === "zh" ? "该年不在大运周期内。" : "Year outside available luck cycle.",
      opportunity: "",
      caution: "",
      reason_unavailable: lang === "zh" ? "年份超出大运表" : "year outside pillars",
    };
  }
  const decadeStem = pillar.gan_zhi.charAt(0);
  const yearStem = liu.gan_zhi.charAt(0);
  const decadeTG = tenGodOf(dm, decadeStem);
  const yearTG = tenGodOf(dm, yearStem);
  const base = 50 + (decadeTG ? TEN_GOD_DELTA[decadeTG] * 0.4 : 0) + (yearTG ? TEN_GOD_DELTA[yearTG] * 0.6 : 0);
  const score = clampScore(base);
  const strings = lang === "zh" ? TEN_GOD_ZH : TEN_GOD_EN;
  const primary = yearTG ?? decadeTG;
  const opp = primary ? strings[primary].opportunity : "";
  const cau = primary ? strings[primary].caution : "";
  const brief = lang === "zh"
    ? `大运 ${pillar.gan_zhi}（${decadeTG ?? "—"}）· 流年 ${liu.gan_zhi}（${yearTG ?? "—"}）`
    : `Luck pillar ${pillar.gan_zhi} (${decadeTG ?? "—"}) · Year pillar ${liu.gan_zhi} (${yearTG ?? "—"})`;
  return {
    system: "bazi",
    available: true,
    score,
    direction: directionFromScore(score),
    confidence: yearTG && decadeTG ? "high" : "mid",
    evidence_refs: [
      `bazi.luck.pillars[${pillar.index}]`,
      `bazi.luck.pillars[${pillar.index}].liu_nian[${pillar.liu_nian.indexOf(liu)}]`,
      "bazi.day_master",
    ],
    brief,
    opportunity: opp,
    caution: cau,
  };
}

export function readVedicYear(facts: PremiumFacts, year: number, _age: number, lang: Lang): SystemReading {
  const vedic = facts.vedic;
  if (!vedic || !vedic.mahadasha || vedic.mahadasha.length === 0) {
    return {
      system: "vedic",
      available: false,
      score: null,
      direction: null,
      confidence: "reference_only",
      evidence_refs: [],
      brief: lang === "zh" ? "印度占星资料不完整。" : "Vedic facts incomplete.",
      opportunity: "",
      caution: "",
      reason_unavailable: lang === "zh" ? "缺少 Vimshottari 大运表" : "missing Vimshottari dasha",
    };
  }
  const yearStart = new Date(`${year}-06-30T00:00:00Z`).getTime();
  const md = vedic.mahadasha.find((m) => {
    const s = new Date(m.start).getTime();
    const e = new Date(m.end).getTime();
    return yearStart >= s && yearStart < e;
  }) ?? null;
  if (!md) {
    return {
      system: "vedic",
      available: false,
      score: null,
      direction: null,
      confidence: "reference_only",
      evidence_refs: ["vedic.mahadasha"],
      brief: lang === "zh" ? "该年不在 Vimshottari 周期内。" : "Year outside Vimshottari coverage.",
      opportunity: "",
      caution: "",
      reason_unavailable: lang === "zh" ? "年份超出周期" : "year outside period",
    };
  }
  const ad = md.antardasha.find((a) => {
    const s = new Date(a.start).getTime();
    const e = new Date(a.end).getTime();
    return yearStart >= s && yearStart < e;
  }) ?? null;
  const mdLord = md.lord;
  const adLord = ad?.lord ?? null;
  const base = 50 + (VEDIC_LORD_DELTA[mdLord] ?? 0) * 0.6 + (adLord ? (VEDIC_LORD_DELTA[adLord] ?? 0) * 0.4 : 0);
  const score = clampScore(base);
  const strings = lang === "zh" ? VEDIC_ZH : VEDIC_EN;
  const primary = adLord ?? mdLord;
  const opp = strings[primary]?.opportunity ?? "";
  const cau = strings[primary]?.caution ?? "";
  const mdi = vedic.mahadasha.indexOf(md);
  const adi = ad ? md.antardasha.indexOf(ad) : -1;
  const evidence: string[] = [`vedic.mahadasha[${mdi}]`];
  if (adi >= 0) evidence.push(`vedic.mahadasha[${mdi}].antardasha[${adi}]`);
  return {
    system: "vedic",
    available: true,
    score,
    direction: directionFromScore(score),
    confidence: adLord ? "high" : "mid",
    evidence_refs: evidence,
    brief: lang === "zh"
      ? `大运主星 ${mdLord}${adLord ? ` · Antardasha ${adLord}` : ""}`
      : `Mahadasha ${mdLord}${adLord ? ` · Antardasha ${adLord}` : ""}`,
    opportunity: opp,
    caution: cau,
  };
}

export function readZiweiYear(facts: PremiumFacts, year: number, _age: number, lang: Lang): SystemReading {
  const z = facts.ziwei;
  // Prefer multi-year `horoscope_years[]` (v3.1). Fall back to the
  // single-year `horoscope` when only one snapshot exists (v3 cache).
  let hs = null as null | NonNullable<typeof z>["horoscope"];
  let evidencePath = "ziwei.horoscope.yearly";
  if (z?.horoscope_years && z.horoscope_years.length > 0) {
    const match = z.horoscope_years.find((h) => Number(h.as_of_date.slice(0, 4)) === year);
    if (match) {
      hs = match;
      const idx = z.horoscope_years.indexOf(match);
      evidencePath = `ziwei.horoscope_years[${idx}].yearly`;
    }
  }
  if (!hs && z?.horoscope) {
    const asOfYear = Number(z.horoscope.as_of_date.slice(0, 4));
    if (asOfYear === year) hs = z.horoscope;
  }
  if (!z || !hs) {
    return {
      system: "ziwei",
      available: false,
      score: null,
      direction: null,
      confidence: "reference_only",
      evidence_refs: [],
      brief: lang === "zh" ? "该年紫微流年资料未在快照内。" : "Ziwei flow-year not in snapshot.",
      opportunity: "",
      caution: "",
      reason_unavailable: lang === "zh"
        ? "紫微流年快照未覆盖该年"
        : "Ziwei flow-year snapshot does not cover this year",
    };
  }
  // Deterministic scoring: weight yearly mutagens (化禄+ / 化权+ / 化科+ / 化忌-).
  const mutagenDelta: Record<string, number> = { 禄: 8, 权: 6, 科: 4, 忌: -8 };
  const majorSum = hs.yearly.mutagen.reduce(
    (acc: number, m: string) => acc + (mutagenDelta[m] ?? 0), 0,
  );
  const score = clampScore(50 + majorSum);
  const brief = lang === "zh"
    ? `流年宫 ${hs.yearly.name}（四化：${hs.yearly.mutagen.join("、") || "无"}）`
    : `Flow-year palace ${hs.yearly.name} (mutagen: ${hs.yearly.mutagen.join(", ") || "none"})`;
  return {
    system: "ziwei",
    available: true,
    score,
    direction: directionFromScore(score),
    confidence: hs.yearly.mutagen.length > 0 ? "high" : "mid",
    evidence_refs: [evidencePath],
    brief,
    opportunity: lang === "zh" ? "顺势承接宫主星能量" : "align with palace star energy",
    caution: lang === "zh" ? "避开宫内煞星影响" : "note maleficence in same palace",
  };
}

export function readWesternYear(_facts: PremiumFacts, _year: number, _age: number, lang: Lang): SystemReading {
  // Western transits require an ephemeris the calculator does not currently
  // include — honestly unavailable. No fabricated houses / aspects.
  return {
    system: "western",
    available: false,
    score: null,
    direction: null,
    confidence: "reference_only",
    evidence_refs: [],
    brief: lang === "zh" ? "西方占星年度行运计算未在本地提供。" : "Western transits not available locally.",
    opportunity: "",
    caution: "",
    reason_unavailable: lang === "zh" ? "缺少行运/推运引擎" : "no local transit engine",
  };
}

/* ---------------- Aggregate ---------------- */

const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  high: 1.0, mid: 0.6, low: 0.3, reference_only: 0.1,
};

export function readYear(facts: PremiumFacts, year: number, age: number, lang: Lang): YearReading {
  const bazi = readBaZiYear(facts, year, age, lang);
  const ziwei = readZiweiYear(facts, year, age, lang);
  const vedic = readVedicYear(facts, year, age, lang);
  const western = readWesternYear(facts, year, age, lang);
  const all = [bazi, ziwei, vedic, western];
  const available = all.filter((s) => s.available && s.score != null);
  const unavailable = all.filter((s) => !s.available).map((s) => s.system);

  let composite: number | null = null;
  let composite_direction: Direction | null = null;
  let composite_confidence: Confidence = "reference_only";

  if (available.length >= 2) {
    const totalW = available.reduce((a, s) => a + CONFIDENCE_WEIGHT[s.confidence], 0);
    const sum = available.reduce((a, s) => a + (s.score as number) * CONFIDENCE_WEIGHT[s.confidence], 0);
    composite = Math.round(sum / totalW);
    composite_direction = directionFromScore(composite);
    const allHigh = available.every((s) => s.confidence === "high");
    composite_confidence = allHigh && available.length >= 3 ? "high" : available.length >= 3 ? "mid" : "mid";
  } else if (available.length === 1) {
    composite = available[0].score;
    composite_direction = available[0].direction;
    composite_confidence = "reference_only";
  }

  const evidence_refs = Array.from(new Set(all.flatMap((s) => s.evidence_refs)));

  const briefLines = available.map((s) =>
    `${systemLabel(s.system, lang)}：${s.brief}`,
  );
  const brief = briefLines.join(" · ") || (
    lang === "zh" ? "缺少可用的体系事实。" : "No available system facts."
  );

  const oppList = available.map((s) => s.opportunity).filter(Boolean);
  const cauList = available.map((s) => s.caution).filter(Boolean);

  const opportunity = oppList.length ? oppList.join(lang === "zh" ? "；" : "; ") : (
    lang === "zh" ? "无稳定机会信号。" : "No stable opportunity signal."
  );
  const caution = cauList.length ? cauList.join(lang === "zh" ? "；" : "; ") : (
    lang === "zh" ? "无明显警戒信号。" : "No specific caution."
  );

  const advice = adviceFor(composite, composite_direction, lang);

  const content_hash = fnv1a(canonicalJson({
    year, age,
    b: bazi, z: ziwei, v: vedic, w: western,
    composite, composite_direction, composite_confidence,
    lang,
    v_calc: YEAR_READING_CALC_VERSION,
    v_skill: YEAR_READING_SKILL_VERSION,
  }));

  return {
    year, age,
    systems: { bazi, ziwei, vedic, western },
    composite_score: composite,
    composite_direction,
    composite_confidence,
    unavailable_systems: unavailable,
    interpretation: { brief, opportunity, caution },
    advice,
    evidence_refs,
    content_hash,
  };
}

function systemLabel(s: SystemName, lang: Lang): string {
  const zh = { bazi: "八字", ziwei: "紫微", vedic: "印度", western: "西方" };
  const en = { bazi: "BaZi", ziwei: "Ziwei", vedic: "Vedic", western: "Western" };
  return (lang === "zh" ? zh : en)[s];
}

function adviceFor(score: number | null, dir: Direction | null, lang: Lang): { suggestion: string; boundary: string } {
  if (score == null || dir == null) {
    return {
      suggestion: lang === "zh"
        ? "本年综合信号不足，建议以生活基本盘为主，不做重大决定。"
        : "Insufficient composite signal — prioritise stability and defer big decisions.",
      boundary: lang === "zh"
        ? "本内容为参考性质，不涉及健康、寿命或投资建议。"
        : "Reference only — not medical, longevity, or investment advice.",
    };
  }
  const zhUp = "顺势推进有把握之事，抓住可复利的方向；量力承接机会。";
  const zhStable = "适合打磨基本功、完成已开始的事，避免大幅转向。";
  const zhDown = "以守成与休整为主，把资源投在关系与健康上，回避重大承诺。";
  const enUp = "Move forward on high-conviction work; compound the direction that fits.";
  const enStable = "Refine fundamentals and finish what's already started; avoid drastic pivots.";
  const enDown = "Consolidate and recover; invest in relationships and health; avoid major commitments.";
  const suggestion = lang === "zh"
    ? (dir === "up" ? zhUp : dir === "down" ? zhDown : zhStable)
    : (dir === "up" ? enUp : dir === "down" ? enDown : enStable);
  return {
    suggestion,
    boundary: lang === "zh"
      ? "本内容以命理事实为参考，不构成健康、寿命或投资承诺。"
      : "Reference commentary from calculated facts — not health, longevity, or investment advice.",
  };
}

/* ---------------- Validator (guard for tests + server) ---------------- */

export function validateYearReading(r: YearReading): { ok: true } | { ok: false; error: string } {
  for (const s of Object.values(r.systems)) {
    if (s.available) {
      if (s.score == null || s.score < 0 || s.score > 100) return { ok: false, error: `${s.system} score out of range` };
      if (s.evidence_refs.length === 0) return { ok: false, error: `${s.system} available but no evidence_refs` };
    } else {
      if (s.score != null) return { ok: false, error: `${s.system} unavailable but has score` };
    }
  }
  if (r.composite_score != null && (r.composite_score < 0 || r.composite_score > 100)) {
    return { ok: false, error: "composite out of range" };
  }
  const avail = Object.values(r.systems).filter((s) => s.available).length;
  if (avail < 2 && r.composite_confidence !== "reference_only") {
    return { ok: false, error: "composite_confidence must be reference_only with <2 systems" };
  }
  return { ok: true };
}

export function readYearWindow(
  facts: PremiumFacts,
  birthYear: number,
  fromAge: number,
  toAge: number,
  lang: Lang,
): YearReading[] {
  const out: YearReading[] = [];
  for (let age = fromAge; age <= toAge; age += 1) {
    out.push(readYear(facts, birthYear + age, age, lang));
  }
  return out;
}
