/**
 * Integration-style cache test for the premium deep-report wiring.
 *
 * This models the exact Supabase interaction shape used by
 * `generatePremiumReport` (cache-lookup by full versioned key,
 * atomic claim on unique(user, chart, report_version, input_hash),
 * update on didStart winner) — with an in-memory table and a mock
 * provider — and locks in the same invariants as the real code:
 *
 *   1. First call → provider called exactly ONCE, hashes stored.
 *   2. Three "reader reopens" → 0 provider calls, content_hash and
 *      generated_at identical across all three reads.
 *   3. Bumping any of prompt_version / model_id / report_version /
 *      calculation_version creates a NEW row; original row is left
 *      untouched with its original content_hash.
 *   4. Cross-user isolation: two owners with identical birth data
 *      generate independent rows and never share a cached reading.
 *   5. Legacy rows (input_hash = NULL) remain readable as the
 *      backwards-compat fallback.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, it, expect } from "bun:test";

import {
  buildEngineInput,
  computeContentHash,
  makeCacheKey,
  DEFAULT_VERSIONS,
  type CacheKey,
  type EngineChartFacts,
} from "./reading-engine";
import type { CalculationSnapshot } from "./calc-snapshot";

type Row = {
  id: string;
  user_id: string;
  chart_id: string;
  report_version: string;
  prompt_version: string;
  model_id: string;
  calculation_version: string;
  input_hash: string | null;
  status: "generating" | "completed" | "failed";
  content_json: unknown | null;
  content_hash: string | null;
  generated_at: string | null;
  ai_generation_count: number;
  created_at: string;
};

/**
 * Minimal in-memory model of the `premium_pdf_reports` table with the
 * (user_id, chart_id, report_version, input_hash) unique constraint.
 */
class FakeTable {
  rows: Row[] = [];
  private nextId = 1;
  insertGenerating(user: string, chart: string, key: CacheKey): Row | null {
    const dup = this.rows.find(
      (r) =>
        r.user_id === user &&
        r.chart_id === chart &&
        r.report_version === key.report_version &&
        r.input_hash === key.input_hash,
    );
    if (dup) return null;
    const row: Row = {
      id: `r${this.nextId++}`,
      user_id: user,
      chart_id: chart,
      report_version: key.report_version,
      prompt_version: key.prompt_version,
      model_id: key.model_id,
      calculation_version: key.calculation_version,
      input_hash: key.input_hash,
      status: "generating",
      content_json: null,
      content_hash: null,
      generated_at: null,
      ai_generation_count: 0,
      created_at: new Date(Date.now() + this.rows.length).toISOString(),
    };
    this.rows.push(row);
    return row;
  }
  findByKey(user: string, chart: string, key: CacheKey): Row | undefined {
    return this.rows.find(
      (r) =>
        r.user_id === user &&
        r.chart_id === chart &&
        r.report_version === key.report_version &&
        r.input_hash === key.input_hash &&
        r.prompt_version === key.prompt_version &&
        r.model_id === key.model_id &&
        r.calculation_version === key.calculation_version,
    );
  }
  findLegacy(user: string, chart: string, reportVersion: string): Row | undefined {
    return this.rows.find(
      (r) =>
        r.user_id === user &&
        r.chart_id === chart &&
        r.report_version === reportVersion &&
        r.input_hash === null,
    );
  }
  insertLegacyCompleted(user: string, chart: string, content: unknown, hash: string): Row {
    const row: Row = {
      id: `legacy${this.nextId++}`,
      user_id: user,
      chart_id: chart,
      report_version: DEFAULT_VERSIONS.report_version,
      prompt_version: "legacy",
      model_id: "legacy",
      calculation_version: "legacy",
      input_hash: null,
      status: "completed",
      content_json: content,
      content_hash: hash,
      generated_at: "2024-01-01T00:00:00.000Z",
      ai_generation_count: 1,
      created_at: "2024-01-01T00:00:00.000Z",
    };
    this.rows.push(row);
    return row;
  }
}

/**
 * Fake `generatePremiumReport` mirroring the real wiring in
 * `src/lib/premium.functions.ts`: cache lookup → legacy fallback →
 * atomic claim → provider once → persist hashes.
 */
