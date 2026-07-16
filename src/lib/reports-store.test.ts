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
  test("normalized shape is stable and pure", () => {
    const input = { name: "X", date: "1990", time: "12:00", place: "NYC", lang: "en" as const };
    expect(normalizeForHash(input)).toEqual({ date: "1990", time: "12:00", place: "nyc", lang: "en" });
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
