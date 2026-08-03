/**
 * compatibility-score-v1 — deterministic pairwise compatibility.
 *
 * ── Design invariants ─────────────────────────────────────────────
 * 1. **Pure & deterministic**: no AI, no I/O. Same inputs → same output.
 * 2. **Order-independent**: score(A,B) === score(B,A). Canonical pair key
 *    orders the two user ids lexicographically before hashing.
 * 3. **Friendship-first**: default mode is `friendship`; romantic tier
 *    is gated behind explicit consent from both parties (surface only,
 *    the engine still computes 5 dimensions the same way).
 * 4. **No success probability**: we never emit "关系成功率 / 结婚率".
 *    Copy calls out "互动适配指数" and a legal disclaimer.
 *
 * The 5 dimensions are a project-internal decomposition of interaction
 * quality — communication, emotional support, action rhythm, boundary
 * repair, shared growth — chosen so each dimension can be scored from
 * facets we can honestly derive from the chart FACTS. We do NOT claim
 * any specific external methodology (no Gottman, no classical Bagua
 * pairing rule) and we do NOT emit success probability.
 *
 * Scores are purely feature-based on the two charts. We do NOT invent
 * astrological compatibility rules — the score derives from four
 * facets of each side and their signed distance:
 *   • yang (day-master polarity + Sun element, -1..1)
 *   • pace (bazi 十神 initiating/receiving + Mercury sign, 0..1)
 *   • openness (bazi 食伤 + Western Moon/Venus/Mercury aspects, 0..1)
 *   • rootedness (bazi earth+metal + Sun element, 0..1)
 *
 * Callers pass these four scalars per side. If a side is missing one
 * facet (e.g. no birth time), the engine still returns a score but
 * marks `partial: true` and lowers `confidence`.
 */

export const COMPATIBILITY_SCORE_VERSION = "compatibility-score-v1" as const;

export type CompatMode = "friendship" | "romantic" | "family" | "work";

export type SideFacets = {
  yang: number; // -1 (yin) .. 1 (yang)
  pace: number; // 0 (slow / receptive) .. 1 (fast / initiating)
  openness: number; // 0 (guarded) .. 1 (expressive)
  rootedness: number; // 0 (fluid) .. 1 (grounded)
};

export type CompatLang = "zh" | "en";

export type CompatInput = {
  a: { userId: string; chartId: string; facets: Partial<SideFacets> };
  b: { userId: string; chartId: string; facets: Partial<SideFacets> };
  mode?: CompatMode;
  /** Optional locale for the emitted resonance/complement/friction/
   * suggestion/disclaimer text. Deterministic scores are unaffected. */
  lang?: CompatLang;
};

export type DimensionScore = {
  key:
    | "communication"
    | "emotional_support"
    | "action_rhythm"
    | "boundary_repair"
    | "shared_growth";
  label: string;
  score: number; // 0..100
  band: "high" | "mid" | "low";
  note: string;
};

export type CompatResult = {
  version: typeof COMPATIBILITY_SCORE_VERSION;
  pairKey: string; // canonical order-independent id
  mode: CompatMode;
  overall: number; // 0..100
  dimensions: DimensionScore[];
  resonances: string[]; // 共鸣点
  complements: string[]; // 互补点
  frictions: string[]; // 误解点
  suggestions: string[]; // 相处建议
  disclaimer: string;
  partial: boolean;
  confidence: number; // 0..1
  /** Optional: evidence_refs into premium_facts contributed by the two sides. */
  evidence_refs?: string[];
  /** Optional: source systems (bazi/ziwei/western/vedic) that supplied facets. */
  source_systems?: string[];
  /** True when facets came from ≥2 different source systems across both sides. */
  cross_system_support?: boolean;
  /** Optional: honest missing_facts markers. */
  missing_facts?: string[];
};

// -- helpers ---------------------------------------------------------

const DEFAULT_FACETS: SideFacets = {
  yang: 0,
  pace: 0.5,
  openness: 0.5,
  rootedness: 0.5,
};

