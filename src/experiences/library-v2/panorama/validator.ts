/**
 * Guided Domain Reading skill — evidence validator.
 *
 * Enforces the contract before a reading is treated as "completed":
 *   - every non-empty per-system observation must ship with available:true;
 *   - unsupported systems (available:false) must have empty observation;
 *   - self_inquiry.length === 3;
 *   - evidence_refs must be non-empty and reference only whitelisted paths;
 *   - keep/stop/start each non-empty.
 */
import type { GuidedDomainReading } from "./types";

export const SUPPORTED_EVIDENCE_PREFIXES: readonly string[] = [
  "bazi.day_master",
  "bazi.day_element",
  "bazi.ten_gods_summary",
  "bazi.element_counts",
  "bazi.dayun",
  "ziwei.ming_palace",
  "ziwei.career_palace_stars",
  "ziwei.spouse_palace_stars",
  "ziwei.wealth_palace_stars",
  "ziwei.parent_palace_stars",
  "ziwei.daxian",
  "vedic.mahadasha[0]",
  "vedic.antardasha[0]",
  "vedic.moon_nakshatra",
  "western.sun",
  "western.moon",
  "western.mercury",
  "western.venus",
  "western.mars",
  "western.aspects",
];

export interface ReadingValidationIssue {
  code: string;
  detail: string;
}

export function validateGuidedReading(r: GuidedDomainReading): ReadingValidationIssue[] {
  const issues: ReadingValidationIssue[] = [];
  if (!r.evidence_refs.length) {
    issues.push({ code: "empty_evidence", detail: "evidence_refs must be non-empty" });
  }
  for (const ref of r.evidence_refs) {
    if (!SUPPORTED_EVIDENCE_PREFIXES.some((p) => ref === p || ref.startsWith(`${p}.`) || ref.startsWith(`${p}[`))) {
      issues.push({ code: "unsupported_evidence_ref", detail: ref });
    }
  }
  if (r.sections.self_inquiry.length !== 3) {
    issues.push({ code: "self_inquiry_size", detail: `expected 3, got ${r.sections.self_inquiry.length}` });
  }
  const { keep, stop, start } = r.sections.keep_stop_start;
  if (!keep || !stop || !start) {
    issues.push({ code: "keep_stop_start_missing", detail: JSON.stringify(r.sections.keep_stop_start) });
  }
  for (const obs of r.sections.per_system) {
    if (obs.available && !obs.observation.trim()) {
      issues.push({ code: "system_available_but_empty", detail: obs.system });
    }
    if (!obs.available && obs.observation.trim()) {
      issues.push({ code: "system_unavailable_but_filled", detail: obs.system });
    }
  }
  if (!r.sections.method_and_limits.includes("暂不可用") && r.sections.per_system.some((s) => !s.available)) {
    // Not fatal — surfaced as a soft issue so QA notices, but doesn't block.
    issues.push({ code: "missing_limits_note_soft", detail: "method_and_limits should mention 暂不可用 when a system is unavailable" });
  }
  return issues;
}