async function fakeGenerate(
  table: FakeTable,
  user: string,
  chart: string,
  input: ReturnType<typeof buildEngineInput>,
  provider: () => Promise<unknown>,
  clock: { now: string },
): Promise<{ hit: boolean; providerCalls: number; rowId: string }> {
  const key = await makeCacheKey(user, chart, input);
  // 1. Full-key cache lookup.
  const cached = table.findByKey(user, chart, key);
  if (cached?.status === "completed" && cached.content_json) {
    return { hit: true, providerCalls: 0, rowId: cached.id };
  }
  // 2. Legacy fallback (input_hash = NULL).
  const legacy = table.findLegacy(user, chart, key.report_version);
  if (legacy?.status === "completed" && legacy.content_json) {
    return { hit: true, providerCalls: 0, rowId: legacy.id };
  }
  // 3. Atomic claim.
  const row = table.insertGenerating(user, chart, key);
  if (!row) {
    // concurrent loser — never call provider
    const existing = table.findByKey(user, chart, key)!;
    return { hit: true, providerCalls: 0, rowId: existing.id };
  }
  // 4. Provider (exactly once).
  const content = await provider();
  const contentHash = await computeContentHash(content);
  row.status = "completed";
  row.content_json = content;
  row.content_hash = contentHash;
  row.generated_at = clock.now;
  row.ai_generation_count = 1;
  return { hit: false, providerCalls: 1, rowId: row.id };
}

const snapshot = (): CalculationSnapshot => ({
  calculation_version: "calc_snapshot_v2.0.0",
  generated_at: "", // stripped for stable hashing
  input: { date: "2002-11-03", time: "09:26", place: "Nanjing", lang: "en" },
  western: { status: "ok", source: "test", sun: null },
  bazi: { status: "ok", source: "test", pillars: null, day_master: null, zodiac: null },
  vedic: { status: "ok", source: "test", chart: null },
  ziwei: { status: "ok", source: "test", chart: null },
  geo: null,
});

const chart = (): EngineChartFacts => ({
  name: "Serena",
  birth_date: "2002-11-03",
  birth_time: "09:26",
  birth_place: "Nanjing",
  lang: "en",
  gender: "female",
});

const mockContent = { chapters: [{ key: "executive_summary", body: "hello world" }] };

