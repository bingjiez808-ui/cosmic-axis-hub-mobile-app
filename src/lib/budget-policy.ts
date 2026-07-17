/**
 * AI_BUDGET_POLICY — hard ceilings for the Premium ¥79 deep report.
 *
 * The reading engine MUST respect these limits and abort the run as
 * `partial` (never silently exceed):
 *   • per-chapter max output tokens
 *   • per-chapter max input tokens
 *   • whole-report max total input + output tokens
 *   • per-chapter max retries (state-machine also enforces this)
 *
 * Costing is intentionally reported as tokens + a linear formula, not
 * a hard-coded ¥ amount. The exact ¥/credit rate is a runtime provider
 * setting; see `estimateCredits` for the formula.
 */

export const AI_BUDGET_POLICY = {
  model_id: "google/gemini-2.5-flash",
  temperature: 0,
  // Per-chapter caps
  chapter_max_input_tokens: 6000,
  chapter_max_output_tokens: 1800,
  chapter_max_retries: 3,
  // Whole-report caps (24 chapters × ~1.8k output ≈ 43k; add buffer)
  report_max_input_tokens: 180_000,
  report_max_output_tokens: 60_000,
  // Absolute hard stop across a single generation call (worker safety)
  report_max_wall_seconds: 900,
} as const;

export type BudgetLimits = {
  chapter_max_input_tokens: number;
  chapter_max_output_tokens: number;
  report_max_input_tokens: number;
  report_max_output_tokens: number;
};

export type BudgetUsage = {
  input_tokens: number;
  output_tokens: number;
};

export type BudgetDecision =
  | { action: "continue"; remaining_input: number; remaining_output: number }
  | { action: "stop"; reason: "report_input_exhausted" | "report_output_exhausted" };

/**
 * After N chapters have run, should we continue? Called BEFORE each
 * new chapter call. If continuing would risk exceeding a report-level
 * ceiling, stop as partial.
 */
export function checkBudgetBeforeChapter(
  usedSoFar: BudgetUsage,
  policy: typeof AI_BUDGET_POLICY = AI_BUDGET_POLICY,
): BudgetDecision {
  const remaining_input = policy.report_max_input_tokens - usedSoFar.input_tokens;
  const remaining_output = policy.report_max_output_tokens - usedSoFar.output_tokens;
  if (remaining_input < policy.chapter_max_input_tokens) {
    return { action: "stop", reason: "report_input_exhausted" };
  }
  if (remaining_output < policy.chapter_max_output_tokens) {
    return { action: "stop", reason: "report_output_exhausted" };
  }
  return { action: "continue", remaining_input, remaining_output };
}

/**
 * Chapter-level clamp: how many output tokens the AI call may request.
 * Returns min(policy, remaining budget).
 */
export function chapterOutputCap(
  usedSoFar: BudgetUsage,
  policy: typeof AI_BUDGET_POLICY = AI_BUDGET_POLICY,
): number {
  const remaining = policy.report_max_output_tokens - usedSoFar.output_tokens;
  return Math.max(0, Math.min(policy.chapter_max_output_tokens, remaining));
}

/**
 * Linear cost estimator in Lovable credits. Rates are provided at
 * runtime (typically pulled from AI Gateway pricing table). Kept in
 * one place so both server code and admin dashboards derive numbers
 * consistently. Returns null when rates are unknown — never guesses.
 */
export function estimateCredits(
  usage: BudgetUsage,
  rates: { input_credits_per_1k: number; output_credits_per_1k: number } | null,
): number | null {
  if (!rates) return null;
  const inCost = (usage.input_tokens / 1000) * rates.input_credits_per_1k;
  const outCost = (usage.output_tokens / 1000) * rates.output_credits_per_1k;
  return Math.round((inCost + outCost) * 10000) / 10000;
}

/**
 * Human-readable summary of the per-report call path — surfaced in the
 * admin dashboard AND emitted to logs so support can answer "how much
 * did this report cost the user?" without inventing numbers.
 */
export function describeCallPath(chapterCount: number) {
  const p = AI_BUDGET_POLICY;
  return {
    model: p.model_id,
    calls_per_new_report: chapterCount, // one per chapter, cache-miss
    cache_hit_calls: 0,
    view_report_calls: 0,
    local_calculation_calls: 0,
    max_input_tokens: chapterCount * p.chapter_max_input_tokens,
    max_output_tokens: chapterCount * p.chapter_max_output_tokens,
    hard_report_cap: {
      input: p.report_max_input_tokens,
      output: p.report_max_output_tokens,
    },
    retry_billing: "Each retry that reaches the provider counts as a new call.",
    partial_stop: "When any report cap is reached, generation halts as partial; already-completed chapters remain.",
  };
}
