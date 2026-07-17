/**
 * Tarot quota unit tests — run with `bun test src/lib/tarot-quota.test.ts`.
 * Covers timezone-aware month keys, per-account scoping, monthly reset,
 * plan ceilings, and the in-flight double-charge lock.
 */
// @ts-expect-error — bun:test is Bun's built-in runner, no npm types shipped.
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
// Use defineProperty so this works even when a DOM (happy-dom) has been
// registered by another test file — then `window` / `localStorage` are
// non-writable data properties on globalThis.
Object.defineProperty(globalThis, "window", {
  value: { localStorage: shim, dispatchEvent: () => true },
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: shim,
  configurable: true,
  writable: true,
});

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
  test("re-entrant consume from inside the same frame is rejected", () => {
    const scope = { accountKey: "lock@t.co" };
    // Simulate the guard: call consume once, and while its handler is still
    // on the stack the second call must be denied via the IN_FLIGHT set.
    let secondResult: boolean | null = null;
    // Monkey-patch write path by observing the lock — easiest way is to
    // dispatchEvent, which the SUT emits after write. We hook that.
    const origDispatch = (window as unknown as { dispatchEvent: (e: Event) => boolean }).dispatchEvent;
    (window as unknown as { dispatchEvent: (e: Event) => boolean }).dispatchEvent = (e: Event) => {
      if (secondResult === null) secondResult = tarotConsume("sage", scope);
      return origDispatch(e);
    };
    try {
      expect(tarotConsume("sage", scope)).toBe(true);
      expect(secondResult).toBe(false);
      expect(tarotUsed(scope)).toBe(1);
    } finally {
      (window as unknown as { dispatchEvent: (e: Event) => boolean }).dispatchEvent = origDispatch;
    }
  });
});
