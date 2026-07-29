/**
 * v2 数学馆数据契约 — 七维人生曲线 + 综合总览 + 实验分支。
 *
 * 七个维度直接对齐 LifeDomainModel 的七个 domain, 不再合并 love+social。
 */
export type LifeDimensionKey =
  | "study"
  | "career"
  | "love"
  | "family"
  | "social"
  | "wealth"
  | "health";

export const LIFE_DIMENSIONS: LifeDimensionKey[] = [
  "study",
  "career",
  "love",
  "family",
  "social",
  "wealth",
  "health",
];

export const DIMENSION_LABELS: Record<LifeDimensionKey, { zh: string; en: string }> = {
  study:  { zh: "学业与成长", en: "Study & Growth" },
  career: { zh: "事业与选择", en: "Career & Choices" },
  love:   { zh: "爱情与亲密", en: "Love & Intimacy" },
  family: { zh: "家庭与责任", en: "Family & Duty" },
  social: { zh: "人际协作",   en: "Social & Collab" },
  wealth: { zh: "财富与风险", en: "Wealth & Risk" },
  health: { zh: "健康与恢复", en: "Health & Recovery" },
};

/** Distinct enough hues so the seven lines never blur into one another. */
export const DIMENSION_COLORS: Record<LifeDimensionKey, string> = {
  study:  "#a78bfa",
  career: "#f59e0b",
  love:   "#f472b6",
  family: "#fb923c",
  social: "#38bdf8",
  wealth: "#facc15",
  health: "#34d399",
};

/** Distinct SVG marker shapes so the seven lines are legible without color. */
export type DimensionMarker = "circle" | "triangle" | "diamond" | "square" | "pentagon" | "hexagon" | "plus";
export const DIMENSION_MARKERS: Record<LifeDimensionKey, DimensionMarker> = {
  study:  "circle",
  career: "triangle",
  love:   "diamond",
  family: "square",
  social: "pentagon",
  wealth: "hexagon",
  health: "plus",
};

/** Short "what this line reads / does not read" copy for click-to-explain sheet. */
export const DIMENSION_DESCRIPTIONS: Record<LifeDimensionKey, { reads: { zh: string; en: string }; notReads: { zh: string; en: string }; coupled: LifeDimensionKey[] }> = {
  study: {
    reads:    { zh: "学习节奏、知识结构与自我更新的相对空间。", en: "Rhythm of learning, structure of knowledge, and room to update yourself." },
    notReads: { zh: "不代表智商, 也不代表某一门考试的具体结果。", en: "Not IQ, not the outcome of any single exam." },
    coupled:  ["career", "social"],
  },
  career: {
    reads:    { zh: "工作结构、发展方向、承担责任与外部机会之间的相对状态。", en: "Work structure, direction, ownership, and the relative flow of outside opportunity." },
    notReads: { zh: "不代表职位高低, 也不代表某一年一定升职或跳槽。", en: "Not job title or a guarantee of promotion in any specific year." },
    coupled:  ["wealth", "family", "health"],
  },
  love: {
    reads:    { zh: "亲密关系里的沟通、信任修复与情感兑现节奏。", en: "Rhythm of intimacy — communication, trust repair, emotional follow-through." },
    notReads: { zh: "不代表桃花个数, 也不预测婚姻是否发生。", en: "Not a count of romances, not a marriage prediction." },
    coupled:  ["family", "health"],
  },
  family: {
    reads:    { zh: "家庭责任的承担、协商与结构性稳定程度。", en: "Bearing family duty, renegotiating it, and structural stability." },
    notReads: { zh: "不代表原生家庭的好坏, 也不评判家庭成员。", en: "Not a verdict on your family of origin or its members." },
    coupled:  ["love", "wealth"],
  },
  social: {
    reads:    { zh: "同伴与协作资源的可用度, 以及协作摩擦的相对程度。", en: "Availability of peer and collaboration resources, and friction cost." },
    notReads: { zh: "不代表朋友数量, 也不代表社交媒体表现。", en: "Not friend count, not social-media performance." },
    coupled:  ["career", "study"],
  },
  wealth: {
    reads:    { zh: "承担与消化财务风险的相对空间, 不是绝对收入。", en: "Room to shoulder and absorb financial risk — not absolute income." },
    notReads: { zh: "不代表存款数字, 也不预测具体投资结果。", en: "Not a bank balance and not an investment prediction." },
    coupled:  ["career", "family"],
  },
  health: {
    reads:    { zh: "作息、恢复与体力可持续度的相对空间。", en: "Sleep, recovery, and sustainable physical bandwidth." },
    notReads: { zh: "不是医学诊断, 也不代替体检结果。", en: "Not a medical diagnosis and no substitute for a check-up." },
    coupled:  ["career", "love"],
  },
};

