/**
 * Tarot quota unit tests — run with `bun test src/lib/tarot-quota.test.ts`.
 * Covers timezone-aware month keys, per-account scoping, monthly reset,
 * plan ceilings, and the in-flight double-charge lock.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// Provide a minimal in-memory localStorage shim before importing SUT.
const memStore = new Map<string, string>();
const shim = {
  getItem: (k: string) => memStore.get(k) ?? null,
  setItem: (k: string, v: string) => { memStore.set(k, String(v)); },
  removeItem: (k: string) => { memStore.delete(k); },
  clear: () => { memStore.clear(); },
  key: (i: number) => Array.from(memStore.keys())[i] ?? null,
  get length() { return memStore.size; },
};
(globalThis as unknown as { window: unknown }).window = {
  localStorage: shim,
  dispatchEvent: () => true,
};
(globalThis as unknown as { localStorage: unknown }).localStorage = shim;

const {
  TAROT_LIMITS,
  monthKey,
  tarotConsume,
  tarotRemaining,
  tarotUsed,
  tarotCanRead,
} = await import("./tarot-quota");

beforeEach(() => memStore.clear());
afterEach(() => memStore.clear());

describe("monthKey", () => {
  test("emits YYYY-MM in the caller's timezone", () => {
    // 2025-12-31 23:00 UTC is 2026-01-01 07:00 in Asia/Shanghai.
    const at = new Date(Date.UTC(2025, 11, 31, 23, 0, 0));
    expect(monthKey("UTC", at)).toBe("2025-12");
    expect(monthKey("Asia/Shanghai", at)).toBe("2026-01");
    expect(monthKey("America/New_York", at)).toBe("2025-12");
  });
});

describe("scoped quota", () => {
  test("free plan has zero quota", () => {
    expect(tarotRemaining("free")).toBe(0);
    expect(tarotCanRead("free")).toBe(false);
    expect(tarotConsume("free")).toBe(false);
  });

  test("oracle plan is unlimited", () => {
    expect(tarotRemaining("oracle")).toBe(Infinity);
    expect(tarotConsume("oracle", { accountKey: "a@b.co" })).toBe(true);
    expect(tarotRemaining("oracle")).toBe(Infinity);
  });

  test("sage plan meters up to the monthly ceiling", () => {
    const scope = { accountKey: "sage@test" };
    for (let i = 0; i < TAROT_LIMITS.sage; i++) {
      expect(tarotConsume("sage", scope)).toBe(true);
    }
    expect(tarotUsed(scope)).toBe(TAROT_LIMITS.sage);
    expect(tarotRemaining("sage", scope)).toBe(0);
    expect(tarotConsume("sage", scope)).toBe(false); // no double-spend past limit
  });

  test("two accounts do not share quota", () => {
    tarotConsume("sage", { accountKey: "a@x.io" });
    tarotConsume("sage", { accountKey: "a@x.io" });
    expect(tarotUsed({ accountKey: "a@x.io" })).toBe(2);
    expect(tarotUsed({ accountKey: "b@x.io" })).toBe(0);
  });

  test("email casing / whitespace normalises to the same bucket", () => {
    tarotConsume("sage", { accountKey: "Mix@Case.io" });
    expect(tarotUsed({ accountKey: "  mix@case.io  " })).toBe(1);
  });

  test("stale month resets the counter", () => {
    const key = "lod:tarot-quota::stale@t.co";
    memStore.set(key, JSON.stringify({ month: "1999-01", used: 9 }));
    expect(tarotUsed({ accountKey: "stale@t.co" })).toBe(0);
    expect(tarotRemaining("sage", { accountKey: "stale@t.co" })).toBe(TAROT_LIMITS.sage);
  });
});

describe("double-charge lock", () => {
  test("re-entrant consume within the lock window is rejected", () => {
    const scope = { accountKey: "lock@t.co" };
    // First call succeeds; a synchronous second call must be denied because
    // the in-flight guard is still hot until its setTimeout fires.
    expect(tarotConsume("sage", scope)).toBe(true);
    expect(tarotConsume("sage", scope)).toBe(false);
    // Only one increment landed.
    expect(tarotUsed(scope)).toBe(1);
  });
});
