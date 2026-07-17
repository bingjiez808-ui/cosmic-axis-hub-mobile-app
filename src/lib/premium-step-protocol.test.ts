/**
 * Durable premium chapter-step protocol regression tests.
 *
 * These tests model the serverless-safe contract implemented by
 * `generatePremiumReport` + `processNextPremiumChapter`:
 *   - start only creates/restores report state; no fire-and-forget worker
 *   - each step claims and completes at most one chapter
 *   - progress is exactly completed / 24, so 0/24 is 0%
 *   - refresh/reopen resumes pending/failed only
 *   - completed reports are cache hits and do not call the provider again
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { PREMIUM_V3_CHAPTERS } from "./premium-chapters-v3";
import { computeContentHash } from "./reading-engine";

type ChapterState = {
  key: string;
  index: number;
  status: "pending" | "running" | "completed" | "failed";
  attemptCount: number;
  claimToken: string | null;
  claimedAt: number | null;
  contentHash: string | null;
  evidenceRefs: Array<{ path: string; module: string; confidence: string }>;
  confidence: "grounded" | "traditional" | "reflective" | null;
};

type StepResult = {
  processed: boolean;
  status: "generating" | "completed";
  completedChapters: number;
  totalChapters: number;
  pct: number;
};

const LEASE_MS = 120_000;

class FakePremiumReport {
  readonly chapters: ChapterState[] = PREMIUM_V3_CHAPTERS.map((c) => ({
    key: c.key,
    index: c.index,
    status: "pending",
    attemptCount: 0,
    claimToken: null,
    claimedAt: null,
    contentHash: null,
    evidenceRefs: [],
    confidence: null,
  }));
  providerCalls = 0;

  progress(): StepResult {
    const completedChapters = this.chapters.filter((c) => c.status === "completed").length;
    const totalChapters = this.chapters.length;
    return {
      processed: false,
      status: completedChapters === totalChapters ? "completed" : "generating",
      completedChapters,
      totalChapters,
      pct: totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0,
    };
  }

  recoverStale(now: number) {
    for (const ch of this.chapters) {
      if (ch.status === "running" && ch.claimedAt !== null && now - ch.claimedAt >= LEASE_MS) {
        ch.status = "failed";
        ch.claimToken = null;
        ch.claimedAt = null;
      }
    }
  }

  claimNext(now: number): ChapterState | null {
    this.recoverStale(now);
    if (this.chapters.some((c) => c.status === "running")) return null;
    const next = this.chapters.find(
      (c) => c.status === "pending" || (c.status === "failed" && c.attemptCount < 3),
    );
    if (!next) return null;
    next.status = "running";
    next.attemptCount += 1;
    next.claimToken = crypto.randomUUID();
    next.claimedAt = now;
    return next;
  }

  async processNext(now = Date.now()): Promise<StepResult> {
    if (this.progress().status === "completed") return this.progress();
    const claim = this.claimNext(now);
    if (!claim) return this.progress();
    this.providerCalls += 1;
    const meta = PREMIUM_V3_CHAPTERS[claim.index];
    const evidenceRefs = meta.allowed_facts.length
      ? [{ path: "western.sun", module: meta.allowed_facts[0], confidence: "grounded" }]
      : [];
    const content = {
      key: claim.key,
      title: meta.title_en,
      body: `deterministic body ${claim.key}`,
      evidence_refs: evidenceRefs,
      confidence: evidenceRefs.length ? "grounded" : "reflective",
    } as const;
    claim.status = "completed";
    claim.claimToken = null;
    claim.contentHash = await computeContentHash(content);
    claim.evidenceRefs = [...evidenceRefs];
    claim.confidence = content.confidence;
    return { ...this.progress(), processed: true };
  }
}

describe("premium durable chapter-step protocol", () => {
  test("0/24 is 0%, then first step completes exactly one chapter as 1/24", async () => {
    const report = new FakePremiumReport();
    expect(report.progress()).toMatchObject({ completedChapters: 0, totalChapters: 24, pct: 0 });

    const first = await report.processNext();
    expect(first).toMatchObject({ processed: true, completedChapters: 1, totalChapters: 24, pct: 4 });
    expect(report.chapters[0]).toMatchObject({
      status: "completed",
      evidenceRefs: [],
      confidence: "reflective",
    });
    expect(report.chapters[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(report.providerCalls).toBe(1);
  });

  test("serial loop reaches 24/24; completed reopen performs zero provider calls", async () => {
    const report = new FakePremiumReport();
    for (let i = 0; i < PREMIUM_V3_CHAPTERS.length; i += 1) {
      const step = await report.processNext();
      expect(step.completedChapters).toBe(i + 1);
    }
    const finalHashes = report.chapters.map((c) => c.contentHash);
    expect(report.progress()).toMatchObject({ status: "completed", completedChapters: 24, pct: 100 });
    expect(report.providerCalls).toBe(24);

    const before = report.providerCalls;
    const reopened = await report.processNext();
    expect(reopened.status).toBe("completed");
    expect(report.providerCalls).toBe(before);
    expect(report.chapters.map((c) => c.contentHash)).toEqual(finalHashes);
  });

  test("refresh resumes only pending chapters and preserves completed hashes", async () => {
    const report = new FakePremiumReport();
    for (let i = 0; i < 5; i += 1) await report.processNext();
    const completedHashes = report.chapters.slice(0, 5).map((c) => c.contentHash);
    const callsBeforeRefresh = report.providerCalls;

    // Simulate a browser refresh: durable chapter rows remain; the client
    // simply continues calling one-step requests for unfinished rows.
    while (report.progress().status !== "completed") await report.processNext();

    expect(report.providerCalls - callsBeforeRefresh).toBe(19);
    expect(report.chapters.slice(0, 5).map((c) => c.contentHash)).toEqual(completedHashes);
    expect(report.progress().completedChapters).toBe(24);
  });

  test("stale running chapter is recovered after the two-minute lease", async () => {
    const report = new FakePremiumReport();
    const now = Date.now();
    const claimed = report.claimNext(now)!;
    expect(claimed.status).toBe("running");

    const step = await report.processNext(now + LEASE_MS + 1);
    expect(step).toMatchObject({ processed: true, completedChapters: 1 });
    expect(report.chapters[0].status).toBe("completed");
    expect(report.providerCalls).toBe(1);
  });

  test("concurrent step attempts cannot process more than one chapter claim", async () => {
    const report = new FakePremiumReport();
    const now = Date.now();
    const firstClaim = report.claimNext(now);
    const racingClaim = report.claimNext(now);
    expect(firstClaim?.key).toBe(PREMIUM_V3_CHAPTERS[0].key);
    expect(racingClaim).toBeNull();
    expect(report.progress().completedChapters).toBe(0);
  });
});

describe("premium source invariant — start does not background-generate", () => {
  test("generatePremiumReport delegates generation to processNextPremiumChapter only", () => {
    const src = readFileSync("src/lib/premium.functions.ts", "utf8");
    const startBlock = src.slice(
      src.indexOf("export const generatePremiumReport"),
      src.indexOf("export const processNextPremiumChapter"),
    );
    expect(startBlock).toContain("startPremiumReportState");
    expect(startBlock).not.toContain("generateChapter(");
    expect(startBlock).not.toContain("Promise.all");
    expect(startBlock).not.toContain("setTimeout");
  });
});