/**
 * Reading-engine invariants.
 *
 * These tests lock in the contract that generatePremiumReport relies on:
 *   1. canonicalize is key-order stable.
 *   2. content_hash is deterministic on the same content, regardless of
 *      key insertion order — three reader "reopens" produce the same hash.
 *   3. input_hash isolates users: two owners with identical birth data
 *      hash to different cache keys.
 *   4. A cache hit NEVER calls the provider.
 *   5. Bumping any of prompt_version / model_id / report_version /
 *      calculation_version produces a new cache key (no accidental reuse).
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, it, expect } from "bun:test";

import type { CalculationSnapshot } from "./calc-snapshot";
import {
  buildEngineInput,
  canonicalize,
  cacheKeyMatches,
  computeContentHash,
  computeInputHash,
  DEFAULT_VERSIONS,
  makeCacheKey,
  runReading,
  type CachedReading,
  type CacheAdapter,
  type EngineChartFacts,
  type ProviderCall,
} from "./reading-engine";

/* Minimal fake snapshot — the engine treats it as opaque JSON. */
const fakeSnapshot = (): CalculationSnapshot => ({
  calculation_version: "calc_snapshot_v2.0.0",
  generated_at: "2026-07-17T00:00:00.000Z",
  input: { date: "2002-11-03", time: "09:26", place: "Nanjing", lang: "en" },
  western: { status: "ok", source: "test", sun: null },
  bazi: { status: "ok", source: "test", pillars: null, day_master: null, zodiac: null },
  vedic: { status: "ok", source: "test", chart: null },
  ziwei: { status: "ok", source: "test", chart: null },
  geo: null,
});

const chartFacts = (): EngineChartFacts => ({
  name: "Serena",
  birth_date: "2002-11-03",
  birth_time: "09:26",
  birth_place: "Nanjing",
  lang: "en",
  gender: "female",
});

/* In-memory cache adapter for tests. */
class MemCache implements CacheAdapter {
  store = new Map<string, CachedReading>();
  readCount = 0;
  writeCount = 0;
  key(k: Awaited<ReturnType<typeof makeCacheKey>>): string {
    return [
      k.owner_id,
      k.chart_id,
      k.input_hash,
      k.prompt_version,
      k.model_id,
      k.report_version,
      k.calculation_version,
    ].join("|");
  }
  async read(k: Awaited<ReturnType<typeof makeCacheKey>>) {
    this.readCount++;
    return this.store.get(this.key(k)) ?? null;
  }
  async write(k: Awaited<ReturnType<typeof makeCacheKey>>, v: CachedReading) {
    this.writeCount++;
    this.store.set(this.key(k), v);
  }
}

describe("canonicalize", () => {
  it("sorts object keys deterministically regardless of insertion order", () => {
    const a = { b: 1, a: 2, c: { z: 9, a: 1 } };
    const b: Record<string, unknown> = {};
    b.c = { a: 1, z: 9 };
    b.a = 2;
    b.b = 1;
    expect(canonicalize(a)).toBe(canonicalize(b));
  });

  it("preserves array order", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });
});

describe("computeContentHash", () => {
  it("is stable across three re-reads of the same content", async () => {
    const c1 = { chapters: [{ key: "a", body: "hello" }] };
    const c2 = { chapters: [{ body: "hello", key: "a" }] };
    const c3 = { chapters: [{ key: "a", body: "hello" }] };
    const [h1, h2, h3] = await Promise.all([
      computeContentHash(c1),
      computeContentHash(c2),
      computeContentHash(c3),
    ]);
    expect(h1).toBe(h2);
    expect(h2).toBe(h3);
    expect(h1).toHaveLength(64);
  });
});

