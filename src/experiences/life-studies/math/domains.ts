/**
 * Seven life-domain contract for /life-studies/math.
 *
 * Scores are INTERPRETIVE INDICES in [0, 100]. 50 = neutral. Higher = more
 * available resources / lower friction; lower = need to allocate energy
 * more carefully. Scores are NEVER success probabilities, medical readings,
 * or investment returns. All copy must respect the language rules below.
 */

export type DomainKey =
  | "study"
  | "career"
  | "love"
  | "family"
  | "social"
  | "wealthRisk"
  | "health";

export const DOMAIN_KEYS: DomainKey[] = [
  "study",
  "career",
  "love",
  "family",
  "social",
  "wealthRisk",
  "health",
];

export const DOMAIN_LABELS: Record<DomainKey, { zh: string; en: string }> = {
  study:      { zh: "学业与成长",   en: "Study & Growth" },
  career:     { zh: "事业与选择",   en: "Career & Choices" },
  love:       { zh: "爱情与亲密",   en: "Love & Intimacy" },
  family:     { zh: "家庭与责任",   en: "Family & Duty" },
  social:     { zh: "人际协作",     en: "Collaboration" },
  wealthRisk: { zh: "财富与风险",   en: "Wealth & Risk" },
  health:     { zh: "健康与恢复",   en: "Health & Recovery" },
};

export const DOMAIN_COLORS: Record<DomainKey, string> = {
  study:      "#a78bfa",
  career:     "#f59e0b",
  love:       "#f472b6",
  family:     "#fb923c",
  social:     "#38bdf8",
  wealthRisk: "#facc15",
  health:     "#34d399",
};

/** Distinct dash patterns so lines are readable when colors overlap. */
export const DOMAIN_DASH: Record<DomainKey, string> = {
  study:      "6 3",
  career:     "0",
  love:       "4 2",
  family:     "8 3 2 3",
  social:     "2 3",
  wealthRisk: "10 4",
  health:     "3 3",
};

/** Composite weights (sum ≈ 1). Health is later applied as a realisability cap. */
export const COMPOSITE_WEIGHTS: Record<DomainKey, number> = {
  study:      0.12,
  career:     0.22,
  love:       0.12,
  family:     0.14,
  social:     0.10,
  wealthRisk: 0.12,
  health:     0.18,
};

/**
 * Terminology guard — these tokens must NEVER appear in signal or copy
 * strings produced by this room. Tests enforce it.
 */
export const BANNED_TERMS: RegExp[] = [
  /小人/,
  /必(破财|失败|离婚|结婚|升职|大赚)/,
  /稳赚/,
  /确诊/,
  /治愈/,
  /寿命/,
  /(will|guaranteed to|certainly) (succeed|fail|earn|lose|profit|divorce|marry)/i,
  /diagnos(is|ed)/i,
  /life[-\s]?span/i,
];

/** Preferred replacements to use in copy. */
export const PREFERRED_TERMS = {
  socialFriction: { zh: "合作摩擦 / 权责不清 / 竞争压力 / 信息不对称", en: "collaboration friction / unclear ownership / competitive pressure / information asymmetry" },
  wealth:         { zh: "风险管理环境相对宽松 / 风险承受空间相对提高", en: "risk-management climate is more accommodating / room for risk exposure is relatively higher" },
  health:         { zh: "作息、恢复、压力管理、就医提醒",              en: "sleep, recovery, stress, medical check reminders" },
} as const;

/** Quick-look domain groups for one-click chart presets. */
export const DOMAIN_PRESETS: Array<{
  id: "career-only" | "career-wealth" | "love-family" | "all" | "overview";
  label: { zh: string; en: string };
  domains: DomainKey[];
}> = [
  { id: "overview",       label: { zh: "只看总览",     en: "Overview only" },   domains: [] },
  { id: "career-only",    label: { zh: "只看事业",     en: "Career only" },     domains: ["career"] },
  { id: "career-wealth",  label: { zh: "事业+财富",    en: "Career + Wealth" }, domains: ["career", "wealthRisk"] },
  { id: "love-family",    label: { zh: "爱情+家庭",    en: "Love + Family" },   domains: ["love", "family"] },
  { id: "all",            label: { zh: "全部七条",     en: "All seven" },       domains: [...DOMAIN_KEYS] },
];
