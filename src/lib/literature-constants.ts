/**
 * Literature Hall — shared constants for concerns, reading tones, life-stage
 * mapping, and bilingual copy. Kept client-safe so both the route UI and
 * server functions can import it without pulling any DB code.
 */

import type { LifeStage } from "@/lib/life-guidance-v1";

/** Site-wide LifeStage → literature-DB life_stage_tags value. */
export function stageToTag(stage: LifeStage | null): string | null {
  switch (stage) {
    case "learning_self":
      return "youth";
    case "early_adulthood":
      return "early_career";
    case "building_life":
      return "midlife_entry";
    case "midlife_reassessment":
      return "midlife";
    case "maturity_legacy":
      return "later";
    default:
      return null;
  }
}

/** Chapter-of-life label shown to the user — never the raw age band. */
export function stageLabel(stage: LifeStage | null, isZh: boolean): string {
  const zh: Record<string, string> = {
    learning_self: "少年时",
    early_adulthood: "初入人间",
    building_life: "行至中途",
    midlife_reassessment: "后来",
    maturity_legacy: "此刻",
  };
  const en: Record<string, string> = {
    learning_self: "Youth",
    early_adulthood: "First steps",
    building_life: "Midway",
    midlife_reassessment: "Later",
    maturity_legacy: "Now",
  };
  return (isZh ? zh : en)[stage ?? ""] ?? (isZh ? "此刻" : "Now");
}

/** Reading concerns — first step in the flow. */
export type ConcernKey =
  | "study"
  | "career"
  | "love"
  | "family"
  | "solitude"
  | "wealth"
  | "migration"
  | "recovery"
  | "self"
  | "any";

export const CONCERNS: { key: ConcernKey; zh: string; en: string }[] = [
  { key: "study", zh: "学业与成长", en: "Study & growth" },
  { key: "career", zh: "事业与选择", en: "Career & choices" },
  { key: "love", zh: "爱情与离别", en: "Love & farewell" },
  { key: "family", zh: "家庭与责任", en: "Family & duty" },
  { key: "solitude", zh: "人际与孤独", en: "People & solitude" },
  { key: "wealth", zh: "财富与安全感", en: "Wealth & security" },
  { key: "migration", zh: "迁移与远方", en: "Distance & moving on" },
  { key: "recovery", zh: "失意与恢复", en: "Setback & recovery" },
  { key: "self", zh: "自我与意义", en: "Self & meaning" },
  { key: "any", zh: "我也说不清，只想读一点什么", en: "I can't say — just want to read something" },
];

/** Reading tones — second step in the flow. */
export type ToneKey =
  | "classical"
  | "direct"
  | "tender"
  | "sober"
  | "romantic"
  | "absurd"
  | "any"
  | "auto";

export const TONES: { key: ToneKey; zh: string; en: string }[] = [
  { key: "classical", zh: "古典含蓄", en: "Classical & reserved" },
  { key: "direct", zh: "直白有力", en: "Direct & strong" },
  { key: "tender", zh: "温柔安慰", en: "Tender & comforting" },
  { key: "sober", zh: "清醒克制", en: "Sober & restrained" },
  { key: "romantic", zh: "浪漫辽阔", en: "Romantic & vast" },
  { key: "absurd", zh: "荒诞幽默", en: "Absurd & wry" },
  { key: "any", zh: "中外都可以", en: "Any region" },
  { key: "auto", zh: "交给图书馆", en: "Let the library choose" },
];

export const LITERATURE_CONTENT_VERSION = "v1";
export const LITERATURE_PROMPT_VERSION = "v1";
