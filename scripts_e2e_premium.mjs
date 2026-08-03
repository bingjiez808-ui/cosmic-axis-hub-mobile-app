// Synthetic-fixture E2E for the Premium Deep Reading generation flow.
// - Creates a synthetic auth user with a fixture-tagged email.
// - Auto-admin via the domain rule in public.handle_new_user (destinylib.com).
// - Creates a Nanjing 2002-11-03 09:26 female chart.
// - Self-admin grants + generates + reads + regenerates.
// - Asserts ai_generation_count == 1 after both calls.
// - Cleans up ONLY this fixture (deletes cascade from auth.users).

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
const PREVIEW = "https://id-preview--8dd02eb0-ad23-48d1-858e-b5eb297af57e.lovable.app";

if (!URL || !SRK || !PUB) throw new Error("missing supabase env");

const admin = createClient(URL, SRK, { auth: { persistSession: false } });

const FIXTURE_TAG = "e2e-synth-" + Date.now();
const email = `synthetic+${FIXTURE_TAG}@destinylib.com`; // domain triggers auto-admin
const password = "Synth!Fixture-" + Math.random().toString(36).slice(2, 10);

async function step(name, fn) {
  process.stdout.write(`\n== ${name} ==\n`);
  try {
    const r = await fn();
    console.log("  ok", r ?? "");
    return r;
  } catch (e) {
    console.log("  FAIL", e?.message ?? e);
    throw e;
  }
}

let userId, chartId, accessToken;

try {
  await step("create synthetic user (auto-admin via domain)", async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: "Synthetic Fixture", fixture: FIXTURE_TAG },
    });
    if (error) throw error;
    userId = data.user.id;
    return userId;
  });

  await step("verify admin role granted by handle_new_user trigger", async () => {
    const { data, error } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("admin role NOT granted — trigger failed");
    return data.role;
  });

  await step("mint access token via password sign-in", async () => {
    const anon = createClient(URL, PUB, { auth: { persistSession: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    if (error) throw error;
    accessToken = data.session.access_token;
    return `token len=${accessToken.length}`;
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
        normalized_input_hash:
          "synthetic-" + FIXTURE_TAG + "-" + Math.random().toString(36).slice(2),
      })
      .select("id")
      .single();
    if (error) throw error;
    chartId = data.id;
    return chartId;
  });

  // ---- Now hit server functions via HTTP with the user's bearer token ----
  const callFn = async (name, body) => {
    const r = await fetch(`${PREVIEW}/_serverFn/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ data: body }),
    });
    const text = await r.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    return { status: r.status, body: json };
  };

  // Server fn ids are hashed at build time. Instead, use the same
  // supabaseAdmin path server-side by calling grantPremiumReportAccess
  // logic directly via DB (simulates admin grant deterministically).
  await step("simulate admin grant: insert paid deep-report order", async () => {
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
        grant_note: `synthetic fixture ${FIXTURE_TAG}`,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  });

  // Call generatePremiumReport through the app's routing. Server-fn ids
  // are content-hashed and not stable; use the /_serverFn dispatcher
  // by name-hash isn't public, so we probe via a fallback: hit the
  // deployed preview's api route if present, else fall back to
  // driving the same code path via supabaseAdmin + AI directly to
  // observe the counter increment.

  const preview = `${PREVIEW}/api/e2e-probe-not-real`;
  const probe = await fetch(preview);
  console.log("\n(preview reachability probe status:", probe.status, ")");

  // Since server-fn IDs are private, we exercise the SAME code path by
  // calling the exported handler through a tiny in-process import.
  await step("call generatePremiumReport (in-process import; real AI)", async () => {
    process.env.LOVABLE_API_KEY = process.env.LOVABLE_API_KEY; // ensure set
    const mod = await import("/dev-server/src/lib/premium.functions.ts");
    // The server fn is wrapped; call underlying handler via .__executeServer
    // if exposed; else invoke by constructing a request-like context.
    // Simpler: replicate the entrypoint by calling supabaseAdmin path.
    const { generatePremiumReport } = mod;
    try {
      const res = await generatePremiumReport({ data: { chartId } });
      return res;
    } catch (e) {
      console.log("  serverFn direct call error (expected without HTTP wrap):", e?.message);
      throw e;
    }
  });

  await step("assert ai_generation_count == 1", async () => {
    const { data, error } = await admin
      .from("premium_pdf_reports")
      .select("status, ai_generation_count, generated_at")
      .eq("user_id", userId)
      .eq("chart_id", chartId)
      .single();
    if (error) throw error;
    console.log("  row:", data);
    if (data.status !== "completed") throw new Error("status not completed");
    if (data.ai_generation_count !== 1)
      throw new Error(`count=${data.ai_generation_count}, expected 1`);
    return "count=1 ✓";
  });

  await step("second generatePremiumReport call must NOT call AI again", async () => {
    const mod = await import("/dev-server/src/lib/premium.functions.ts");
    const before = Date.now();
    const res = await mod.generatePremiumReport({ data: { chartId } });
    const ms = Date.now() - before;
    console.log("  result:", res, `(${ms}ms — should be <500ms if cached)`);
    const { data } = await admin
      .from("premium_pdf_reports")
      .select("ai_generation_count")
      .eq("user_id", userId)
      .eq("chart_id", chartId)
      .single();
    if (data.ai_generation_count !== 1)
      throw new Error(`counter incremented on cached read: ${data.ai_generation_count}`);
    return "count still 1 ✓";
  });
} catch (e) {
  console.log("\n=== E2E ABORTED ===");
  console.log(e?.message ?? e);
} finally {
  // Always clean up the synthetic fixture.
  if (userId) {
    console.log("\n== cleanup ==");
    const { error } = await admin.auth.admin.deleteUser(userId);
    console.log("  deleted synthetic user:", userId, error?.message ?? "ok");
  }
}
