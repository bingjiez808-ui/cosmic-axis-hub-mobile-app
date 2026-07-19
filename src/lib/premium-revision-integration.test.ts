/**
 * Revision-pinned in-memory integration test for the current manifest
 * (PREMIUM_REPORT_REVISION = "premium_v3_rev_2026_07_real_ai").
 *
 * Scenarios (deterministic provider, pure in-memory fake tables):
 *   1) 0 → 24 uses the current revision; every persisted chapter carries it.
 *   2) 7 → 24 resume: prior 7 hashes preserved, provider only runs for 17.
 *   3) Single-chapter failure recovered; drain still reaches 24/24.
 *   4) Reopening a completed report performs 0 provider calls; hashes unchanged.
 *   5) Old-revision immutability: an "old" completed row with a different
 *      prompt_version is never overwritten — a NEW row (identified by the
 *      current revision) is inserted alongside it.
 *
 * Watchdog: 10s file-level abort matching the sibling in-mem suite.
 */
// @ts-expect-error bun:test
import { afterAll, describe, expect, test } from "bun:test";

import { PREMIUM_REPORT_REVISION, PREMIUM_V3_CHAPTERS } from "./premium-chapters-v3";
import { computeContentHash } from "./reading-engine";

const OLD_REVISION = "reading_prompt_v2.0.0";
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 3;
const TOTAL_CHAPTERS = PREMIUM_V3_CHAPTERS.length;

type ChapterStatus = "pending" | "running" | "completed" | "failed";

interface ChapterRow {
  key: string;
  index: number;
  status: ChapterStatus;
  attemptCount: number;
  claimToken: string | null;
  claimedAt: number | null;
  contentHash: string | null;
  promptVersion: string | null;
}

interface ReportRow {
  id: string;
  userId: string;
  chartId: string;
  promptVersion: string;
  status: "pending" | "generating" | "partial" | "completed" | "failed";
  chapters: ChapterRow[];
  providerCalls: number;
}

interface DrainResult {
  status: "generating" | "completed" | "failed";
  completedChapters: number;
  totalChapters: number;
  shouldContinue: boolean;
  processed: number;
}

/** Very small in-memory ReportsTable mirroring the DB uniqueness rule. */
class ReportsTable {
  private rows: ReportRow[] = [];
  /** Emulates `(user_id, chart_id, prompt_version)` uniqueness — bumping
   * revision creates a new row rather than overwriting an existing one. */
  ensureRow(userId: string, chartId: string, promptVersion: string): ReportRow {
    const found = this.rows.find(
      (r) => r.userId === userId && r.chartId === chartId && r.promptVersion === promptVersion,
    );
    if (found) return found;
    const row: ReportRow = {
      id: `rep-${this.rows.length + 1}`,
      userId,
      chartId,
      promptVersion,
      status: "pending",
      chapters: PREMIUM_V3_CHAPTERS.map((c) => ({
        key: c.key,
        index: c.index,
        status: "pending",
        attemptCount: 0,
        claimToken: null,
        claimedAt: null,
        contentHash: null,
        promptVersion: null,
      })),
      providerCalls: 0,
    };
    this.rows.push(row);
    return row;
  }
  seedCompleted(userId: string, chartId: string, promptVersion: string): ReportRow {
    const row = this.ensureRow(userId, chartId, promptVersion);
    for (const ch of row.chapters) {
      ch.status = "completed";
      ch.contentHash = "sealed-" + promptVersion + "-" + ch.key;
      ch.promptVersion = promptVersion;
    }
    row.status = "completed";
    return row;
  }
  list(): ReportRow[] {
    return this.rows;
  }
}

async function runOne(row: ReportRow, ch: ChapterRow, failOnceFor: Set<string>): Promise<void> {
  row.providerCalls += 1;
  if (failOnceFor.has(ch.key)) {
    failOnceFor.delete(ch.key);
    if (ch.status === "completed") throw new Error("completed_chapter_immutable");
    ch.status = "failed";
    ch.claimToken = null;
    ch.claimedAt = null;
    return;
  }
  const meta = PREMIUM_V3_CHAPTERS[ch.index];
  const content = {
    key: ch.key,
    title: meta.title_zh,
    body: `det body ${ch.key} @ ${row.promptVersion}`,
    prompt_version: row.promptVersion,
  };
  if (ch.status === "completed") throw new Error("completed_chapter_immutable");
  ch.status = "completed";
  ch.claimToken = null;
  ch.claimedAt = null;
  ch.contentHash = await computeContentHash(content);
  ch.promptVersion = row.promptVersion;
}

