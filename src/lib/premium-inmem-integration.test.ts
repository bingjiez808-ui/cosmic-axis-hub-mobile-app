/**
 * Pure in-memory fake-Supabase integration test for the durable
 * chapter-step protocol. The suite has a HARD 10-second total
 * timeout (bun test --timeout applied per-test; a top-level watchdog
 * also aborts the whole process if the file overruns). All handles
 * (timers, watchdog) are explicitly cleared in `afterAll` so the
 * runner exits cleanly.
 *
 * Five scenarios, each an independent test:
 *   1. 0 → 24 completion via serial drain
 *   2. 7 → 24 resume-after-refresh
 *   3. Expired-lease recovery (stale `running` → reclaimed)
 *   4. Single-chapter failure retried and drained to 24/24
 *   5. Reopening a completed report performs 0 provider calls
 *
 * The fake mirrors the invariants enforced by the real DB layer:
 *   - `claim_premium_chapter_for_user` CAS + attempt_count < 3
 *   - `premium_report_chapters_guard` trigger: completed is TERMINAL
 *   - 2-minute lease auto-recovery on stale `running`
 *   - server-side `drain` returns shouldContinue while work remains
 */
// @ts-expect-error bun:test
import { afterAll, describe, expect, test } from "bun:test";

import { PREMIUM_V3_CHAPTERS } from "./premium-chapters-v3";
import { computeContentHash } from "./reading-engine";

const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 3;
const TOTAL_CHAPTERS = PREMIUM_V3_CHAPTERS.length;

type Status = "pending" | "running" | "completed" | "failed" | "skipped";

interface ChapterRow {
  key: string;
  index: number;
  status: Status;
  attemptCount: number;
  claimToken: string | null;
  claimedAt: number | null;
  contentHash: string | null;
}

interface DrainResult {
  status: "generating" | "completed" | "failed";
  completedChapters: number;
  totalChapters: number;
  shouldContinue: boolean;
  processed: number;
}

/**
 * FakePremiumReport — a pure in-memory model of the report + chapters
 * tables plus the server-side drain loop. Deterministic provider:
 * synthesizes evidence and body from the manifest, so hashes are
 * reproducible across runs and refreshes.
 */
class FakePremiumReport {
  readonly chapters: ChapterRow[];
  providerCalls = 0;
  /** Force `failOnceFor` to throw the first time it is claimed. */
  failOnceFor: string | null = null;
  private failedOnce = new Set<string>();

  constructor() {
    this.chapters = PREMIUM_V3_CHAPTERS.map((c) => ({
      key: c.key,
      index: c.index,
      status: "pending" as Status,
      attemptCount: 0,
      claimToken: null,
      claimedAt: null,
      contentHash: null,
    }));
  }

  private completedCount(): number {
    return this.chapters.filter((c) => c.status === "completed").length;
  }

  private recoverStale(now: number): void {
    for (const c of this.chapters) {
      if (c.status === "running" && c.claimedAt !== null && now - c.claimedAt >= LEASE_MS) {
        c.status = "failed";
        c.claimToken = null;
        c.claimedAt = null;
      }
    }
  }

  private claimNext(now: number): ChapterRow | null {
    this.recoverStale(now);
    if (this.chapters.some((c) => c.status === "running")) return null;
    const next = this.chapters.find(
      (c) =>
        c.status === "pending" ||
        (c.status === "failed" && c.attemptCount < MAX_ATTEMPTS),
    );
    if (!next) return null;
    next.status = "running";
    next.attemptCount += 1;
    next.claimToken = `tok-${next.key}-${next.attemptCount}`;
    next.claimedAt = now;
    return next;
  }

  /** Mirrors the DB trigger: completed is TERMINAL and never overwritten. */
  private guardCompleted(row: ChapterRow, nextStatus: Status): void {
    if (row.status === "completed" && nextStatus !== "completed") {
      throw new Error("completed_chapter_immutable");
    }
  }

