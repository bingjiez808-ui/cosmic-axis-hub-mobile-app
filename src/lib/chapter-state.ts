/**
 * Chapter-level state machine for the Premium ¥79 deep-report
 * generation. Pure and deterministic — no DB, no clock, no AI. Tests
 * pin every transition. The DB layer (see supabase/pending/*.sql) is
 * the authoritative store; this module encodes the rules the server
 * function must follow when it reads / writes chapter rows.
 *
 * Rules:
 *   • pending → running → completed | failed
 *   • failed → running (retry) → completed | failed
 *   • completed is TERMINAL — never re-run, never overwritten. This is
 *     re-enforced by the `premium_report_chapters_guard` trigger.
 *   • skipped is TERMINAL — used when a chapter has no evidence AND
 *     budget policy forbids empty AI calls (see budget-policy.ts).
 *   • Concurrent claim: a worker "claims" a pending/failed row by
 *     writing its own claim_token. The DB does a compare-and-swap;
 *     the loser sees another token and does NOT call the provider.
 */

export type ChapterStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type ChapterRow = {
  chapter_key: string;
  chapter_index: number;
  status: ChapterStatus;
  attempt_count: number;
  claim_token: string | null;
};

export const MAX_CHAPTER_ATTEMPTS = 3;

export function canTransition(from: ChapterStatus, to: ChapterStatus): boolean {
  if (from === "completed") return false;
  if (from === "skipped") return false;
  switch (to) {
    case "running":
      return from === "pending" || from === "failed";
    case "completed":
    case "failed":
      return from === "running";
    case "skipped":
      return from === "pending" || from === "failed";
    case "pending":
      return false;
  }
}

export function canRetry(row: ChapterRow): boolean {
  return row.status === "failed" && row.attempt_count < MAX_CHAPTER_ATTEMPTS;
}

export function isTerminal(status: ChapterStatus): boolean {
  return status === "completed" || status === "skipped";
}

/**
 * Given every chapter row for a report, decide the next set of
 * chapter_keys that should be claimed and executed (in index order).
 * Never returns completed/skipped/running rows. Failed rows are
 * included only when they still have retry budget.
 */
export function selectNextChapters(rows: ChapterRow[]): string[] {
  return rows
    .slice()
    .sort((a, b) => a.chapter_index - b.chapter_index)
    .filter((r) => {
      if (r.status === "pending") return true;
      if (r.status === "failed") return canRetry(r);
      return false;
    })
    .map((r) => r.chapter_key);
}

export type OverallStatus = "pending" | "generating" | "partial" | "completed" | "failed";

export function summarizeReportStatus(
  rows: ChapterRow[],
  totalChapters: number,
): OverallStatus {
  if (rows.length === 0) return "pending";
  const running = rows.some((r) => r.status === "running");
  const completedCount = rows.filter((r) => r.status === "completed").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;
  const skippedCount = rows.filter((r) => r.status === "skipped").length;
  if (completedCount === totalChapters) return "completed";
  if (running) return "generating";
  if (failedCount > 0 && failedCount + completedCount + skippedCount === totalChapters) {
    // All chapters have been tried; some still failed.
    return "partial";
  }
  if (completedCount > 0 || skippedCount > 0) return "partial";
  if (failedCount > 0) return "failed";
  return "pending";
}

/**
 * Optimistic claim: succeeds when the DB row's current claim_token
 * matches `expected` (which is what the worker last read). This helper
 * captures the logic that the DB update must implement:
 *   UPDATE ... SET claim_token = new, status='running', attempt_count = attempt_count + 1
 *   WHERE chapter_key = k AND status IN ('pending','failed')
 *     AND (claim_token IS NULL OR claim_token = expected)
 */
export function shouldGrantClaim(
  row: ChapterRow,
  expectedToken: string | null,
): boolean {
  if (row.status !== "pending" && row.status !== "failed") return false;
  if (row.status === "failed" && !canRetry(row)) return false;
  return row.claim_token === expectedToken;
}
