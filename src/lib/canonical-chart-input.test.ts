/**
 * Regression tests for the shared canonical chart-input builder.
 *
 * `report.tsx` (runReport) and `PremiumPdfCard` (refresh) BOTH funnel
 * through `buildCanonicalChartInput` before calling `ensureChart`. Prior
 * to the fix, one side included `calculation_snapshot` in
 * `input_snapshot` while the other did not — but only the fields
 * `normalizeForHash` picks up should ever influence the hash. This file
 * pins that invariant so a future edit cannot silently re-split the
 * same user + birth data into two chart rows.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, expect, test } from "bun:test";

import {
  buildCanonicalChartInput,
  computeChartHash,
} from "./reports-store.functions";

const BASE_SEARCH = {
  name: "Alpha",
  date: "1992-04-15",
  time: "14:30",
  place: "Beijing",
  gender: "male" as const,
  lang: "zh" as const,
};

describe("buildCanonicalChartInput", () => {
  test("URL search.lang takes precedence over the fallback UI language", () => {
    const a = buildCanonicalChartInput({ ...BASE_SEARCH, lang: "zh" }, "en");
    const b = buildCanonicalChartInput({ ...BASE_SEARCH, lang: "zh" }, "zh");
    expect(a.lang).toBe("zh");
    expect(b.lang).toBe("zh");
    expect(computeChartHash(a)).toBe(computeChartHash(b));
  });

  test("hydration flicker (fallback lang differs) does NOT drift the hash when the URL fixes lang", () => {
    // Simulates the reported bug: PremiumPdfCard first renders with
    // useLang()="en" (SSR default) then re-renders with "zh". As long
    // as both call sites route through this helper AND the URL carries
    // lang=zh, they must produce the same hash.
    const firstRender = buildCanonicalChartInput({ ...BASE_SEARCH, lang: "zh" }, "en");
    const secondRender = buildCanonicalChartInput({ ...BASE_SEARCH, lang: "zh" }, "zh");
    expect(computeChartHash(firstRender)).toBe(computeChartHash(secondRender));
  });

  test("PremiumPdfCard-style input_snapshot enrichment does not change the hash", () => {
    const runReportSide = buildCanonicalChartInput(BASE_SEARCH, "zh");
    const premiumCardSide = buildCanonicalChartInput(BASE_SEARCH, "zh");
    // The premium card enriches input_snapshot with calculation_snapshot.
    const enriched = {
      ...premiumCardSide,
      input_snapshot: {
        ...premiumCardSide.input_snapshot,
        calculation_snapshot: { anything: true, arbitrary: ["blob"] },
      },
    };
    expect(computeChartHash(runReportSide)).toBe(computeChartHash(enriched));
  });

  test("object-literal key order and undefined-vs-missing keys hash identically", () => {
    const shapeA = buildCanonicalChartInput(
      { lang: "zh", date: "1992-04-15", time: "14:30", place: "Beijing", gender: "male", name: "Alpha" },
      "zh",
    );
    const shapeB = buildCanonicalChartInput(
      { name: "Alpha", date: "1992-04-15", time: "14:30", place: "Beijing", gender: "male", lang: "zh" },
      "zh",
    );
    const shapeC = buildCanonicalChartInput(
      { date: "1992-04-15", time: "14:30", place: "Beijing", gender: "male", lang: "zh", name: undefined },
      "zh",
    );
    expect(computeChartHash(shapeA)).toBe(computeChartHash(shapeB));
    expect(computeChartHash(shapeA)).toBe(computeChartHash(shapeC));
  });

  test("place casing / surrounding whitespace collapse to the same hash", () => {
    const a = buildCanonicalChartInput({ ...BASE_SEARCH, place: "Beijing" }, "zh");
    const b = buildCanonicalChartInput({ ...BASE_SEARCH, place: "  beijing " }, "zh");
    expect(computeChartHash(a)).toBe(computeChartHash(b));
  });

  test("different genders produce different hashes — Zi Wei binding is intentional", () => {
    const male = buildCanonicalChartInput({ ...BASE_SEARCH, gender: "male" }, "zh");
    const female = buildCanonicalChartInput({ ...BASE_SEARCH, gender: "female" }, "zh");
    expect(computeChartHash(male)).not.toBe(computeChartHash(female));
  });

  test("input_snapshot never leaks the raw search keys that could accidentally change the hash", () => {
    // A caller passing an unknown extra key on `search` must not be
    // able to drift the hash. Since normalizeForHash whitelists fields,
    // extra keys are ignored — this locks it in.
    const withExtras = buildCanonicalChartInput(
      Object.assign({}, BASE_SEARCH, { readingId: "abc", quiz: "x", zodiac: "y" }) as typeof BASE_SEARCH,
      "zh",
    );
    const clean = buildCanonicalChartInput(BASE_SEARCH, "zh");
    expect(computeChartHash(withExtras)).toBe(computeChartHash(clean));
  });
});
