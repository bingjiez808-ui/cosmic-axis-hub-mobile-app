// Three-account E2E for 同门 · 众生之厅 (Hall of Beings).
//
// A: 23-29 sender, B: 30-39 target recipient, C: 18-22 non-target.
// Uses the real Supabase project, the real RPCs from round 1, and
// user-scoped anon clients so RLS is exercised exactly as in the app.
// SIDE EFFECTS: creates 3 synthetic auth users, deletes them at the end.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SRK || !ANON) throw new Error("missing supabase env");

const admin = createClient(URL, SRK, { auth: { persistSession: false } });
const TAG = "hall-e2e-" + Date.now();
const PW = "Hall!E2E-" + Math.random().toString(36).slice(2, 10);

let ok = 0, fail = 0;
const results = [];
async function step(name, fn) {
  try {
    const r = await fn();
    console.log("  ✓", name, r === undefined ? "" : "—", r ?? "");
    results.push({ name, pass: true });
    ok++;
    return r;
  } catch (e) {
    console.log("  ✗", name, "—", e?.message ?? e);
    results.push({ name, pass: false, error: String(e?.message ?? e) });
    fail++;
  }
}
const must = (cond, msg) => { if (!cond) throw new Error(msg); return true; };

function yearsAgo(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
}

async function makeUser(label, age, optIn) {
  const email = `synthetic+${TAG}-${label}@destinylib.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password: PW, email_confirm: true,
  });
  if (error) throw error;
  const id = data.user.id;
  // verified birth date lives on profiles; age_band is derived server-side
  { const { error: bErr } = await admin.from("profiles").upsert({ id, email, birth_date: yearsAgo(age) }, { onConflict: "id" }); if (bErr) throw new Error("profiles upsert: " + bErr.message); }
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: sErr } = await client.auth.signInWithPassword({ email, password: PW });
  if (sErr) throw sErr;
  const { error: pErr } = await client.from("community_profiles").upsert(
    { user_id: id, alias: `${label} 旅者`, language: "zh", opt_in: optIn },
    { onConflict: "user_id" },
  );
  if (pErr) throw pErr;
  return { id, email, client };
}

const cleanup = [];
try {
  console.log("\n== setup ==");
  const A = await makeUser("A", 26, true);
  const B = await makeUser("B", 34, true);
  const C = await makeUser("C", 20, true);
  cleanup.push(A.id, B.id, C.id);
  console.log("  ✓ 3 accounts created (A 23-29, B 30-39, C 18-22)");

  for (const [label, u, want] of [["A", A, "23-29"], ["B", B, "30-39"], ["C", C, "18-22"]]) {
    await step(`${label} age_band computed server-side = ${want}`, async () => {
      const { data } = await admin.from("community_profiles").select("age_band").eq("user_id", u.id).single();
      must(data.age_band === want, `got ${data?.age_band}`);
    });
  }

  await step("client cannot forge its own age_band", async () => {
    await A.client.from("community_profiles").update({ age_band: "60+" }).eq("user_id", A.id);
    const { data } = await admin.from("community_profiles").select("age_band").eq("user_id", A.id).single();
    must(data.age_band === "23-29", `forged to ${data.age_band}`);
  });

  console.log("\n== 1. A sends a letter to 30-39 ==");
  const letterId = await step("send_community_letter", async () => {
    const { data, error } = await A.client.rpc("send_community_letter", {
      _subject: "30 岁还没有找到方向，是不是已经晚了？",
      _body: "我今年二十几岁，常常怀疑自己走错了路。想问问走过这段路的人，当时你们是怎么熬过来的。",
      _topic: "self",
      _target_age_band: "30-39",
      _response_style: "gentle",
      _needs_review: false,
    });
    if (error) throw error;
    return data;
  });
  must(letterId, "no letter id");

  await step("no direct table INSERT bypass (RLS)", async () => {
    const { error } = await A.client.from("community_letters").insert({
      author_id: A.id, body: "x".repeat(30), target_age_band: "30-39",
    });
    must(error, "insert unexpectedly allowed");
  });

  await step("dispatch_community_letter delivers", async () => {
    const { data, error } = await A.client.rpc("dispatch_community_letter", { _letter_id: letterId });
    if (error) throw error;
    must(data >= 1, `delivered ${data}`);
    return `${data} recipient(s)`;
  });

  console.log("\n== 2-4. visibility ==");
  const mailbox = async (u) => {
    const { data, error } = await u.client.rpc("get_my_community_mailbox");
    if (error) throw error;
    return data;
  };
  await step("B sees the letter in inbox", async () => {
    const m = await mailbox(B);
    must((m.received ?? []).some((l) => l.letterId === letterId), "not delivered to B");
  });
  await step("C (18-22) does NOT see it", async () => {
    const m = await mailbox(C);
    must(!(m.received ?? []).some((l) => l.letterId === letterId), "leaked to C");
  });
  await step("A does not receive its own letter", async () => {
    const m = await mailbox(A);
    must(!(m.received ?? []).some((l) => l.letterId === letterId), "self-delivery");
    must((m.sent ?? []).some((l) => l.letterId === letterId), "missing from outbox");
  });
  await step("re-dispatch does not duplicate B's delivery", async () => {
    await A.client.rpc("dispatch_community_letter", { _letter_id: letterId });
    const { count } = await admin
      .from("community_letter_deliveries")
      .select("id", { count: "exact", head: true })
      .eq("letter_id", letterId).eq("recipient_id", B.id);
    must(count === 1, `count=${count}`);
  });
  await step("C cannot read the letter row by id (RLS)", async () => {
    const { data } = await C.client.from("community_letters").select("id,body").eq("id", letterId);
    must(!data || data.length === 0, "C read the letter");
  });
  await step("anonymous (signed-out) cannot read or write", async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data } = await anon.from("community_letters").select("id").eq("id", letterId);
    must(!data || data.length === 0, "anon read");
    const { error } = await anon.rpc("send_community_letter", {
      _subject: "x", _body: "y".repeat(40), _topic: "self",
      _target_age_band: "30-39", _response_style: "gentle", _needs_review: false,
    });
    must(error, "anon could send");
  });

  console.log("\n== 5-7. reply + echo ==");
  await step("C cannot reply (not a recipient)", async () => {
    const { error } = await C.client.rpc("reply_to_community_letter", {
      _letter_id: letterId, _body: "我也不知道答案，但我想说点什么。", _needs_review: false,
    });
    must(error, "C replied");
  });
  const replyId = await step("B replies", async () => {
    const { data, error } = await B.client.rpc("reply_to_community_letter", {
      _letter_id: letterId,
      _body: "三十几岁那年我也这样想过。方向不是找到的，是走出来的，慢一点没关系。",
      _needs_review: false,
    });
    if (error) throw error;
    return data;
  });
  await step("duplicate reply blocked", async () => {
    const { error } = await B.client.rpc("reply_to_community_letter", {
      _letter_id: letterId,
      _body: "三十几岁那年我也这样想过。方向不是找到的，是走出来的，慢一点没关系。",
      _needs_review: false,
    });
    must(error, "duplicate accepted");
  });
  await step("A receives the echo + notification (persists across reload)", async () => {
    const m = await mailbox(A);
    must((m.echoes ?? []).some((e) => e.replyId === replyId), "echo missing");
    const { count } = await admin.from("community_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", A.id).eq("type", "reply_received");
    must((count ?? 0) >= 1, "no notification");
  });
  await step("echo exposes no real identity fields", async () => {
    const m = await mailbox(A);
    const e = (m.echoes ?? []).find((x) => x.replyId === replyId);
    const s = JSON.stringify(e);
    must(!s.includes(B.id), "leaked user id");
    must(!s.includes(B.email), "leaked email");
    must(!/birth_date|birthDate/.test(s), "leaked birth date");
  });

  console.log("\n== 10. blocking ==");
  await step("blocked user is excluded from future matching", async () => {
    await admin.from("community_blocks").insert({ blocker_id: B.id, blocked_user_id: A.id });
    const { data: id2, error: e2 } = await A.client.rpc("send_community_letter", {
      _subject: "如果重新回到 20 岁，你最想提醒自己什么？",
      _body: "想知道走过那段路的人，回头看最想对当年的自己说的一句话是什么呢。",
      _topic: "self", _target_age_band: "30-39", _response_style: "gentle", _needs_review: false,
    });
    if (e2) throw e2;
    await A.client.rpc("dispatch_community_letter", { _letter_id: id2 });
    const { count } = await admin.from("community_letter_deliveries")
      .select("id", { count: "exact", head: true }).eq("letter_id", id2).eq("recipient_id", B.id);
    must(count === 0, "blocked user still matched");
    await admin.from("community_blocks").delete().eq("blocker_id", B.id).eq("blocked_user_id", A.id);
  });

  console.log("\n== 11-12. report + moderation ==");
  await step("B reports the letter", async () => {
    const { error } = await B.client.rpc("report_community_content", {
      _target_type: "letter", _target_id: letterId, _reason: "harassment", _details: "e2e test report",
    });
    if (error) throw error;
  });
  await step("non-admin cannot open the admin overview", async () => {
    const { error } = await B.client.rpc("admin_community_hall_overview");
    must(error, "non-admin got overview");
  });
  await step("report is visible to admin backend", async () => {
    const { count } = await admin.from("community_reports")
      .select("id", { count: "exact", head: true }).eq("target_id", letterId);
    must((count ?? 0) >= 1, "report missing");
  });
  await step("admin hides letter → recipient can no longer read it", async () => {
    await admin.from("community_letters").update({ status: "hidden" }).eq("id", letterId);
    const m = await mailbox(B);
    must(!(m.received ?? []).some((l) => l.letterId === letterId), "hidden letter still readable");
    const { data } = await B.client.from("community_letters").select("id").eq("id", letterId);
    must(!data || data.length === 0, "hidden row readable via table");
  });
  await step("moderation events are audited", async () => {
    const { count } = await admin.from("community_moderation_events")
      .select("id", { count: "exact", head: true }).eq("target_id", letterId);
    must((count ?? 0) >= 1, "no audit events");
  });

  console.log("\n== validation guards ==");
  await step("body under 20 chars rejected", async () => {
    const { error } = await A.client.rpc("send_community_letter", {
      _subject: "短", _body: "太短了", _topic: "self",
      _target_age_band: "30-39", _response_style: "gentle", _needs_review: false,
    });
    must(error, "short body accepted");
  });
  await step("invalid target age band rejected", async () => {
    const { error } = await A.client.rpc("send_community_letter", {
      _subject: "x", _body: "这是一封足够长的测试信件正文内容，用于验证年龄段校验逻辑。",
      _topic: "self", _target_age_band: "12-17", _response_style: "gentle", _needs_review: false,
    });
    must(error, "invalid band accepted");
  });
} finally {
  console.log("\n== cleanup ==");
  for (const id of cleanup) await admin.auth.admin.deleteUser(id).catch(() => {});
  console.log(`  removed ${cleanup.length} synthetic accounts`);
  console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}
