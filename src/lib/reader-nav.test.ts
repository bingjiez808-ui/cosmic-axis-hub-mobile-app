/**
 * Unit tests for the reader navigation helpers used by
 * `PremiumReportReader`. Focus:
 *   - scroll-progress math (edge cases, clamping)
 *   - prev/next chapter neighbors (boundaries disabled)
 *   - audit-line rendering never leaks hashes/tokens
 *   - legacy v1 content (no `facts`) is still recognised
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";

import {
  chapterIndex,
  computeScrollProgress,
  formatAuditLine,
  hasFacts,
  neighborChapters,
  type ChapterLite,
} from "./reader-nav";

const chapters: ChapterLite[] = [
  { key: "executive_summary", title: "Executive" },
  { key: "western", title: "Western" },
  { key: "bazi", title: "BaZi" },
  { key: "closing", title: "Closing" },
];

describe("computeScrollProgress", () => {
  test("returns 0 when the document fits in the viewport", () => {
    expect(computeScrollProgress(0, 500, 500)).toBe(0);
    expect(computeScrollProgress(0, 400, 500)).toBe(0);
  });
  test("returns 0 at the very top", () => {
    expect(computeScrollProgress(0, 2000, 500)).toBe(0);
  });
  test("returns 100 at the very bottom", () => {
    expect(computeScrollProgress(1500, 2000, 500)).toBe(100);
  });
  test("returns ~50 in the middle", () => {
    expect(computeScrollProgress(750, 2000, 500)).toBe(50);
  });
  test("clamps below 0 and above 100", () => {
    expect(computeScrollProgress(-999, 2000, 500)).toBe(0);
    expect(computeScrollProgress(99999, 2000, 500)).toBe(100);
  });
});

describe("chapter navigation", () => {
  test("chapterIndex finds keys and returns -1 for unknown", () => {
    expect(chapterIndex(chapters, "bazi")).toBe(2);
    expect(chapterIndex(chapters, null)).toBe(-1);
    expect(chapterIndex(chapters, "missing")).toBe(-1);
  });

  test("first chapter disables prev", () => {
    const { prev, next } = neighborChapters(chapters, "executive_summary");
    expect(prev).toBeNull();
    expect(next).toBe("western");
  });

  test("last chapter disables next", () => {
    const { prev, next } = neighborChapters(chapters, "closing");
    expect(prev).toBe("bazi");
    expect(next).toBeNull();
  });

  test("middle chapters expose both", () => {
    expect(neighborChapters(chapters, "western")).toEqual({
      prev: "executive_summary",
      next: "bazi",
    });
  });

  test("unknown key yields both null", () => {
    expect(neighborChapters(chapters, "unknown")).toEqual({ prev: null, next: null });
  });
});

describe("formatAuditLine", () => {
  test("renders schema/prompt/model/calc versions and generated date", () => {
    const line = formatAuditLine(
      {
        generated_at: "2026-07-17T12:00:00.000Z",
        report_schema_version: "v2",
        prompt_version: "reading_prompt_v2.0.0",
        model_id: "google/gemini-2.5-flash",
        calculation_version: "calc_v3",
      },
      "en",
    );
    expect(line).toMatch(/schema v2/);
    expect(line).toMatch(/prompt reading_prompt_v2\.0\.0/);
    expect(line).toMatch(/model google\/gemini-2\.5-flash/);
    expect(line).toMatch(/calc calc_v3/);
    // No hash or token count leaked.
    expect(line).not.toMatch(/hash/i);
    expect(line).not.toMatch(/token/i);
  });

  test("skips missing fields gracefully", () => {
    expect(formatAuditLine({}, "en")).toBe("");
    expect(
      formatAuditLine({ report_schema_version: "v1" }, "zh"),
    ).toBe("schema v1");
  });
});

describe("hasFacts (v1 vs v2 schema)", () => {
  test("v1 legacy content (no facts) is recognised as facts-less", () => {
    expect(hasFacts({ chapters: [] } as unknown as Parameters<typeof hasFacts>[0])).toBe(false);
    expect(hasFacts(null)).toBe(false);
    expect(hasFacts(undefined)).toBe(false);
  });
  test("v2 content with facts is recognised", () => {
    expect(hasFacts({ facts: { bazi: null } })).toBe(true);
  });
});