function claimNext(row: ReportRow, now: number): ChapterRow | null {
  // Recover stale leases.
  for (const c of row.chapters) {
    if (c.status === "running" && c.claimedAt !== null && now - c.claimedAt >= LEASE_MS) {
      c.status = "failed";
      c.claimToken = null;
      c.claimedAt = null;
    }
  }
  if (row.chapters.some((c) => c.status === "running")) return null;
  const next = row.chapters.find(
    (c) => c.status === "pending" || (c.status === "failed" && c.attemptCount < MAX_ATTEMPTS),
  );
  if (!next) return null;
  next.status = "running";
  next.attemptCount += 1;
  next.claimToken = `tok-${next.key}-${next.attemptCount}`;
  next.claimedAt = now;
  return next;
}

async function drain(
  row: ReportRow,
  opts: { failOnceFor?: Set<string>; maxChapters?: number; now?: number } = {},
): Promise<DrainResult> {
  const failOnceFor = opts.failOnceFor ?? new Set<string>();
  const maxChapters = opts.maxChapters ?? Infinity;
  let processed = 0;
  const completedCount = () => row.chapters.filter((c) => c.status === "completed").length;
  while (completedCount() < TOTAL_CHAPTERS && processed < maxChapters) {
    const now = (opts.now ?? Date.now()) + processed;
    const ch = claimNext(row, now);
    if (!ch) break;
    await runOne(row, ch, failOnceFor);
    processed += 1;
  }
  const completed = completedCount();
  const allTerminal = row.chapters.every(
    (c) => c.status === "completed" || (c.status === "failed" && c.attemptCount >= MAX_ATTEMPTS),
  );
  const status: DrainResult["status"] =
    completed === TOTAL_CHAPTERS ? "completed" : allTerminal ? "failed" : "generating";
  row.status = status === "completed" ? "completed" : status === "failed" ? "failed" : completed > 0 ? "partial" : "generating";
  return {
    status,
    completedChapters: completed,
    totalChapters: TOTAL_CHAPTERS,
    shouldContinue: status === "generating",
    processed,
  };
}

// ---------- Watchdog ------------------------------------------------------

const START = Date.now();
const WATCHDOG_MS = 10_000;
const watchdog = setTimeout(() => {
  // eslint-disable-next-line no-console
  console.error(
    `[premium-revision-integration] watchdog: file exceeded ${WATCHDOG_MS}ms; aborting`,
  );
  process.exit(2);
}, WATCHDOG_MS);
(watchdog as unknown as { unref?: () => void }).unref?.();

afterAll(() => clearTimeout(watchdog));

// ---------- Scenarios -----------------------------------------------------

