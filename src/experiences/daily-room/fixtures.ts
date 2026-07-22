/**
 * DEMO fixtures for /me/home. These are deterministic and clearly marked;
 * no fixture corresponds to a real user. See
 * `skills/fate-nexus-daily-reading/references/fixtures.md`.
 */
import { computeDailyFacts } from "@/lib/daily-facts";
import { computeDailyDomainScore, type DailyDomainScore } from "@/lib/daily-domain-score";
import { computeWesternChart } from "@/lib/western-natal";
import type { DailyFacts } from "@/lib/daily-facts";
import type { WesternPlanet } from "@/lib/western-natal";

export type DailyRoomFixtureKey = "student_youth" | "working_adult" | "adult_transition" | "no_birth_time";

export type DailyRoomFixture = {
  key: DailyRoomFixtureKey;
  label: string;
  chartLabel: string;
  facts: DailyFacts | null;
  score: DailyDomainScore;
  natal: WesternPlanet[] | null;
  natalHasTime: boolean;
  slower: { vedic: string; bazi: string; ziwei: string };
  isDemo: true;
};

function build(natalUtc: Date, lat: number, lng: number, localDate: string, timezone: string) {
  const chart = computeWesternChart({ utc: natalUtc, lat, lng });
  const facts = chart ? computeDailyFacts({ natal: chart.planets, localDate, timezone }) : null;
  const score = computeDailyDomainScore({ facts, natalHasTime: true });
  return { facts, score, natal: chart?.planets ?? null };
}

export function loadDailyRoomFixture(
  key: DailyRoomFixtureKey,
  localDate: string,
  timezone: string,
): DailyRoomFixture {
  const slower = {
    vedic: "Jupiter–Saturn–Mercury (Mahadasha–Antardasha–Pratyantar)",
    bazi: "戊土大运 · 丙寅流年",
    ziwei: "命宫大限 · 甲辰流年",
  };
  switch (key) {
    case "student_youth": {
      const b = build(new Date(Date.UTC(2008, 5, 15, 8, 0, 0)), 31.23, 121.47, localDate, timezone);
      return { key, label: "学生 · 18 岁", chartLabel: "DEMO 学生", ...b, slower, isDemo: true };
    }
    case "working_adult": {
      const b = build(new Date(Date.UTC(1992, 2, 3, 22, 30, 0)), 39.9, 116.4, localDate, timezone);
      return { key, label: "职场 · 32 岁", chartLabel: "DEMO 职场", ...b, slower, isDemo: true };
    }
    case "adult_transition": {
      const b = build(new Date(Date.UTC(1979, 10, 20, 4, 15, 0)), 22.3, 114.2, localDate, timezone);
      return { key, label: "成年转型 · 45 岁", chartLabel: "DEMO 转型", ...b, slower, isDemo: true };
    }
    case "no_birth_time": {
      const chart = computeWesternChart({ utc: new Date(Date.UTC(1990, 6, 1, 12, 0, 0)), lat: null, lng: null });
      const facts = chart ? computeDailyFacts({ natal: chart.planets, localDate, timezone }) : null;
      const score = computeDailyDomainScore({ facts, natalHasTime: false });
      return { key, label: "缺出生时间", chartLabel: "DEMO 无时", facts, score, slower, isDemo: true };
    }
  }
}
