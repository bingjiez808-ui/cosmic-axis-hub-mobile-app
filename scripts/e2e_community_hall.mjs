// Reproducible three-account (+1 admin) end-to-end harness for
// 同门 · 众生之厅 (Hall of Beings), run against the REAL backend.
//
//   A  23-29  sender
//   B  30-39  targeted recipient
//   C  18-22  non-targeted control
//   D  admin  moderator (temporary admin role, revoked on cleanup)
//
// Every assertion goes through user-scoped anon clients + real RPCs, so RLS is
// exercised exactly as the app does. The service-role client is only used for
// fixture setup, out-of-band verification and cleanup.
//
// Usage:
//   bun run test:e2e:hall
//   bun run test:e2e:hall -- --keep            # keep synthetic accounts
//   bun run test:e2e:hall -- --only=report     # run one suite
//   bun run test:e2e:hall -- --json=/tmp/hall.json
//
// Suites: identity, delivery, dedupe, reply, seal, report, rls
// SIDE EFFECTS: creates 4 synthetic auth users (synthetic+hall-e2e-*), and
// deletes them (plus any orphans from crashed earlier runs) at the end.

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SRK || !ANON) {
  console.error(
    "missing env: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY",
  );
  process.exit(2);
}

const argv = process.argv.slice(2);
const flag = (name) => argv.some((a) => a === `--${name}`);
const opt = (name) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const KEEP = flag("keep");
const ONLY = (opt("only") || "").split(",").filter(Boolean);
const JSON_OUT = opt("json");
const SUITES = ["identity", "delivery", "dedupe", "reply", "seal", "report", "rls"];
const enabled = (suite) => ONLY.length === 0 || ONLY.includes(suite);

const admin = createClient(URL, SRK, { auth: { persistSession: false } });
const RUN_ID = String(Date.now());
const TAG = `hall-e2e-${RUN_ID}`;
const PW = "Hall!E2E-" + Math.random().toString(36).slice(2, 10);
const EMAIL_PREFIX = "synthetic+hall-e2e-";

let ok = 0,
  fail = 0,
  skipped = 0;
let suite = "setup";
const results = [];
const startedAt = Date.now();

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    console.log("  ✓", name, r === undefined || r === null ? "" : `— ${r}`);
    results.push({ suite, name, status: "pass", ms: Date.now() - t0 });
    ok++;
    return r;
  } catch (e) {
    const msg = String(e?.message ?? e);
    console.log("  ✗", name, "—", msg);
    results.push({ suite, name, status: "fail", error: msg, ms: Date.now() - t0 });
    fail++;
    return undefined;
  }
}
const must = (cond, msg) => {
  if (!cond) throw new Error(msg);
  return true;
};
function section(id, title) {
  suite = id;
  if (!enabled(id)) {
    console.log(`\n== ${title} == (skipped)`);
    skipped++;
    return false;
  }
  console.log(`\n== ${title} ==`);
  return true;
}

function yearsAgo(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
}

const cleanup = [];

