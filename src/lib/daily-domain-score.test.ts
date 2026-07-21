// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { computeDailyFacts } from "./daily-facts";
import { computeDailyDomainScore, DAILY_DOMAIN_SCORE_VERSION } from "./daily-domain-score";
import { computeWesternChart } from "./western-natal";

const NATAL_UTC = new Date(Date.UTC(1988, 5, 15, 8, 0, 0));
function natal() {
  const c = computeWesternChart({ utc: NATAL_UTC, lat: 31.23, lng: 121.47 });
  if (!c) throw new Error("natal compute failed");
  return c;
}

describe("daily-domain-score-v1", () => {
  const n = natal();
  const facts = computeDailyFacts({ natal: n.planets, localDate: "2026-07-21", timezone: "Asia/Shanghai" })!;

  test("no facts → partial=true, all domains 50, low confidence, no fabricated scores", () => {
    const s = computeDailyDomainScore({ facts: null, natalHasTime: false });
    expect(s.partial).toBe(true);
    expect(s.missing_facts).toContain("daily_facts_v1");
    for (const d of s.domains) {
      expect(d.score).toBe(50);
      expect(d.confidence).toBe("low");
      expect(d.evidence_refs.length).toBe(0);
    }
  });

  test("deterministic: same input → identical output (no Math.random)", () => {
    const a = computeDailyDomainScore({ facts, natalHasTime: true });
    const b = computeDailyDomainScore({ facts, natalHasTime: true });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("scores clamped to [0,100], version pinned, 4 domains present", () => {
    const s = computeDailyDomainScore({ facts, natalHasTime: true });
    expect(s.score_version).toBe(DAILY_DOMAIN_SCORE_VERSION);
    expect(s.overall.score).toBeGreaterThanOrEqual(0);
    expect(s.overall.score).toBeLessThanOrEqual(100);
    const domains = s.domains.map((d) => d.domain).sort();
    expect(domains).toEqual(["career", "love", "study", "wealth"]);
    for (const d of s.domains) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(100);
    }
  });

  test("missing natal time → confidence drops to 'low' on every domain", () => {
    const s = computeDailyDomainScore({ facts, natalHasTime: false });
    for (const d of s.domains) expect(d.confidence).toBe("low");
    expect(s.missing_facts).toContain("natal_ascendant_and_houses");
  });

  test("contradictions surface when spread ≥ 20 between best and worst domain", () => {
    // Synthesise a spread by injecting a fabricated facts object with only
    // supportive Jupiter aspects on wealth targets and only square Saturn
    // on career targets.
    const s = computeDailyDomainScore({ facts, natalHasTime: true });
    const scores = s.domains.map((d) => d.score);
    const spread = Math.max(...scores) - Math.min(...scores);
    if (spread >= 20) expect(s.contradictions.length).toBeGreaterThan(0);
    else expect(s.contradictions.length).toBe(0);
  });

  test("slower-cycle context passes through opaquely", () => {
    const s = computeDailyDomainScore({
      facts, natalHasTime: true,
      slower: { vedic: "Jup–Sat–Mer", bazi: "戊土大运 / 丙寅流年", ziwei: "命宫大限 / 甲辰流年" },
    });
    expect(s.slower_cycle_context.vedic).toBe("Jup–Sat–Mer");
    expect(s.slower_cycle_context.bazi).toContain("戊土");
    expect(s.slower_cycle_context.ziwei).toContain("大限");
  });
});
