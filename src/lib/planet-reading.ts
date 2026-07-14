import { PLANETS, ZODIAC_SIGNS } from "@/components/charts/DestinyCharts";

// Sign elemental tone
const SIGN_TONE: [string, string][] = [
  ["fiery, direct, pioneering", "火象 · 直接、开拓"], // Aries
  ["earthy, sensual, patient", "土象 · 感官、耐心"], // Taurus
  ["airy, quick, communicative", "风象 · 敏捷、善表达"], // Gemini
  ["watery, tidal, protective", "水象 · 潮汐、护持"], // Cancer
  ["fiery, radiant, proud", "火象 · 光亮、骄傲"], // Leo
  ["earthy, precise, useful", "土象 · 精细、实用"], // Virgo
  ["airy, relational, balanced", "风象 · 关系、平衡"], // Libra
  ["watery, intense, transformative", "水象 · 强烈、蜕变"], // Scorpio
  ["fiery, philosophical, far-seeing", "火象 · 哲学、远视"], // Sagittarius
  ["earthy, disciplined, ambitious", "土象 · 纪律、志远"], // Capricorn
  ["airy, unorthodox, humanitarian", "风象 · 独特、人道"], // Aquarius
  ["watery, dreamlike, empathic", "水象 · 梦幻、共情"], // Pisces
];

export function planetPlacementReading(
  planetIdx: number,
  signIdx: number,
  house: number,
  lang: "en" | "zh",
): string {
  const p = PLANETS[planetIdx];
  const s = ZODIAC_SIGNS[signIdx];
  const tone = SIGN_TONE[signIdx][lang === "zh" ? 1 : 0];
  const pName = p.name[lang === "zh" ? 1 : 0];
  const sName = lang === "zh" ? s.zh : s.en;
  const pMeaning = p.meaning[lang === "zh" ? 1 : 0];
  if (lang === "zh") {
    const houseHint =
      house === 1
        ? "落于第一宫，直接染上你的外显气质"
        : house === 4
          ? "落在第四宫，深植于家与根系"
          : house === 7
            ? "落在第七宫，向亲密关系倾斜"
            : house === 10
              ? "落在第十宫，在事业与公众面前显形"
              : `落于第 ${house} 宫`;
    return `${pName}（${pMeaning}）此刻披上「${sName}」的${tone}气质 —— ${houseHint}。它意味着这一部分的你，${
      signIdx % 4 === 0
        ? "外放而清亮，容易先动手再思考"
        : signIdx % 4 === 1
          ? "缓慢而扎实，宁可迟到也要落地"
          : signIdx % 4 === 2
            ? "灵动而擅表达，靠对话与串联发力"
            : "深情而敏感，靠共振与信任推进"
    }。请留意：当此行星与其他行星形成合相（同宫）或三分相时，它会被强化；形成四分或对分时，会被推向必须解决的功课。`;
  }
  const houseHint =
    house === 1
      ? "in the 1st house, coloring how you arrive"
      : house === 4
        ? "in the 4th house, rooted in home and origin"
        : house === 7
          ? "in the 7th house, leaning into partnership"
          : house === 10
            ? "in the 10th house, visible in career and public life"
            : `in the ${house}th house`;
  return `${pName} (${pMeaning}) is dressed in ${sName} — ${tone} — ${houseHint}. This part of you tends to be ${
    signIdx % 4 === 0
      ? "outward and bright — you act before you deliberate"
      : signIdx % 4 === 1
        ? "slow and solid — you would rather be late than shallow"
        : signIdx % 4 === 2
          ? "nimble and articulate — you compound through dialogue"
          : "deep and porous — you move through trust and resonance"
  }. Note: when this planet forms a conjunction or trine with another it is amplified; when it forms a square or opposition, it is pushed toward a lesson that must be answered.`;
}

export function aspectReading(
  aspectKey: string,
  lang: "en" | "zh",
): string {
  const map: Record<string, [string, string]> = {
    conj: [
      "Fusion. The two energies act as one — intense focus, but blind spots.",
      "合相 · 两股能量融合为一 —— 高度聚焦，但视野狭窄。",
    ],
    sext: [
      "Ease. A supportive channel — talent that flows if you use it.",
      "六分 · 顺畅的通道 —— 用则通、不用则空。",
    ],
    squ: [
      "Friction. Growth pressure — the block that becomes the muscle.",
      "四分 · 摩擦生长 —— 阻力最终变成肌肉。",
    ],
    tri: [
      "Harmony. Natural flow — talent that others notice before you do.",
      "三分 · 天然和谐 —— 他人先看见的天赋。",
    ],
    opp: [
      "Polarity. A see-saw between two selves — mastery is holding both.",
      "对分 · 两个自我的跷跷板 —— 成熟即同时持有。",
    ],
  };
  return (map[aspectKey] ?? ["", ""])[lang === "zh" ? 1 : 0];
}
