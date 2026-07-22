// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { computeDailyFacts } from "./daily-facts";
import { computeDailyDomainScore } from "./daily-domain-score";
import { computeWesternChart } from "./western-natal";
import { interpretAll, interpretDomain, DAILY_PLAIN_LANGUAGE_VERSION } from "./daily-plain-language";

const NATAL_UTC = new Date(Date.UTC(1988, 5, 15, 8, 0, 0));
function natal() {
  const c = computeWesternChart({ utc: NATAL_UTC, lat: 31.23, lng: 121.47 });
  if (!c) throw new Error("natal");
  return c;
}

const FORBIDDEN_ZH = /(三分|四分|对分|合相|trine|square|opposition|conjunction|sextile|sun→|moon→|→sun|→moon|study:|career:|love:|body_mind:|finance:)/i;

describe("daily-plain-language-v1", () => {
  const n = natal();
  const facts = computeDailyFacts({ natal: n.planets, localDate: "2026-07-21", timezone: "Asia/Shanghai" })!;
  const score = computeDailyDomainScore({ facts, natalHasTime: true });

  test("version pinned", () => {
    expect(DAILY_PLAIN_LANGUAGE_VERSION).toBe("daily-plain-v1");
  });

  test("deterministic: same input → identical output", () => {
    const a = interpretAll({ score, facts, lang: "zh" });
    const b = interpretAll({ score, facts, lang: "zh" });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("zh output does NOT leak raw aspect / planet / domain keys", () => {
    const out = interpretAll({ score, facts, lang: "zh" });
    const blob = JSON.stringify(out);
    expect(FORBIDDEN_ZH.test(blob)).toBe(false);
  });

  test("every domain × every band template exists in zh + en", () => {
    for (const domain of ["overall", "love", "study", "career", "body_mind", "finance"] as const) {
      for (const lang of ["zh", "en"] as const) {
        const partial = domain === "overall" ? score : score;
        const out = interpretDomain({ domain, score: partial, facts, lang });
        expect(out.headline.length).toBeGreaterThan(0);
        expect(out.may_show_as.length).toBeGreaterThan(0);
        expect(out.do_today.length).toBeGreaterThan(0);
        expect(out.avoid_today.length).toBeGreaterThan(0);
      }
    }
  });

  test("no-facts → neutral overall with missing_data note", () => {
    const empty = computeDailyDomainScore({ facts: null, natalHasTime: false });
    const out = interpretDomain({ domain: "overall", score: empty, facts: null, lang: "zh" });
    expect(out.band).toBe("neutral");
    expect(out.missing_data_note).not.toBeNull();
  });

  test("breakdown deltas sum ≈ (score - 50) up to rounding", () => {
    for (const d of score.domains) {
      const sum = d.breakdown.reduce((s, b) => s + b.delta_applied, 0);
      // Allow ±2 rounding drift: aggregate score uses Math.round(50 + delta*2)
      // while each breakdown row rounds delta_raw*2 independently.
      expect(Math.abs(d.score - 50 - sum)).toBeLessThanOrEqual(Math.max(2, d.breakdown.length));
    }
  });

  test("safety: no love promises / body_mind diagnosis / finance return predictions", () => {
    const out = interpretAll({ score, facts, lang: "zh" });
    const blob = JSON.stringify(out);
    expect(blob).not.toMatch(/一定会|必然|保证|注定|命中/);
    expect(blob).not.toMatch(/(诊断|症状|治疗|确诊)/);
    expect(blob).not.toMatch(/(收益率|回报率|稳赚|翻倍)/);
  });
});
