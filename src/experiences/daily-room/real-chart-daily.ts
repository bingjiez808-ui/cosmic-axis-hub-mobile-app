/**
 * Real-chart daily source for /me/home.
 *
 * Computes `daily-facts-v1` + `daily-domain-score-v2` from the visitor's
 * OWN primary chart (birth date/time/place), so Today's Fate no longer
 * depends on demo fixtures. Fully deterministic — no AI here.
 */
import { computeDailyFacts, type DailyFacts } from "@/lib/daily-facts";
import { computeDailyDomainScore, type DailyDomainScore } from "@/lib/daily-domain-score";
import { computeWesternChart, type WesternPlanet } from "@/lib/western-natal";
import { lookupCityGeo, localBirthToUTC } from "@/lib/city-geo";

export type RealDailySource = {
  facts: DailyFacts | null;
  score: DailyDomainScore;
  natal: WesternPlanet[] | null;
  natalHasTime: boolean;
  chartLabel: string;
  /** true when the birth place could not be resolved to coordinates */
  geoUnresolved: boolean;
};

export function buildRealDaily(input: {
  name?: string | null;
  birthDate?: string | null;
  birthTime?: string | null;
  birthPlace?: string | null;
  localDate: string;
  timezone: string;
}): RealDailySource | null {
  if (!input.birthDate) return null;
  const geo = lookupCityGeo(input.birthPlace);
  const hasTime = Boolean(input.birthTime);
  const tz = geo?.tz ?? input.timezone;
  const utc =
    localBirthToUTC(input.birthDate, input.birthTime ?? "12:00", tz) ??
    new Date(`${input.birthDate}T12:00:00Z`);
  const chart = computeWesternChart({
    utc,
    lat: geo?.lat ?? null,
    lng: geo?.lng ?? null,
  });
  const facts = chart
    ? computeDailyFacts({
        natal: chart.planets,
        localDate: input.localDate,
        timezone: input.timezone,
      })
    : null;
  const natalHasTime = hasTime && Boolean(geo);
  const score = computeDailyDomainScore({ facts, natalHasTime });
  return {
    facts,
    score,
    natal: chart?.planets ?? null,
    natalHasTime,
    chartLabel: input.name?.trim() || "",
    geoUnresolved: !geo,
  };
}
