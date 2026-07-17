/**
 * Reading engine — the versioned, cache-first bridge between local
 * calculation facts and AI narrative.
 *
 * Design invariants (locked in by tests in `reading-engine.test.ts`):
 *
 * 1. **Deterministic serialization**: `canonicalize(x)` emits stable
 *    JSON with recursively sorted object keys, so `input_hash` and
 *    `content_hash` do not drift with property-order noise.
 *
 * 2. **Fact / narrative separation**: `buildEngineInput(chart, snapshot)`
 *    is the ONLY object passed to the provider. Local calculators are
 *    ground truth; the model narrates them but cannot invent chart
 *    facts. The provider receives compact structured JSON, never
 *    freeform HTML.
 *
 * 3. **Versioned cache key** = `(owner_id, chart_id, input_hash,
 *    prompt_version, model_id, report_version, calculation_version)`.
 *    Bump ANY of the four version strings → the old row is left
 *    intact but a NEW cache key is produced, so a re-generation
 *    happens and old buyers keep seeing their prior report.
 *
 * 4. **Cache hit = zero provider call**. `runReading` never invokes
 *    `callProvider` when a cached row with a matching key exists.
 *    Tests inject a spy provider that MUST NOT be called on hit.
 *
 * 5. **Cross-user isolation**: `input_hash` embeds the `owner_id`,
 *    so two users with the identical birth data get separate cache
 *    entries and cannot share a row. RLS on `premium_pdf_reports`
 *    is the second line of defence.
 */
import type { CalculationSnapshot } from "./calc-snapshot";
import { CALCULATION_VERSION } from "./calc-snapshot";

/* ------------------------------------------------------------------ */
/* Version pins — bump one → new cache key, old rows untouched.       */
/* ------------------------------------------------------------------ */

// v1.0.0 = 19 body-only chapters
// v2.0.0 = 19 chapters + locally-derived facts (BaZi pillars/ten-gods/
// element counts, Ziwei 12 palaces w/ brightness+mutagen, Western/Vedic
// facts). New key → new row; old buyers keep their v1 report.
export const READING_PROMPT_VERSION = "reading_prompt_v2.0.0";
export const READING_REPORT_VERSION = "premium_pdf_v1"; // matches premium_pdf_reports.report_version
export const READING_MODEL_ID = "google/gemini-2.5-flash";
/** Gemini's supported minimum (0 = deterministic). */
export const READING_TEMPERATURE = 0;
export { CALCULATION_VERSION };

export type ReadingVersions = {
  prompt_version: string;
  report_version: string;
  model_id: string;
  calculation_version: string;
  temperature: number;
};

export const DEFAULT_VERSIONS: ReadingVersions = {
  prompt_version: READING_PROMPT_VERSION,
  report_version: READING_REPORT_VERSION,
  model_id: READING_MODEL_ID,
  calculation_version: CALCULATION_VERSION,
  temperature: READING_TEMPERATURE,
};

/* ------------------------------------------------------------------ */
/* Deterministic JSON — recursively sorted keys.                       */
/* ------------------------------------------------------------------ */

export function canonicalize(x: unknown): string {
  if (x === null || typeof x !== "object") return JSON.stringify(x);
  if (Array.isArray(x)) return "[" + x.map(canonicalize).join(",") + "]";
  const obj = x as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}

/* ------------------------------------------------------------------ */
/* SHA-256 — isomorphic (Web Crypto in browsers/edge, node:crypto in tests). */
/* ------------------------------------------------------------------ */

