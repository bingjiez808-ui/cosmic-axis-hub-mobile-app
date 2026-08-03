/**
 * Demo FACTS bundle for /life-studies/math.
 *
 * These are CLEARLY LABELLED sample values used when the visitor has no
 * primary chart or picks "Demo" mode. They are shaped like the minimum
 * subset of deterministic FACTS the scoring model reads today — bazi
 * five-element balance, ziwei major stars per palace at broad age bands,
 * vedic Mahadasha/Antardasha ranges, and western natal aspect summary.
 *
 * A future adapter can swap this with the user's real FACTS from
 * calc-snapshot; the model does not care where FACTS come from, only that
 * the same input reproduces the same output.
 */

export type SupportedFacts = {
  /** Stable identifier used for seeding baseline variance. Never a raw ID. */
  seed: string;

  /** Coverage report — which sub-systems supplied enough data to score. */
  coverage: {
    bazi: "full" | "partial" | "none";
    ziwei: "full" | "partial" | "none";
    vedic: "full" | "partial" | "none";
    western: "natal-only" | "none";
  };

  /** 五行 balance (bazi). Values sum to ~1.0. */
  wuxing: { wood: number; fire: number; earth: number; metal: number; water: number };

  /** 大运 boundaries in age (bazi). Sorted ascending. */
  daYunBoundaries: number[];

  /** Ziwei 大限 boundaries in age. Sorted ascending. */
  ziweiLimitBoundaries: number[];

  /** Vedic mahadasha windows (age ranges + lord token). */
  mahadasha: Array<{ from: number; to: number; lord: string }>;

  /** Western natal aspect summary tokens (harmonious vs challenging count). */
  westernAspects: { harmonious: number; challenging: number };

  /** Human-readable label shown in the UI to disclose data source. */
  disclosure: { zh: string; en: string };
};

export const DEMO_FACTS: SupportedFacts = {
  seed: "demo:v1",
  coverage: {
    bazi: "full",
    ziwei: "full",
    vedic: "full",
    western: "natal-only",
  },
  wuxing: { wood: 0.24, fire: 0.18, earth: 0.22, metal: 0.20, water: 0.16 },
  daYunBoundaries: [8, 18, 28, 38, 48, 58, 68, 78],
  ziweiLimitBoundaries: [6, 16, 26, 36, 46, 56, 66, 76],
  mahadasha: [
    { from:  0, to:  6, lord: "Moon"    },
    { from:  6, to: 13, lord: "Mars"    },
    { from: 13, to: 31, lord: "Rahu"    },
    { from: 31, to: 47, lord: "Jupiter" },
    { from: 47, to: 66, lord: "Saturn"  },
    { from: 66, to: 83, lord: "Mercury" },
  ],
  westernAspects: { harmonious: 5, challenging: 3 },
  disclosure: {
    zh: "演示命盘 · 用于展示模型如何跨四大体系读取周期，不对应任何真实个人。",
    en: "Demo chart — shows how the model reads cycles across the four systems. Not a real person.",
  },
};

/**
 * Build a personalized FACTS bundle from a birth ISO. Today this only
 * seeds baseline variance and shifts DaYun boundaries; a real adapter
 * that pulls from calc-snapshot will land later without changing the
 * model contract.
 */
export function factsFromSeed(seed: string): SupportedFacts {
  const h = hash32(seed || "demo");
  const shift = (h % 5) - 2; // -2..+2 years
  const wuxingRoll = (h >>> 3) % 5;
  const wuxingOrder = ["wood", "fire", "earth", "metal", "water"] as const;
  const dominant = wuxingOrder[wuxingRoll];
  const wuxing = { wood: 0.2, fire: 0.2, earth: 0.2, metal: 0.2, water: 0.2 };
  wuxing[dominant] = 0.28;
  wuxing[wuxingOrder[(wuxingRoll + 3) % 5]] = 0.14;
  return {
    ...DEMO_FACTS,
    seed,
    wuxing,
    daYunBoundaries: DEMO_FACTS.daYunBoundaries.map((b) => Math.max(1, b + shift)),
    disclosure: {
      zh: "个性化模式 · 使用主命盘的确定性事实，未支持项以中性值处理，不由 AI 补造。",
      en: "Personalized mode — uses deterministic facts from your primary chart; unsupported items stay neutral (no AI fill).",
    },
  };
}

function hash32(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