export type LifeMathPoint = {
  age: number;
  /** Seven-dimension scores at this age (0–100). */
  dimensions: Record<LifeDimensionKey, number>;
  /** Seven-dimension long-run baselines (rolling mean). */
  dimensionBaselines: Record<LifeDimensionKey, number>;
  /** Same but experiment-adjusted; equals dimensions when no experiment active. */
  dimensionsExperiment: Record<LifeDimensionKey, number>;
  /** Composite series — kept as top-level fields for backwards-compat with bookmarks. */
  baseline: number;
  currentPath: number;
  experimentPath: number;
  /** Optional key event flag. Used by bookmarks + chart markers. */
  eventType?: "peak" | "low" | "crossing" | "risk" | "branch" | "resonance" | "tension";
  eventDimensions?: LifeDimensionKey[];
  shortHint?: { zh: string; en: string };
  caution?: { zh: string; en: string };
};

export type LifeExperiment = {
  id: string;
  title: { zh: string; en: string };
  description: { zh: string; en: string };
  startAge: number;
  /** 每年在各维度上的稳态增量 (0 表示不变)。累积渐进施加。 */
  dimensionEffects: Partial<Record<LifeDimensionKey, number>>;
  /** 需要用户看见的代价（同为增量, 通常为负）。 */
  costEffects: Partial<Record<LifeDimensionKey, number>>;
  shortTerm: { zh: string; en: string };
  midTerm:   { zh: string; en: string };
  cost:      { zh: string; en: string };
  curveTransition: "gradual";
};

export type MathBookmark = {
  id:
    | "law-of-large-numbers"
    | "survivorship"
    | "murphy"
    | "simpson"
    | "regression-to-mean"
    | "opportunity-cost"
    | "marginal"
    | "compounding";
  title:       { zh: string; en: string };
  summary:     { zh: string; en: string };
  explanation: { zh: string; en: string };
  actionPrompt:{ zh: string; en: string };
  relatedPattern:
    | "repetition"
    | "extreme"
    | "selection_bias"
    | "tradeoff"
    | "compound"
    | "contradiction";
  highlight: (points: LifeMathPoint[]) => Array<[number, number]>;
};

export type AgePhase = {
  from: number;
  to: number;
  label: { zh: string; en: string };
};

export const AGE_PHASES: AgePhase[] = [
  { from: 0,  to: 18, label: { zh: "成长与学习", en: "Growth & Study" } },
  { from: 19, to: 25, label: { zh: "探索与独立", en: "Explore & Independence" } },
  { from: 26, to: 35, label: { zh: "选择与建立", en: "Choose & Build" } },
  { from: 36, to: 45, label: { zh: "扩张与责任", en: "Expand & Responsibility" } },
  { from: 46, to: 60, label: { zh: "重构与沉淀", en: "Rebuild & Consolidate" } },
  { from: 61, to: 120,label: { zh: "传承与自由", en: "Legacy & Freedom" } },
];

export function phaseForAge(age: number): AgePhase {
  return AGE_PHASES.find((p) => age >= p.from && age <= p.to) ?? AGE_PHASES[0];
}

/** Equal-weight composite of the seven dimensions. */
export function composeFromDimensions(d: Record<LifeDimensionKey, number>): number {
  let s = 0;
  for (const k of LIFE_DIMENSIONS) s += d[k];
  return s / LIFE_DIMENSIONS.length;
}
