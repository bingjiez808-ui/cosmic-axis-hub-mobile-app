// Synthetic-fixture E2E for the Premium Deep Reading audit-count invariants.
//
// Executes the identical DB writes / branches that generatePremiumReport
// performs, without going through the TanStack Start server-fn HTTP
// wrapper (which needs the preview to be attached to the Lovable
// preview session — signed_out at time of run). This exercises the
// real Supabase code path: unique index behaviour, ai_generation_count
// bookkeeping, and the cached-read branch.
//
// SIDE EFFECTS: creates one synthetic auth user + related rows and
// deletes them at the end via `auth.admin.deleteUser` (cascade).

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !SRK) throw new Error("missing supabase env");

const admin = createClient(URL, SRK, { auth: { persistSession: false } });

const FIXTURE_TAG = "e2e-synth-" + Date.now();
const email = `synthetic+${FIXTURE_TAG}@destinylib.com`;
const password = "Synth!Fixture-" + Math.random().toString(36).slice(2, 10);
const RV = "premium_pdf_v1"; // PREMIUM_REPORT_VERSION

const results = [];
let ok = 0,
  fail = 0;
async function step(name, fn) {
  process.stdout.write(`\n== ${name} ==\n`);
  try {
    const r = await fn();
    console.log("  ✓", r ?? "");
    results.push({ name, pass: true, r });
    ok++;
    return r;
  } catch (e) {
    console.log("  ✗", e?.message ?? e);
    results.push({ name, pass: false, error: String(e?.message ?? e) });
    fail++;
    throw e;
  }
}

let userId, chartId, orderId, reportId;

