import { describe, it, expect } from "vitest";

import {
  CLIENT_SAFE_KEYS,
  assertNoPii,
  ageBandFromDob,
} from "@/lib/community-match.functions";
import { communityMatchCopy } from "@/lib/i18n-community-match";

describe("community-match client-safe contract", () => {
  it("candidate payloads containing only whitelisted keys pass assertNoPii", () => {
    const candidate = {
      alias: "traveler-42",
      ageBand: "25-34",
      overall: 78,
      overallBand: "high",
      facets: [{ key: "communication", score: 80, band: "high" }],
      evidence: ["mock resonance"],
      partial: false,
      confidence: 0.9,
    };
    for (const key of Object.keys(candidate)) expect(CLIENT_SAFE_KEYS.has(key)).toBe(true);
    expect(() => assertNoPii(candidate)).not.toThrow();
  });

  it("throws when a payload contains user_id / email / birth_date", () => {
    expect(() => assertNoPii({ user_id: "abc" })).toThrow();
    expect(() => assertNoPii({ email: "x@y" })).toThrow();
    expect(() => assertNoPii({ birth_date: "2000-01-01" })).toThrow();
  });

  it("ageBandFromDob buckets ages correctly", () => {
    const today = new Date();
    const y = (offset: number) => `${today.getUTCFullYear() - offset}-01-01`;
    expect(ageBandFromDob(y(20))).toBe("18-24");
    expect(ageBandFromDob(y(30))).toBe("25-34");
    expect(ageBandFromDob(y(60))).toBe("55+");
    expect(ageBandFromDob(y(10))).toBeNull();
  });
});

describe("community-match i18n", () => {
  it("returns Chinese for zh and English for en on tab labels", () => {
    expect(communityMatchCopy("zh").t("tab_community")).toContain("匿名");
    expect(communityMatchCopy("en").t("tab_community")).toContain("Community");
  });

  it("maps server error codes to localized copy", () => {
    const zh = communityMatchCopy("zh");
    expect(zh.errFor("primary_chart_required")).toContain("主命盘");
    expect(zh.errFor("rate_limited")).toContain("频繁");
    expect(communityMatchCopy("en").errFor("daily_limit")).toContain("Daily");
  });

  it("formats facet labels bilingually", () => {
    expect(communityMatchCopy("zh").facetLabel("communication")).toBe("沟通");
    expect(communityMatchCopy("en").facetLabel("emotional_support")).toBe("Emotional support");
  });
});
