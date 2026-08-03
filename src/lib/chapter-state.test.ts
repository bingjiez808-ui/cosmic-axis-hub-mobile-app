// @ts-expect-error bun:test
import { describe, expect, it } from "bun:test";
import {
  canRetry,
  canTransition,
  isTerminal,
  MAX_CHAPTER_ATTEMPTS,
  selectNextChapters,
  shouldGrantClaim,
  summarizeReportStatus,
  type ChapterRow,
} from "./chapter-state";

const row = (k: string, i: number, status: ChapterRow["status"], attempts = 0, token: string | null = null): ChapterRow => ({
  chapter_key: k, chapter_index: i, status, attempt_count: attempts, claim_token: token,
});

describe("chapter-state — canTransition", () => {
  it("pending → running / skipped only", () => {
    expect(canTransition("pending", "running")).toBe(true);
    expect(canTransition("pending", "skipped")).toBe(true);
    expect(canTransition("pending", "completed")).toBe(false);
    expect(canTransition("pending", "failed")).toBe(false);
  });
  it("running → completed / failed only", () => {
    expect(canTransition("running", "completed")).toBe(true);
    expect(canTransition("running", "failed")).toBe(true);
    expect(canTransition("running", "running")).toBe(false);
  });
  it("failed → running (retry) / skipped only", () => {
    expect(canTransition("failed", "running")).toBe(true);
    expect(canTransition("failed", "skipped")).toBe(true);
    expect(canTransition("failed", "completed")).toBe(false);
  });
  it("completed and skipped are terminal", () => {
    for (const to of ["pending","running","failed","completed","skipped"] as const) {
      expect(canTransition("completed", to)).toBe(false);
      expect(canTransition("skipped", to)).toBe(false);
    }
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("skipped")).toBe(true);
    expect(isTerminal("failed")).toBe(false);
  });
});

describe("chapter-state — retry budget", () => {
  it(`allows up to ${MAX_CHAPTER_ATTEMPTS} attempts`, () => {
    expect(canRetry(row("a", 0, "failed", 0))).toBe(true);
    expect(canRetry(row("a", 0, "failed", MAX_CHAPTER_ATTEMPTS - 1))).toBe(true);
    expect(canRetry(row("a", 0, "failed", MAX_CHAPTER_ATTEMPTS))).toBe(false);
  });
  it("never retries non-failed rows", () => {
    expect(canRetry(row("a", 0, "completed"))).toBe(false);
    expect(canRetry(row("a", 0, "pending"))).toBe(false);
  });
});

describe("chapter-state — selectNextChapters", () => {
  it("returns pending + retriable failed in index order, skipping terminal", () => {
    const rows = [
      row("c", 2, "failed", 1),
      row("a", 0, "completed"),
      row("b", 1, "pending"),
      row("d", 3, "running"),
      row("e", 4, "failed", MAX_CHAPTER_ATTEMPTS),
      row("f", 5, "skipped"),
    ];
    expect(selectNextChapters(rows)).toEqual(["b", "c"]);
  });
});

describe("chapter-state — summarizeReportStatus", () => {
  const total = 3;
  it("empty → pending", () => {
    expect(summarizeReportStatus([], total)).toBe("pending");
  });
  it("all completed → completed", () => {
    expect(summarizeReportStatus([
      row("a",0,"completed"), row("b",1,"completed"), row("c",2,"completed"),
    ], total)).toBe("completed");
  });
  it("any running → generating", () => {
    expect(summarizeReportStatus([
      row("a",0,"completed"), row("b",1,"running"), row("c",2,"pending"),
    ], total)).toBe("generating");
  });
  it("all tried with some failed → partial", () => {
    expect(summarizeReportStatus([
      row("a",0,"completed"), row("b",1,"failed",3), row("c",2,"skipped"),
    ], total)).toBe("partial");
  });
});

describe("chapter-state — shouldGrantClaim", () => {
  it("grants when token matches and status is pending", () => {
    expect(shouldGrantClaim(row("a",0,"pending",0,null), null)).toBe(true);
  });
  it("rejects when token differs (other worker holds claim)", () => {
    expect(shouldGrantClaim(row("a",0,"pending",0,"tok-x"), null)).toBe(false);
  });
  it("rejects when out of retry budget", () => {
    expect(shouldGrantClaim(row("a",0,"failed",MAX_CHAPTER_ATTEMPTS,null), null)).toBe(false);
  });
  it("rejects on terminal", () => {
    expect(shouldGrantClaim(row("a",0,"completed",0,null), null)).toBe(false);
  });
});
