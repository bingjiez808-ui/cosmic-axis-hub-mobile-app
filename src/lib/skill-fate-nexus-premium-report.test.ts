// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PREMIUM_V3_CHAPTERS,
  PREMIUM_REPORT_REVISION,
  PREMIUM_SKILL_ID,
  PREMIUM_SKILL_VERSION,
  PREMIUM_MANIFEST_VERSION,
} from "./premium-chapters-v3";

const SKILL_DIR = join(process.cwd(), "skills", "fate-nexus-premium-report");
const readSkill = (p: string) => readFileSync(join(SKILL_DIR, p), "utf8");

describe("skill fate-nexus-premium-report — identity", () => {
  it("skill id is stable", () => {
    expect(PREMIUM_SKILL_ID).toBe("fate-nexus-premium-report");
  });
  it("skill version follows semver x.y.z", () => {
    expect(PREMIUM_SKILL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it("manifest version follows YYYY-MM tag", () => {
    expect(PREMIUM_MANIFEST_VERSION).toMatch(/^\d{4}-\d{2}$/);
  });
  it("revision embeds the manifest version tag", () => {
    // Revision string must include the manifest year-month so that any bump
    // of the manifest forces a matching revision bump (new input_hash).
    const [year, month] = PREMIUM_MANIFEST_VERSION.split("-");
    expect(PREMIUM_REPORT_REVISION).toContain(year);
    expect(PREMIUM_REPORT_REVISION).toContain(month);
  });
});

describe("skill fate-nexus-premium-report — files present", () => {
  it("has SKILL.md with correct frontmatter", () => {
    const md = readSkill("SKILL.md");
    expect(md.startsWith("---\n")).toBe(true);
    expect(md).toContain(`name: ${PREMIUM_SKILL_ID}`);
    expect(md).toMatch(/^description: .+$/m);
  });
  it("has all three reference files", () => {
    expect(readSkill("references/chapter-manifest.md").length).toBeGreaterThan(500);
    expect(readSkill("references/evidence-contract.md").length).toBeGreaterThan(500);
    expect(readSkill("references/token-cache-policy.md").length).toBeGreaterThan(500);
  });
  it("SKILL.md stays under 500 lines", () => {
    const lines = readSkill("SKILL.md").split("\n").length;
    expect(lines).toBeLessThan(500);
  });
});

describe("skill fate-nexus-premium-report — chapter manifest sync", () => {
  const manifestDoc = readSkill("references/chapter-manifest.md");
  it("mentions every chapter key from the runtime catalog", () => {
    for (const c of PREMIUM_V3_CHAPTERS) {
      expect(manifestDoc).toContain(`\`${c.key}\``);
    }
  });
  it("mentions every module used in allowed_facts", () => {
    const modules = new Set(PREMIUM_V3_CHAPTERS.flatMap((c) => c.allowed_facts));
    for (const m of modules) {
      expect(manifestDoc).toContain(m);
    }
  });
});

describe("skill fate-nexus-premium-report — runtime invariants", () => {
  it("exactly 24 chapters", () => {
    expect(PREMIUM_V3_CHAPTERS).toHaveLength(24);
  });
  it("cover-kind chapters allow zero facts (prose scaffold) except chart_map", () => {
    const coverNoFacts = PREMIUM_V3_CHAPTERS.filter((c) => c.kind === "cover" && c.allowed_facts.length === 0);
    // cover_letter is the guaranteed prose-only cover chapter
    expect(coverNoFacts.map((c) => c.key)).toContain("cover_letter");
  });
  it("cross chapters cite ≥2 modules and set variety ≥2 explicitly or by kind", () => {
    for (const c of PREMIUM_V3_CHAPTERS.filter((x) => x.kind === "cross")) {
      expect(c.allowed_facts.length).toBeGreaterThanOrEqual(2);
      const minVar = c.min_module_variety ?? 2;
      expect(minVar).toBeGreaterThanOrEqual(2);
    }
  });
  it("timing chapters only allow timing modules", () => {
    const timingAllowed = new Set(["bazi_luck", "ziwei_horoscope", "vedic_dasha"]);
    for (const c of PREMIUM_V3_CHAPTERS.filter((x) => x.kind === "timing")) {
      for (const m of c.allowed_facts) {
        expect(timingAllowed.has(m)).toBe(true);
      }
    }
  });
  it("system chapters have ≥1 allowed fact module", () => {
    for (const c of PREMIUM_V3_CHAPTERS.filter((x) => x.kind === "system")) {
      expect(c.allowed_facts.length).toBeGreaterThanOrEqual(1);
    }
  });
});
