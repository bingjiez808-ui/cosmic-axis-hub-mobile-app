/**
 * Unit coverage for `isDeterministicGenerationModeFor` — the explicit
 * REPORT_GENERATION_MODE gate that decides whether the premium report
 * pipeline uses the deterministic stub provider (safe for Lovable
 * preview / integration tests) or the real Lovable AI Gateway.
 *
 * These tests pin the precedence contract so a later refactor cannot
 * silently re-introduce a NODE_ENV=production gate that disables the
 * mock flow in Lovable's preview build.
 */
// @ts-expect-error bun:test types
import { describe, expect, test } from "bun:test";
import { isDeterministicGenerationModeFor } from "./premium.functions";

describe("isDeterministicGenerationModeFor", () => {
  test("REPORT_GENERATION_MODE=deterministic forces stub even with an API key", () => {
    expect(
      isDeterministicGenerationModeFor(
        { REPORT_GENERATION_MODE: "deterministic" },
        { hasApiKey: true },
      ),
    ).toBe(true);
  });

  test("REPORT_GENERATION_MODE=mock and stub are equivalent", () => {
    expect(
      isDeterministicGenerationModeFor({ REPORT_GENERATION_MODE: "mock" }, { hasApiKey: true }),
    ).toBe(true);
    expect(
      isDeterministicGenerationModeFor({ REPORT_GENERATION_MODE: "stub" }, { hasApiKey: true }),
    ).toBe(true);
  });

  test("REPORT_GENERATION_MODE=live forces real provider even without an API key", () => {
    expect(
      isDeterministicGenerationModeFor(
        { REPORT_GENERATION_MODE: "live" },
        { hasApiKey: false },
      ),
    ).toBe(false);
  });

  test("legacy PREMIUM_TEST_DETERMINISTIC=1 still enables stub", () => {
    expect(
      isDeterministicGenerationModeFor(
        { PREMIUM_TEST_DETERMINISTIC: "1" },
        { hasApiKey: true },
      ),
    ).toBe(true);
  });

  test("no explicit mode defaults to deterministic for preview safety", () => {
    expect(isDeterministicGenerationModeFor({}, { hasApiKey: true })).toBe(true);
    expect(isDeterministicGenerationModeFor({}, { hasApiKey: false })).toBe(true);
  });

  test("NODE_ENV must NOT disable stub — only explicit switches do", () => {
    // NODE_ENV is not part of the input shape. Passing it as an extra
    // key must be ignored (this test also documents the contract).
    const env = { NODE_ENV: "production" } as unknown as {
      REPORT_GENERATION_MODE?: string;
    };
    expect(isDeterministicGenerationModeFor(env, { hasApiKey: false })).toBe(true);
  });
});
