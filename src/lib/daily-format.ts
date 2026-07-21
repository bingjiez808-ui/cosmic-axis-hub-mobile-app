/**
 * daily-format — presentation-layer formatter for `daily-domain-score-v1`
 * emissions. Parses structured strings such as
 *   `study:sun→mercury trine`
 *   `career:mars→sun square`
 * into human sentences in the current locale. The underlying score /
 * evidence_refs are NEVER mutated — only the *display* string is.
 *
 * Rules:
 * - Chinese must never surface `study/career/love/wealth`, planet English
 *   names, aspect English names, or snake_case tokens.
 * - Unknown tokens fall back to a humanized version (`_` → space) rather
 *   than raw internal key.
 * - Missing translation is logged in dev to help catch regressions.
 */
import type { DailyDict } from "@/lib/i18n-daily";
import type { Lang } from "@/lib/i18n";

const IS_DEV =
  typeof process !== "undefined" && process.env && process.env.NODE_ENV !== "production";

const missingReported = new Set<string>();
function reportMissing(kind: string, key: string) {
  if (!IS_DEV) return;
  const tag = `${kind}:${key}`;
  if (missingReported.has(tag)) return;
  missingReported.add(tag);
  // eslint-disable-next-line no-console
  console.warn(`[daily-format] missing ${kind} translation for "${key}"`);
}

function humanize(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function tPlanet(dict: DailyDict, key: string): string {
  const v = dict.planet[key];
  if (v) return v;
  reportMissing("planet", key);
  return humanize(key);
}

export function tAspect(dict: DailyDict, key: string): string {
  const v = dict.aspect[key];
  if (v) return v;
  reportMissing("aspect", key);
  return humanize(key);
}

export function tDomain(dict: DailyDict, key: string): string {
  const v = (dict.domain as Record<string, string>)[key];
  if (v) return v;
  reportMissing("domain", key);
  return humanize(key);
}

export function tSign(dict: DailyDict, key: string): string {
  const v = dict.sign[key];
  if (v) return v;
  reportMissing("sign", key);
  return humanize(key);
}

/** Phase keys arrive as `new_moon`/`full_moon`/etc. The dict accepts
 *  either the underscored key or the shortened alias (`new`, `full`). */
export function tPhase(dict: DailyDict, key: string): string {
  const map = dict.phase as Record<string, string>;
  if (map[key]) return map[key];
  const alias = key === "new_moon" ? "new" : key === "full_moon" ? "full" : key;
  if (map[alias]) return map[alias];
  reportMissing("phase", key);
  return humanize(key);
}

export function tBand(dict: DailyDict, key: string): string {
  const v = (dict.band as Record<string, string>)[key];
  if (v) return v;
  reportMissing("band", key);
  return humanize(key);
}

export function tConfidence(dict: DailyDict, key: string): string {
  const v = (dict.confidence as Record<string, string>)[key];
  if (v) return v;
  reportMissing("confidence", key);
  return humanize(key);
}

const ASPECT_TOKENS = new Set([
  "conjunction",
  "opposition",
  "trine",
  "square",
  "sextile",
  "quincunx",
]);
const DOMAIN_TOKENS = new Set(["study", "career", "love", "wealth"]);

type Parsed =
  | { kind: "domain_aspect"; domain: string; transit: string; natal: string; aspect: string }
  | { kind: "aspect"; transit: string; natal: string; aspect: string }
  | { kind: "raw" };

/** Parse a signal string. Accepts:
 *   `domain:planet→planet aspect`
 *   `planet→planet aspect`
 *   `domain:planet->planet aspect` (ASCII arrow fallback) */
export function parseDailySignal(raw: string): Parsed {
  // Normalize ASCII arrow to unicode
  const s = raw.replace(/->/g, "→").trim();
  // domain:planet→planet aspect
  const m1 = s.match(/^(\w+):(\w+)→(\w+)\s+(\w+)$/);
  if (m1) {
    const [, domain, transit, natal, aspect] = m1;
    if (DOMAIN_TOKENS.has(domain) && ASPECT_TOKENS.has(aspect)) {
      return { kind: "domain_aspect", domain, transit, natal, aspect };
    }
  }
  const m2 = s.match(/^(\w+)→(\w+)\s+(\w+)$/);
  if (m2) {
    const [, transit, natal, aspect] = m2;
    if (ASPECT_TOKENS.has(aspect)) {
      return { kind: "aspect", transit, natal, aspect };
    }
  }
  return { kind: "raw" };
}

/** Format a signal into a natural-language sentence. */
export function formatDailySignal(raw: string, dict: DailyDict, lang: Lang): string {
  const p = parseDailySignal(raw);
  if (p.kind === "raw") return raw;
  const transit = tPlanet(dict, p.transit);
  const natal = tPlanet(dict, p.natal);
  const aspect = tAspect(dict, p.aspect);
  if (p.kind === "domain_aspect") {
    const domain = tDomain(dict, p.domain);
    if (lang === "zh") {
      return `${domain}：${transit}与本命${natal}呈${aspect}`;
    }
    return `${domain}: transit ${transit} ${aspect} natal ${natal}`;
  }
  // aspect only
  if (lang === "zh") return `${transit}与本命${natal}呈${aspect}`;
  return `Transit ${transit} ${aspect} natal ${natal}`;
}

/** Theme keyword formatter, e.g. `new_moon:起始` or `retrograde:mercury,venus`. */
export function formatThemeKeyword(raw: string, dict: DailyDict, lang: Lang): string {
  const [head, tail] = raw.split(":");
  if (head === "retrograde") {
    const planets = (tail ?? "")
      .split(",")
      .map((p) => tPlanet(dict, p.trim()))
      .filter(Boolean)
      .join(" · ");
    return `${lang === "zh" ? "逆行" : "retrograde"}: ${planets}`;
  }
  const phaseName = tPhase(dict, head);
  return tail ? `${phaseName} · ${tail}` : phaseName;
}

/** Contradiction line rewriter — engine emits e.g.
 *  `study(70) 与 wealth(35) 分数差 ≥ 20，请以现实情境为准。` */
export function formatContradiction(raw: string, dict: DailyDict, lang: Lang): string {
  const m = raw.match(/(\w+)\((\d+)\)\s*[^\d]+?(\w+)\((\d+)\)/);
  if (!m) return raw;
  const [, aK, aS, bK, bS] = m;
  const aL = tDomain(dict, aK);
  const bL = tDomain(dict, bK);
  return lang === "zh"
    ? `${aL}（${aS}） 与 ${bL}（${bS}） 分数差 ≥ 20，请以现实情境为准。`
    : `${aL} (${aS}) vs. ${bL} (${bS}) differ by ≥ 20 — trust the real situation over the reading.`;
}
