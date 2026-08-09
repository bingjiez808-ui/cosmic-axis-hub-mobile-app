// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import {
  STUDY_FIXTURES,
  STUDY_READING_SKILL_ID,
  STUDY_READING_SKILL_VERSION,
  validateStudyReading,
  type StudyReadingContent,
  type SubjectClusterCandidate,
} from "./study-reading";
import {
  PREMIUM_SKILL_VERSION,
  PREMIUM_V3_CHAPTERS,
} from "./premium-chapters-v3";

describe("study-reading — versioning is co-located with the premium skill", () => {
  it("skill version is derived from PREMIUM_SKILL_VERSION", () => {
    expect(STUDY_READING_SKILL_VERSION.startsWith(PREMIUM_SKILL_VERSION + "+study")).toBe(true);
  });
  it("skill id names the guided-domain-reading contract", () => {
    expect(STUDY_READING_SKILL_ID).toBe("guided-domain-reading-v1/study");
  });
});

describe("study-reading — academic chapter has 12 sections", () => {
  it("premium academic chapter declares the 12-section skeleton", () => {
    const meta = PREMIUM_V3_CHAPTERS.find((c) => c.key === "academic")!;
    expect(meta.required_sections?.length).toBe(12);
    const keys = meta.required_sections!.map((s) => s.key);
    expect(keys).toEqual([
      "why_now","learning_style","subject_clusters","four_systems","consensus","real_life",
      "strengths","obstacles","windows","actions","questions","method_limits",
    ]);
  });
});

describe("study-reading — fixtures per age band", () => {
  for (const band of ["youth", "university", "adult_transition"] as const) {
    it(`${band} fixture validates cleanly and carries ≥3 subject clusters`, () => {
      const fx = STUDY_FIXTURES[band];
      expect(fx.clusters.length).toBeGreaterThanOrEqual(3);
      // Every cluster carries all required fields.
      for (const c of fx.clusters) {
        expect(c.cluster).toBeTruthy();
        expect(["high","medium","exploratory"]).toContain(c.suitability);
        expect(c.evidence_refs.length).toBeGreaterThanOrEqual(1);
        expect(c.conditions.length).toBeGreaterThanOrEqual(1);
        expect(c.how_to_validate).toBeTruthy();
      }
      expect(validateStudyReading(fx)).toEqual([]);
    });
  }
});

describe("study-reading — validator rejects unsupported claims", () => {
  const clone = (fx: StudyReadingContent): StudyReadingContent => JSON.parse(JSON.stringify(fx));

  it("rejects fewer than 3 subject clusters", () => {
    const c = clone(STUDY_FIXTURES.youth);
    c.clusters = c.clusters.slice(0, 2);
    expect(validateStudyReading(c).some((i) => i.problem === "fewer_than_three_candidates")).toBe(true);
  });

  it("rejects a cluster with no evidence_refs", () => {
    const c = clone(STUDY_FIXTURES.youth);
    (c.clusters[0] as SubjectClusterCandidate).evidence_refs = [];
    expect(validateStudyReading(c).some((i) => i.problem === "missing")).toBe(true);
  });

  it("rejects unconditional claims (missing conditions)", () => {
    const c = clone(STUDY_FIXTURES.youth);
    c.clusters[0].conditions = [];
    expect(validateStudyReading(c).some((i) => i.problem === "unconditional_claim")).toBe(true);
  });

  it("rejects IQ ranking claims", () => {
    const c = clone(STUDY_FIXTURES.youth);
    c.sections.real_life = "你的智商很高，属于天才。";
    const issues = validateStudyReading(c);
    expect(issues.some((i) => i.problem.startsWith("banned:iq"))).toBe(true);
  });

  it("rejects admission guarantees (Chinese)", () => {
    const c = clone(STUDY_FIXTURES.university);
    c.sections.why_now = "保证你考上清华。";
    expect(validateStudyReading(c).some((i) => i.problem === "banned:admission_guarantee")).toBe(true);
  });

  it("rejects admission guarantees (English)", () => {
    const c = clone(STUDY_FIXTURES.university);
    c.sections.real_life = "You are guaranteed admission to any top university.";
    expect(validateStudyReading(c).some((i) => i.problem === "banned:admission_guarantee")).toBe(true);
  });

  it("rejects house / MC mentions without a supporting evidence_ref", () => {
    const c = clone(STUDY_FIXTURES.youth);
    // Add prose that mentions a house/MC. Existing evidence_refs are on
    // western.mercury / bazi / ziwei — none carry a .house path.
    c.sections.four_systems = "第三宫强化了你的表达能力。";
    expect(validateStudyReading(c).some((i) => i.problem === "unsupported_house_or_mc")).toBe(true);
  });

  it("accepts house / MC mentions when a matching evidence_ref exists", () => {
    const c = clone(STUDY_FIXTURES.youth);
    c.sections.four_systems = "第三宫强化了你的表达能力。";
    c.clusters[0].evidence_refs.push({ path: "western.houses[2]", module: "western", confidence: "grounded" });
    expect(validateStudyReading(c).some((i) => i.problem === "unsupported_house_or_mc")).toBe(false);
  });

  it("rejects fake cross-system consensus (single module only)", () => {
    const c = clone(STUDY_FIXTURES.youth);
    // Force every ref to the same module.
    c.clusters = c.clusters.map((cl) => ({
      ...cl,
      evidence_refs: [{ path: "bazi.pillars.day", module: "bazi", confidence: "grounded" }],
    }));
    c.sections.consensus = "四体系一致指向语言表达优势。";
    expect(validateStudyReading(c).some((i) => i.problem === "fake_cross_system_consensus")).toBe(true);
  });

  it("rejects unresolved evidence path when available_paths is supplied", () => {
    const c = clone(STUDY_FIXTURES.youth);
    const issues = validateStudyReading(c, {
      available_paths: ["bazi.pillars", "ziwei.palaces"],
      available_modules: ["bazi", "ziwei", "western", "vedic"],
    });
    // western.mercury and vedic.moon are not under the allow-list.
    expect(issues.some((i) => i.problem.startsWith("unresolved_path:"))).toBe(true);
  });
});

describe("study-reading — age band voice", () => {
  it("adult_transition rejects school-only prose", () => {
    const c: StudyReadingContent = JSON.parse(JSON.stringify(STUDY_FIXTURES.adult_transition));
    c.sections.real_life = "你需要专注高考冲刺。";
    expect(validateStudyReading(c).some((i) => i.problem === "school_voice_in_adult_transition")).toBe(true);
  });
  it("youth rejects midlife retirement prose", () => {
    const c: StudyReadingContent = JSON.parse(JSON.stringify(STUDY_FIXTURES.youth));
    c.sections.real_life = "考虑退休后再学一门语言。";
    expect(validateStudyReading(c).some((i) => i.problem === "midlife_voice_in_youth")).toBe(true);
  });
});

describe("study-reading — cache stability keyed by stable slug + revision", () => {
  it("academic chapter slug is 'academic' (stable across future manifest reorders)", () => {
    const meta = PREMIUM_V3_CHAPTERS.find((c) => c.key === "academic");
    expect(meta).toBeDefined();
    // Chapter identity is the slug — index is derived. A future manifest may
    // move it but existing rows keyed on `academic` MUST NOT re-generate.
    expect(meta!.key).toBe("academic");
  });
});