describe("cache keys", () => {
  it("cross-user isolation: same birth data, different owners → different input_hash", async () => {
    const input = buildEngineInput(chartFacts(), fakeSnapshot());
    const [ha, hb] = await Promise.all([
      computeInputHash("owner-A", "chart-1", input),
      computeInputHash("owner-B", "chart-1", input),
    ]);
    expect(ha).not.toBe(hb);
  });

  it("version bump ⇒ new cache key, old key untouched", async () => {
    const input = buildEngineInput(chartFacts(), fakeSnapshot());
    const oldKey = await makeCacheKey("u", "c", input);
    for (const bump of ["prompt_version", "model_id", "report_version", "calculation_version"] as const) {
      const bumped = buildEngineInput(chartFacts(), fakeSnapshot(), {
        ...DEFAULT_VERSIONS,
        [bump]: DEFAULT_VERSIONS[bump] + "-next",
      });
      const newKey = await makeCacheKey("u", "c", bumped);
      expect(cacheKeyMatches(oldKey, newKey)).toBe(false);
      // Old key still equals itself.
      expect(cacheKeyMatches(oldKey, { ...oldKey })).toBe(true);
    }
  });
});

describe("runReading", () => {
  const input = buildEngineInput(chartFacts(), fakeSnapshot());

  it("cache miss: calls provider exactly once and persists", async () => {
    const cache = new MemCache();
    let calls = 0;
    const provider: ProviderCall = async () => {
      calls++;
      return {
        content: { chapters: [{ key: "a", body: "x" }] },
        token_usage: { input_tokens: 10, output_tokens: 20 },
      };
    };
    const res = await runReading({ ownerId: "u", chartId: "c", input, cache, callProvider: provider });
    expect(res.hit).toBe(false);
    expect(res.provider_calls).toBe(1);
    expect(calls).toBe(1);
    expect(cache.writeCount).toBe(1);
    expect(res.reading.content_hash).toHaveLength(64);
    expect(res.reading.token_usage).toEqual({ input_tokens: 10, output_tokens: 20 });
  });

  it("cache hit: reader reopen does NOT call the provider", async () => {
    const cache = new MemCache();
    let calls = 0;
    const provider: ProviderCall = async () => {
      calls++;
      return { content: { chapters: [{ key: "a", body: "x" }] } };
    };
    // First run — miss, populates cache.
    await runReading({ ownerId: "u", chartId: "c", input, cache, callProvider: provider });
    // Three "reader reopens" — each is a cache hit, provider MUST NOT be called again.
    const hashes: string[] = [];
    for (let i = 0; i < 3; i++) {
      const res = await runReading({ ownerId: "u", chartId: "c", input, cache, callProvider: provider });
      expect(res.hit).toBe(true);
      expect(res.provider_calls).toBe(0);
      hashes.push(res.reading.content_hash);
    }
    expect(new Set(hashes).size).toBe(1);
    expect(calls).toBe(1); // exactly one lifetime provider call
  });

  it("bumping a version invalidates the cache and forces a new provider call", async () => {
    const cache = new MemCache();
    let calls = 0;
    const provider: ProviderCall = async () => {
      calls++;
      return { content: { chapters: [{ key: "a", body: String(calls) }] } };
    };
    await runReading({ ownerId: "u", chartId: "c", input, cache, callProvider: provider });
    expect(calls).toBe(1);
    const bumped = buildEngineInput(chartFacts(), fakeSnapshot(), {
      ...DEFAULT_VERSIONS,
      prompt_version: DEFAULT_VERSIONS.prompt_version + "-v2",
    });
    await runReading({ ownerId: "u", chartId: "c", input: bumped, cache, callProvider: provider });
    expect(calls).toBe(2);
    // Old key still resolves to the old content on next call with old version.
    const rerun = await runReading({ ownerId: "u", chartId: "c", input, cache, callProvider: provider });
    expect(rerun.hit).toBe(true);
    expect(calls).toBe(2);
  });

  it("cross-user isolation at runtime: two owners never share a cached reading", async () => {
    const cache = new MemCache();
    let calls = 0;
    const provider: ProviderCall = async () => {
      calls++;
      return { content: { chapters: [{ key: "a", body: "for owner " + calls }] } };
    };
    const a = await runReading({ ownerId: "owner-A", chartId: "c", input, cache, callProvider: provider });
    const b = await runReading({ ownerId: "owner-B", chartId: "c", input, cache, callProvider: provider });
    expect(a.hit).toBe(false);
    expect(b.hit).toBe(false);
    expect(a.reading.input_hash).not.toBe(b.reading.input_hash);
    expect(calls).toBe(2);
  });
});