const DIM_LABEL: Record<CompatLang, Record<DimensionScore["key"], string>> = {
  zh: {
    communication: "沟通",
    emotional_support: "情绪支持",
    action_rhythm: "行动节奏",
    boundary_repair: "边界修复",
    shared_growth: "共同成长",
  },
  en: {
    communication: "Communication",
    emotional_support: "Emotional support",
    action_rhythm: "Action tempo",
    boundary_repair: "Boundary repair",
    shared_growth: "Shared growth",
  },
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function to100(n: number): number {
  return Math.round(clamp01(n) * 100);
}

function band(score: number): DimensionScore["band"] {
  if (score >= 68) return "high";
  if (score >= 42) return "mid";
  return "low";
}

/** Fill missing facets with neutral defaults, count coverage. */
function normalize(f: Partial<SideFacets>): { full: SideFacets; coverage: number } {
  const keys: (keyof SideFacets)[] = ["yang", "pace", "openness", "rootedness"];
  let covered = 0;
  const full = { ...DEFAULT_FACETS };
  for (const k of keys) {
    const v = f[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      full[k] = v;
      covered += 1;
    }
  }
  return { full, coverage: covered / keys.length };
}

/** canonical order-independent pair key. */
export function canonicalPairKey(aUserId: string, bUserId: string): string {
  const [x, y] = [aUserId, bUserId].sort();
  return `${x}::${y}`;
}

// -- dimensions ------------------------------------------------------

function scoreCommunication(a: SideFacets, b: SideFacets): number {
  // Both open + close pace → high. Wide pace gap lowers score.
  const openness = (a.openness + b.openness) / 2;
  const paceGap = Math.abs(a.pace - b.pace);
  return clamp01(openness * 0.7 + (1 - paceGap) * 0.3);
}

function scoreEmotional(a: SideFacets, b: SideFacets): number {
  // Complementary yang polarity + shared rootedness support.
  const complement = 1 - Math.abs((a.yang + b.yang) / 2); // 1 when they average to 0
  const rooted = (a.rootedness + b.rootedness) / 2;
  return clamp01(complement * 0.5 + rooted * 0.5);
}

function scoreRhythm(a: SideFacets, b: SideFacets): number {
  // Similar pace helps action coordination; extreme dissimilarity hurts.
  const paceGap = Math.abs(a.pace - b.pace);
  return clamp01(1 - paceGap * 0.85);
}

function scoreBoundary(a: SideFacets, b: SideFacets): number {
  // Rootedness + openness both matter for repair after friction.
  const rooted = Math.min(a.rootedness, b.rootedness);
  const openness = (a.openness + b.openness) / 2;
  return clamp01(rooted * 0.55 + openness * 0.45);
}

function scoreGrowth(a: SideFacets, b: SideFacets): number {
  // Moderate difference across facets fuels growth without breaking bond.
  const diffs = [
    Math.abs(a.yang - b.yang) / 2,
    Math.abs(a.pace - b.pace),
    Math.abs(a.openness - b.openness),
    Math.abs(a.rootedness - b.rootedness),
  ];
  const avgDiff = diffs.reduce((s, x) => s + x, 0) / diffs.length;
  // Peaked at ~0.35: enough divergence to teach, not enough to alienate.
  const distFromIdeal = Math.abs(avgDiff - 0.35);
  return clamp01(1 - distFromIdeal * 1.6);
}

// -- text emitters --------------------------------------------------

type TextPack = {
  resonance: { pace: string; openness: string; rooted: string; empty: string };
  complement: { yang: string; openness: string; rootedness: string; empty: string };
  friction: { pace: string; openness: string; rootedness: string; empty: string };
  modeHint: Record<CompatMode, string>;
  suggestion: Record<DimensionScore["key"], (m: string) => string>;
  note: (label: string) => string;
  disclaimer: string;
};

const TEXT: Record<CompatLang, TextPack> = {
  zh: {
    resonance: {
      pace: "行动节奏接近，容易一起启动一件事情。",
      openness: "双方都愿意直接表达，情绪不容易积压。",
      rooted: "两个人都能长期承担事情，适合共同做需要坚持的项目。",
      empty: "在中性区间内，共鸣需要通过共同经历累积。",
    },
    complement: {
      yang: "一动一静、一进一守，能形成互补而不是对撞。",
      openness: "一个更外放、一个更内省，可以互相扩展对方的表达半径。",
      rootedness: "一个更稳、一个更灵活，节奏切换时对方能补位。",
      empty: "差异集中在细节而非结构，互补空间不大。",
    },
    friction: {
      pace: "行动节奏差距较大：一个想立刻决定，另一个想再看看，容易被误读为拖延或催促。",
      openness: "表达方式不对齐：直接说 vs. 暗示，可能被解释成冷漠或压迫。",
      rootedness: "双方稳定度都不高时，冲突后修复需要额外时间与仪式感。",
      empty: "没有明显结构性冲突点，误解多来自具体场景。",
    },
    modeHint: { friendship: "朋友关系", romantic: "亲密关系", family: "家人关系", work: "工作搭档" },
    suggestion: {
      communication: (m) => `${m}中，先约定表达方式：谁需要直接说、谁需要留出解读空间。`,
      emotional_support: (m) => `${m}中，遇到低潮不着急解决问题，先陪伴 24 小时再讨论对策。`,
      action_rhythm: (m) => `${m}中，重要决定给对方一个"缓冲窗口"，不要在同一次对话里逼决定。`,
      boundary_repair: (m) => `${m}中，事先约好一个"暂停信号"，冲突升级时任何一方可以喊停。`,
      shared_growth: (m) => `${m}中，每隔一段时间刻意做一件对方主导的事情，让差异变成学习。`,
    },
    note: (label) => `${label}维度基于双方 yang/pace/openness/rootedness 事实计算。`,
    disclaimer:
      "本指数为「互动适配指数」，基于两张确定性命盘特征计算，不代表关系成功率、婚姻结果或任何命运判定。仅作为沟通与相处的参考。",
  },
  en: {
    resonance: {
      pace: "Action tempo is close — starting things together comes naturally.",
      openness: "Both sides prefer to say things out loud, so emotions rarely stack up.",
      rooted: "Both can carry long-running commitments; well-suited to work that needs endurance.",
      empty: "You're in a neutral range — resonance will accrue through shared experience.",
    },
    complement: {
      yang: "One moves, one steadies — the polarity complements instead of colliding.",
      openness: "One is more outward, one more inward — you widen each other's expressive range.",
      rootedness: "One is steadier, one more fluid — when tempo shifts the other side can cover.",
      empty: "Differences are in detail, not structure — limited room for complement.",
    },
    friction: {
      pace: "Action tempo differs sharply — one wants to decide now, the other wants to wait, easily misread as stalling or pressuring.",
      openness: "Expression styles don't match — direct vs. implied can read as cold or forceful.",
      rootedness: "When neither side is very grounded, repair after friction needs extra time and ritual.",
      empty: "No obvious structural friction; misreads mostly come from specific situations.",
    },
    modeHint: {
      friendship: "friendship",
      romantic: "an intimate bond",
      family: "family ties",
      work: "a working partnership",
    },
    suggestion: {
      communication: (m) => `In ${m}, agree on expression up front: who says it plainly, who leaves room for interpretation.`,
      emotional_support: (m) => `In ${m}, don't rush to fix a low mood — sit with it for 24 hours before proposing solutions.`,
      action_rhythm: (m) => `In ${m}, give each other a buffer window on big decisions — don't force closure in one conversation.`,
      boundary_repair: (m) => `In ${m}, agree in advance on a "pause signal" either side can call when conflict escalates.`,
      shared_growth: (m) => `In ${m}, occasionally do one thing the other person leads — let difference become learning.`,
    },
    note: (label) => `${label} is computed from both sides' yang / pace / openness / rootedness facts.`,
    disclaimer:
      "This is a compatibility index derived from two deterministic charts. It is not a relationship success rate, marriage outcome, or fate verdict — treat it as a lens on how you interact.",
  },
};

function resonanceLines(a: SideFacets, b: SideFacets, tp: TextPack): string[] {
  const lines: string[] = [];
  if (Math.abs(a.pace - b.pace) < 0.15) lines.push(tp.resonance.pace);
  if (Math.min(a.openness, b.openness) > 0.6) lines.push(tp.resonance.openness);
  if (Math.min(a.rootedness, b.rootedness) > 0.6) lines.push(tp.resonance.rooted);
  if (lines.length === 0) lines.push(tp.resonance.empty);
  return lines;
}

function complementLines(a: SideFacets, b: SideFacets, tp: TextPack): string[] {
  const lines: string[] = [];
  if (Math.sign(a.yang) !== Math.sign(b.yang) && Math.abs(a.yang - b.yang) > 0.4)
    lines.push(tp.complement.yang);
  if (Math.abs(a.openness - b.openness) > 0.35) lines.push(tp.complement.openness);
  if (Math.abs(a.rootedness - b.rootedness) > 0.35) lines.push(tp.complement.rootedness);
  if (lines.length === 0) lines.push(tp.complement.empty);
  return lines;
}

function frictionLines(a: SideFacets, b: SideFacets, tp: TextPack): string[] {
  const lines: string[] = [];
  const paceGap = Math.abs(a.pace - b.pace);
  if (paceGap > 0.45) lines.push(tp.friction.pace);
  if (Math.max(a.openness, b.openness) - Math.min(a.openness, b.openness) > 0.45)
    lines.push(tp.friction.openness);
  if (Math.min(a.rootedness, b.rootedness) < 0.35) lines.push(tp.friction.rootedness);
  if (lines.length === 0) lines.push(tp.friction.empty);
  return lines;
}

function suggestionLines(mode: CompatMode, dims: DimensionScore[], tp: TextPack): string[] {
  const weak = [...dims].sort((a, b) => a.score - b.score).slice(0, 2);
  const modeHint = tp.modeHint[mode];
  return weak.map((d) => tp.suggestion[d.key](modeHint));
}

// -- main -----------------------------------------------------------

export function computeCompatibility(input: CompatInput): CompatResult {
  const mode: CompatMode = input.mode ?? "friendship";
  const lang: CompatLang = input.lang ?? "zh";
  const tp = TEXT[lang];
  const labels = DIM_LABEL[lang];

  // Order-independent normalization.
  const [first, second] = input.a.userId <= input.b.userId ? [input.a, input.b] : [input.b, input.a];
  const A = normalize(first.facets);
  const B = normalize(second.facets);

  const raw = {
    communication: scoreCommunication(A.full, B.full),
    emotional_support: scoreEmotional(A.full, B.full),
    action_rhythm: scoreRhythm(A.full, B.full),
    boundary_repair: scoreBoundary(A.full, B.full),
    shared_growth: scoreGrowth(A.full, B.full),
  };

  const dimensions: DimensionScore[] = (
    Object.keys(raw) as (keyof typeof raw)[]
  ).map((k) => {
    const score = to100(raw[k]);
    return {
      key: k,
      label: labels[k],
      score,
      band: band(score),
      note: tp.note(labels[k]),
    };
  });

  const overall = Math.round(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length,
  );

  const coverage = (A.coverage + B.coverage) / 2;
  const partial = coverage < 1;
  const confidence = Math.round(coverage * 100) / 100;

  return {
    version: COMPATIBILITY_SCORE_VERSION,
    pairKey: canonicalPairKey(first.userId, second.userId),
    mode,
    overall,
    dimensions,
    resonances: resonanceLines(A.full, B.full, tp),
    complements: complementLines(A.full, B.full, tp),
    frictions: frictionLines(A.full, B.full, tp),
    suggestions: suggestionLines(mode, dimensions, tp),
    disclaimer: tp.disclaimer,
    partial,
    confidence,
  };
}

/* -------------------- facts-adapter integration -------------------- */

import type { PremiumFacts } from "./premium-facts";
import {
  adaptFacetsFromFacts,
  aggregateEvidence,
} from "./compatibility-facts-adapter";

/**
 * Convenience: derive facets from each side's PremiumFacts via the
 * `compatibility-facts-adapter-v1` adapter and compute the score
 * carrying evidence_refs and cross-system-support metadata.
 */
export function computeCompatibilityFromFacts(input: {
  a: { userId: string; chartId: string; facts: PremiumFacts | null };
  b: { userId: string; chartId: string; facts: PremiumFacts | null };
  mode?: CompatMode;
}): CompatResult {
  const A = adaptFacetsFromFacts(input.a.facts);
  const B = adaptFacetsFromFacts(input.b.facts);
  const facetsA: Partial<SideFacets> = {};
  const facetsB: Partial<SideFacets> = {};
  if (A.yang) facetsA.yang = A.yang.value;
  if (A.pace) facetsA.pace = A.pace.value;
  if (A.openness) facetsA.openness = A.openness.value;
  if (A.rootedness) facetsA.rootedness = A.rootedness.value;
  if (B.yang) facetsB.yang = B.yang.value;
  if (B.pace) facetsB.pace = B.pace.value;
  if (B.openness) facetsB.openness = B.openness.value;
  if (B.rootedness) facetsB.rootedness = B.rootedness.value;

  const base = computeCompatibility({
    a: { userId: input.a.userId, chartId: input.a.chartId, facets: facetsA },
    b: { userId: input.b.userId, chartId: input.b.chartId, facets: facetsB },
    mode: input.mode,
  });
  const agg = aggregateEvidence(A, B);
  return {
    ...base,
    evidence_refs: agg.refs,
    source_systems: [...new Set([...A.consensus_bodies, ...B.consensus_bodies])],
    cross_system_support: agg.cross_system_support,
    missing_facts: [...new Set([...A.missing_facts, ...B.missing_facts])],
  };
}
