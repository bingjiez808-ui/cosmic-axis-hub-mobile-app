/**
 * v2 数学馆数据契约。命盘计算规则与 DB 无关。
 */
export type LifeDimensionKey =
  | "study"
  | "career"
  | "relationship"
  | "family"
  | "wealth"
  | "health";

export const LIFE_DIMENSIONS: LifeDimensionKey[] = [
  "study",
  "career",
  "relationship",
  "family",
  "wealth",
  "health",
];

export const DIMENSION_LABELS: Record<LifeDimensionKey, { zh: string; en: string }> = {
  study:        { zh: "学业",   en: "Study" },
  career:       { zh: "事业",   en: "Career" },
  relationship: { zh: "关系",   en: "Relationship" },
  family:       { zh: "家庭",   en: "Family" },
  wealth:       { zh: "财富",   en: "Wealth" },
  health:       { zh: "健康",   en: "Health" },
};

export const DIMENSION_COLORS: Record<LifeDimensionKey, string> = {
  study:        "#a78bfa",
  career:       "#f59e0b",
  relationship: "#f472b6",
  family:       "#fb923c",
  wealth:       "#facc15",
  health:       "#34d399",
};

export type LifeMathPoint = {
  age: number;
  baseline: number;
  currentPath: number;
  experimentPath?: number;
  dimensions: Record<LifeDimensionKey, number>;
  eventType?: "peak" | "low" | "crossing" | "risk" | "branch";
  shortHint?: { zh: string; en: string };
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
  /** 图上高亮的年龄区间选择器 */
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