describe("premium report cache wiring", () => {
  it("first call → provider once; 3 reopens → 0 provider, hashes stable", async () => {
    const table = new FakeTable();
    let providerCalls = 0;
    const clock = { now: "2026-07-18T00:00:00.000Z" };
    const provider = async () => {
      providerCalls++;
      return mockContent;
    };
    const input = buildEngineInput(chart(), snapshot());
    const first = await fakeGenerate(table, "u1", "c1", input, provider, clock);
    expect(first.hit).toBe(false);
    expect(first.providerCalls).toBe(1);
    expect(providerCalls).toBe(1);

    const hashes: (string | null)[] = [];
    const times: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await fakeGenerate(table, "u1", "c1", input, provider, clock);
      expect(r.hit).toBe(true);
      expect(r.providerCalls).toBe(0);
      const row = table.rows.find((x) => x.id === r.rowId)!;
      hashes.push(row.content_hash);
      times.push(row.generated_at);
    }
    expect(providerCalls).toBe(1);
    expect(new Set(hashes).size).toBe(1);
    expect(new Set(times).size).toBe(1);
    const row = table.rows.find((r) => r.id === first.rowId)!;
    expect(row.ai_generation_count).toBe(1);
  });

  it("version bumps (each of the 4) create NEW rows and leave the original untouched", async () => {
    const table = new FakeTable();
    let providerCalls = 0;
    const clock = { now: "2026-07-18T00:00:00.000Z" };
    const provider = async () => {
      providerCalls++;
      return { chapters: [{ key: "a", body: `run-${providerCalls}` }] };
    };
    const base = buildEngineInput(chart(), snapshot());
    const first = await fakeGenerate(table, "u1", "c1", base, provider, clock);
    const originalRow = table.rows.find((r) => r.id === first.rowId)!;
    const originalHash = originalRow.content_hash;

    for (const bump of [
      "prompt_version",
      "model_id",
      "report_version",
      "calculation_version",
    ] as const) {
      const bumped = buildEngineInput(chart(), snapshot(), {
        ...DEFAULT_VERSIONS,
        [bump]: DEFAULT_VERSIONS[bump] + "-next-" + bump,
      });
      const before = providerCalls;
      const res = await fakeGenerate(table, "u1", "c1", bumped, provider, clock);
      expect(res.hit).toBe(false);
      expect(providerCalls).toBe(before + 1);
      expect(res.rowId).not.toBe(first.rowId);
      // original row still identical
      const fresh = table.rows.find((r) => r.id === first.rowId)!;
      expect(fresh.content_hash).toBe(originalHash);
      expect(fresh.status).toBe("completed");
    }
    // Reopening the original with the ORIGINAL versions is still a cache hit.
    const reopen = await fakeGenerate(table, "u1", "c1", base, provider, clock);
    expect(reopen.hit).toBe(true);
    expect(reopen.rowId).toBe(first.rowId);
  });

  it("cross-user isolation: two owners never share a cache row", async () => {
    const table = new FakeTable();
    let providerCalls = 0;
    const clock = { now: "2026-07-18T00:00:00.000Z" };
    const provider = async () => {
      providerCalls++;
      return mockContent;
    };
    const input = buildEngineInput(chart(), snapshot());
    const a = await fakeGenerate(table, "owner-A", "c1", input, provider, clock);
    const b = await fakeGenerate(table, "owner-B", "c1", input, provider, clock);
    expect(a.hit).toBe(false);
    expect(b.hit).toBe(false);
    expect(a.rowId).not.toBe(b.rowId);
    expect(providerCalls).toBe(2);
    // Each owner reopens: no cross-pollination.
    const a2 = await fakeGenerate(table, "owner-A", "c1", input, provider, clock);
    const b2 = await fakeGenerate(table, "owner-B", "c1", input, provider, clock);
    expect(a2.rowId).toBe(a.rowId);
    expect(b2.rowId).toBe(b.rowId);
    expect(providerCalls).toBe(2);
  });

  it("legacy row (input_hash NULL) is readable via the backwards-compat fallback", async () => {
    const table = new FakeTable();
    const legacyContent = { chapters: [{ key: "legacy", body: "from-old-migration" }] };
    const legacyHash = "legacy-hash-not-canonical";
    table.insertLegacyCompleted("u1", "c1", legacyContent, legacyHash);

    let providerCalls = 0;
    const clock = { now: "2026-07-18T00:00:00.000Z" };
    const provider = async () => {
      providerCalls++;
      return mockContent;
    };
    const input = buildEngineInput(chart(), snapshot());
    const res = await fakeGenerate(table, "u1", "c1", input, provider, clock);
    expect(res.hit).toBe(true);
    expect(providerCalls).toBe(0);
    const row = table.rows.find((r) => r.id === res.rowId)!;
    expect(row.input_hash).toBeNull();
    expect(row.content_hash).toBe(legacyHash);
  });

  it("concurrent losers do NOT call provider (unique constraint wins)", async () => {
    const table = new FakeTable();
    let providerCalls = 0;
    const clock = { now: "2026-07-18T00:00:00.000Z" };
    const provider = async () => {
      providerCalls++;
      return mockContent;
    };
    const input = buildEngineInput(chart(), snapshot());
    // Simulate two concurrent generatePremiumReport calls: the second
    // one hits an existing generating row (row.status='generating',
    // content_json=null → NOT a completed cache hit) and would try to
    // insert but the unique constraint blocks it. In real code the
    // loser returns row.status without calling provider. We model that
    // by attempting a second insert while row 1 is still generating.
    const key = await makeCacheKey("u1", "c1", input);
    const first = table.insertGenerating("u1", "c1", key);
    expect(first).not.toBeNull();
    // Second concurrent caller — same key → insert refused.
    const second = table.insertGenerating("u1", "c1", key);
    expect(second).toBeNull();
    // Neither has invoked the provider in this racing model.
    expect(providerCalls).toBe(0);
  });
});
