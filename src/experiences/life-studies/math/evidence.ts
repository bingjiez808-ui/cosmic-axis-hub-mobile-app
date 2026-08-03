/**
 * Evidence-path resolver for the life-domain scoring model.
 *
 * Every score/signal ships with an `evidence_refs: string[]`. Each ref
 * follows the shape:
 *
 *   "<system>:<field>:<age?>"
 *
 * where <system> ∈ {bazi, ziwei, vedic, western}. This module resolves
 * a ref to a plain object drawn from the SupportedFacts bundle so the UI
 * and tests can verify no reference points at fabricated data.
 */

import type { DomainKey } from "./domains";
import type { SupportedFacts } from "./demoFacts";

export type ResolvedEvidence =
  | { ok: true; system: "bazi" | "ziwei" | "vedic" | "western"; field: string; age: number | null; value: unknown }
  | { ok: false; ref: string; reason: "unsupported-system" | "unsupported-field" | "no-coverage" };

export type Confidence = "high" | "medium" | "low";
export type DataCoverage = "full" | "partial" | "insufficient";

export function makeRef(
  system: "bazi" | "ziwei" | "vedic" | "western",
  field: string,
  age: number | null = null,
): string {
  return age == null ? `${system}:${field}` : `${system}:${field}:${age}`;
}

export function resolveEvidence(ref: string, facts: SupportedFacts): ResolvedEvidence {
  const [system, field, ageStr] = ref.split(":");
  const age = ageStr == null || ageStr === "" ? null : Number(ageStr);
  if (system === "bazi") {
    if (facts.coverage.bazi === "none") return { ok: false, ref, reason: "no-coverage" };
    if (field === "wuxing") return { ok: true, system, field, age, value: facts.wuxing };
    if (field === "dayun-boundary" && age != null) {
      const nearest = nearestBoundary(facts.daYunBoundaries, age);
      return { ok: true, system, field, age, value: nearest };
    }
    return { ok: false, ref, reason: "unsupported-field" };
  }
  if (system === "ziwei") {
    if (facts.coverage.ziwei === "none") return { ok: false, ref, reason: "no-coverage" };
    if (field === "limit-boundary" && age != null) {
      const nearest = nearestBoundary(facts.ziweiLimitBoundaries, age);
      return { ok: true, system, field, age, value: nearest };
    }
    return { ok: false, ref, reason: "unsupported-field" };
  }
  if (system === "vedic") {
    if (facts.coverage.vedic === "none") return { ok: false, ref, reason: "no-coverage" };
    if (field === "mahadasha" && age != null) {
      const active = facts.mahadasha.find((m) => age >= m.from && age < m.to);
      if (!active) return { ok: false, ref, reason: "unsupported-field" };
      return { ok: true, system, field, age, value: active };
    }
    return { ok: false, ref, reason: "unsupported-field" };
  }
  if (system === "western") {
    if (facts.coverage.western === "none") return { ok: false, ref, reason: "no-coverage" };
    if (field === "aspects") return { ok: true, system, field, age, value: facts.westernAspects };
    // Explicitly reject unsupported transit/progression/house-cusp asks.
    if (field === "transit" || field === "progression" || field === "house-cusp") {
      return { ok: false, ref, reason: "no-coverage" };
    }
    return { ok: false, ref, reason: "unsupported-field" };
  }
  return { ok: false, ref, reason: "unsupported-system" };
}

function nearestBoundary(boundaries: number[], age: number): { boundary: number; index: number } {
  let best = boundaries[0];
  let bestIdx = 0;
  let bestDist = Math.abs(age - best);
  for (let i = 1; i < boundaries.length; i += 1) {
    const d = Math.abs(age - boundaries[i]);
    if (d < bestDist) {
      best = boundaries[i];
      bestIdx = i;
      bestDist = d;
    }
  }
  return { boundary: best, index: bestIdx };
}

/**
 * Confidence heuristic — high when at least 3 systems cover, medium when
 * 2, low when only 1. Western natal-only counts as half-coverage.
 */
export function confidenceFor(facts: SupportedFacts, _domain: DomainKey): Confidence {
  let n = 0;
  if (facts.coverage.bazi !== "none") n += 1;
  if (facts.coverage.ziwei !== "none") n += 1;
  if (facts.coverage.vedic !== "none") n += 1;
  if (facts.coverage.western !== "none") n += 0.5;
  if (n >= 3) return "high";
  if (n >= 2) return "medium";
  return "low";
}

export function coverageFor(facts: SupportedFacts): DataCoverage {
  const parts = [facts.coverage.bazi, facts.coverage.ziwei, facts.coverage.vedic];
  const missing = parts.filter((p) => p === "none").length;
  if (missing === 0) return "full";
  if (missing >= 2) return "insufficient";
  return "partial";
}
