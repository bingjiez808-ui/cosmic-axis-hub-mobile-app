/**
 * Fun Library · Reading Personality — types.
 *
 * Four hidden binary axes. User-visible copy never mentions these
 * letters; they exist only for scoring and tests.
 *
 *   M/L  Map ↔ Lantern      (structure-first vs. cue-first)
 *   E/T  Editor ↔ Traveler  (control-revise vs. explore-adapt)
 *   A/C  Annotation ↔ Co-reading (solo digest vs. via relation)
 *   F/O  Finality ↔ Open-ending (seek closure vs. keep possibility)
 */

export type AxisKey = "ML" | "ET" | "AC" | "FO";

/** Signed integer weight in [-2, +2] applied per axis by an option. */
export type AxisWeights = Partial<Record<AxisKey, number>>;

export type QuizOption = {
  /** Stable ID; visual order may shuffle but ID + weights are locked. */
  id: string;
  zh: string;
  en: string;
  weights: AxisWeights;
};

export type QuizQuestion = {
  id: string;
  zh: string;
  en: string;
  options: [QuizOption, QuizOption, QuizOption, QuizOption];
};

/** Answers = ordered array of option IDs, one per question. */
export type Answers = string[];

export type AxisScore = {
  raw: number;
  /** Normalized to 0..100 where 50 = perfect middle. */
  normalized: number;
  /** Positive letter ("M","E","A","F") or negative ("L","T","C","O"). */
  letter: string;
};

export type PersonalityResult = {
  code: string; // 4 letters, e.g. "METF"
  axes: Record<AxisKey, AxisScore>;
  quizVersion: string;
  scoringVersion: string;
};
