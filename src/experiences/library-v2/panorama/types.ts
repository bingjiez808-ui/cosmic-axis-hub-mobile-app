/**
 * Panorama Tour · Types.
 *
 * A self-contained subsystem for the "命运全景导览" that runs after the
 * V2 intake. Uses its own DomainKey union so we don't have to migrate
 * every existing StoryTopic reference in one turn.
 *
 * Contract: everything here is deterministic. No AI, no random, no
 * clock-dependent output. The V1 integration adapter maps real
 * PremiumFacts into DomainScoreResult[] using the same shape.
 */

export type DomainKey = "study" | "career" | "love" | "wealth";
export const DOMAIN_ORDER: readonly DomainKey[] = ["study", "career", "love", "wealth"] as const;

export type SystemKey = "western" | "vedic" | "bazi" | "ziwei";

export interface SystemContribution {
  system: SystemKey;
  /** Contribution to the raw score in [-40, +40]. */
  contribution: number;
  /** Whether this system had enough facts to score. */
  available: boolean;
  reason_codes: string[];
}

export type SignalBand = "high_signal" | "mid_signal" | "insufficient_facts";
export type Confidence = "high" | "mid" | "low" | "reference_only";

export interface DomainScoreResult {
  domain: DomainKey;
  /** 0-100. Neutral name: "领域信号" — never call this success rate. */
  score: number;
  band: SignalBand;
  confidence: Confidence;
  /** Human-readable evidence keys such as "bazi.day_master" or
   *  "vedic.mahadasha[0]". Never internal hashes. */
  evidence_refs: string[];
  system_contributions: SystemContribution[];
  /** Names of currently-active cycles (e.g. "bazi.dayun[2005-2014]"). */
  timing_activation: string[];
  /** Present when systems disagree — kept, never hidden. */
  contradiction_flags: string[];
  /** Facts we would have used if available. */
  missing_facts: string[];
  calculation_version: "domain-score-v1";
  calculated_at: number;
}

export interface RecommendedFirstRead {
  domain: DomainKey;
  reason_codes: string[];
  /** Short natural-language reason, safe for direct display. */
  reason_text: string;
  /** Neutral one-liner shown alongside the CTA. */
  disclaimer: string;
}

/**
 * The Guided Domain Reading skill output. Structure is fixed;
 * per-domain fixtures fill each section deterministically.
 */
export interface GuidedDomainReading {
  domain: DomainKey;
  skill_version: "guided-domain-reading-v1";
  /** Cache key: fnv1a(canonical(chart_id + facts_hash + domain + score_hash + skill_version + lang)). */
  content_hash: string;
  sections: {
    opening: string;
    per_system: { system: SystemKey; observation: string; available: boolean }[];
    consensus_and_conflict: string;
    real_life_expression: string;
    strengths_and_resources: string;
    recurring_patterns: string;
    current_cycle_window: string;
    keep_stop_start: { keep: string; stop: string; start: string };
    self_inquiry: string[]; // exactly 3
    method_and_limits: string;
  };
  evidence_refs: string[];
  confidence: Confidence;
  generated_at: number;
}

export interface PanoramaTourState {
  domain_scores: DomainScoreResult[] | null;
  recommended: RecommendedFirstRead | null;
  selected_domain: DomainKey | "overview" | null;
  reading_status: Record<DomainKey, "idle" | "short" | "full" | "done">;
  overview_nav_position: string | null;
  tour_completed_at: number | null;
}

export const INITIAL_PANORAMA_STATE: PanoramaTourState = {
  domain_scores: null,
  recommended: null,
  selected_domain: null,
  reading_status: { study: "idle", career: "idle", love: "idle", wealth: "idle" },
  overview_nav_position: null,
  tour_completed_at: null,
};

export const DOMAIN_LABEL: Record<DomainKey, string> = {
  study: "学业与认知",
  career: "事业与方向",
  love: "关系与情感",
  wealth: "财富与资源",
};

export const DOMAIN_TAGLINE: Record<DomainKey, string> = {
  study: "理解你的学习方式、知识优势与成长路径",
  career: "看见你的能力、位置与下一步方向",
  love: "理解你的亲密模式、需要与边界",
  wealth: "理解你的积累方式、机会与风险偏好",
};
