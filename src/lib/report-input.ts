import {
  PLANETS,
  ZODIAC_SIGNS,
  computePlanetSigns,
  houseForSign,
} from "@/components/charts/DestinyCharts";
import { solarToLunarInfo } from "@/lib/lunar";
import { buildCalculationSnapshot } from "@/lib/calc-snapshot";
import { buildFourSystemFacts } from "@/lib/four-system-brief";
import { REPORT_AI_VERSION } from "@/lib/ai-cache-version";

export type ReportSearchLike = {
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  lang?: "en" | "zh";
  quiz?: string;
  bazi?: string;
  zodiac?: string;
  lunar?: string;
  readingId?: string;
  gender?: "male" | "female";
  /** Homepage "今天你带着什么问题来到这里" selection, when present. */
  concern?: string;
};

export function buildReportSeed(search: ReportSearchLike) {
  return [search.name, search.date, search.time, search.place].map((v) => v ?? "").join("|");
}

export function buildReportFingerprint(search: ReportSearchLike, lang: "en" | "zh") {
  return [
    lang,
    search.name,
    search.date,
    search.time,
    search.place,
    search.quiz,
    search.bazi,
    search.zodiac,
    search.lunar,
  ]
    .map((v) => v ?? "")
    .join("|");
}

export function buildReportCacheKey(search: ReportSearchLike, lang: "en" | "zh") {
  const run = search.readingId?.trim() || "direct";
  // Version is embedded so a model/prompt upgrade auto-invalidates the cache.
  return `destiny-ai-report::${REPORT_AI_VERSION}::${run}::${buildReportFingerprint(search, lang)}`;
}

export function buildReportRequest(search: ReportSearchLike, lang: "en" | "zh") {
  const seed = buildReportSeed(search);
  const signs = computePlanetSigns(seed);
  const ascSign = signs[PLANETS.findIndex((p) => p.key === "asc")] ?? 0;
  const lunarInfo = search.date ? solarToLunarInfo(search.date, search.time) : null;

  // Every AI generator that reads a chart gets ALL FOUR systems, not just
  // Western + BaZi. Without these two lines Jyotish / Zi Wei sections can
  // only answer "insufficient data".
  const four = buildFourSystemFacts(
    buildCalculationSnapshot({
      date: search.date,
      time: search.time,
      place: search.place,
      lang,
      gender: search.gender,
    }),
  );

  return {
    name: search.name,
    date: search.date,
    time: search.time,
    place: search.place,
    lang,
    quiz: search.quiz,
    planets: PLANETS.map((p, i) => ({
      name: p.name[0],
      sign: ZODIAC_SIGNS[signs[i]].en,
      house: houseForSign(signs[i], ascSign),
    })),
    bazi: search.bazi || lunarInfo?.bazi,
    zodiac: search.zodiac || lunarInfo?.zodiac,
    lunar: search.lunar || lunarInfo?.lunarZh,
    gender: search.gender,
    vedic: four.vedic,
    ziwei: four.ziwei,
    concern: search.concern,
  };
}