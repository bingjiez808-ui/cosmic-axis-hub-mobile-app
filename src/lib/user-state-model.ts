/**
 * User state model — Phase A.
 *
 * Three orthogonal slices of user state that MUST NOT be conflated:
 *
 *   1. primary_concern — long-term theme the traveller returns to.
 *      Stored in `user_preferences.concern` (kept for backward
 *      compatibility with the existing column name).
 *
 *   2. daily_focus    — the ONE thing occupying the user today. Local
 *      to a calendar date; does not influence chart calculation or
 *      long-term recommendation. Persisted to
 *      `user_preferences.daily_focus` + `daily_focus_date`.
 *
 *   3. support_mode   — how the traveller wants the Sage companion to
 *      chat today. Persisted to `user_preferences.support_mode`.
 *      Historical `onboarding_intent` values (direction / courage /
 *      calm / connection) are normalized into this enum at read time.
 *
 * Zero randomness, zero AI. This module is the single source of truth
 * for the vocabulary; UI components, server functions and tests all
 * import from here.
 */
import { z } from "zod";

import type { OnboardingIntent } from "@/lib/life-guidance-v1";
import { CONCERN_KEYS, type ConcernKey } from "@/lib/concern-guidance-v1";

/* ─────────────────── primary_concern (re-exported) ─────────────────── */

export type PrimaryConcern = ConcernKey;
export const PRIMARY_CONCERNS: readonly PrimaryConcern[] = CONCERN_KEYS;
export const primaryConcernSchema = z.enum(
  PRIMARY_CONCERNS as unknown as [string, ...string[]],
);
export function isPrimaryConcern(v: unknown): v is PrimaryConcern {
  return typeof v === "string" && (PRIMARY_CONCERNS as readonly string[]).includes(v);
}

/* ─────────────────────────── daily_focus ─────────────────────────── */

export type DailyFocus =
  | "decision"
  | "relationship"
  | "work_study"
  | "money"
  | "body_mind"
  | "none";

export const DAILY_FOCUSES: readonly DailyFocus[] = [
  "decision",
  "relationship",
  "work_study",
  "money",
  "body_mind",
  "none",
] as const;

export const dailyFocusSchema = z.enum(
  DAILY_FOCUSES as unknown as [string, ...string[]],
);

export function isDailyFocus(v: unknown): v is DailyFocus {
  return typeof v === "string" && (DAILY_FOCUSES as readonly string[]).includes(v);
}

/** Local calendar date (YYYY-MM-DD) for the caller. Never derived from server. */
export function localDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * True if the stored daily_focus is valid AND was recorded on the same
 * local date as `today`. Yesterday's focus MUST NOT bleed into today.
 */
export function isDailyFocusFresh(
  row: { daily_focus: string | null; daily_focus_date: string | null } | null,
  today = localDateKey(),
): boolean {
  if (!row) return false;
  if (!isDailyFocus(row.daily_focus)) return false;
  if (!row.daily_focus_date) return false;
  // Postgres date arrives as YYYY-MM-DD already.
  return row.daily_focus_date === today;
}

/* ─────────────────────────── support_mode ─────────────────────────── */

export type SupportMode = "clarify" | "decide" | "calm" | "understand";

export const SUPPORT_MODES: readonly SupportMode[] = [
  "clarify",
  "decide",
  "calm",
  "understand",
] as const;

export const supportModeSchema = z.enum(
  SUPPORT_MODES as unknown as [string, ...string[]],
);

export function isSupportMode(v: unknown): v is SupportMode {
  return typeof v === "string" && (SUPPORT_MODES as readonly string[]).includes(v);
}

/**
 * Deterministic migration from the legacy CuratorLetter "onboarding
 * intent" vocabulary to the new SupportMode vocabulary. This runs at
 * read time; old rows are never rewritten so a user who logs back in
 * after weeks won't lose their pick.
 *
 *   direction  → decide     (they came here to make a choice)
 *   courage    → decide     (they came here to move forward)
 *   calm       → calm       (unchanged)
 *   connection → understand (they came here to be understood)
 */
export function supportModeFromOnboardingIntent(
  intent: OnboardingIntent | null | undefined,
): SupportMode | null {
  switch (intent) {
    case "direction":
    case "courage":
      return "decide";
    case "calm":
      return "calm";
    case "connection":
      return "understand";
    default:
      return null;
  }
}

/**
 * Fold a raw preferences row (as returned by getLifeGuidancePrefs) into
 * the resolved SupportMode: explicit column wins; else fall back to a
 * migrated onboarding_intent; else null.
 */
export function resolveSupportMode(
  row: {
    support_mode?: string | null;
    onboarding_intent?: string | null;
  } | null,
): SupportMode | null {
  if (!row) return null;
  if (isSupportMode(row.support_mode)) return row.support_mode;
  const legacy = row.onboarding_intent as OnboardingIntent | null | undefined;
  return supportModeFromOnboardingIntent(legacy);
}

/* ─────────────────── Combined normalizer for the UI ─────────────────── */

export type UserStateSnapshot = {
  primaryConcern: PrimaryConcern | null;
  dailyFocus: DailyFocus | null; // null when stored value is stale or missing
  supportMode: SupportMode | null;
};

export function normalizeUserState(
  row:
    | {
        concern?: string | null;
        daily_focus?: string | null;
        daily_focus_date?: string | null;
        support_mode?: string | null;
        onboarding_intent?: string | null;
      }
    | null,
  today = localDateKey(),
): UserStateSnapshot {
  return {
    primaryConcern: isPrimaryConcern(row?.concern) ? row!.concern : null,
    dailyFocus: isDailyFocusFresh(
      {
        daily_focus: row?.daily_focus ?? null,
        daily_focus_date: row?.daily_focus_date ?? null,
      },
      today,
    )
      ? (row!.daily_focus as DailyFocus)
      : null,
    supportMode: resolveSupportMode(row ?? null),
  };
}
