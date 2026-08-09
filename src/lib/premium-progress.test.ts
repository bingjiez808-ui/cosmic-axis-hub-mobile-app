/**
 * Pure decision tests for the reader's "can continue" / partial logic.
 * These mirror the shape emitted by `getPremiumReportProgress` — we do
 * not spin up Supabase; we only pin the deterministic rules.
 */
// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { PREMIUM_V3_CHAPTERS } from "./premium-chapters-v3";

type Ch = {
  key: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  attempt_count: number;
};

function derive(chapters: Ch[], reportStatus: string) {
  const completed = chapters.filter((c) => c.status === "completed").length;
  const failed = chapters.filter((c) => c.status === "failed").length;
  const canContinue = chapters.some(
    (c) => c.status === "pending" || (c.status === "failed" && c.attempt_count < 3),
  );
  const isPartial =
    reportStatus === "partial" ||
    reportStatus === "failed" ||
    (canContinue && completed < chapters.length);
  return { completed, failed, canContinue, isPartial };
}

describe("premium report progress derivation", () => {
  test("all completed => not partial, cannot continue", () => {
    const rows = PREMIUM_V3_CHAPTERS.map<Ch>((c) => ({
      key: c.key,
      status: "completed",
      attempt_count: 1,
    }));
    const d = derive(rows, "completed");
    expect(d.completed).toBe(PREMIUM_V3_CHAPTERS.length);
    expect(d.canContinue).toBe(false);
    expect(d.isPartial).toBe(false);
  });

  test("half completed, half pending => partial + canContinue", () => {
    const rows = PREMIUM_V3_CHAPTERS.map<Ch>((c, i) => ({
      key: c.key,
      status: i < 12 ? "completed" : "pending",
      attempt_count: i < 12 ? 1 : 0,
    }));
    const d = derive(rows, "generating");
    expect(d.canContinue).toBe(true);
    expect(d.isPartial).toBe(true);
  });

  test("failed at retry cap => not retriable via canContinue", () => {
    const rows: Ch[] = PREMIUM_V3_CHAPTERS.map((c) => ({
      key: c.key,
      status: "failed",
      attempt_count: 3,
    }));
    const d = derive(rows, "partial");
    expect(d.canContinue).toBe(false);
    // reportStatus itself is partial, so UI still shows the banner.
    expect(d.isPartial).toBe(true);
  });

  test("budget-stopped mid-run: some completed + report status=partial", () => {
    const rows: Ch[] = PREMIUM_V3_CHAPTERS.map((c, i) => ({
      key: c.key,
      status: i < 5 ? "completed" : "pending",
      attempt_count: i < 5 ? 1 : 0,
    }));
    const d = derive(rows, "partial");
    expect(d.isPartial).toBe(true);
    expect(d.canContinue).toBe(true);
  });
});
