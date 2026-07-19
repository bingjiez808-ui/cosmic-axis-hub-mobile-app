// Seeds a new premium report revision for chart 948474f7 (user 7518fca6)
// using the deterministic path — NO real AI call, NO real charge.
// Old completed row e2c78bd7 stays untouched (different prompt_version → different input_hash).
import { Client } from "pg";
import crypto from "node:crypto";
import { PREMIUM_V3_CHAPTERS, PREMIUM_REPORT_REVISION } from "/dev-server/src/lib/premium-chapters-v3.ts";

const USER_ID = "7518fca6-33c9-45c2-b3cb-67d7ff87544a";
const CHART_ID = "948474f7-1602-4871-87de-dbcc8d348a15";
const REPORT_VERSION = "premium_pdf_v1";
const MODEL_ID = "deterministic-stub";
const CALCULATION_VERSION = "calc@1.1.0";

// Build a deterministic input_hash tied to (user, chart, revision) that does not
// collide with the old row's input_hash. Use SHA-256 of a canonical json.
const canonical = JSON.stringify({
  user: USER_ID, chart: CHART_ID, revision: PREMIUM_REPORT_REVISION, report_version: REPORT_VERSION,
});
const input_hash = crypto.createHash("sha256").update(canonical).digest("hex");

function evidenceRefsFor(meta) {
  if (meta.allowed_facts.length === 0) return [];
  const pool = [
    { path: "bazi.pillars.day", module: "bazi", confidence: "grounded" },
    { path: "bazi.pillars.year", module: "bazi", confidence: "grounded" },
    { path: "ziwei.palaces[0]", module: "ziwei", confidence: "grounded" },
    { path: "ziwei.five_elements_class", module: "ziwei", confidence: "traditional" },
    { path: "western.sun", module: "western", confidence: "grounded" },
    { path: "western.moon", module: "western", confidence: "grounded" },
    { path: "vedic.moon", module: "vedic", confidence: "grounded" },
    { path: "bazi_luck.current", module: "bazi_luck", confidence: "grounded" },
    { path: "ziwei_horoscope.year", module: "ziwei_horoscope", confidence: "grounded" },
    { path: "vedic_dasha.current", module: "vedic_dasha", confidence: "grounded" },
    { path: "western_aspects.list[0]", module: "western_aspects", confidence: "grounded" },
    { path: "western_aspects.list[1]", module: "western_aspects", confidence: "grounded" },
  ];
  const allowed = pool.filter((r) => meta.allowed_facts.includes(r.module));
  const minRefs = Math.max(meta.min_evidence_refs ?? 0, meta.min_module_variety ?? 0, meta.kind === "cross" ? 2 : 1);
  const picks = []; const seen = new Set();
  for (const r of allowed) if (!seen.has(r.module)) { picks.push(r); seen.add(r.module); }
  for (const r of allowed) { if (picks.length >= minRefs) break; if (!picks.includes(r)) picks.push(r); }
  return picks;
}

function chapterBody(meta, title) {
  const parts = [title, "",
    `本章为测试模式下的确定性内容，仅解释本地事实（章节键 ${meta.key}，序号 ${meta.index + 1}）。不调用任何真实 AI，也不产生费用。`];
  for (const sec of meta.required_sections ?? []) {
    parts.push("", `## ${sec.marker_zh}`,
      `围绕「${sec.marker_zh}」，结合命盘事实给出现实表现、条件反证与建议；置信度依据 evidence_refs 计算。`);
  }
  for (const tab of meta.required_tables ?? []) {
    parts.push("", `### ${tab.title_zh}`,
      "| 维度 | 表现 | 条件 | 建议 |", "| --- | --- | --- | --- |",
      "| 主线 | 由事实推导的稳定倾向 | 需要满足的现实条件 | 立即可行的一步 |",
      "| 变量 | 受行运影响的波动区间 | 触发/减弱的条件 | 观察指标 |");
  }
  return parts.join("\n");
}

