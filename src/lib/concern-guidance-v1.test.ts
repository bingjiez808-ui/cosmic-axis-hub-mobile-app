// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import {
  CONCERNS,
  CONCERN_KEYS,
  isConcernKey,
  isReportSection,
  isSafeReturnTo,
  REPORT_SECTION_WHITELIST,
  resolveConcernRoute,
  selectDailyCounsel,
  SHELF_BOOKS,
} from "@/lib/concern-guidance-v1";

describe("concern-guidance-v1", () => {
  test("7 concerns, complete zh/en, whitelisted targetSection", () => {
    expect(CONCERN_KEYS.length).toBe(7);
    for (const k of CONCERN_KEYS) {
      const r = CONCERNS[k];
      for (const lang of ["zh", "en"] as const) {
        expect(r.chip[lang].length).toBeGreaterThan(1);
        expect(r.question[lang].length).toBeGreaterThan(6);
        expect(r.situationalResponse[lang].length).toBeGreaterThan(40);
        expect(r.featureBullets[lang].length).toBeGreaterThanOrEqual(4);
        expect(r.sampleOutput[lang].length).toBeGreaterThan(20);
        expect(r.ctaLabel[lang].length).toBeGreaterThan(4);
        expect(r.nextStepHint[lang].length).toBeGreaterThan(10);
      }
      expect(isReportSection(r.targetSection)).toBe(true);
      expect(REPORT_SECTION_WHITELIST).toContain(r.targetSection);
    }
  });

  test("isConcernKey and isSafeReturnTo gate bad inputs", () => {
    expect(isConcernKey("study")).toBe(true);
    expect(isConcernKey("nope")).toBe(false);
    expect(isConcernKey(null)).toBe(false);
    expect(isSafeReturnTo("/me/home")).toBe(true);
    expect(isSafeReturnTo("//evil.com")).toBe(false);
    expect(isSafeReturnTo("https://evil.com")).toBe(false);
    expect(isSafeReturnTo("javascript:alert(1)")).toBe(false);
    expect(isSafeReturnTo(null)).toBe(false);
  });

  test("resolveConcernRoute — unsigned goes to /auth signup with same-origin ritual redirect", () => {
    const href = resolveConcernRoute({
      concern: "career",
      isSignedIn: false,
      hasPrimaryChart: false,
    });
    expect(href.startsWith("/auth?mode=signup")).toBe(true);
    expect(href).toContain("redirect=");
    expect(href).toContain(encodeURIComponent("/ritual?concern=career"));
    // Never leaks a protocol-relative or absolute URL:
    expect(href.includes("//evil")).toBe(false);
  });

  test("resolveConcernRoute — signed-in no chart lands on ritual", () => {
    const href = resolveConcernRoute({
      concern: "love",
      isSignedIn: true,
      hasPrimaryChart: false,
    });
    expect(href).toBe("/ritual?concern=love");
  });

  test("resolveConcernRoute — with chart + report lands on report focus", () => {
    const href = resolveConcernRoute({
      concern: "study",
      isSignedIn: true,
      hasPrimaryChart: true,
      existingReportId: "abc-123",
    });
    expect(href).toContain("/report?id=abc-123");
    expect(href).toContain("focus=academic");
  });

  test("resolveConcernRoute — with chart but no report goes to /me/home welcome anchor", () => {
    const href = resolveConcernRoute({
      concern: "overview",
      isSignedIn: true,
      hasPrimaryChart: true,
    });
    expect(href).toBe("/me/home?concern=overview#curator-welcome");
  });

  test("selectDailyCounsel — deterministic, band fallback safe", () => {
    const a = selectDailyCounsel({ concern: "career", band: "supportive", lang: "zh" });
    const b = selectDailyCounsel({ concern: "career", band: "supportive", lang: "zh" });
    expect(a).toEqual(b);
    expect(a.response.length).toBeGreaterThan(6);
    expect(a.today.length).toBeGreaterThan(6);
    expect(a.move.length).toBeGreaterThan(6);
    // Unknown band → neutral, never blank
    const c = selectDailyCounsel({ concern: "love", band: "unknown" as never, lang: "en" });
    const n = selectDailyCounsel({ concern: "love", band: "neutral", lang: "en" });
    expect(c).toEqual(n);
  });

  test("shelf books map to real concern keys", () => {
    for (const b of SHELF_BOOKS) {
      expect(CONCERN_KEYS).toContain(b.ctaTarget);
      for (const lang of ["zh", "en"] as const) {
        expect(b.title[lang].length).toBeGreaterThan(1);
        expect(b.oneLiner[lang].length).toBeGreaterThan(10);
        expect(b.answers[lang].length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
