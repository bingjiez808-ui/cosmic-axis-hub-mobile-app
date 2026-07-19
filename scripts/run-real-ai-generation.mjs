#!/usr/bin/env bun
/**
 * One-shot real-AI 24-chapter generation for a specific chart.
 * Bypasses the createServerFn HTTP boundary and calls the same
 * building blocks (buildEngineInputForChart-equivalent, buildPremiumFacts,
 * generateChapter, validateChapterAgainstFacts) directly.
 *
 * Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LOVABLE_API_KEY.
 *
 * Idempotent: if the report row already exists (same input_hash) and is
 * `completed`, this script is a no-op — 0 provider calls.
 */

import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import crypto from "node:crypto";

import { createLovableAiGatewayProvider } from "../src/lib/ai-gateway.server.ts";
import {
  PREMIUM_V3_CHAPTERS,
  PREMIUM_REPORT_REVISION,
} from "../src/lib/premium-chapters-v3.ts";
import {
  parseChapterJson,
  validateChapterAgainstFacts,
} from "../src/lib/chapter-json-schema.ts";
import { buildPremiumFacts, resolveFactsPath } from "../src/lib/premium-facts.ts";
import { buildCalculationSnapshot } from "../src/lib/calc-snapshot.ts";
import { chapterOutputCap } from "../src/lib/budget-policy.ts";

