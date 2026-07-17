/**
 * Chapter-worker orchestration — pure, DB-agnostic.
 *
 * Given the current set of chapter rows for a report + a chapter
 * catalogue + a provider function, decide which chapters to run next
 * and produce a list of state transitions that the DB layer applies.
 *
 * The DB layer is responsible for actually persisting these transitions
 * and enforcing the compare-and-swap on `claim_token`. This module
 * encodes the rules the worker must follow so we can unit-test cache
 * hits (zero calls), resume, budget stop, retry cap, and concurrency
 * loss WITHOUT touching Supabase.
 */
import {
  MAX_CHAPTER_ATTEMPTS,
  isTerminal,
  type ChapterRow,
  type ChapterStatus,
} from "./chapter-state";
import {
  AI_BUDGET_POLICY,
  chapterOutputCap,
  checkBudgetBeforeChapter,
  type BudgetUsage,
} from "./budget-policy";

export type WorkerChapterMeta = { key: string; index: number };

export type ProviderResult =
  | { ok: true; body: string; usage: { input_tokens: number; output_tokens: number } }
  | { ok: false; error: string; usage?: { input_tokens: number; output_tokens: number } };

export type WorkerProvider = (
  chapter: WorkerChapterMeta,
  outputCap: number,
) => Promise<ProviderResult>;

export type ChapterTransition =
  | {
      kind: "completed";
      chapter_key: string;
      body: string;
      input_tokens: number;
      output_tokens: number;
    }
  | {
      kind: "failed";
      chapter_key: string;
      error: string;
      input_tokens: number;
      output_tokens: number;
    }
  | { kind: "skipped_budget"; chapter_key: string; reason: string };

export type WorkerReport = {
  transitions: ChapterTransition[];
  usage: BudgetUsage;
  stopped_reason:
    | null
    | "report_input_exhausted"
    | "report_output_exhausted"
    | "all_terminal";
};

/**
 * Run one pass over the chapters:
 *   - Skip rows already `completed` / `skipped`.
 *   - Skip `failed` rows that hit `MAX_CHAPTER_ATTEMPTS`.
 *   - For each remaining row, if budget permits, call provider; else
 *     stop with `report_*_exhausted`.
 *   - The caller must persist `transitions` in order.
 */
export async function runChapterWorkers(opts: {
  catalog: WorkerChapterMeta[];
  rows: ChapterRow[];
  provider: WorkerProvider;
  initialUsage?: BudgetUsage;
  policy?: typeof AI_BUDGET_POLICY;
}): Promise<WorkerReport> {
  const rowsByKey = new Map(opts.rows.map((r) => [r.chapter_key, r]));
  const usage: BudgetUsage = {
    input_tokens: opts.initialUsage?.input_tokens ?? 0,
    output_tokens: opts.initialUsage?.output_tokens ?? 0,
  };
  const transitions: ChapterTransition[] = [];
  const policy = opts.policy ?? AI_BUDGET_POLICY;
  let stopped_reason: WorkerReport["stopped_reason"] = null;

  const sortedCatalog = opts.catalog.slice().sort((a, b) => a.index - b.index);
  for (const meta of sortedCatalog) {
    const row = rowsByKey.get(meta.key);
    // No row yet OR pending OR retriable-failed — attempt.
    if (row && isTerminal(row.status as ChapterStatus)) continue;
    if (row && row.status === "failed" && row.attempt_count >= MAX_CHAPTER_ATTEMPTS) continue;

    const decision = checkBudgetBeforeChapter(usage, policy);
    if (decision.action === "stop") {
      stopped_reason = decision.reason;
      transitions.push({
        kind: "skipped_budget",
        chapter_key: meta.key,
        reason: decision.reason,
      });
      break;
    }

    const cap = chapterOutputCap(usage, policy);
    let result: ProviderResult;
    try {
      result = await opts.provider(meta, cap);
    } catch (err) {
      result = {
        ok: false,
        error: err instanceof Error ? err.message : "provider_threw",
      };
    }
    const u = result.usage ?? { input_tokens: 0, output_tokens: 0 };
    usage.input_tokens += u.input_tokens;
    usage.output_tokens += u.output_tokens;

    if (result.ok) {
      transitions.push({
        kind: "completed",
        chapter_key: meta.key,
        body: result.body,
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
      });
    } else {
      transitions.push({
        kind: "failed",
        chapter_key: meta.key,
        error: result.error,
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
      });
    }
  }

  if (stopped_reason === null) {
    const allTerminal = sortedCatalog.every((m) => {
      const r = rowsByKey.get(m.key);
      if (r && isTerminal(r.status as ChapterStatus)) return true;
      const t = transitions.find((tr) => tr.chapter_key === m.key);
      return t?.kind === "completed";
    });
    if (allTerminal) stopped_reason = "all_terminal";
  }

  return { transitions, usage, stopped_reason };
}
