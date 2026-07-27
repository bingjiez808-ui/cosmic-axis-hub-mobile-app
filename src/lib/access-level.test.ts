// @ts-expect-error — bun:test
import { describe, expect, test } from "bun:test";
import {
  ACCESS_LABEL,
  UPGRADE_CTA,
  hasAccess,
  requiredLevelFor,
  resolveTierLevel,
  type AccessContext,
} from "./access-level";

const NOW = new Date("2026-07-27T00:00:00Z");
const FUTURE = new Date("2027-01-01T00:00:00Z").toISOString();
const PAST = new Date("2026-06-01T00:00:00Z").toISOString();

const ctx = (over: Partial<AccessContext> = {}): AccessContext => ({
  membershipTier: "none",
  membershipExpiresAt: null,
  premiumChartIds: [],
  now: NOW,
  ...over,
});

describe("access-level — fail-closed capability resolver", () => {
  test("free features unlock for everyone", () => {
    expect(hasAccess("panorama_basic", ctx())).toBe(true);
    expect(hasAccess("daily_reading", ctx())).toBe(true);
    expect(hasAccess("concern_situational_response", ctx())).toBe(true);
    expect(hasAccess("personal_bookshelf", ctx())).toBe(true);
  });

  test("sage feature stays locked without active sage/oracle", () => {
    expect(hasAccess("concern_deep_chapter", ctx())).toBe(false);
    // Expired sage is treated as free.
    expect(
      hasAccess(
        "concern_deep_chapter",
        ctx({ membershipTier: "sage", membershipExpiresAt: PAST }),
      ),
    ).toBe(false);
    // Active sage unlocks.
    expect(
      hasAccess(
        "concern_deep_chapter",
        ctx({ membershipTier: "sage", membershipExpiresAt: FUTURE }),
      ),
    ).toBe(true);
    // Oracle is a superset of sage.
    expect(
      hasAccess(
        "concern_deep_chapter",
        ctx({ membershipTier: "oracle", membershipExpiresAt: FUTURE }),
      ),
    ).toBe(true);
  });

  test("oracle-only features refuse sage tier", () => {
    expect(
      hasAccess(
        "cross_tradition_synthesis",
        ctx({ membershipTier: "sage", membershipExpiresAt: FUTURE }),
      ),
    ).toBe(false);
    expect(
      hasAccess(
        "cross_tradition_synthesis",
        ctx({ membershipTier: "oracle", membershipExpiresAt: FUTURE }),
      ),
    ).toBe(true);
  });

  test("premium report is per-chart and independent of subscription", () => {
    // Owning premium for chart A does not unlock chart B.
    const owned = ctx({ premiumChartIds: ["A"] });
    expect(hasAccess("premium_report_read", owned, { chartId: "A" })).toBe(true);
    expect(hasAccess("premium_report_read", owned, { chartId: "B" })).toBe(false);
    // No chartId → always false.
    expect(hasAccess("premium_report_read", owned)).toBe(false);
    // Oracle tier does NOT auto-unlock premium report — separate SKU.
    expect(
      hasAccess(
        "premium_report_read",
        ctx({ membershipTier: "oracle", membershipExpiresAt: FUTURE }),
        { chartId: "A" },
      ),
    ).toBe(false);
  });

  test("resolveTierLevel expires membership correctly", () => {
    expect(resolveTierLevel(ctx())).toBe("free");
    expect(
      resolveTierLevel(ctx({ membershipTier: "sage", membershipExpiresAt: PAST })),
    ).toBe("free");
    expect(
      resolveTierLevel(ctx({ membershipTier: "sage", membershipExpiresAt: FUTURE })),
    ).toBe("sage");
    expect(
      resolveTierLevel(ctx({ membershipTier: "oracle", membershipExpiresAt: FUTURE })),
    ).toBe("oracle");
  });

  test("required level for every feature is declarative", () => {
    expect(requiredLevelFor("panorama_basic")).toBe("free");
    expect(requiredLevelFor("concern_deep_chapter")).toBe("sage");
    expect(requiredLevelFor("cross_tradition_synthesis")).toBe("oracle");
    expect(requiredLevelFor("premium_report_read")).toBe("premium_report");
  });

  test("UI vocabulary avoids raw enum values", () => {
    // Every level must ship a bilingual label.
    for (const level of ["free", "sage", "oracle", "premium_report"] as const) {
      expect(ACCESS_LABEL[level].zh.length).toBeGreaterThan(0);
      expect(ACCESS_LABEL[level].en.length).toBeGreaterThan(0);
    }
    // Upgrade CTAs never use "立即升级" — must be result-oriented.
    for (const feature of Object.keys(UPGRADE_CTA) as (keyof typeof UPGRADE_CTA)[]) {
      const cta = UPGRADE_CTA[feature]!;
      expect(cta.zh).not.toContain("立即升级");
      expect(cta.en.toLowerCase()).not.toContain("upgrade now");
    }
  });
});
