/**
 * Fun Library · deterministic scoring.
 *
 * scoreReadingPersonality(answers) is a pure function: no network,
 * no AI, no random. Same answers → same result, forever.
 */

import { createHash } from "node:crypto";
import { QUIZ, QUIZ_VERSION } from "./quiz";
import type { Answers, AxisKey, PersonalityResult } from "./types";

export const SCORING_VERSION = "score_v1";

const AXES: AxisKey[] = ["ML", "ET", "AC", "FO"];

// Positive letter ↔ negative letter per axis.
const LETTER: Record<AxisKey, [string, string]> = {
  ML: ["M", "L"],
  ET: ["E", "T"],
  AC: ["A", "C"],
  FO: ["F", "O"],
};

/** Canonical JSON for stable hashing (sorted keys). */
function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
}

function sha256Hex(s: string): string {
  // Prefer Web Crypto for edge/browser; fall back to Node crypto sync.
  // We use node:crypto sync so this function stays pure-sync and
  // trivially testable with no await ceremony.
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/**
 * Total possible ± range per axis given the current quiz.
 * Used to normalize raw → 0..100 (50 = perfect middle).
 */
function axisRange(axis: AxisKey): number {
  let total = 0;
  for (const q of QUIZ) {
    // The max |weight| any option contributes to this axis on this question.
    const maxAbs = Math.max(
      0,
      ...q.options.map((o) => Math.abs(o.weights[axis] ?? 0)),
    );
    total += maxAbs;
  }
  return total;
}

export function scoreReadingPersonality(
  answers: Answers,
  quizVersion: string = QUIZ_VERSION,
): PersonalityResult {
  if (answers.length !== QUIZ.length) {
    throw new Error(
      `answers length ${answers.length} does not match quiz length ${QUIZ.length}`,
    );
  }

  const raw: Record<AxisKey, number> = { ML: 0, ET: 0, AC: 0, FO: 0 };
  for (let i = 0; i < QUIZ.length; i += 1) {
    const q = QUIZ[i];
    const optId = answers[i];
    const opt = q.options.find((o) => o.id === optId);
    if (!opt) {
      throw new Error(`answer[${i}]="${optId}" is not an option of ${q.id}`);
    }
    for (const ax of AXES) {
      raw[ax] += opt.weights[ax] ?? 0;
    }
  }

  // Deterministic tie-break for exact-zero axes.
  const hashHex = sha256Hex(canonical({ answers, quizVersion }));
  const tieBits: Record<AxisKey, number> = {
    ML: parseInt(hashHex[0], 16) & 1,
    ET: parseInt(hashHex[1], 16) & 1,
    AC: parseInt(hashHex[2], 16) & 1,
    FO: parseInt(hashHex[3], 16) & 1,
  };

  const axes = {} as PersonalityResult["axes"];
  let code = "";
  for (const ax of AXES) {
    const r = raw[ax];
    const range = axisRange(ax) || 1;
    const normalized = Math.round(((r + range) / (2 * range)) * 100);
    const positive = r === 0 ? tieBits[ax] === 1 : r > 0;
    const letter = positive ? LETTER[ax][0] : LETTER[ax][1];
    axes[ax] = { raw: r, normalized, letter };
    code += letter;
  }

  return { code, axes, quizVersion, scoringVersion: SCORING_VERSION };
}
