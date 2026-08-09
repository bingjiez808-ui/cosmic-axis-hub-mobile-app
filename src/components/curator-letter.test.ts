// @ts-expect-error bun:test
import { describe, expect, test } from "bun:test";
import {
  curatorLetter,
  ONBOARDING_INTENTS,
  isOnboardingIntent,
} from "@/lib/life-guidance-v1";

describe("curator letter v2 · ritual data", () => {
  test("both languages define exactly 4 pages with a title and body", () => {
    for (const lang of ["en", "zh"] as const) {
      const c = curatorLetter[lang];
      expect(c.pages.length).toBe(4);
      for (const p of c.pages) {
        expect(p.title.length).toBeGreaterThan(2);
        expect(p.body.length).toBeGreaterThanOrEqual(1);
        expect(p.body.length).toBeLessThanOrEqual(3);
        for (const line of p.body) expect(line.length).toBeGreaterThan(4);
      }
      expect(c.openCta.length).toBeGreaterThan(2);
      expect(c.skipCta.length).toBeGreaterThan(2);
      expect(c.doorSelf.length).toBeGreaterThan(2);
      expect(c.doorPeers.length).toBeGreaterThan(2);
      expect(c.pageOf(2, 4)).toMatch(/2/);
      expect(c.pageOf(2, 4)).toMatch(/4/);
    }
  });

  test("intent picker covers all 4 intents with label + hint in both langs", () => {
    expect(ONBOARDING_INTENTS.length).toBe(4);
    for (const lang of ["en", "zh"] as const) {
      const c = curatorLetter[lang];
      for (const k of ONBOARDING_INTENTS) {
        const opt = c.intentOptions[k];
        expect(opt.label.length).toBeGreaterThan(1);
        expect(opt.hint.length).toBeGreaterThan(4);
      }
    }
  });

  test("welcomeBack returns a unique sentence per intent in both langs", () => {
    for (const lang of ["en", "zh"] as const) {
      const seen = new Set<string>();
      for (const k of ONBOARDING_INTENTS) {
        const line = curatorLetter[lang].welcomeBack(k);
        expect(line.length).toBeGreaterThan(10);
        expect(seen.has(line)).toBe(false);
        seen.add(line);
      }
    }
  });

  test("isOnboardingIntent gates unknown values", () => {
    for (const k of ONBOARDING_INTENTS) expect(isOnboardingIntent(k)).toBe(true);
    expect(isOnboardingIntent("something")).toBe(false);
    expect(isOnboardingIntent(null)).toBe(false);
    expect(isOnboardingIntent(undefined)).toBe(false);
    expect(isOnboardingIntent(3)).toBe(false);
  });
});
