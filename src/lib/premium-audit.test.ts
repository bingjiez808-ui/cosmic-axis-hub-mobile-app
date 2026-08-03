/**
 * AI generation audit invariants.
 *
 * These tests lock in the "call the AI provider at most once per
 * (user, chart, report_version)" guarantee.
 *
 * The full generator (`generatePremiumReport`) is an integration surface
 * — it touches Supabase, calls the Lovable AI Gateway, and is exercised
 * end-to-end in the preview E2E harness. Here we exercise the pure
 * decision helper that gates every generation path in code, so the
 * contract is machine-verified in CI without needing DB or provider
 * credentials.
 */
// @ts-expect-error — bun:test is Bun's built-in runner.
import { describe, expect, test } from "bun:test";

import { chooseGenerationAction, type ExistingReportLite } from "./premium.functions";

const cached: ExistingReportLite = { status: "completed", hasContent: true };
const completedButEmpty: ExistingReportLite = { status: "completed", hasContent: false };
const generating: ExistingReportLite = { status: "generating", hasContent: false };
const pending: ExistingReportLite = { status: "pending", hasContent: false };
const failed: ExistingReportLite = { status: "failed", hasContent: false };
const nothing: ExistingReportLite = null;

describe("chooseGenerationAction — audit invariants", () => {
  test("cached completed row → return_cached, never re-calls AI", () => {
    const d = chooseGenerationAction(cached);
    expect(d.action).toBe("return_cached");
    expect("willCallAi" in d).toBe(false);
  });

  test("concurrent generator loser (existing generating row) → return_existing, never calls AI", () => {
    // Scenario: request A wins the unique-index race and starts
    // generation; request B sees the same row already `generating` and
    // MUST short-circuit — otherwise the provider is charged twice.
    const d = chooseGenerationAction(generating);
    expect(d.action).toBe("return_existing");
    expect("willCallAi" in d).toBe(false);
  });

  test("existing pending row (e.g. legacy pending, admin grant race) → return_existing", () => {
    const d = chooseGenerationAction(pending);
    expect(d.action).toBe("return_existing");
  });

  test("failed row is NOT retried automatically — return_existing", () => {
    // The row exists (unique-index already claimed) so a retry would
    // hit didStart=false. Auto-retry is intentionally out of scope of
    // this decision; the human/admin path handles rerun.
    const d = chooseGenerationAction(failed);
    expect(d.action).toBe("return_existing");
  });

  test("completed row with missing content is still treated as cached-ish (return_existing, no AI)", () => {
    // Defensive: if content_json is somehow null on a completed row we
    // still MUST NOT call the AI a second time — we surface the row.
    const d = chooseGenerationAction(completedButEmpty);
    expect(d.action).toBe("return_existing");
  });

  test("no existing row → start_new is the ONLY path that calls the AI", () => {
    const d = chooseGenerationAction(nothing);
    expect(d.action).toBe("start_new");
    if (d.action === "start_new") expect(d.willCallAi).toBe(true);
  });

  test("only exactly one decision variant flags willCallAi", () => {
    // Belt-and-braces: enumerate every case and count how many report
    // "will call AI". The invariant is: exactly one out of six.
    const cases: ExistingReportLite[] = [cached, completedButEmpty, generating, pending, failed, nothing];
    const willCall = cases
      .map(chooseGenerationAction)
      .filter((d) => d.action === "start_new").length;
    expect(willCall).toBe(1);
  });
});