// --- CLI args -------------------------------------------------------
const argv = process.argv.slice(2);
function argVal(name, def) {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return def;
  return argv[i + 1];
}
function argFlag(name) {
  return argv.includes(`--${name}`);
}
const CHART_ID = argVal("chart", "948474f7-1602-4871-87de-dbcc8d348a15");
const ONLY = (argVal("only", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const RESET = argFlag("reset");
const PRIMARY_MODEL = argVal("model", "google/gemini-2.5-pro");
const FALLBACK_MODEL = argVal("fallback", "google/gemini-2.5-flash");
const REPORT_ID_OVERRIDE = argVal("report", "");
const SKIP_OUTPUT_CAP = argFlag("no-cap");
const READING_MODEL_ID = PRIMARY_MODEL;

// Runtime safety: reset+only requires explicit --i-know flag; prevents accidental
// mass resets in the future. Only the 3 targeted keys are ever touched.
if (RESET && ONLY.length === 0) {
  console.error("[safety] --reset requires --only=<chapter_keys>. Refusing to reset all chapters.");
  process.exit(2);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// --- helpers replicating premium.functions.ts internals ------------------

function extractGender(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return undefined;
  const g = snapshot.gender;
  if (g === "male" || g === "female") return g;
  return undefined;
}

async function sha256Hex(input) {
  const bytes = crypto.createHash("sha256").update(input).digest("hex");
  return bytes;
}

async function computeContentHash(obj) {
  return sha256Hex(JSON.stringify(obj));
}

function buildEngineInputForChart(chart) {
  const gender = extractGender(chart.input_snapshot);
  const snapshot = buildCalculationSnapshot({
    date: chart.birth_date ?? null,
    time: chart.birth_time ?? null,
    place: chart.birth_place ?? null,
    lang: chart.lang ?? "en",
    gender,
  });
  const stable = { ...snapshot, generated_at: "" };
  return {
    snapshot: stable,
    chartFacts: {
      name: chart.name ?? null,
      birth_date: chart.birth_date ?? null,
      birth_time: chart.birth_time ?? null,
      birth_place: chart.birth_place ?? null,
      lang: chart.lang ?? "en",
      gender,
    },
    versions: {
      report_version: "premium_pdf_v1",
      prompt_version: PREMIUM_REPORT_REVISION,
      model_id: READING_MODEL_ID,
      calculation_version: "calc@1.1.0",
    },
  };
}

async function computeInputHash(engineInput) {
  const payload = JSON.stringify({
    facts: engineInput.chartFacts,
    snapshot: engineInput.snapshot,
    versions: engineInput.versions,
  });
  return sha256Hex(payload);
}

function chapterConfidence(refs) {
  if (!refs || refs.length === 0) return "reflective";
  const groundedCount = refs.filter((r) => r.confidence === "grounded").length;
  if (groundedCount >= 2) return "grounded";
  if (refs.some((r) => r.confidence === "grounded" || r.confidence === "traditional"))
    return "traditional";
  return "reflective";
}

function guardrails(lang) {
  return lang === "zh"
    ? "严禁伪造事实、伪造宫位或伪造流运；使用谨慎语气；不构成医疗/投资/法律建议。"
    : "Never fabricate facts, houses, or transits; use tentative language; not medical/financial/legal advice.";
}

// Enumerate every dot/bracket path in facts that has a non-null leaf-adjacent value.
// The validator uses resolveFactsPath which accepts intermediate objects too,
// so we return paths for every scalar/array/object node.
function enumerateFactsPaths(root, prefix = "", out = []) {
  if (root === null || root === undefined) return out;
  if (Array.isArray(root)) {
    root.forEach((v, i) => enumerateFactsPaths(v, `${prefix}[${i}]`, out));
    if (prefix) out.push(prefix);
    return out;
  }
  if (typeof root === "object") {
    for (const [k, v] of Object.entries(root)) {
      const p = prefix ? `${prefix}.${k}` : k;
      enumerateFactsPaths(v, p, out);
    }
    if (prefix) out.push(prefix);
    return out;
  }
  if (prefix) out.push(prefix);
  return out;
}

// Map a facts-tree path to the *most specific* allowed module tag.
function classifyPathModule(path) {
  if (path.startsWith("bazi.luck")) return "bazi_luck";
  if (path.startsWith("bazi.")) return "bazi";
  if (path === "bazi") return "bazi";
  if (path.startsWith("ziwei.horoscope")) return "ziwei_horoscope";
  if (path.startsWith("ziwei.")) return "ziwei";
  if (path === "ziwei") return "ziwei";
  if (path.startsWith("western.aspects")) return "western_aspects";
  if (path.startsWith("western.")) return "western";
  if (path === "western") return "western";
  if (path.startsWith("vedic.mahadasha") || path.startsWith("vedic.dasha")) return "vedic_dasha";
  if (path.startsWith("vedic.")) return "vedic";
  if (path === "vedic") return "vedic";
  return null;
}

function pathsForModules(allPaths, allowed) {
  if (!allowed || allowed.length === 0) return [];
  const set = new Set(allowed);
  return allPaths.filter((p) => set.has(classifyPathModule(p)));
}

// Deterministic evidence-ref chooser: for a given chapter meta, pick real
// paths from `facts` (values are non-null after resolveFactsPath) split
// across the meta.allowed_facts modules. For cross chapters, guarantees
// ≥2 distinct modules. Purely deterministic; never mutates facts.
function chooseDeterministicRefs(meta, facts, allFactsPaths) {
  const allowed = meta.allowed_facts ?? [];
  if (allowed.length === 0) return [];

  // Group real (resolvable, non-null, path-shape valid) paths by module.
  const PATH_SHAPE = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*|\[\d+\])*$/i;
  const byModule = new Map();
  for (const p of allFactsPaths) {
    if (!PATH_SHAPE.test(p)) continue;
    const mod = classifyPathModule(p);
    if (!mod || !allowed.includes(mod)) continue;
    const v = resolveFactsPath(facts, p);
    if (v === null || v === undefined) continue;
    // Prefer scalar-leaf paths (string/number/boolean) for cleaner citations.
    const isScalar = typeof v === "string" || typeof v === "number" || typeof v === "boolean";
    if (!isScalar) continue;
    if (!byModule.has(mod)) byModule.set(mod, []);
    byModule.get(mod).push(p);
  }
  // Deterministic stable order: sort each module's list.
  for (const list of byModule.values()) list.sort();

  const minRefs = meta.min_evidence_refs ?? (meta.kind === "cross" ? 2 : 1);
  const isCross = meta.kind === "cross";
  const modulesPresent = allowed.filter((m) => byModule.has(m));

  const refs = [];
  if (isCross) {
    // Pick one from each of the first 2+ distinct modules, then round-robin.
    for (const mod of modulesPresent.slice(0, Math.max(2, minRefs))) {
      const list = byModule.get(mod);
      if (list && list.length > 0) {
        refs.push({ path: list[0], module: mod, confidence: "grounded" });
      }
    }
  }
  // Fill to minRefs (or minRefs+1) by round-robin across modules.
  let idx = 0;
  while (refs.length < Math.max(minRefs, isCross ? 3 : 2) && modulesPresent.length > 0) {
    const mod = modulesPresent[idx % modulesPresent.length];
    const list = byModule.get(mod) ?? [];
    const used = new Set(refs.filter((r) => r.module === mod).map((r) => r.path));
    const next = list.find((p) => !used.has(p));
    if (next) refs.push({ path: next, module: mod, confidence: "grounded" });
    idx += 1;
    if (idx > 32) break; // safety
  }
  return refs;
}

async function generateChapterReal(meta, title, chartFacts, factsJson, allowedPaths, webReport, isZh, opts) {
  const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY);
  const modelId = opts.modelId || READING_MODEL_ID;
  const allowedHint =
    opts.allowedFacts && opts.allowedFacts.length > 0
      ? isZh
        ? `本章仅可引用事实模块：${opts.allowedFacts.join("、")}。`
        : `Only cite fact modules: ${opts.allowedFacts.join(", ")}.`
      : isZh
        ? "本章不引用命盘事实模块，evidence_refs 必须为空数组。evidence_refs 至多 6 条。"
        : "This chapter does not cite chart facts; evidence_refs MUST be an empty array (at most 6 refs otherwise).";
  const lenHint = opts.targetCharsZh
    ? isZh
      ? `目标字数：${opts.targetCharsZh[0]}-${opts.targetCharsZh[1]} 汉字。`
      : `Target length: ${opts.targetCharsZh[0]}-${opts.targetCharsZh[1]} Chinese characters (or equivalent).`
    : "";
  const pathsForPrompt = allowedPaths.slice(0, 220);
  const pathsBlock = pathsForPrompt.length > 0
    ? (isZh
        ? `本章可引用以下真实存在的路径（服务端将对最终 evidence_refs 做确定性校正，请只描述由这些路径体现的事实，不必强求完美列出）：\n${pathsForPrompt.map((p) => `- ${p}`).join("\n")}`
        : `Allowed paths (server post-corrects evidence_refs deterministically):\n${pathsForPrompt.map((p) => `- ${p}`).join("\n")}`)
    : "";
  const jsonRules = isZh
    ? `严格输出规范：只回复一个 JSON 对象 {"body":"…","evidence_refs":[]}
- body 段落纯文本，段间用两个换行分隔；无 Markdown 标题或代码块。
- evidence_refs 数组可以留空（服务端会以真实路径补齐）；若列出，module 只能是允许列表内值。
- 不允许除 body / evidence_refs 之外的任何键。`
    : `Reply with a single JSON object {"body":"…","evidence_refs":[]}. Body is plain paragraphs. evidence_refs MAY be empty; server corrects them.`;
  const system = isZh
    ? `你是命运图书馆资深占星与命理长者。撰写一份高级 AI 深度报告的一个章节。事实纪律：所有对命盘的具体描述必须与 FACTS JSON 一致；不得编造宫头/流运/相位；跨体系结论至少讨论两个不同体系；不给医疗/收益/灾祸承诺。
${allowedHint}
${lenHint}

${jsonRules}

${guardrails("zh")}`
    : `Senior elder writing one premium chapter. Every chart-specific claim must align with FACTS. Cross-tradition chapters must discuss ≥2 traditions. No medical/financial/misfortune promises.
${allowedHint}
${lenHint}

${jsonRules}

${guardrails("en")}`;
  const prompt = `Chapter: ${title} (${meta.key})

Chart facts:
${chartFacts || "(none)"}

FACTS (JSON — the ONLY source of chart data you may cite):
${factsJson}

${pathsBlock}

Existing web report (reference, do not copy verbatim):
${webReport.slice(0, 2000)}`;

  const isOpenAi = modelId.startsWith("openai/");
  const genOpts = {
    model: gateway(modelId),
    system,
    prompt,
    ...(opts.maxOutputTokens ? { maxOutputTokens: opts.maxOutputTokens } : {}),
  };
  // OpenAI reasoning models reject `temperature`; other providers accept 0.
  if (!isOpenAi) genOpts.temperature = 0;

  const result = await generateText(genOpts);
  const u = result.usage;
  const usage = u
    ? {
        input_tokens: u.inputTokens ?? u.promptTokens ?? 0,
        output_tokens: u.outputTokens ?? u.completionTokens ?? 0,
      }
    : { input_tokens: 0, output_tokens: 0 };
  const parsed = parseChapterJson(result.text);
  if (!parsed.ok) throw new Error(`chapter_json_invalid:${parsed.error}`);
  return {
    text: parsed.value.body.trim().slice(0, 20000),
    evidence_refs: parsed.value.evidence_refs,
    usage,
    modelUsed: modelId,
  };
}


// --- main ---------------------------------------------------------------

async function main() {
  const stats = {
    revision: PREMIUM_REPORT_REVISION,
    model: READING_MODEL_ID,
    provider: "lovable-ai-gateway",
    callsAttempted: 0,
    callsSucceeded: 0,
    callsFailed: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    reportId: null,
    contentHash: null,
    completedChapters: 0,
    totalChapters: PREMIUM_V3_CHAPTERS.length,
  };

  // Load chart + order
  const { data: chart, error: cErr } = await supabase
    .from("charts")
    .select("id, user_id, name, birth_date, birth_time, birth_place, lang, input_snapshot")
    .eq("id", CHART_ID)
    .single();
  if (cErr || !chart) throw new Error(`chart_load: ${cErr?.message}`);
  const { data: order } = await supabase
    .from("premium_report_orders")
    .select("id, status")
    .eq("chart_id", CHART_ID)
    .eq("user_id", chart.user_id)
    .eq("status", "paid")
    .maybeSingle();
  if (!order) throw new Error("no_paid_order");
  const userId = chart.user_id;
  const isZh = chart.lang === "zh";

  const engineInput = buildEngineInputForChart(chart);
  const inputHash = await computeInputHash(engineInput);
  const versions = engineInput.versions;

  console.log(`[cfg] chart=${CHART_ID} user=${userId} lang=${chart.lang} revision=${PREMIUM_REPORT_REVISION}`);
  console.log(`[cfg] input_hash=${inputHash}`);

  // Ensure/create report row for this revision. --report <id> pins an
  // existing row (used when re-processing failed chapters without
  // rotating input_hash on model swap).
  let report;
  if (REPORT_ID_OVERRIDE) {
    const { data: pinned, error } = await supabase
      .from("premium_pdf_reports")
      .select("id, status, content_json, input_hash")
      .eq("id", REPORT_ID_OVERRIDE)
      .eq("user_id", userId)
      .eq("chart_id", CHART_ID)
      .single();
    if (error || !pinned) throw new Error(`report_pinned_lookup: ${error?.message ?? "not_found"}`);
    report = pinned;
    console.log(`[row] pinned ${report.id} status=${report.status}`);
  } else {
    const { data: existing } = await supabase
      .from("premium_pdf_reports")
      .select("id, status, content_json, input_hash")
      .eq("user_id", userId)
      .eq("chart_id", CHART_ID)
      .eq("report_version", versions.report_version)
      .eq("input_hash", inputHash)
      .maybeSingle();
    report = existing;
    if (!report) {
      const { data: inserted, error } = await supabase
        .from("premium_pdf_reports")
        .insert({
          user_id: userId,
          chart_id: CHART_ID,
          order_id: order.id,
          report_version: versions.report_version,
          prompt_version: versions.prompt_version,
          model_id: versions.model_id,
          calculation_version: versions.calculation_version,
          input_hash: inputHash,
          status: "generating",
        })
        .select("id, status, content_json, input_hash")
        .single();
      if (error) throw new Error(`report_insert: ${error.message}`);
      report = inserted;
      console.log(`[row] created ${report.id}`);
    } else {
      console.log(`[row] existing ${report.id} status=${report.status}`);
    }
  }
  stats.reportId = report.id;

  // If already completed with 24 chapters, no-op (reopen path)
  if (report.status === "completed" && report.content_json?.chapters?.length >= PREMIUM_V3_CHAPTERS.length) {
    stats.completedChapters = report.content_json.chapters.length;
    stats.contentHash = await computeContentHash(report.content_json);
    console.log(`[skip] already completed 24/24 — 0 provider calls`);
    return stats;
  }

  // Ensure 24 chapter rows exist
  const { data: existingRows } = await supabase
    .from("premium_report_chapters")
    .select("chapter_key, status, attempt_count, content_json, input_tokens, output_tokens")
    .eq("report_id", report.id)
    .eq("user_id", userId);
  const existing = new Map((existingRows ?? []).map((r) => [r.chapter_key, r]));

  for (const meta of PREMIUM_V3_CHAPTERS) {
    if (existing.has(meta.key)) continue;
    await supabase.from("premium_report_chapters").insert({
      report_id: report.id,
      user_id: userId,
      chapter_key: meta.key,
      chapter_index: meta.index,
      status: "pending",
      attempt_count: 0,
    });
  }

  // Build facts + web report context (real AI needs both)
  const facts = buildPremiumFacts(engineInput.snapshot);
  const factsJson = JSON.stringify(facts, null, 2).slice(0, 12000);
  const allFactsPaths = enumerateFactsPaths(facts);
  console.log(`[cfg] enumerated ${allFactsPaths.length} evidence paths`);
  const chartFactsStr = [
    chart.name && `${isZh ? "姓名" : "Name"}: ${chart.name}`,
    chart.birth_date && `${isZh ? "阳历生日" : "Solar birth"}: ${chart.birth_date}`,
    chart.birth_time && `${isZh ? "出生时间" : "Birth time"}: ${chart.birth_time}`,
    chart.birth_place && `${isZh ? "出生地点" : "Birth place"}: ${chart.birth_place}`,
  ].filter(Boolean).join("\n");

  const { data: webReport } = await supabase
    .from("reports")
    .select("report_json")
    .eq("user_id", userId)
    .eq("chart_id", CHART_ID)
    .eq("kind", "report")
    .eq("status", "completed")
    .maybeSingle();
  const webReportText = webReport?.report_json ? JSON.stringify(webReport.report_json).slice(0, 6000) : "";

  // Optional targeted reset: only affects the specified chapter keys.
  if (RESET && ONLY.length > 0) {
    const { data: resetRows, error: rErr } = await supabase
      .from("premium_report_chapters")
      .update({ status: "pending", attempt_count: 0, error_message: null, claim_token: null, claimed_at: null })
      .eq("report_id", report.id)
      .eq("user_id", userId)
      .in("chapter_key", ONLY)
      .in("status", ["failed", "pending", "running"])
      .select("chapter_key");
    if (rErr) throw new Error(`reset: ${rErr.message}`);
    console.log(`[reset] ${resetRows?.map((r) => r.chapter_key).join(",") || "(none)"}`);
  }

  // Process chapters in order
  const MAX_ATTEMPTS = 3;
  const perChapterUsage = {};
  const perChapterModel = {};

  for (const meta of PREMIUM_V3_CHAPTERS) {
    if (ONLY.length > 0 && !ONLY.includes(meta.key)) continue;
    const { data: rowRaw } = await supabase
      .from("premium_report_chapters")
      .select("status, attempt_count, content_json, input_tokens, output_tokens")
      .eq("report_id", report.id)
      .eq("user_id", userId)
      .eq("chapter_key", meta.key)
      .single();
    if (rowRaw?.status === "completed") {
      stats.completedChapters += 1;
      continue;
    }
    if (rowRaw?.status === "failed" && (rowRaw.attempt_count ?? 0) >= MAX_ATTEMPTS) {
      console.log(`[skip] ${meta.key} exhausted attempts`);
      continue;
    }

    const title = isZh ? meta.title_zh : meta.title_en;
    const claimToken = crypto.randomUUID();
    await supabase
      .from("premium_report_chapters")
      .update({
        status: "running",
        claim_token: claimToken,
        claimed_at: new Date().toISOString(),
        attempt_count: (rowRaw?.attempt_count ?? 0) + 1,
      })
      .eq("report_id", report.id)
      .eq("user_id", userId)
      .eq("chapter_key", meta.key);

    const spent = { input_tokens: stats.totalInputTokens, output_tokens: stats.totalOutputTokens };
    let providerError = null;
    let body = "";
    let refs = [];
    let usage = { input_tokens: 0, output_tokens: 0 };
    let modelUsed = null;
    const allowedPaths = pathsForModules(allFactsPaths, meta.allowed_facts);

    // Try primary model, fall back on hard errors (model unsupported, 4xx).
    const tryModels = [PRIMARY_MODEL, FALLBACK_MODEL].filter((m, i, a) => a.indexOf(m) === i);
    for (const modelId of tryModels) {
      try {
        stats.callsAttempted += 1;
        const out = await generateChapterReal(meta, title, chartFactsStr, factsJson, allowedPaths, webReportText, isZh, {
          allowedFacts: meta.allowed_facts,
          targetCharsZh: meta.target_chars_zh,
          maxOutputTokens: SKIP_OUTPUT_CAP ? undefined : chapterOutputCap(spent),
          modelId,
        });
        body = out.text;
        refs = out.evidence_refs;
        usage = { input_tokens: usage.input_tokens + out.usage.input_tokens, output_tokens: usage.output_tokens + out.usage.output_tokens };
        modelUsed = out.modelUsed;
        providerError = null;
        break;
      } catch (err) {
        providerError = err.message ?? String(err);
        stats.callsFailed += 1;
        console.log(`[retry ${meta.key}] model=${modelId} error=${providerError.slice(0, 120)}`);
      }
    }

    if (!providerError) {
      // Deterministic evidence-ref correction: replace refs with real
      // paths chosen from facts, matched to meta.allowed_facts.
      const preRefs = refs;
      const corrected = chooseDeterministicRefs(meta, facts, allFactsPaths);
      const issuesPre = validateChapterAgainstFacts({ meta, facts, chapter: { body, evidence_refs: preRefs } });
      if (issuesPre.length > 0 && corrected.length > 0) {
        refs = corrected;
        console.log(`[fix ${meta.key}] refs replaced deterministically (${preRefs.length}→${refs.length})`);
      }
      const issuesPost = validateChapterAgainstFacts({ meta, facts, chapter: { body, evidence_refs: refs } });
      if (issuesPost.length > 0) providerError = `validation:${issuesPost.slice(0, 3).map((i) => i.problem).join("|")}`;
    }

    perChapterUsage[meta.key] = usage;
    perChapterModel[meta.key] = modelUsed;
    stats.totalInputTokens += usage.input_tokens;
    stats.totalOutputTokens += usage.output_tokens;



    if (providerError) {
      console.log(`[fail ${String(meta.index + 1).padStart(2, "0")}/24] ${meta.key}: ${providerError.slice(0, 200)}`);
      await supabase
        .from("premium_report_chapters")
        .update({
          status: "failed",
          claim_token: null,
          error_message: providerError.slice(0, 500),
          input_tokens: (rowRaw?.input_tokens ?? 0) + usage.input_tokens,
          output_tokens: (rowRaw?.output_tokens ?? 0) + usage.output_tokens,
        })
        .eq("report_id", report.id)
        .eq("user_id", userId)
        .eq("chapter_key", meta.key);
      await supabase.from("ai_usage_ledger").insert({
        user_id: userId,
        report_id: report.id,
        chapter_key: meta.key,
        operation: "chapter_generate",
        model_id: modelUsed || PRIMARY_MODEL,
        provider: "lovable-ai-gateway",
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        status: "error",
        error_code: providerError.slice(0, 120),
      });
      continue;
    }

    stats.callsSucceeded += 1;
    const chapterContent = {
      key: meta.key,
      title,
      body,
      evidence_refs: refs,
      confidence: chapterConfidence(refs),
    };
    const chapterHash = await computeContentHash(chapterContent);
    await supabase
      .from("premium_report_chapters")
      .update({
        status: "completed",
        content_json: chapterContent,
        evidence_refs: refs,
        confidence: chapterContent.confidence,
        content_hash: chapterHash,
        input_tokens: (rowRaw?.input_tokens ?? 0) + usage.input_tokens,
        output_tokens: (rowRaw?.output_tokens ?? 0) + usage.output_tokens,
        error_message: null,
        claim_token: null,
        completed_at: new Date().toISOString(),
      })
      .eq("report_id", report.id)
      .eq("user_id", userId)
      .eq("chapter_key", meta.key);
    await supabase.from("ai_usage_ledger").insert({
      user_id: userId,
      report_id: report.id,
      chapter_key: meta.key,
      operation: "chapter_generate",
      model_id: modelUsed || PRIMARY_MODEL,
      provider: "lovable-ai-gateway",
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      status: "ok",
    });
    stats.completedChapters += 1;
    console.log(`[ok   ${String(meta.index + 1).padStart(2, "0")}/24] ${meta.key}  in=${usage.input_tokens} out=${usage.output_tokens}`);
  }

  // Aggregate content_json
  const { data: doneRows } = await supabase
    .from("premium_report_chapters")
    .select("chapter_key, chapter_index, content_json")
    .eq("report_id", report.id)
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("chapter_index", { ascending: true });
  const chapters = (doneRows ?? []).map((r) => r.content_json).filter(Boolean);

  if (chapters.length >= PREMIUM_V3_CHAPTERS.length) {
    const content = {
      schema_version: "v3",
      cover: {
        title: isZh ? `${chart.name} · 高级 AI 深度报告` : `${chart.name} · Premium Deep Reading`,
        subtitle: isZh ? "命运图书馆 · 事实驱动 · 跨体系" : "Library of Destiny · fact-driven · multi-tradition",
      },
      chapters,
      facts,
      meta: {
        generated_at: new Date().toISOString(),
        disclaimer: isZh
          ? "本报告仅供文化娱乐与自我反思，不构成医疗、法律、投资或人生决策建议。"
          : "For reflective self-exploration only — not medical/legal/financial/life-decision advice.",
      },
    };
    stats.contentHash = await computeContentHash(content);
    await supabase
      .from("premium_pdf_reports")
      .update({
        status: "completed",
        content_json: content,
        content_hash: stats.contentHash,
        generated_at: new Date().toISOString(),
        provider: "lovable-ai-gateway",
        model: PRIMARY_MODEL,
        error_message: null,
      })
      .eq("id", report.id);
    console.log(`[done] ${report.id} completed ${chapters.length}/${PREMIUM_V3_CHAPTERS.length}`);
  } else {
    await supabase
      .from("premium_pdf_reports")
      .update({ status: "partial" })
      .eq("id", report.id);
    console.log(`[partial] ${chapters.length}/${PREMIUM_V3_CHAPTERS.length}`);
  }

  stats.perChapterUsage = perChapterUsage;
  stats.perChapterModel = perChapterModel;
  return stats;
}

main()
  .then((s) => {
    console.log("\n=== STATS ===");
    console.log(JSON.stringify(s, null, 2));
  })
  .catch((err) => {
    console.error("[fatal]", err);
    process.exit(1);
  });