function confidenceOf(refs) {
  if (refs.length === 0) return "reflective";
  const hasGrounded = refs.some((r) => r.confidence === "grounded");
  const hasTraditional = refs.some((r) => r.confidence === "traditional");
  return hasGrounded ? "grounded" : hasTraditional ? "traditional" : "reflective";
}

const chapters = PREMIUM_V3_CHAPTERS.map((m) => {
  const title = m.title_zh;
  const refs = evidenceRefsFor(m);
  return { key: m.key, title, body: chapterBody(m, title), evidence_refs: refs, confidence: confidenceOf(refs) };
});

const content_json = {
  meta: {
    prompt_version: PREMIUM_REPORT_REVISION,
    report_version: REPORT_VERSION,
    report_schema_version: "v3",
    generated_at: new Date().toISOString(),
    lang: "zh",
    chart_name: "BingJie Zhang",
    disclaimer: "本报告仅供反思参考，不构成医疗、法律或投资建议。",
  },
  cover: { title: "命运图书馆 · 高级 AI 深度报告", subtitle: "BingJie Zhang" },
  chapters,
};
const content_hash = crypto.createHash("sha256").update(JSON.stringify(content_json)).digest("hex");

const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

// Look up an existing paid order for this user+chart to satisfy FK if required.
const oq = await client.query(
  `SELECT id FROM premium_report_orders WHERE user_id=$1 AND chart_id=$2 AND status='paid' ORDER BY created_at DESC LIMIT 1`,
  [USER_ID, CHART_ID]
);
const orderId = oq.rows[0]?.id ?? null;
console.log("orderId:", orderId);

const ins = await client.query(
  `INSERT INTO premium_pdf_reports
     (user_id, chart_id, order_id, report_version, prompt_version, model_id,
      calculation_version, input_hash, status, content_json, content_hash,
      token_usage, model, provider, generated_at, ai_generation_count)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9::jsonb,$10,
           $11::jsonb,$6,'deterministic-stub', now(), 0)
   RETURNING id, status, prompt_version, jsonb_array_length(content_json->'chapters') AS ch_len`,
  [USER_ID, CHART_ID, orderId, REPORT_VERSION, PREMIUM_REPORT_REVISION, MODEL_ID,
   CALCULATION_VERSION, input_hash, JSON.stringify(content_json), content_hash,
   JSON.stringify({ input_tokens: 0, output_tokens: 0 })]
);
console.log("inserted:", ins.rows[0]);

// Backfill chapter rows.
for (const [i, m] of PREMIUM_V3_CHAPTERS.entries()) {
  const ch = chapters[i];
  const chHash = crypto.createHash("sha256").update(JSON.stringify(ch)).digest("hex");
  await client.query(
    `INSERT INTO premium_report_chapters
       (report_id, user_id, chapter_key, chapter_index, status, attempt_count,
        content_json, evidence_refs, confidence, content_hash, input_tokens, output_tokens, completed_at)
     VALUES ($1,$2,$3,$4,'completed',1,$5::jsonb,$6::jsonb,$7,$8,0,0, now())
     ON CONFLICT (report_id, chapter_key) DO NOTHING`,
    [ins.rows[0].id, USER_ID, m.key, m.index, JSON.stringify(ch), JSON.stringify(ch.evidence_refs), ch.confidence, chHash]
  );
}
const cc = await client.query(
  `SELECT count(*) FROM premium_report_chapters WHERE report_id=$1 AND status='completed'`,
  [ins.rows[0].id]
);
console.log("completed chapters:", cc.rows[0].count);

// Confirm old row untouched.
const oldRow = await client.query(
  `SELECT id, status, prompt_version FROM premium_pdf_reports WHERE id='e2c78bd7-bd47-4d8b-a0f8-b6ca2f9fe46a'`
);
console.log("old row:", oldRow.rows[0]);
await client.end();
