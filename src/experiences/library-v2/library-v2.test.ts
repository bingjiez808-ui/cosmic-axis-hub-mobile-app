// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  LIBRARY_EXPERIENCE_VERSION,
} from "@/experiences/library-v2/version";
import {
  DEMO_BOOKS,
  FOCUS_CARDS,
  nextBookAfter,
  recommendedOrderFor,
} from "@/experiences/library-v2/fixtures";
import {
  INITIAL_STATE,
  cardProgress,
  isCardStepValid,
  nextStep,
  prevStep,
} from "@/experiences/library-v2/state";

const REPO_ROOT = process.cwd();

describe("library-v2 version", () => {
  it("uses the frozen version string required by the spec", () => {
    expect(LIBRARY_EXPERIENCE_VERSION).toBe("library-v2-guided-2026-07");
  });
});

describe("library-v2 focus ordering", () => {
  it("exposes the four themed books plus an 'unsure' entry", () => {
    const keys = FOCUS_CARDS.map((f) => f.key).sort();
    expect(keys).toEqual(["career", "love", "self", "unsure", "wealth"]);
  });

  it("puts the picked focus first in the recommended order", () => {
    expect(recommendedOrderFor("career")[0]).toBe("career");
    expect(recommendedOrderFor("love")[0]).toBe("love");
    expect(recommendedOrderFor("wealth")[0]).toBe("wealth");
    expect(recommendedOrderFor("self")[0]).toBe("self");
  });

  it("has 'unsure' fall back to the self-first tour", () => {
    expect(recommendedOrderFor("unsure")[0]).toBe("self");
  });

  it("returns the same six books for every focus", () => {
    for (const f of ["career", "love", "wealth", "self", "unsure"] as const) {
      expect([...recommendedOrderFor(f)].sort()).toEqual(
        DEMO_BOOKS.map((b) => b.key).sort(),
      );
    }
  });

  it("walks to the next book and then null at the end", () => {
    const order = recommendedOrderFor("career");
    expect(nextBookAfter("career", order[0])).toBe(order[1]);
    expect(nextBookAfter("career", order[order.length - 1])).toBeNull();
  });
});

describe("library-v2 borrow card state machine", () => {
  it("reports 1/4 .. 4/4 progress across the card steps", () => {
    expect(cardProgress("card_name")).toEqual({ index: 1, total: 4 });
    expect(cardProgress("card_birth")).toEqual({ index: 2, total: 4 });
    expect(cardProgress("card_place")).toEqual({ index: 3, total: 4 });
    expect(cardProgress("card_confirm")).toEqual({ index: 4, total: 4 });
    expect(cardProgress("home")).toBeNull();
  });

  it("requires the correct fields at each step", () => {
    const card = { ...INITIAL_STATE.card };
    expect(isCardStepValid("card_name", card)).toBe(false);
    card.name = "Ada";
    expect(isCardStepValid("card_name", card)).toBe(true);
    expect(isCardStepValid("card_birth", card)).toBe(false);
    card.birth_date = "1990-01-01";
    card.birth_time = "09:30";
    expect(isCardStepValid("card_birth", card)).toBe(true);
    expect(isCardStepValid("card_place", card)).toBe(false);
    card.place = "Hangzhou";
    card.gender = "female";
    expect(isCardStepValid("card_place", card)).toBe(true);
    expect(isCardStepValid("card_confirm", card)).toBe(true);
  });

  it("advances through the card and back", () => {
    expect(nextStep("home")).toBe("card_name");
    expect(nextStep("card_name")).toBe("card_birth");
    expect(nextStep("card_birth")).toBe("card_place");
    expect(nextStep("card_place")).toBe("card_confirm");
    expect(nextStep("card_confirm")).toBe("archive");
    expect(prevStep("card_confirm")).toBe("card_place");
    expect(prevStep("card_name")).toBe("home");
    expect(prevStep("home")).toBe("home");
  });
});

