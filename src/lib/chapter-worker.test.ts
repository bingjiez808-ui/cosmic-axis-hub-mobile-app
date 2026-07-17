// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import { runChapterWorkers, type WorkerProvider } from "./chapter-worker";
import type { ChapterRow } from "./chapter-state";
import { AI_BUDGET_POLICY } from "./budget-policy";

const CATALOG = [
  { key: "a", index: 0 },
  { key: "b", index: 1 },
  { key: "c", index: 2 },
];

function row(key: string, status: ChapterRow["status"], attempts = 0): ChapterRow {
  return {
    chapter_key: key,
    chapter_index: CATALOG.findIndex((c) => c.key === key),
    status,
    attempt_count: attempts,
    claim_token: null,
  };
}

const okProvider =
  (bodies: Record<string, string>): WorkerProvider =>
  async (m) => ({
    ok: true,
    body: bodies[m.key] ?? `body:${m.key}`,
    usage: { input_tokens: 100, output_tokens: 200 },
  });

describe("runChapterWorkers", () => {
  test("cache hit: all chapters completed → zero provider calls", async () => {
    let calls = 0;
    const provider: WorkerProvider = async () => {
      calls += 1;
      return { ok: true, body: "x", usage: { input_tokens: 0, output_tokens: 0 } };
    };
    const rows = CATALOG.map((c) => row(c.key, "completed"));
    const r = await runChapterWorkers({ catalog: CATALOG, rows, provider });
    expect(calls).toBe(0);
    expect(r.transitions.length).toBe(0);
    expect(r.stopped_reason).toBe("all_terminal");
  });

  test("resume: completed chapter is not re-called, only pending ones run", async () => {
    let calledKeys: string[] = [];
    const provider: WorkerProvider = async (m) => {
      calledKeys.push(m.key);
      return { ok: true, body: "y", usage: { input_tokens: 10, output_tokens: 20 } };
    };
    const rows = [row("a", "completed"), row("b", "failed", 1)];
    // c has no row yet
    const r = await runChapterWorkers({ catalog: CATALOG, rows, provider });
    expect(calledKeys).toEqual(["b", "c"]);
    expect(r.transitions.filter((t) => t.kind === "completed").length).toBe(2);
  });

  test("retry cap: failed row at MAX_CHAPTER_ATTEMPTS is skipped", async () => {
    const provider = okProvider({});
    const rows = [row("a", "failed", 3)];
    const r = await runChapterWorkers({ catalog: CATALOG, rows, provider });
    expect(r.transitions.find((t) => t.chapter_key === "a")).toBeUndefined();
    expect(r.transitions.map((t) => t.chapter_key)).toEqual(["b", "c"]);
  });

  test("budget stop: report_output_exhausted halts remaining chapters as skipped_budget", async () => {
    // Force the second chapter to trip the report output ceiling.
    const tightPolicy = {
      ...AI_BUDGET_POLICY,
      report_max_output_tokens: AI_BUDGET_POLICY.chapter_max_output_tokens + 10,
    };
    const provider: WorkerProvider = async () => ({
      ok: true,
      body: "z",
      usage: {
        input_tokens: 100,
        output_tokens: AI_BUDGET_POLICY.chapter_max_output_tokens,
      },
    });
    const r = await runChapterWorkers({
      catalog: CATALOG,
      rows: [],
      provider,
      policy: tightPolicy,
    });
    const kinds = r.transitions.map((t) => t.kind);
    expect(kinds[0]).toBe("completed");
    // Second call should trip the budget check.
    expect(r.stopped_reason).toBe("report_output_exhausted");
    expect(r.transitions.some((t) => t.kind === "skipped_budget")).toBe(true);
  });

  test("provider failure → failed transition, tokens still counted", async () => {
    const provider: WorkerProvider = async (m) =>
      m.key === "b"
        ? { ok: false, error: "boom", usage: { input_tokens: 50, output_tokens: 0 } }
        : { ok: true, body: "ok", usage: { input_tokens: 30, output_tokens: 40 } };
    const r = await runChapterWorkers({ catalog: CATALOG, rows: [], provider });
    const b = r.transitions.find((t) => t.chapter_key === "b")!;
    expect(b.kind).toBe("failed");
    expect(r.usage.input_tokens).toBeGreaterThan(0);
  });

  test("deterministic: same catalog + rows + provider → identical transitions", async () => {
    const provider = okProvider({ a: "A", b: "B", c: "C" });
    const a = await runChapterWorkers({ catalog: CATALOG, rows: [], provider });
    const b = await runChapterWorkers({ catalog: CATALOG, rows: [], provider });
    expect(JSON.stringify(a.transitions)).toBe(JSON.stringify(b.transitions));
  });

  test("resume after interruption: 2nd pass only calls chapters not yet completed; completed count of calls stays zero", async () => {
    // 1st pass: only 'a' completes (provider fails on 'b','c').
    const firstCalls: string[] = [];
    const partialProvider: WorkerProvider = async (m) => {
      firstCalls.push(m.key);
      if (m.key === "a") {
        return { ok: true, body: "A", usage: { input_tokens: 10, output_tokens: 20 } };
      }
      return { ok: false, error: "sim-fail", usage: { input_tokens: 5, output_tokens: 0 } };
    };
    const first = await runChapterWorkers({ catalog: CATALOG, rows: [], provider: partialProvider });
    expect(firstCalls).toEqual(["a", "b", "c"]);
    const firstCompleted = first.transitions.find(
      (t) => t.chapter_key === "a" && t.kind === "completed",
    ) as Extract<(typeof first.transitions)[number], { kind: "completed" }>;
    expect(firstCompleted.body).toBe("A");

    // Feed the 1st-pass results back in as persisted rows and re-run.
    const rowsAfter: ChapterRow[] = [
      row("a", "completed", 1),
      row("b", "failed", 1),
      row("c", "failed", 1),
    ];
    const secondCalls: string[] = [];
    const secondProvider: WorkerProvider = async (m) => {
      secondCalls.push(m.key);
      return { ok: true, body: `body:${m.key}`, usage: { input_tokens: 8, output_tokens: 16 } };
    };
    const second = await runChapterWorkers({
      catalog: CATALOG,
      rows: rowsAfter,
      provider: secondProvider,
    });
    // Only the previously-failed chapters are attempted; 'a' is not touched.
    expect(secondCalls).toEqual(["b", "c"]);
    // The completed 'a' transition must NOT appear in the 2nd pass output.
    expect(second.transitions.some((t) => t.chapter_key === "a")).toBe(false);
    // The re-run produced two new completed transitions with the expected bodies.
    const bDone = second.transitions.find((t) => t.chapter_key === "b");
    const cDone = second.transitions.find((t) => t.chapter_key === "c");
    expect(bDone?.kind).toBe("completed");
    expect(cDone?.kind).toBe("completed");
    if (bDone && bDone.kind === "completed") expect(bDone.body).toBe("body:b");
  });
});
