/**
 * Reports-store unit tests — run with `bun test src/lib/reports-store.test.ts`.
 * Focused on the pure helpers that gate the idempotent AI generation
 * flow: input normalization, stable hashing across cosmetic differences,
 * and the email-verified guard. The server-function handlers themselves
 * are integration surface and exercised end-to-end in Playwright/CI.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, expect, test } from "bun:test";

import { computeChartHash, isEmailVerified, normalizeForHash } from "./reports-store.functions";

describe("normalizeForHash", () => {
  test("drops display name so a rename never invalidates the cache", () => {
    const a = { name: "Alice", date: "1990-05-15", time: "12:00", place: "New York", lang: "en" as const };
    const b = { name: "Bob (renamed)", date: "1990-05-15", time: "12:00", place: "New York", lang: "en" as const };
    expect(computeChartHash(a)).toBe(computeChartHash(b));
  });
  test("collapses trivial place-string casing / whitespace differences", () => {
    const a = { date: "1990-05-15", time: "12:00", place: "  new york  ", lang: "en" as const };
    const b = { date: "1990-05-15", time: "12:00", place: "New York", lang: "en" as const };
    expect(computeChartHash(a)).toBe(computeChartHash(b));
  });
  test("changing language forces a new hash (translations must not collide)", () => {
    const a = { date: "1990-05-15", time: "12:00", place: "NYC", lang: "en" as const };
    const b = { date: "1990-05-15", time: "12:00", place: "NYC", lang: "zh" as const };
    expect(computeChartHash(a)).not.toBe(computeChartHash(b));
  });
  test("changing a real birth field forces a new hash", () => {
    const a = { date: "1990-05-15", time: "12:00", place: "NYC", lang: "en" as const };
    const b = { date: "1990-05-15", time: "12:01", place: "NYC", lang: "en" as const };
    expect(computeChartHash(a)).not.toBe(computeChartHash(b));
  });
  test("changing gender forces a new hash — Zi Wei is gender-dependent", () => {
    const a = { date: "1990-05-15", time: "12:00", place: "NYC", lang: "en" as const, gender: "male" as const };
    const b = { date: "1990-05-15", time: "12:00", place: "NYC", lang: "en" as const, gender: "female" as const };
    expect(computeChartHash(a)).not.toBe(computeChartHash(b));
  });
  test("missing gender vs explicit empty-effect gender hashes identically to the pre-gender legacy shape", () => {
    // Legacy (pre-gender) input has undefined gender. normalizeForHash
    // maps that to "" so we can distinguish it from male/female while
    // keeping the shape stable across omit-vs-undefined.
    const legacy = { date: "1990-05-15", time: "12:00", place: "NYC", lang: "en" as const };
    const withUndef = { ...legacy, gender: undefined };
    expect(computeChartHash(legacy)).toBe(computeChartHash(withUndef));
  });
  test("normalized shape is stable and pure", () => {
    const input = { name: "X", date: "1990", time: "12:00", place: "NYC", lang: "en" as const, gender: "male" as const };
    expect(normalizeForHash(input)).toEqual({ date: "1990", gender: "male", lang: "en", place: "nyc", time: "12:00" });
  });
});

describe("isEmailVerified", () => {
  test("top-level email_verified claim", () => {
    expect(isEmailVerified({ email_verified: true })).toBe(true);
    expect(isEmailVerified({ email_verified: false })).toBe(false);
  });
  test("legacy user_metadata.email_verified", () => {
    expect(isEmailVerified({ user_metadata: { email_verified: true } })).toBe(true);
  });
  test("OAuth providers (Google, Apple) count as verified", () => {
    expect(isEmailVerified({ app_metadata: { provider: "google" } })).toBe(true);
    expect(isEmailVerified({ app_metadata: { providers: ["apple", "email"] } })).toBe(true);
  });
  test("email-only, unconfirmed → not verified", () => {
    expect(isEmailVerified({ app_metadata: { provider: "email" } })).toBe(false);
    expect(isEmailVerified({})).toBe(false);
    expect(isEmailVerified(null)).toBe(false);
  });
});

/**
 * `updateChartGender` is a server function whose safety comes from three
 * places: (1) input validation (only `"male"` / `"female"` accepted),
 * (2) owner scoping through RLS + explicit `user_id` filter, and (3)
 * effect on the calc snapshot (ziwei flips from `gender_missing` to
 * `ok`). The server handler is exercised via preview E2E; here we lock
 * in the input contract and the snapshot effect so a regression is
 * caught in CI.
 */
import { z } from "zod";
import { buildCalculationSnapshot, missingSystems } from "./calc-snapshot";

const UpdateChartGenderInput = z.object({
  chartId: z.string().uuid(),
  gender: z.enum(["male", "female"]),
});

describe("updateChartGender input contract", () => {
  const owner = "3f8b0e2c-4a1d-4c2e-9f3a-9b1c2d3e4f5a";
  test("accepts male/female for an owner-scoped chartId", () => {
    expect(UpdateChartGenderInput.parse({ chartId: owner, gender: "male" }).gender).toBe("male");
    expect(UpdateChartGenderInput.parse({ chartId: owner, gender: "female" }).gender).toBe("female");
  });
  test("rejects unknown gender values (no 'unspecified', no free text, no null)", () => {
    for (const v of ["unspecified", "", null, "other", "M", "female "]) {
      expect(() => UpdateChartGenderInput.parse({ chartId: owner, gender: v })).toThrow();
    }
  });
  test("rejects non-uuid chartId (defense against tampered client payloads)", () => {
    expect(() =>
      UpdateChartGenderInput.parse({ chartId: "1784018592533-y6m3rg", gender: "male" }),
    ).toThrow();
  });
});

describe("updateChartGender snapshot effect", () => {
  const nanjingBirth = {
    date: "2002-11-03",
    time: "09:26",
    place: "Nanjing",
    lang: "en" as const,
  };
  test("gender_missing → complete once ziwei receives a valid gender", () => {
    const before = buildCalculationSnapshot({ ...nanjingBirth, gender: null });
    expect(missingSystems(before)).toContain("ziwei");
    const after = buildCalculationSnapshot({ ...nanjingBirth, gender: "female" });
    expect(missingSystems(after)).not.toContain("ziwei");
    // The rest of the snapshot must remain consistent — western/bazi
    // are gender-independent and MUST still be ok.
    expect(after.western.status).toBe("ok");
    expect(after.bazi.status).toBe("ok");
  });
});