describe("library-v2 book content contract", () => {
  it("provides all six books with quick + deep content", () => {
    expect(DEMO_BOOKS.map((b) => b.key)).toEqual([
      "self",
      "career",
      "love",
      "wealth",
      "timeline",
      "chart",
    ]);
    for (const b of DEMO_BOOKS) {
      expect(b.quick.keywords).toHaveLength(3);
      expect(b.deep.evidence.length).toBeGreaterThanOrEqual(4);
      expect(b.read_minutes).toBeGreaterThan(0);
    }
  });

  it("expands career with industry / role / environment", () => {
    const c = DEMO_BOOKS.find((b) => b.key === "career")!;
    expect(c.deep.career_detail).toBeDefined();
    expect(c.deep.career_detail!.industry.length).toBeGreaterThan(0);
    expect(c.deep.career_detail!.role.length).toBeGreaterThan(0);
    expect(c.deep.career_detail!.environment.length).toBeGreaterThan(0);
  });

  it("expands love with need / partner / conflict", () => {
    const l = DEMO_BOOKS.find((b) => b.key === "love")!;
    expect(l.deep.love_detail).toBeDefined();
    expect(l.deep.love_detail!.need.length).toBeGreaterThan(0);
    expect(l.deep.love_detail!.partner.length).toBeGreaterThan(0);
    expect(l.deep.love_detail!.conflict.length).toBeGreaterThan(0);
  });

  it("does not use forbidden marketing claims", () => {
    const forbidden = ["唯一正缘", "必婚", "保证收益", "治愈疾病", "预测灾祸"];
    for (const b of DEMO_BOOKS) {
      const blob = JSON.stringify(b);
      for (const word of forbidden) {
        expect(blob.includes(word)).toBe(false);
      }
    }
  });
});

describe("library-v2 isolation from V1", () => {
  it("has a dev-only route that gates on import.meta.env.DEV", () => {
    const src = readFileSync(
      join(REPO_ROOT, "src/routes/dev.guided-library-v2.tsx"),
      "utf8",
    );
    expect(src).toContain("import.meta.env.DEV");
    expect(src).toContain("noindex,nofollow");
  });

  it("is NOT listed in the sitemap", () => {
    const sitemap = readFileSync(
      join(REPO_ROOT, "src/routes/sitemap[.]xml.ts"),
      "utf8",
    );
    expect(sitemap.includes("guided-library-v2")).toBe(false);
    expect(sitemap.includes("/dev/")).toBe(false);
  });

  it("keeps V1 route files present and does not import V2 from them", () => {
    for (const path of [
      "src/routes/index.tsx",
      "src/routes/ritual.tsx",
      "src/routes/report.tsx",
    ]) {
      expect(existsSync(join(REPO_ROOT, path))).toBe(true);
      const src = readFileSync(join(REPO_ROOT, path), "utf8");
      expect(src.includes("experiences/library-v2")).toBe(false);
      expect(src.includes("LIBRARY_EXPERIENCE_VERSION")).toBe(false);
    }
  });

  it("V2 fixtures do not import V1 report/premium/community modules", () => {
    const files = [
      "src/experiences/library-v2/GuidedLibraryV2.tsx",
      "src/experiences/library-v2/fixtures.ts",
      "src/experiences/library-v2/state.ts",
      "src/experiences/library-v2/version.ts",
    ];
    const banned = [
      "@/lib/premium",
      "@/lib/report",
      "@/lib/community",
      "@/lib/oracle",
      "@/lib/year-readings",
      "@/integrations/supabase",
      "premium.functions",
      "report.functions",
    ];
    for (const f of files) {
      const src = readFileSync(join(REPO_ROOT, f), "utf8");
      for (const b of banned) {
        expect(src.includes(b)).toBe(false);
      }
    }
  });

  it("has a handoff document at the documented path", () => {
    expect(
      existsSync(join(REPO_ROOT, "docs/LIBRARY_V2_GUIDED_EXPERIENCE.md")),
    ).toBe(true);
  });
});
