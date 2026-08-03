/**
 * Guided Library V2 · Story chain — insight feedback weight.
 *
 * The "像我 / 不太像 / 想继续了解" buttons under the first insight do
 * NOT re-run any AI or fact pipeline. They only reweight local
 * recommendation ordering by nudging a per-topic weight in a plain
 * numeric map. When the weight is positive, that topic sorts earlier
 * in `recommendNext`; when negative, later. When zero, the base
 * matching order applies.
 *
 * Kept in its own file so it stays testable without React.
 */
import type { StoryTopic } from "./types";

export type FeedbackKind = "resonant" | "not_me" | "want_more";

export const FEEDBACK_DELTA: Record<FeedbackKind, number> = {
  resonant: 1,
  want_more: 2,
  not_me: -2,
};

export type FeedbackWeights = Partial<Record<StoryTopic, number>>;

export function applyFeedback(
  weights: FeedbackWeights,
  topic: StoryTopic,
  kind: FeedbackKind,
): FeedbackWeights {
  const cur = weights[topic] ?? 0;
  const next = cur + FEEDBACK_DELTA[kind];
  // Clamp so noisy tapping cannot drown out the base ordering.
  const clamped = Math.max(-4, Math.min(4, next));
  return { ...weights, [topic]: clamped };
}

/**
 * Deterministic tie-break for two topics under the current weight map.
 * Higher weight sorts first; equal weights preserve input order.
 */
export function compareTopicsByWeight(
  weights: FeedbackWeights,
  a: StoryTopic,
  b: StoryTopic,
): number {
  return (weights[b] ?? 0) - (weights[a] ?? 0);
}
