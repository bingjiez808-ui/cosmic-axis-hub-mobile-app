/**
 * Regression tests for the intake-ritual validation rules.
 * See src/lib/ritual-validation.ts.
 */
// @ts-expect-error — bun:test
import { describe, expect, test } from "bun:test";
import {
  FIELD_STEP,
  firstMissingStep,
  missingFields,
  nameStepCopy,
  validateField,
  type RitualState,
} from "./ritual-validation";

const empty: RitualState = {
  ownerRole: "",
  relationship: "",
  name: "",
  date: "",
  time: "",
  place: "",
  gender: "",
  genderChosen: false,
};

const complete: RitualState = {
  ownerRole: "self",
  relationship: "",
  name: "Alice",
  date: "1990-05-15",
  time: "12:00",
  place: "Shanghai",
  gender: "female",
  genderChosen: true,
};

describe("validateField", () => {
  test("empty state → owner is the first missing", () => {
    expect(validateField("owner", empty, "en")).not.toBeNull();
  });

  test("owner=self → owner error clears immediately (bug #1)", () => {
    const s = { ...empty, ownerRole: "self" as const };
    expect(validateField("owner", s, "en")).toBeNull();
  });

  test("owner=other but no relationship → relationship error, not owner (bug #3)", () => {
    const s = { ...empty, ownerRole: "other" as const };
    expect(validateField("owner", s, "en")).toBeNull();
    const rel = validateField("relationship", s, "en");
    expect(rel).not.toBeNull();
    expect(rel).toMatch(/relationship/i);
  });

  test("owner=other + relationship picked → both clear", () => {
    const s = { ...empty, ownerRole: "other" as const, relationship: "partner" as const };
    expect(validateField("owner", s, "en")).toBeNull();
    expect(validateField("relationship", s, "en")).toBeNull();
  });

  test("owner=other with blank name → 'other' error mentions private nickname (bug #2)", () => {
    const s = { ...empty, ownerRole: "other" as const, relationship: "partner" as const };
    const zh = validateField("name", s, "zh");
    const en = validateField("name", s, "en");
    expect(zh).toContain("备注名");
    expect(en?.toLowerCase()).toContain("nickname");
  });

  test("owner=other with whitespace-only name → still fails", () => {
    const s = { ...empty, ownerRole: "other" as const, relationship: "partner" as const, name: "   " };
    expect(validateField("name", s, "en")).not.toBeNull();
  });

  test("name accepts up to 80 chars, rejects 81", () => {
    const ok = { ...complete, name: "x".repeat(80) };
    const bad = { ...complete, name: "x".repeat(81) };
    expect(validateField("name", ok, "en")).toBeNull();
    expect(validateField("name", bad, "en")).not.toBeNull();
  });

  test("future date rejected", () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    const iso = future.toISOString().slice(0, 10);
    const s = { ...complete, date: iso };
    expect(validateField("date", s, "en")).not.toBeNull();
  });

  test("gender: prefer-not-to-say still counts as chosen", () => {
    const s = { ...complete, gender: "" as const, genderChosen: true };
    expect(validateField("gender", s, "en")).toBeNull();
  });

  test("gender: not chosen fails", () => {
    const s = { ...complete, gender: "" as const, genderChosen: false };
    expect(validateField("gender", s, "en")).not.toBeNull();
  });
});

describe("nameStepCopy — dynamic label by ownerRole (bug #2)", () => {
  test("self uses birth-name prompt (both langs)", () => {
    expect(nameStepCopy("en", "self").placeholder.toLowerCase()).toContain("birth name");
    expect(nameStepCopy("zh", "self").placeholder).toContain("本名");
  });
  test("other uses nickname prompt (both langs)", () => {
    expect(nameStepCopy("en", "other").placeholder.toLowerCase()).toContain("nickname");
    expect(nameStepCopy("zh", "other").placeholder).toContain("备注名");
  });
});

describe("missingFields — N decrements as fields are fixed (bug #4)", () => {
  test("empty → 6 misses (owner, name, date, time, gender, place)", () => {
    // relationship only counted when ownerRole === "other"
    expect(missingFields(empty, "en").length).toBe(6);
  });
  test("pick owner=self → drops to 5", () => {
    const s = { ...empty, ownerRole: "self" as const };
    expect(missingFields(s, "en").length).toBe(5);
  });
  test("pick owner=other → 6 (owner ok but relationship now required)", () => {
    const s = { ...empty, ownerRole: "other" as const };
    expect(missingFields(s, "en").length).toBe(6);
  });
  test("complete state → 0 misses", () => {
    expect(missingFields(complete, "en").length).toBe(0);
  });
});

describe("firstMissingStep — focuses first true miss", () => {
  test("owner missing → step 0", () => {
    expect(firstMissingStep(empty, "en")).toBe(FIELD_STEP.owner);
  });
  test("owner=other, no relationship → still step 0", () => {
    const s = { ...empty, ownerRole: "other" as const };
    expect(firstMissingStep(s, "en")).toBe(0);
  });
  test("only place missing → step 5", () => {
    const s = { ...complete, place: "" };
    expect(firstMissingStep(s, "en")).toBe(FIELD_STEP.place);
  });
  test("complete → -1", () => {
    expect(firstMissingStep(complete, "en")).toBe(-1);
  });
});
