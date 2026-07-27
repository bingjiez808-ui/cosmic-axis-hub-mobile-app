/**
 * Fun Library · Reading Personality — deterministic algorithm tests.
 *
 * Guards:
 *  - all 16 codes reachable via constructed answer sets
 *  - same answers → same result
 *  - mutating one answer shifts the axis by exactly the weight delta
 *  - tie-break is stable across runs
 *  - scoring never touches network / fetch
 */

// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import { QUIZ, QUIZ_VERSION } from "./quiz";
import { SCORING_VERSION, scoreReadingPersonality } from "./scoring";
import { ALL_TYPE_CODES, TYPE_CATALOG } from "./types-catalog";
import type { AxisKey } from "./types";

const AXES: AxisKey[] = ["ML", "ET", "AC", "FO"];

function buildAnswersForSigns(signs: Record<AxisKey, 1 | -1>): string[] {
  return QUIZ.map((q) => {
    let bestOpt = q.options[0];
    let bestScore = -Infinity;
    for (const opt of q.options) {
      let s = 0;
      for (const ax of AXES) {
        const w = opt.weights[ax] ?? 0;
        s += w * signs[ax];
      }
      if (s > bestScore) {
        bestScore = s;
        bestOpt = opt;
      }
    }
    return bestOpt.id;
  });
}

describe("Fun Library · quiz shape", () => {
  it("has 12 questions × 4 options", () => {
    expect(QUIZ).toHaveLength(12);
    for (const q of QUIZ) expect(q.options).toHaveLength(4);
  });

  it("each axis is hit by exactly 6 questions and its ± sums to 0", () => {
    for (const ax of AXES) {
      let touched = 0;
      let sum = 0;
      for (const q of QUIZ) {
        const opts = q.options.filter((o) => (o.weights[ax] ?? 0) !== 0);
        if (opts.length > 0) touched += 1;
        for (const o of q.options) sum += o.weights[ax] ?? 0;
      }
      expect(touched).toBe(6);
      expect(sum).toBe(0);
    }
  });

  it("no option is single-axis (each option contributes to ≥2 axes)", () => {
    for (const q of QUIZ) {
      for (const o of q.options) {
        const nonZero = AXES.filter((ax) => (o.weights[ax] ?? 0) !== 0).length;
        expect(nonZero).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe("Fun Library · scoring", () => {
  it("is deterministic for the same answers", () => {
    const answers = buildAnswersForSigns({ ML: 1, ET: 1, AC: 1, FO: 1 });
    const a = scoreReadingPersonality(answers);
    const b = scoreReadingPersonality(answers);
    expect(a).toEqual(b);
  });

  it("emits the correct scoring/quiz versions", () => {
    const answers = QUIZ.map((q) => q.options[0].id);
    const r = scoreReadingPersonality(answers);
    expect(r.quizVersion).toBe(QUIZ_VERSION);
    expect(r.scoringVersion).toBe(SCORING_VERSION);
  });

  it("all 16 personality codes are reachable", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 16; i += 1) {
      const signs: Record<AxisKey, 1 | -1> = {
        ML: (i & 1 ? 1 : -1) as 1 | -1,
        ET: (i & 2 ? 1 : -1) as 1 | -1,
        AC: (i & 4 ? 1 : -1) as 1 | -1,
        FO: (i & 8 ? 1 : -1) as 1 | -1,
      };
      const answers = buildAnswersForSigns(signs);
      const r = scoreReadingPersonality(answers);
      seen.add(r.code);
    }
    expect(seen.size).toBe(16);
    for (const code of seen) expect(ALL_TYPE_CODES).toContain(code);
  });

  it("changing one answer shifts axes by exactly the weight delta", () => {
    const base = QUIZ.map((q) => q.options[0].id);
    const baseR = scoreReadingPersonality(base);
    const mutated = [...base];
    mutated[0] = QUIZ[0].options[3].id;
    const mutR = scoreReadingPersonality(mutated);
    for (const ax of AXES) {
      const delta =
        (QUIZ[0].options[3].weights[ax] ?? 0) -
        (QUIZ[0].options[0].weights[ax] ?? 0);
      expect(mutR.axes[ax].raw - baseR.axes[ax].raw).toBe(delta);
    }
  });

  it("tie-break at raw=0 is stable across repeated runs", () => {
    const answers = QUIZ.map((q, i) => q.options[i % 2 === 0 ? 0 : 3].id);
    const first = scoreReadingPersonality(answers);
    for (let i = 0; i < 5; i += 1) {
      expect(scoreReadingPersonality(answers)).toEqual(first);
    }
  });

  it("scoring never calls global fetch", () => {
    let called = 0;
    const original = globalThis.fetch;
    (globalThis as { fetch: unknown }).fetch = (..._args: unknown[]) => {
      called += 1;
      return Promise.reject(new Error("network forbidden"));
    };
    try {
      const answers = QUIZ.map((q) => q.options[0].id);
      scoreReadingPersonality(answers);
    } finally {
      globalThis.fetch = original;
    }
    expect(called).toBe(0);
  });
});

describe("Fun Library · type catalog", () => {
  it("has all 16 codes with unique names", () => {
    expect(ALL_TYPE_CODES).toHaveLength(16);
    const zhNames = new Set(ALL_TYPE_CODES.map((c) => TYPE_CATALOG[c].name.zh));
    const enNames = new Set(ALL_TYPE_CODES.map((c) => TYPE_CATALOG[c].name.en));
    expect(zhNames.size).toBe(16);
    expect(enNames.size).toBe(16);
  });
});