export async function sha256Hex(input: string): Promise<string> {
  const g = globalThis as unknown as { crypto?: { subtle?: SubtleCrypto } };
  if (g.crypto?.subtle) {
    const enc = new TextEncoder();
    const buf = await g.crypto.subtle.digest("SHA-256", enc.encode(input));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // Node fallback (unit tests).
  const nodeCrypto = await import("node:crypto");
  return nodeCrypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/* ------------------------------------------------------------------ */
/* Engine input — the compact structured JSON the provider receives.  */
/* ------------------------------------------------------------------ */

export type EngineChartFacts = {
  name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  birth_place: string | null;
  lang: "en" | "zh";
  gender: "male" | "female" | null;
};

export type EngineInput = {
  chart: EngineChartFacts;
  snapshot: CalculationSnapshot;
  versions: ReadingVersions;
};

export function buildEngineInput(
  chart: EngineChartFacts,
  snapshot: CalculationSnapshot,
  versions: ReadingVersions = DEFAULT_VERSIONS,
): EngineInput {
  return { chart, snapshot, versions };
}

/* ------------------------------------------------------------------ */
/* Cache key + hashes.                                                 */
/* ------------------------------------------------------------------ */

export type CacheKey = {
  owner_id: string;
  chart_id: string;
  input_hash: string;
  prompt_version: string;
  model_id: string;
  report_version: string;
  calculation_version: string;
};

export async function computeInputHash(
  ownerId: string,
  chartId: string,
  input: EngineInput,
): Promise<string> {
  // Owner + chart identity are baked into the hash so two users with
  // the identical birth data get separate cache entries. Versions are
  // included too so that bumping any of them invalidates the key.
  const payload = canonicalize({ ownerId, chartId, input });
  return sha256Hex(payload);
}

export async function computeContentHash(content: unknown): Promise<string> {
  return sha256Hex(canonicalize(content));
}

export async function makeCacheKey(
  ownerId: string,
  chartId: string,
  input: EngineInput,
): Promise<CacheKey> {
  return {
    owner_id: ownerId,
    chart_id: chartId,
    input_hash: await computeInputHash(ownerId, chartId, input),
    prompt_version: input.versions.prompt_version,
    model_id: input.versions.model_id,
    report_version: input.versions.report_version,
    calculation_version: input.versions.calculation_version,
  };
}

export function cacheKeyMatches(a: CacheKey, b: CacheKey): boolean {
  return (
    a.owner_id === b.owner_id &&
    a.chart_id === b.chart_id &&
    a.input_hash === b.input_hash &&
    a.prompt_version === b.prompt_version &&
    a.model_id === b.model_id &&
    a.report_version === b.report_version &&
    a.calculation_version === b.calculation_version
  );
}

/* ------------------------------------------------------------------ */
/* runReading — provider-agnostic core.                                */
/* ------------------------------------------------------------------ */

export type ReadingContent = unknown;

export type CachedReading = {
  content: ReadingContent;
  input_hash: string;
  content_hash: string;
  prompt_version: string;
  model_id: string;
  report_version: string;
  calculation_version: string;
  token_usage: TokenUsage | null;
  generated_at: string;
};

export type TokenUsage = { input_tokens: number; output_tokens: number };

export type CacheAdapter = {
  /** Look up a cached reading by exact cache-key match. Returns null on miss. */
  read(key: CacheKey): Promise<CachedReading | null>;
  /** Persist a new reading atomically; treated as best-effort. */
  write(key: CacheKey, value: CachedReading): Promise<void>;
};

export type ProviderCall = (input: EngineInput) => Promise<{
  content: ReadingContent;
  token_usage?: TokenUsage;
}>;

export type RunReadingArgs = {
  ownerId: string;
  chartId: string;
  input: EngineInput;
  cache: CacheAdapter;
  callProvider: ProviderCall;
  /** Injected clock for deterministic tests. */
  now?: () => Date;
};

export type RunReadingResult = {
  hit: boolean;
  reading: CachedReading;
  provider_calls: 0 | 1;
};

/**
 * Cache-first execution. On a cache hit, `callProvider` is NEVER
 * invoked. On a miss, we call the provider exactly once, hash the
 * result, persist, and return.
 */
export async function runReading(args: RunReadingArgs): Promise<RunReadingResult> {
  const key = await makeCacheKey(args.ownerId, args.chartId, args.input);
  const hit = await args.cache.read(key);
  if (hit) {
    return { hit: true, reading: hit, provider_calls: 0 };
  }
  const { content, token_usage } = await args.callProvider(args.input);
  const content_hash = await computeContentHash(content);
  const reading: CachedReading = {
    content,
    input_hash: key.input_hash,
    content_hash,
    prompt_version: key.prompt_version,
    model_id: key.model_id,
    report_version: key.report_version,
    calculation_version: key.calculation_version,
    token_usage: token_usage ?? null,
    generated_at: (args.now?.() ?? new Date()).toISOString(),
  };
  await args.cache.write(key, reading);
  return { hit: false, reading, provider_calls: 1 };
}