describe(`premium revision integration — pinned to ${PREMIUM_REPORT_REVISION}`, () => {
  test("revision constant hasn't drifted", () => {
    expect(PREMIUM_REPORT_REVISION).toBe("premium_v3_rev_2026_07_real_ai");
    expect(PREMIUM_V3_CHAPTERS.length).toBe(24);
  });

  test("1) 0 → 24 completes under the current revision", async () => {
    const tbl = new ReportsTable();
    const row = tbl.ensureRow("u1", "c1", PREMIUM_REPORT_REVISION);
    let out = await drain(row);
    let guard = 0;
    while (out.shouldContinue && guard++ < 50) out = await drain(row);
    expect(out.status).toBe("completed");
    expect(out.completedChapters).toBe(TOTAL_CHAPTERS);
    expect(row.providerCalls).toBe(TOTAL_CHAPTERS);
    expect(row.chapters.every((c) => c.promptVersion === PREMIUM_REPORT_REVISION)).toBe(true);
    expect(row.chapters.every((c) => c.contentHash?.length === 64)).toBe(true);
  });

  test("2) 7 → 24 resume: first 7 hashes preserved, provider only runs 17 more", async () => {
    const tbl = new ReportsTable();
    const row = tbl.ensureRow("u2", "c2", PREMIUM_REPORT_REVISION);
    const first = await drain(row, { maxChapters: 7 });
    expect(first.completedChapters).toBe(7);
    expect(first.shouldContinue).toBe(true);
    const preserved = row.chapters.slice(0, 7).map((c) => c.contentHash);
    const callsAfterFirst = row.providerCalls;
    expect(callsAfterFirst).toBe(7);
    let out = await drain(row);
    let guard = 0;
    while (out.shouldContinue && guard++ < 50) out = await drain(row);
    expect(out.status).toBe("completed");
    expect(row.chapters.slice(0, 7).map((c) => c.contentHash)).toEqual(preserved);
    expect(row.providerCalls - callsAfterFirst).toBe(TOTAL_CHAPTERS - 7);
  });

  test("3) single-chapter failure recovered; drain reaches 24/24", async () => {
    const tbl = new ReportsTable();
    const row = tbl.ensureRow("u3", "c3", PREMIUM_REPORT_REVISION);
    const target = PREMIUM_V3_CHAPTERS[5].key;
    let out = await drain(row, { failOnceFor: new Set([target]) });
    let guard = 0;
    while (out.shouldContinue && guard++ < 50) out = await drain(row);
    expect(out.status).toBe("completed");
    expect(out.completedChapters).toBe(TOTAL_CHAPTERS);
    const targetRow = row.chapters.find((c) => c.key === target)!;
    expect(targetRow.status).toBe("completed");
    expect(targetRow.attemptCount).toBe(2);
    expect(row.providerCalls).toBe(TOTAL_CHAPTERS + 1);
  });

  test("4) reopening a completed report performs 0 provider calls; hashes unchanged", async () => {
    const tbl = new ReportsTable();
    const row = tbl.ensureRow("u4", "c4", PREMIUM_REPORT_REVISION);
    let out = await drain(row);
    let guard = 0;
    while (out.shouldContinue && guard++ < 50) out = await drain(row);
    expect(out.status).toBe("completed");
    const hashesBefore = row.chapters.map((c) => c.contentHash);
    const callsBefore = row.providerCalls;
    for (let i = 0; i < 5; i++) {
      const reopen = await drain(row);
      expect(reopen.status).toBe("completed");
      expect(reopen.shouldContinue).toBe(false);
      expect(reopen.processed).toBe(0);
    }
    expect(row.providerCalls).toBe(callsBefore);
    expect(row.chapters.map((c) => c.contentHash)).toEqual(hashesBefore);
  });

  test("5) old revision is immutable: bumping revision creates a new row and never overwrites", async () => {
    const tbl = new ReportsTable();
    // Seed an "old" row that is already completed under a prior revision.
    const oldRow = tbl.seedCompleted("u5", "c5", OLD_REVISION);
    const oldHashes = oldRow.chapters.map((c) => c.contentHash);
    expect(oldRow.status).toBe("completed");
    expect(oldRow.chapters.every((c) => c.promptVersion === OLD_REVISION)).toBe(true);

    // A fresh generate for (u5,c5) at the current revision must NOT touch
    // the old row — instead a second row is inserted.
    const newRow = tbl.ensureRow("u5", "c5", PREMIUM_REPORT_REVISION);
    expect(newRow.id).not.toBe(oldRow.id);
    let out = await drain(newRow);
    let guard = 0;
    while (out.shouldContinue && guard++ < 50) out = await drain(newRow);
    expect(out.status).toBe("completed");
    expect(newRow.chapters.every((c) => c.promptVersion === PREMIUM_REPORT_REVISION)).toBe(true);

    // Old row is byte-for-byte unchanged.
    expect(oldRow.chapters.map((c) => c.contentHash)).toEqual(oldHashes);
    expect(oldRow.promptVersion).toBe(OLD_REVISION);
    expect(oldRow.status).toBe("completed");
    // Both rows coexist for the same (user, chart).
    const forChart = tbl.list().filter((r) => r.userId === "u5" && r.chartId === "c5");
    expect(forChart.length).toBe(2);
    expect(new Set(forChart.map((r) => r.promptVersion))).toEqual(
      new Set([OLD_REVISION, PREMIUM_REPORT_REVISION]),
    );
  });

  test("watchdog margin", () => {
    expect(Date.now() - START).toBeLessThan(WATCHDOG_MS);
  });
});
