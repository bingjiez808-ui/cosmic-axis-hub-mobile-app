/**
 * Key-parity contract test for the Daily Room / friends / match locale dict.
 *
 * If a new key is added to one language it must be added to the other in
 * the same commit — otherwise the UI silently falls back to `undefined`
 * and renders "undefined" or crashes when the value is invoked.
 */
// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";

import { DAILY_DICTS } from "@/lib/i18n-daily";

function shape(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "function") return "function";
  return typeof v;
}

function collect(prefix: string, obj: Record<string, unknown>, into: Map<string, string>) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v) && typeof v !== "function") {
      collect(key, v as Record<string, unknown>, into);
    } else {
      into.set(key, shape(v));
    }
  }
}

describe("i18n-daily key parity", () => {
  const zh = new Map<string, string>();
  const en = new Map<string, string>();
  collect("", DAILY_DICTS.zh as unknown as Record<string, unknown>, zh);
  collect("", DAILY_DICTS.en as unknown as Record<string, unknown>, en);

  it("zh and en have the same keys", () => {
    const zhKeys = [...zh.keys()].sort();
    const enKeys = [...en.keys()].sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it("zh and en share the same value shape per key", () => {
    for (const [k, s] of zh) {
      expect({ k, shape: en.get(k) }).toEqual({ k, shape: s });
    }
  });

  it("no user-facing string is empty", () => {
    for (const [k, v] of Object.entries(DAILY_DICTS.zh)) {
      if (typeof v === "string") expect(v.length, `zh.${k}`).toBeGreaterThan(0);
    }
    for (const [k, v] of Object.entries(DAILY_DICTS.en)) {
      if (typeof v === "string") expect(v.length, `en.${k}`).toBeGreaterThan(0);
    }
  });
});
