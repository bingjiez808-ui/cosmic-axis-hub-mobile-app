// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import {
  AI_BUDGET_POLICY,
  checkBudgetBeforeChapter,
  chapterOutputCap,
  describeCallPath,
  estimateCredits,
} from "./budget-policy";

describe("budget-policy — checkBudgetBeforeChapter", () => {
  it("continues while both input+output remaining ≥ per-chapter cap", () => {
    const d = checkBudgetBeforeChapter({ input_tokens: 0, output_tokens: 0 });
    expect(d.action).toBe("continue");
  });
  it("stops when remaining output < per-chapter cap", () => {
    const used = { input_tokens: 0, output_tokens: AI_BUDGET_POLICY.report_max_output_tokens - 100 };
    const d = checkBudgetBeforeChapter(used);
    expect(d.action).toBe("stop");
    expect(d).toMatchObject({ reason: "report_output_exhausted" });
  });
  it("stops when remaining input < per-chapter cap", () => {
    const used = { input_tokens: AI_BUDGET_POLICY.report_max_input_tokens - 100, output_tokens: 0 };
    const d = checkBudgetBeforeChapter(used);
    expect(d.action).toBe("stop");
    expect(d).toMatchObject({ reason: "report_input_exhausted" });
  });
});

describe("budget-policy — chapterOutputCap", () => {
  it("returns policy cap while budget is fresh", () => {
    expect(chapterOutputCap({ input_tokens: 0, output_tokens: 0 })).toBe(AI_BUDGET_POLICY.chapter_max_output_tokens);
  });
  it("clamps to remaining budget near the ceiling", () => {
    const used = { input_tokens: 0, output_tokens: AI_BUDGET_POLICY.report_max_output_tokens - 500 };
    expect(chapterOutputCap(used)).toBe(500);
  });
  it("never returns negative", () => {
    const used = { input_tokens: 0, output_tokens: AI_BUDGET_POLICY.report_max_output_tokens + 100 };
    expect(chapterOutputCap(used)).toBe(0);
  });
});

describe("budget-policy — estimateCredits", () => {
  it("returns null when rates unknown (no guessing)", () => {
    expect(estimateCredits({ input_tokens: 1000, output_tokens: 1000 }, null)).toBeNull();
  });
  it("computes linear cost with provided rates", () => {
    const cost = estimateCredits(
      { input_tokens: 2000, output_tokens: 500 },
      { input_credits_per_1k: 0.1, output_credits_per_1k: 0.4 },
    );
    // 2*0.1 + 0.5*0.4 = 0.2 + 0.2 = 0.4
    expect(cost).toBeCloseTo(0.4, 4);
  });
});

describe("budget-policy — describeCallPath", () => {
  it("reports zero AI calls on cache hit and view", () => {
    const p = describeCallPath(24);
    expect(p.cache_hit_calls).toBe(0);
    expect(p.view_report_calls).toBe(0);
    expect(p.local_calculation_calls).toBe(0);
    expect(p.calls_per_new_report).toBe(24);
    expect(p.max_output_tokens).toBe(24 * AI_BUDGET_POLICY.chapter_max_output_tokens);
  });
});