  private async runOne(row: ChapterRow): Promise<void> {
    this.providerCalls += 1;
    if (this.failOnceFor === row.key && !this.failedOnce.has(row.key)) {
      this.failedOnce.add(row.key);
      this.guardCompleted(row, "failed");
      row.status = "failed";
      row.claimToken = null;
      row.claimedAt = null;
      return;
    }
    const meta = PREMIUM_V3_CHAPTERS[row.index];
    const content = {
      key: row.key,
      title: meta.title_en,
      body: `deterministic body ${row.key}`,
      evidence_refs: meta.allowed_facts.length
        ? [
            {
              path: "western.sun",
              module: meta.allowed_facts[0],
              confidence: "grounded" as const,
            },
          ]
        : [],
      confidence: "reflective" as const,
    };
    this.guardCompleted(row, "completed");
    row.status = "completed";
    row.claimToken = null;
    row.claimedAt = null;
    row.contentHash = await computeContentHash(content);
  }

  /**
   * Mirrors server-side `processNextPremiumChapter` drain: a bounded
   * loop that claims + completes chapters within a soft deadline, and
   * returns shouldContinue when work remains for the next request.
   */
  async drain(opts: { now?: number; softBudgetMs?: number; maxChapters?: number } = {}): Promise<DrainResult> {
    const softBudgetMs = opts.softBudgetMs ?? 5_000;
    const maxChapters = opts.maxChapters ?? Infinity;
    const started = opts.now ?? Date.now();
    let processed = 0;
    while (this.completedCount() < TOTAL_CHAPTERS && processed < maxChapters) {
      const now = (opts.now ?? Date.now()) + processed;
      if ((now - started) >= softBudgetMs) break;
      const row = this.claimNext(now);
      if (!row) break;
      await this.runOne(row);
      processed += 1;
    }
    const completedChapters = this.completedCount();
    const allTerminal = this.chapters.every(
      (c) => c.status === "completed" || (c.status === "failed" && c.attemptCount >= MAX_ATTEMPTS),
    );
    const status: DrainResult["status"] =
      completedChapters === TOTAL_CHAPTERS ? "completed" : allTerminal ? "failed" : "generating";
    return {
      status,
      completedChapters,
      totalChapters: TOTAL_CHAPTERS,
      shouldContinue: status === "generating",
      processed,
    };
  }
}

// ---------- Hard 10 s watchdog + handle cleanup ---------------------------

const START = Date.now();
const WATCHDOG_MS = 10_000;
const watchdog = setTimeout(() => {
  // eslint-disable-next-line no-console
  console.error(
    `[premium-inmem-integration] watchdog: file exceeded ${WATCHDOG_MS}ms; aborting`,
  );
  process.exit(2);
}, WATCHDOG_MS);
// Never keep the process alive purely for the watchdog.
(watchdog as unknown as { unref?: () => void }).unref?.();

afterAll(() => {
  clearTimeout(watchdog);
});

// ---------- Scenarios -----------------------------------------------------

