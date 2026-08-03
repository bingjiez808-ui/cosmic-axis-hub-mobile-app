// @ts-expect-error — bun:test
import { describe, expect, test } from "bun:test";
import {
  DAILY_FOCUSES,
  SUPPORT_MODES,
  PRIMARY_CONCERNS,
  isDailyFocus,
  isDailyFocusFresh,
  isPrimaryConcern,
  isSupportMode,
  localDateKey,
  normalizeUserState,
  resolveSupportMode,
  supportModeFromOnboardingIntent,
} from "./user-state-model";

describe("user-state-model — three orthogonal slices", () => {
  test("enums are the exact allow-lists we shipped", () => {
    expect([...PRIMARY_CONCERNS]).toEqual([
      "study",
      "career",
      "love",
      "relationships",
      "finance",
      "self_family",
      "overview",
    ]);
    expect([...DAILY_FOCUSES]).toEqual([
      "decision",
      "relationship",
      "work_study",
      "money",
      "body_mind",
      "none",
    ]);
    expect([...SUPPORT_MODES]).toEqual(["clarify", "decide", "calm", "understand"]);
  });

  test("guards reject empty/unknown strings (fail-closed)", () => {
    for (const bad of ["", "  ", "sage", "unknown", null, undefined, 42]) {
      expect(isPrimaryConcern(bad)).toBe(false);
      expect(isDailyFocus(bad)).toBe(false);
      expect(isSupportMode(bad)).toBe(false);
    }
    expect(isPrimaryConcern("career")).toBe(true);
    expect(isDailyFocus("body_mind")).toBe(true);
    expect(isSupportMode("clarify")).toBe(true);
  });

  test("localDateKey is stable YYYY-MM-DD", () => {
    const k = localDateKey(new Date(2026, 0, 3, 12));
    expect(k).toBe("2026-01-03");
  });

  test("stale daily_focus does not carry over to a new day", () => {
    const today = "2026-07-27";
    expect(
      isDailyFocusFresh({ daily_focus: "decision", daily_focus_date: today }, today),
    ).toBe(true);
    expect(
      isDailyFocusFresh({ daily_focus: "decision", daily_focus_date: "2026-07-26" }, today),
    ).toBe(false);
    expect(
      isDailyFocusFresh({ daily_focus: null, daily_focus_date: today }, today),
    ).toBe(false);
    expect(isDailyFocusFresh(null, today)).toBe(false);
  });

  test("legacy onboarding_intent maps deterministically", () => {
    expect(supportModeFromOnboardingIntent("direction")).toBe("decide");
    expect(supportModeFromOnboardingIntent("courage")).toBe("decide");
    expect(supportModeFromOnboardingIntent("calm")).toBe("calm");
    expect(supportModeFromOnboardingIntent("connection")).toBe("understand");
    expect(supportModeFromOnboardingIntent(null)).toBe(null);
  });

  test("resolveSupportMode: explicit column beats legacy intent", () => {
    expect(
      resolveSupportMode({ support_mode: "clarify", onboarding_intent: "direction" }),
    ).toBe("clarify");
    expect(
      resolveSupportMode({ support_mode: null, onboarding_intent: "connection" }),
    ).toBe("understand");
    expect(resolveSupportMode({ support_mode: null, onboarding_intent: null })).toBe(null);
    expect(resolveSupportMode(null)).toBe(null);
  });

  test("normalizeUserState folds a raw row into a safe snapshot", () => {
    const today = "2026-07-27";
    const snap = normalizeUserState(
      {
        concern: "love",
        daily_focus: "relationship",
        daily_focus_date: today,
        support_mode: null,
        onboarding_intent: "connection",
      },
      today,
    );
    expect(snap).toEqual({
      primaryConcern: "love",
      dailyFocus: "relationship",
      supportMode: "understand",
    });

    // Yesterday's focus is silently dropped.
    const stale = normalizeUserState(
      {
        concern: "career",
        daily_focus: "money",
        daily_focus_date: "2026-07-26",
        support_mode: "calm",
      },
      today,
    );
    expect(stale.dailyFocus).toBe(null);
    expect(stale.supportMode).toBe("calm");
  });
});