async function makeUser(label, age, { optIn = true, isAdmin = false } = {}) {
  const email = `${EMAIL_PREFIX}${RUN_ID}-${label}@destinylib.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PW,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  const id = data.user.id;
  cleanup.push(id);

  // verified birth date lives on profiles; age_band is derived server-side
  const { error: bErr } = await admin
    .from("profiles")
    .upsert({ id, email, birth_date: yearsAgo(age) }, { onConflict: "id" });
  if (bErr) throw new Error(`profiles upsert ${label}: ${bErr.message}`);

  if (isAdmin) {
    const { error: rErr } = await admin
      .from("user_roles")
      .upsert({ user_id: id, role: "admin" }, { onConflict: "user_id,role" });
    if (rErr) throw new Error(`grant admin ${label}: ${rErr.message}`);
  }

  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: sErr } = await client.auth.signInWithPassword({ email, password: PW });
  if (sErr) throw new Error(`signIn ${label}: ${sErr.message}`);

  const { error: pErr } = await client.from("community_profiles").upsert(
    { user_id: id, alias: `${label} 旅者`, language: "zh", opt_in: optIn },
    { onConflict: "user_id" },
  );
  if (pErr) throw new Error(`community_profiles ${label}: ${pErr.message}`);
  return { label, id, email, client };
}

const mailbox = async (u) => {
  const { data, error } = await u.client.rpc("get_my_community_mailbox");
  if (error) throw error;
  return data ?? {};
};
const sendLetter = async (u, over = {}) => {
  const { data, error } = await u.client.rpc("send_community_letter", {
    _subject: "30 岁还没有找到方向，是不是已经晚了？",
    _body: "我今年二十几岁，常常怀疑自己走错了路。想问问走过这段路的人，当时你们是怎么熬过来的。",
    _topic: "self",
    _target_age_band: "30-39",
    _response_style: "gentle",
    _needs_review: false,
    ...over,
  });
  if (error) throw error;
  return data;
};
const dispatch = async (u, letterId) => {
  const { data, error } = await u.client.rpc("dispatch_community_letter", { _letter_id: letterId });
  if (error) throw error;
  return data;
};
const deliveryCount = async (letterId, recipientId) => {
  const q = admin
    .from("community_letter_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("letter_id", letterId);
  const { count } = await (recipientId ? q.eq("recipient_id", recipientId) : q);
  return count ?? 0;
};

let A, B, C, D;
let letterId, replyId;

try {
  console.log(`\n== setup (run ${RUN_ID}) ==`);
  A = await makeUser("A", 26);
  B = await makeUser("B", 34);
  C = await makeUser("C", 20);
  D = await makeUser("D", 41, { optIn: false, isAdmin: true });
  console.log("  ✓ accounts: A 23-29 · B 30-39 · C 18-22 · D admin");

  // ---------------------------------------------------------------- identity
  if (section("identity", "1. identity & age band")) {
    for (const [u, want] of [
      [A, "23-29"],
      [B, "30-39"],
      [C, "18-22"],
    ]) {
      await step(`${u.label} age_band derived server-side = ${want}`, async () => {
        const { data } = await admin
          .from("community_profiles")
          .select("age_band")
          .eq("user_id", u.id)
          .single();
        must(data?.age_band === want, `got ${data?.age_band}`);
      });
    }
    await step("client cannot forge its own age_band", async () => {
      await A.client.from("community_profiles").update({ age_band: "60+" }).eq("user_id", A.id);
      const { data } = await admin
        .from("community_profiles")
        .select("age_band")
        .eq("user_id", A.id)
        .single();
      must(data?.age_band === "23-29", `forged to ${data?.age_band}`);
    });
  }

  // ---------------------------------------------------------------- delivery
  if (section("delivery", "2. delivery loop A → B")) {
    letterId = await step("A sends a letter targeted at 30-39", () => sendLetter(A));
    must(letterId, "no letter id — aborting dependent suites");
    await step("dispatch delivers to at least one recipient", async () => {
      const n = await dispatch(A, letterId);
      must(n >= 1, `delivered ${n}`);
      return `${n} recipient(s)`;
    });
    await step("B sees it in the inbox", async () => {
      const m = await mailbox(B);
      must((m.received ?? []).some((l) => l.letterId === letterId), "not delivered to B");
    });
    await step("C (18-22, out of band) does NOT see it", async () => {
      const m = await mailbox(C);
      must(!(m.received ?? []).some((l) => l.letterId === letterId), "leaked to C");
    });
    await step("A keeps it in outbox but never self-receives", async () => {
      const m = await mailbox(A);
      must(!(m.received ?? []).some((l) => l.letterId === letterId), "self-delivery");
      must((m.sent ?? []).some((l) => l.letterId === letterId), "missing from outbox");
    });
    await step("letter payload exposes no author identity to B", async () => {
      const m = await mailbox(B);
      const s = JSON.stringify((m.received ?? []).find((l) => l.letterId === letterId) ?? {});
      must(!s.includes(A.id), "leaked author id");
      must(!s.includes(A.email), "leaked author email");
      must(!/birth_date|birthDate/.test(s), "leaked birth date");
    });
  }

  // ------------------------------------------------------------------ dedupe
  if (section("dedupe", "3. dedupe / idempotency")) {
    await step("re-dispatch does not duplicate B's delivery", async () => {
      await dispatch(A, letterId);
      await dispatch(A, letterId);
      const n = await deliveryCount(letterId, B.id);
      must(n === 1, `count=${n}`);
    });
    await step("delivery rows are unique per (letter, recipient)", async () => {
      const { data } = await admin
        .from("community_letter_deliveries")
        .select("recipient_id")
        .eq("letter_id", letterId);
      const ids = (data ?? []).map((r) => r.recipient_id);
      must(new Set(ids).size === ids.length, `duplicates in ${ids.length} rows`);
    });
    await step("mailbox never returns the same letter twice", async () => {
      const m = await mailbox(B);
      const ids = (m.received ?? []).map((l) => l.letterId);
      must(new Set(ids).size === ids.length, "duplicate inbox entries");
    });
    await step("non-author cannot dispatch someone else's letter", async () => {
      const { error } = await C.client.rpc("dispatch_community_letter", { _letter_id: letterId });
      must(error, "C dispatched A's letter");
    });
  }

  // ------------------------------------------------------------------- reply
  if (section("reply", "4. reply & echo")) {
    await step("C cannot reply (not a recipient)", async () => {
      const { error } = await C.client.rpc("reply_to_community_letter", {
        _letter_id: letterId,
        _body: "我也不知道答案，但我想说点什么。",
        _needs_review: false,
      });
      must(error, "C replied");
    });
    replyId = await step("B replies", async () => {
      const { data, error } = await B.client.rpc("reply_to_community_letter", {
        _letter_id: letterId,
        _body: "三十几岁那年我也这样想过。方向不是找到的，是走出来的，慢一点没关系。",
        _needs_review: false,
      });
      if (error) throw error;
      return data;
    });
    await step("duplicate reply from B is rejected", async () => {
      const { error } = await B.client.rpc("reply_to_community_letter", {
        _letter_id: letterId,
        _body: "三十几岁那年我也这样想过。方向不是找到的，是走出来的，慢一点没关系。",
        _needs_review: false,
      });
      must(error, "duplicate accepted");
    });
    await step("A receives the echo + a persisted notification", async () => {
      const m = await mailbox(A);
      must((m.echoes ?? []).some((e) => e.replyId === replyId), "echo missing");
      const { count } = await admin
        .from("community_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", A.id)
        .eq("type", "reply_received");
      must((count ?? 0) >= 1, "no notification");
    });
    await step("echo exposes no responder identity", async () => {
      const m = await mailbox(A);
      const s = JSON.stringify((m.echoes ?? []).find((x) => x.replyId === replyId) ?? {});
      must(!s.includes(B.id), "leaked user id");
      must(!s.includes(B.email), "leaked email");
    });
  }

  // -------------------------------------------------------------------- seal
  if (section("seal", "5. 封存 · seal / block / restore")) {
    await step("D (admin) seals the letter via admin RPC", async () => {
      const { error } = await D.client.rpc("admin_moderate_community_letter", {
        _letter_id: letterId,
        _action: "hide",
        _notes: "e2e seal",
      });
      if (error) throw error;
    });
    await step("sealed letter disappears from B's inbox", async () => {
      const m = await mailbox(B);
      must(!(m.received ?? []).some((l) => l.letterId === letterId), "sealed letter still listed");
    });
    await step("sealed letter is unreadable via direct table access", async () => {
      const { data } = await B.client.from("community_letters").select("id").eq("id", letterId);
      must(!data || data.length === 0, "sealed row readable");
    });
    await step("D restores it (approve) and B sees it again", async () => {
      const { error } = await D.client.rpc("admin_moderate_community_letter", {
        _letter_id: letterId,
        _action: "approve",
        _notes: "e2e restore",
      });
      if (error) throw error;
      const m = await mailbox(B);
      must((m.received ?? []).some((l) => l.letterId === letterId), "not restored");
    });
    await step("restore does not duplicate the delivery", async () => {
      const n = await deliveryCount(letterId, B.id);
      must(n === 1, `count=${n}`);
    });
    await step("participant suspension seals future participation", async () => {
      const { error } = await D.client.rpc("admin_set_community_participation", {
        _user_id: C.id,
        _status: "paused",
        _notes: "e2e pause",
      });
      if (error) throw error;
      const { data } = await admin
        .from("community_profiles")
        .select("status,opt_in")
        .eq("user_id", C.id)
        .single();
      must(data?.status === "paused" && data?.opt_in === false, JSON.stringify(data));
      await D.client.rpc("admin_set_community_participation", {
        _user_id: C.id,
        _status: "active",
        _notes: "e2e resume",
      });
    });
    await step("blocked author is excluded from future matching", async () => {
      await admin.from("community_blocks").insert({ blocker_id: B.id, blocked_user_id: A.id });
      const id2 = await sendLetter(A, {
        _subject: "如果重新回到 20 岁，你最想提醒自己什么？",
        _body: "想知道走过那段路的人，回头看最想对当年的自己说的一句话是什么呢。",
      });
      await dispatch(A, id2);
      const n = await deliveryCount(id2, B.id);
      must(n === 0, "blocked user still matched");
      await admin
        .from("community_blocks")
        .delete()
        .eq("blocker_id", B.id)
        .eq("blocked_user_id", A.id);
    });
  }

  // ------------------------------------------------------------------ report
  if (section("report", "6. report chain")) {
    await step("B reports the letter", async () => {
      const { error } = await B.client.rpc("report_community_content", {
        _target_type: "letter",
        _target_id: letterId,
        _reason: "harassment",
        _details: "e2e test report",
      });
      if (error) throw error;
    });
    await step("report lands as open in the queue", async () => {
      const { data } = await admin
        .from("community_reports")
        .select("id,status")
        .eq("target_id", letterId)
        .eq("reporter_id", B.id)
        .order("created_at", { ascending: false })
        .limit(1);
      must(data?.[0]?.status === "open", `status=${data?.[0]?.status}`);
    });
    await step("invalid report target type rejected", async () => {
      const { error } = await B.client.rpc("report_community_content", {
        _target_type: "chart",
        _target_id: letterId,
        _reason: "spam",
      });
      must(error, "invalid target accepted");
    });
    await step("non-admin cannot open the admin overview", async () => {
      const { error } = await B.client.rpc("admin_community_hall_overview");
      must(error, "non-admin got overview");
    });
    await step("admin overview surfaces the open report", async () => {
      const { data, error } = await D.client.rpc("admin_community_hall_overview");
      if (error) throw error;
      must(JSON.stringify(data).includes(letterId), "letter not in overview");
    });
    await step("admin action resolves the open report", async () => {
      const { error } = await D.client.rpc("admin_moderate_community_letter", {
        _letter_id: letterId,
        _action: "redact",
        _notes: "（本段内容已由馆员脱敏）",
      });
      if (error) throw error;
      const { count } = await admin
        .from("community_reports")
        .select("id", { count: "exact", head: true })
        .eq("target_id", letterId)
        .eq("status", "open");
      must((count ?? 0) === 0, `${count} report(s) still open`);
    });
    await step("full report chain is audited", async () => {
      const { data } = await admin
        .from("community_moderation_events")
        .select("action")
        .eq("target_id", letterId);
      const actions = new Set((data ?? []).map((r) => r.action));
      for (const a of ["reported", "hide", "approve", "redact"]) {
        must(actions.has(a), `missing audit action: ${a}`);
      }
      return [...actions].join(", ");
    });
  }

  // --------------------------------------------------------------------- RLS
  if (section("rls", "7. RLS negatives & validation")) {
    await step("direct INSERT into community_letters blocked", async () => {
      const { error } = await A.client
        .from("community_letters")
        .insert({ author_id: A.id, body: "x".repeat(30), target_age_band: "30-39" });
      must(error, "insert allowed");
    });
    await step("C cannot read the letter row by id", async () => {
      const { data } = await C.client.from("community_letters").select("id,body").eq("id", letterId);
      must(!data || data.length === 0, "C read the letter");
    });
    await step("signed-out visitor can neither read nor send", async () => {
      const anon = createClient(URL, ANON, { auth: { persistSession: false } });
      const { data } = await anon.from("community_letters").select("id").eq("id", letterId);
      must(!data || data.length === 0, "anon read");
      const { error } = await anon.rpc("send_community_letter", {
        _subject: "x",
        _body: "y".repeat(40),
        _topic: "self",
        _target_age_band: "30-39",
        _response_style: "gentle",
        _needs_review: false,
      });
      must(error, "anon could send");
    });
    await step("nobody can write moderation audit rows directly", async () => {
      const { error } = await B.client
        .from("community_moderation_events")
        .insert({ actor_id: B.id, target_type: "letter", target_id: letterId, action: "approve" });
      must(error, "audit row forged");
    });
    await step("body under the minimum length rejected", async () => {
      const { error } = await A.client.rpc("send_community_letter", {
        _subject: "短",
        _body: "太短了",
        _topic: "self",
        _target_age_band: "30-39",
        _response_style: "gentle",
        _needs_review: false,
      });
      must(error, "short body accepted");
    });
    await step("invalid target age band rejected", async () => {
      const { error } = await A.client.rpc("send_community_letter", {
        _subject: "x",
        _body: "这是一封足够长的测试信件正文内容，用于验证年龄段校验逻辑。",
        _topic: "self",
        _target_age_band: "12-17",
        _response_style: "gentle",
        _needs_review: false,
      });
      must(error, "invalid band accepted");
    });
  }
} catch (e) {
  suite = suite || "setup";
  console.log("  ✗ fatal —", String(e?.message ?? e));
  results.push({ suite, name: "fatal", status: "fail", error: String(e?.message ?? e) });
  fail++;
} finally {
  console.log("\n== cleanup ==");
  if (KEEP) {
    console.log(`  ↷ --keep: leaving ${cleanup.length} accounts (${EMAIL_PREFIX}${RUN_ID}-*)`);
  } else {
    for (const id of cleanup) {
      await admin.from("user_roles").delete().eq("user_id", id).catch(() => {});
      await admin.auth.admin.deleteUser(id).catch(() => {});
    }
    console.log(`  ✓ removed ${cleanup.length} synthetic accounts`);
    // sweep orphans left by crashed earlier runs
    try {
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const orphans = (data?.users ?? []).filter(
        (u) => u.email?.startsWith(EMAIL_PREFIX) && !cleanup.includes(u.id),
      );
      for (const u of orphans) {
        await admin.from("user_roles").delete().eq("user_id", u.id);
        await admin.auth.admin.deleteUser(u.id);
      }
      if (orphans.length) console.log(`  ✓ swept ${orphans.length} orphan account(s)`);
    } catch {
      /* sweep is best-effort */
    }
  }

  const summary = {
    runId: RUN_ID,
    startedAt: new Date(startedAt).toISOString(),
    durationMs: Date.now() - startedAt,
    suitesRun: SUITES.filter(enabled),
    passed: ok,
    failed: fail,
    skippedSuites: skipped,
    results,
  };
  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify(summary, null, 2));
    console.log(`  ✓ JSON report → ${JSON_OUT}`);
  }
  console.log("\n== summary ==");
  for (const s of SUITES) {
    const rows = results.filter((r) => r.suite === s);
    if (!rows.length) continue;
    const bad = rows.filter((r) => r.status === "fail").length;
    console.log(`  ${bad ? "✗" : "✓"} ${s.padEnd(9)} ${rows.length - bad}/${rows.length}`);
  }
  console.log(`\nRESULT: ${ok} passed, ${fail} failed (${Date.now() - startedAt}ms)`);
  if (fail) process.exitCode = 1;
}