describe("premium in-memory integration — 5 scenarios under 10s total", () => {
  test("1) 0 → 24 via serial drain; each chapter runs exactly once", async () => {
    const r = new FakePremiumReport();
    let guard = 0;
    let result = await r.drain();
    while (result.shouldContinue && guard++ < 50) result = await r.drain();
    expect(result.status).toBe("completed");
    expect(result.completedChapters).toBe(TOTAL_CHAPTERS);
    expect(r.providerCalls).toBe(TOTAL_CHAPTERS);
    expect(r.chapters.every((c) => c.contentHash?.length === 64)).toBe(true);
  });

  test("2) 7 → 24 refresh-resume: prior 7 hashes preserved, provider only runs for the remaining 17", async () => {
    const r = new FakePremiumReport();
    // Force only 7 chapters in the first drain via a tight budget.
    // Cap the first drain to 7 chapters to simulate the client backing off.
    const first = await r.drain({ maxChapters: 7 });
    expect(first.completedChapters).toBe(7);
    expect(first.shouldContinue).toBe(true);
    const preservedHashes = r.chapters.slice(0, 7).map((c) => c.contentHash);
    const callsAfterFirst = r.providerCalls;
    expect(callsAfterFirst).toBe(7);

    let guard = 0;
    let next = await r.drain();
    while (next.shouldContinue && guard++ < 50) next = await r.drain();
    expect(next.status).toBe("completed");
    expect(next.completedChapters).toBe(TOTAL_CHAPTERS);
    // Chapters 0..6 preserved.
    expect(r.chapters.slice(0, 7).map((c) => c.contentHash)).toEqual(preservedHashes);
    // Only 17 additional provider calls.
    expect(r.providerCalls - callsAfterFirst).toBe(TOTAL_CHAPTERS - 7);
  });

  test("3) expired-lease recovery: a stale `running` row is reclaimed after 2 minutes", async () => {
    const r = new FakePremiumReport();
    const t0 = 1_000_000;
    // Manually simulate a crash mid-run: claim, but never resolve.
    const claimed = (r as unknown as { claimNext: (n: number) => ChapterRow }).claimNext(t0);
    expect(claimed?.status).toBe("running");
    // A drain BEFORE the lease expires cannot make progress on that row.
    const stuck = await r.drain({ now: t0 + 1_000, softBudgetMs: 1 });
    expect(stuck.processed).toBe(0);
    expect(r.chapters[0].status).toBe("running");
    // After lease expiry the recover pass flips it to `failed`, then the
    // drain retries it and completes normally.
    let guard = 0;
    let out = await r.drain({ now: t0 + LEASE_MS + 1 });
    while (out.shouldContinue && guard++ < 50) out = await r.drain({ now: t0 + LEASE_MS + 1 });
    expect(out.status).toBe("completed");
    expect(r.chapters[0].status).toBe("completed");
    expect(r.chapters[0].attemptCount).toBe(2); // one crashed claim + one retry
  });

  test("4) single-chapter failure retried; drain still reaches 24/24", async () => {
    const r = new FakePremiumReport();
    const targetKey = PREMIUM_V3_CHAPTERS[3].key;
    r.failOnceFor = targetKey;
    let guard = 0;
    let result = await r.drain();
    while (result.shouldContinue && guard++ < 50) result = await r.drain();
    expect(result.status).toBe("completed");
    expect(result.completedChapters).toBe(TOTAL_CHAPTERS);
    const target = r.chapters.find((c) => c.key === targetKey)!;
    expect(target.status).toBe("completed");
    expect(target.attemptCount).toBe(2); // fail once, succeed on retry
    expect(r.providerCalls).toBe(TOTAL_CHAPTERS + 1);
  });

  test("5) reopening a completed report performs 0 provider calls; hashes unchanged", async () => {
    const r = new FakePremiumReport();
    let guard = 0;
    let result = await r.drain();
    while (result.shouldContinue && guard++ < 50) result = await r.drain();
    expect(result.status).toBe("completed");
    const finalHashes = r.chapters.map((c) => c.contentHash);
    const callsBefore = r.providerCalls;
    // Simulate the user reopening the report multiple times.
    for (let i = 0; i < 5; i += 1) {
      const reopen = await r.drain();
      expect(reopen.status).toBe("completed");
      expect(reopen.shouldContinue).toBe(false);
      expect(reopen.processed).toBe(0);
    }
    expect(r.providerCalls).toBe(callsBefore);
    expect(r.chapters.map((c) => c.contentHash)).toEqual(finalHashes);
  });
});

describe("premium in-memory integration — file executes well under 10s", () => {
  test("watchdog margin", () => {
    const elapsed = Date.now() - START;
    expect(elapsed).toBeLessThan(WATCHDOG_MS);
  });
});