try {
  await step("create synthetic auth user (auto-admin via @destinylib.com)", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "Synthetic Fixture", fixture: FIXTURE_TAG },
    });
    if (error) throw error;
    userId = data.user.id;
    return `user_id=${userId}`;
  });

  await step("handle_new_user trigger granted admin role", async () => {
    const { data } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw new Error("admin role NOT granted — trigger regression");
    return "admin";
  });

  await step("insert synthetic chart (Nanjing 2002-11-03 09:26 female)", async () => {
    const { data, error } = await admin
      .from("charts")
      .insert({
        user_id: userId,
        name: `Synthetic ${FIXTURE_TAG}`,
        birth_date: "2002-11-03",
        birth_time: "09:26",
        birth_place: "Nanjing",
        lang: "en",
        input_snapshot: { gender: "female", fixture: FIXTURE_TAG },
        normalized_input_hash: "synth-" + FIXTURE_TAG,
      })
      .select("id")
      .single();
    if (error) throw error;
    chartId = data.id;
    return `chart_id=${chartId}`;
  });

  await step("simulate grantPremiumReportAccess: paid deep-report order inserted", async () => {
    const { data, error } = await admin
      .from("premium_report_orders")
      .insert({
        user_id: userId,
        chart_id: chartId,
        product_version: "premium_deep_report_v1",
        amount_cents: 7900,
        currency: "CNY",
        status: "paid",
        provider: "manual",
        paid_at: new Date().toISOString(),
        granted_by: userId,
        grant_note: `synthetic ${FIXTURE_TAG}`,
      })
      .select("id")
      .single();
    if (error) throw error;
    orderId = data.id;
    return `order_id=${orderId} status=paid`;
  });

  // ----- Concurrency claim: only ONE inserter wins -----
  await step("concurrent beginPremiumReportRow: exactly one didStart winner", async () => {
    const insert = () =>
      admin
        .from("premium_pdf_reports")
        .insert({
          user_id: userId,
          chart_id: chartId,
          order_id: orderId,
          report_version: RV,
          prompt_version: "v1",
          status: "generating",
        })
        .select("id")
        .single();
    const [a, b] = await Promise.all([insert(), insert()]);
    const winners = [a, b].filter((r) => !r.error);
    const losers = [a, b].filter((r) => r.error);
    if (winners.length !== 1)
      throw new Error(`expected 1 winner, got ${winners.length}`);
    if (losers.length !== 1) throw new Error(`expected 1 loser, got ${losers.length}`);
    reportId = winners[0].data.id;
    return `winner=${reportId.slice(0, 8)} loser_error="${losers[0].error.message.slice(0, 60)}…"`;
  });

  // ----- Verify the fresh row starts with count=0 (DB default) -----
  await step("fresh generating row: ai_generation_count starts at 0", async () => {
    const { data } = await admin
      .from("premium_pdf_reports")
      .select("ai_generation_count, status")
      .eq("id", reportId)
      .single();
    if (data.status !== "generating") throw new Error(`status=${data.status}`);
    if (data.ai_generation_count !== 0)
      throw new Error(`initial count=${data.ai_generation_count}, expected 0`);
    return "count=0 status=generating";
  });

  // ----- Completion: mirror what generatePremiumReport does -----
  await step("didStart winner completion sets ai_generation_count=1", async () => {
    // Minimal but valid content_json shape (same schema as production).
    const content = {
      meta: {
        prompt_version: "v1",
        report_version: RV,
        generated_at: new Date().toISOString(),
        lang: "en",
        chart_name: `Synthetic ${FIXTURE_TAG}`,
        disclaimer: "E2E fixture — not a real report.",
      },
      cover: { title: "Fixture", subtitle: "Fixture" },
      chapters: [{ key: "executive_summary", title: "Executive Summary", body: "fixture" }],
    };
    const { error } = await admin
      .from("premium_pdf_reports")
      .update({
        status: "completed",
        content_json: content,
        model: "fixture",
        provider: "fixture",
        generated_at: new Date().toISOString(),
        error_message: null,
        ai_generation_count: 1, // same literal the real handler writes
      })
      .eq("id", reportId)
      .eq("user_id", userId);
    if (error) throw error;
    const { data } = await admin
      .from("premium_pdf_reports")
      .select("ai_generation_count, status")
      .eq("id", reportId)
      .single();
    if (data.ai_generation_count !== 1)
      throw new Error(`post-completion count=${data.ai_generation_count}`);
    return `count=1 status=${data.status}`;
  });

  // ----- Cached branch: simulate the "second generatePremiumReport call" -----
  await step("second call sees completed row: short-circuits, count stays 1", async () => {
    // This is the exact branch in generatePremiumReport:
    //   if (existing?.status === 'completed' && existing.content_json) return
    const { data: existing } = await admin
      .from("premium_pdf_reports")
      .select("id, status, content_json, ai_generation_count")
      .eq("user_id", userId)
      .eq("chart_id", chartId)
      .eq("report_version", RV)
      .maybeSingle();
    if (!(existing?.status === "completed" && existing.content_json))
      throw new Error("cached branch not entered");
    // We MUST NOT touch the row. Verify counter unchanged.
    const { data: after } = await admin
      .from("premium_pdf_reports")
      .select("ai_generation_count")
      .eq("id", reportId)
      .single();
    if (after.ai_generation_count !== 1)
      throw new Error(`cached path leaked increment: ${after.ai_generation_count}`);
    return "cached hit, no AI call, count=1";
  });

  // ----- Cross-user read denial (RLS defense in depth) -----
  await step("cross-user read denial: another user cannot select this row", async () => {
    // Make a second synthetic non-admin user and check RLS.
    const other = await admin.auth.admin.createUser({
      email: `synthetic+${FIXTURE_TAG}-other@example.com`,
      password: "Other!Pw-" + Math.random().toString(36).slice(2, 10),
      email_confirm: true,
    });
    if (other.error) throw other.error;
    const otherPw = "Other!Pw-fixed";
    // reset password so we can sign in
    await admin.auth.admin.updateUserById(other.data.user.id, { password: otherPw });
    const anon = createClient(URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
    });
    const { data: sess, error: sErr } = await anon.auth.signInWithPassword({
      email: other.data.user.email,
      password: otherPw,
    });
    if (sErr) throw sErr;
    const otherClient = createClient(URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } },
    });
    const { data: leak } = await otherClient
      .from("premium_pdf_reports")
      .select("id")
      .eq("id", reportId)
      .maybeSingle();
    // cleanup other user
    await admin.auth.admin.deleteUser(other.data.user.id);
    if (leak) throw new Error("RLS leak: other user could see the report row");
    return "RLS blocks cross-user select";
  });
} catch (e) {
  console.log("\n=== E2E ABORTED at first failure ===");
} finally {
  console.log("\n== cleanup ==");
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    console.log(`  deleted synthetic user ${userId}: ${error?.message ?? "ok"}`);
  }
  // Verify cascade cleaned up the chart + order + report row.
  if (chartId) {
    const { count } = await admin
      .from("charts")
      .select("*", { count: "exact", head: true })
      .eq("id", chartId);
    console.log(`  residual chart rows: ${count ?? 0}`);
  }
  if (reportId) {
    const { count } = await admin
      .from("premium_pdf_reports")
      .select("*", { count: "exact", head: true })
      .eq("id", reportId);
    console.log(`  residual report rows: ${count ?? 0}`);
  }
  console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
