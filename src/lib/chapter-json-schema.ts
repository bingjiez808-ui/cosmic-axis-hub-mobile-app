/**
 * Strict JSON output contract for AI-generated chapters.
 *
 * Every production chapter call MUST return a JSON object matching this
 * schema. Free-text answers, prose citations, and hand-waved evidence
 * are rejected — the parser refuses to guess where paragraphs end or
 * which module a reference belongs to.
 *
 *   {
 *     "body": "…plain-text paragraphs…",
 *     "evidence_refs": [
 *       { "path": "bazi.pillars.day", "module": "bazi", "confidence": "grounded" }
 *     ]
 *   }
 *
 * Additional keys are stripped. Malformed JSON, disallowed modules,
 * unresolvable paths, or missing minimum evidence per the chapter's
 * catalog rules → the caller marks the chapter `failed`. The worker
 * retries up to MAX_CHAPTER_ATTEMPTS.
 */
import { z } from "zod";
import {
  PREMIUM_V3_CHAPTERS,
  type EvidenceRef,
  type FactModule,
  type V3ChapterMeta,
  type ValidationIssue,
} from "./premium-chapters-v3";
import { resolveFactsPath, type PremiumFacts } from "./premium-facts";

export const CHAPTER_MODULE_ENUM = [
  "bazi",
  "bazi_luck",
  "ziwei",
  "ziwei_horoscope",
  "western",
  "western_aspects",
  "vedic",
  "vedic_dasha",
] as const satisfies readonly FactModule[];

export const CHAPTER_CONFIDENCE_ENUM = ["grounded", "traditional", "reflective"] as const;

const PATH_SHAPE = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*|\[\d+\])*$/i;

export const EvidenceRefSchema = z.object({
  path: z.string().min(1).max(200).regex(PATH_SHAPE, "bad_evidence_path"),
  module: z.enum(CHAPTER_MODULE_ENUM),
  confidence: z.enum(CHAPTER_CONFIDENCE_ENUM),
});

export const ChapterJsonSchema = z
  .object({
    body: z.string().min(1).max(20_000),
    evidence_refs: z.array(EvidenceRefSchema).max(24).default([]),
  })
  .strict();

export type ChapterJson = z.infer<typeof ChapterJsonSchema>;

/**
 * Extract the first JSON object from a provider response. Providers
 * sometimes wrap JSON in ```json fences or leading commentary; strip
 * both. Returns null when no JSON object is discoverable — the caller
 * treats that as a hard failure.
 */
export function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  // Fenced block first.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

export type ChapterParseResult =
  | { ok: true; value: ChapterJson }
  | { ok: false; error: string };

export function parseChapterJson(raw: string): ChapterParseResult {
  const obj = extractJsonObject(raw);
  if (!obj) return { ok: false, error: "no_json_object" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(obj);
  } catch (e) {
    return { ok: false, error: `bad_json:${(e as Error).message.slice(0, 80)}` };
  }
  const r = ChapterJsonSchema.safeParse(parsed);
  if (!r.success) {
    const first = r.error.issues[0];
    return {
      ok: false,
      error: `schema:${first?.path.join(".") ?? ""}:${first?.message ?? "invalid"}`.slice(0, 160),
    };
  }
  return { ok: true, value: r.data };
}

/**
 * Validate a parsed chapter against its catalog rules AND the facts
 * tree. Combines the checks previously spread across validateV3Content
 * + resolveFactsPath so the production path fails FAST instead of
 * discovering the issue on read.
 *
 * Returns [] on success. Non-empty means: mark chapter failed with the
 * concatenated `problem` list; the worker will retry.
 */
export function validateChapterAgainstFacts(opts: {
  meta: V3ChapterMeta;
  chapter: ChapterJson;
  facts: PremiumFacts;
}): ValidationIssue[] {
  const { meta, chapter, facts } = opts;
  const issues: ValidationIssue[] = [];
  const key = meta.key;

  if (chapter.body.trim().length === 0) {
    issues.push({ chapter_key: key, problem: "empty_body" });
  }

  // For chapters that allow facts, at least one evidence_ref is required.
  if (meta.allowed_facts.length > 0 && chapter.evidence_refs.length === 0) {
    issues.push({ chapter_key: key, problem: "no_evidence_refs" });
  }
  // For chapters that FORBID facts (cover/closing), disallow any refs.
  if (meta.allowed_facts.length === 0 && chapter.evidence_refs.length > 0) {
    issues.push({ chapter_key: key, problem: "unexpected_evidence_refs" });
  }

  for (const ref of chapter.evidence_refs) {
    if (meta.allowed_facts.length > 0 && !meta.allowed_facts.includes(ref.module)) {
      issues.push({ chapter_key: key, problem: `disallowed_fact_module:${ref.module}` });
      continue;
    }
    // Path must resolve against the facts tree.
    const value = resolveFactsPath(facts, ref.path);
    if (value === undefined || value === null) {
      issues.push({ chapter_key: key, problem: `unresolved_evidence_path:${ref.path}` });
    }
  }

  // Cross-tradition chapters must cite ≥2 modules.
  if (meta.kind === "cross") {
    const distinct = new Set(chapter.evidence_refs.map((r) => r.module));
    if (distinct.size < 2) {
      issues.push({ chapter_key: key, problem: "cross_chapter_needs_two_modules" });
    }
  }

  // System chapters must have at least one grounded reference.
  if (meta.kind === "system" && meta.allowed_facts.length > 0) {
    const hasGrounded = chapter.evidence_refs.some((r) => r.confidence === "grounded");
    if (!hasGrounded) {
      issues.push({ chapter_key: key, problem: "system_chapter_needs_grounded" });
    }
  }

  return issues;
}

export function metaForChapter(key: string): V3ChapterMeta | undefined {
  return PREMIUM_V3_CHAPTERS.find((c) => c.key === key);
}

export type { EvidenceRef };
