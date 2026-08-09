/**
 * Panorama · Demo fixture facts and reference outputs.
 *
 * DEMO ONLY. Not a real user's chart. Used to render the V2 tour without
 * touching PremiumFacts. The V1 adapter will replace this at the seam.
 */
import type { PanoramaFactsInput } from "./domain-score";
import { computeDomainScores, recommendFirstRead } from "./domain-score";
import type { GuidedDomainReading, DomainKey } from "./types";
import { fnv1aHex } from "./domain-score";

export const DEMO_PANORAMA_FACTS: PanoramaFactsInput = {
  chart_id: "demo-panorama-chart-v1",
  facts_hash: "demo-facts-v1",
  bazi: {
    day_master: "甲",
    day_element: "wood",
    ten_gods_summary: {
      正印: 2, 偏印: 1, 食神: 1, 伤官: 0, 正官: 1, 七杀: 0,
      正财: 1, 偏财: 0, 比肩: 1, 劫财: 0,
    },
    element_counts: { wood: 3, fire: 1, earth: 2, metal: 1, water: 1 },
    current_dayun_label: "2019-2028",
  },
  ziwei: {
    ming_palace_stars: ["紫微", "天府"],
    career_palace_stars: ["武曲", "天相"],
    spouse_palace_stars: ["太阴"],
    wealth_palace_stars: ["天梁"],
    parent_palace_stars: ["文昌", "文曲"],
    current_daxian_label: "24-33",
  },
  vedic: {
    moon_nakshatra: "Rohini",
    mahadasha_current: { lord: "Jupiter", from: "2018-04-01", to: "2034-04-01" },
    antardasha_current: { lord: "Saturn", from: "2024-01-15", to: "2026-07-28" },
    mercury_strong: true,
    venus_strong: false,
    jupiter_strong: true,
  },
  western: {
    sun_sign: "Taurus",
    moon_sign: "Cancer",
    mercury_sign: "Gemini",
    venus_sign: "Aries",
    mars_sign: "Leo",
    major_aspects: [
      { a: "Sun", b: "Jupiter", kind: "trine", orb: 2.1 },
      { a: "Mercury", b: "Saturn", kind: "sextile", orb: 1.4 },
      { a: "Venus", b: "Mars", kind: "square", orb: 3.0 },
    ],
    ascendant_available: true,
    houses_available: false, // demo: houses NOT available → surfaced honestly
    progressions_available: false,
  },
};

/** Deterministic demo scores for UI rendering. */
export const DEMO_DOMAIN_SCORES = computeDomainScores(DEMO_PANORAMA_FACTS, 0);
export const DEMO_RECOMMENDATION = recommendFirstRead(DEMO_DOMAIN_SCORES);

/* --------------------------- guided reading fixtures ------------------- */

function reading(
  domain: DomainKey,
  score: number,
  factsHash: string,
): GuidedDomainReading {
  const hash = fnv1aHex(
    JSON.stringify({
      chart_id: DEMO_PANORAMA_FACTS.chart_id,
      facts_hash: factsHash,
      domain,
      score,
      skill: "guided-domain-reading-v1",
      lang: "zh-CN",
    }),
  );
  const perSystemAvailable = {
    western: { available: true, obs: {
      study: "水星在双子座、与土星呈六合：语言与结构感兼具；不擅长的是持续机械训练。",
      career: "太阳在金牛、与木星呈三分：长期建构型能量胜过短期冲刺；缺可用宫位数据。",
      love: "金星在白羊、与火星呈刑：主动、率直，但需要留意对抗性节奏。",
      wealth: "太阳落固定星座、木星相位良好：适合长期积累而非短线交易。",
    }[domain] },
    vedic: { available: true, obs: {
      study: "Moon in Rohini + Jupiter Mahadasha：知识与美感型学习的窗口。",
      career: "Jupiter/Saturn 组合：稳定推进型职业能量强于突进型。",
      love: "Venus 未加强，Antardasha 为 Saturn：关系推进偏慢、重责任。",
      wealth: "Jupiter Mahadasha：结构性财富积累窗口，非投机窗口。",
    }[domain] },
    bazi: { available: true, obs: {
      study: "甲木日主 + 正印透出：书本、老师、系统性知识对你格外有用。",
      career: "正官与食神并见：适合有明确规则又允许创造的岗位。",
      love: "正财偏静：稳定型伴侣结构；不适合频繁刺激。",
      wealth: "财星力弱但印星旺：靠专业与信誉换财，胜于市场交易。",
    }[domain] },
    ziwei: { available: true, obs: {
      study: "父母宫见文昌文曲：受师承与书本影响深。",
      career: "官禄宫武曲天相：适合专业、规则、有决断的岗位。",
      love: "夫妻宫太阴：内敛、需要被理解型伴侣。",
      wealth: "财帛宫天梁：靠稳定与守成型收入，不利偏门。",
    }[domain] },
  };
  return {
    domain,
    skill_version: "guided-domain-reading-v1",
    content_hash: hash,
    sections: {
      opening:
        {
          study: "先读这一章的理由：你的学习方式在四个体系里都有清晰印记，读它能帮你解释此前的一些学习困惑。",
          career: "先读这一章的理由：你的职业结构信号最集中，能帮你决定接下来一年是否需要更换赛道。",
          love: "先读这一章的理由：你在关系里的重复模式在多个体系里指向同一件事，读它能减少下一次误判。",
          wealth: "先读这一章的理由：你的财富型态和你以为的略有不同，先读它可以避免用错方法积累。",
        }[domain],
      per_system: [
        { system: "western", observation: perSystemAvailable.western.obs, available: perSystemAvailable.western.available },
        { system: "vedic",   observation: perSystemAvailable.vedic.obs,   available: perSystemAvailable.vedic.available },
        { system: "bazi",    observation: perSystemAvailable.bazi.obs,    available: perSystemAvailable.bazi.available },
        { system: "ziwei",   observation: perSystemAvailable.ziwei.obs,   available: perSystemAvailable.ziwei.available },
      ],
      consensus_and_conflict:
        {
          study: "四个体系一致指向：你偏结构+人文型学习。分歧点：西方偏理性、印度偏灵感；两种都在你身上出现过。",
          career: "共识：你适合长期、专业、允许沉思的岗位。分歧：紫微给你偏内的位置，Vedic 给你一段外扩窗口；两者需要在同一年里协调。",
          love: "共识：稳定型伴侣结构。分歧：西方指出你偏主动，紫微指出你偏内敛；同一段关系里两种都可能出现。",
          wealth: "共识：长期积累胜过短期交易。分歧：Vedic 给出未来十年宽松，八字提醒你财星并不强，不要盲目扩张。",
        }[domain],
      real_life_expression:
        {
          study: "现实里表现为：你在系统性的课本上很快，但对纯记忆题反感；在有导师指点时进步跳跃式。",
          career: "现实里表现为：你在有清晰产出的岗位上稳定输出，在需要每日争取的岗位上会持续内耗。",
          love: "现实里表现为：你会为一个『能替你解释这个世界』的人心动，而非为最热烈的人。",
          wealth: "现实里表现为：你更适合『每年做一两个大决定』，而不是每天看盘。",
        }[domain],
      strengths_and_resources:
        {
          study: "优势：结构感、语言组织、长期专注。可用资源：书籍、导师、跨学科同伴。",
          career: "优势：判断力、稳定性、耐心。可用资源：口碑、导师、行业内长期关系。",
          love: "优势：稳定、被记得、被守护。可用资源：一段允许你慢开口的关系。",
          wealth: "优势：专业能力换资源、耐心复利。可用资源：稳定手艺、长期资产、可信社群。",
        }[domain],
      recurring_patterns:
        {
          study: "容易重复：先系统学、又中途换方向；反例条件：给自己两个明确的完成节点。",
          career: "容易重复：拿到位置后犹豫是否离开；反例条件：只在有更清晰下一步时离开，不为逃避而走。",
          love: "容易重复：把『能替你解释世界』误认为『能陪你走完这一生』；反例条件：观察日常琐事，而不是深夜聊天。",
          wealth: "容易重复：在长期资产上突然想要一次快钱；反例条件：把快钱账户和长期账户彻底分开。",
        }[domain],
      current_cycle_window:
        {
          study: "当前周期：八字大运 2019-2028 + Vedic Jupiter Mahadasha，学习窗口宽；这是可观察时间窗口，不是保证。",
          career: "当前周期：紫微大限 24-33 + Antardasha Saturn，推进偏慢但基础扎实；可观察，不构成升迁承诺。",
          love: "当前周期：Antardasha Saturn — 关系节奏偏缓、重责任；可观察，不构成结/离婚预测。",
          wealth: "当前周期：Jupiter Mahadasha — 结构性积累窗口；可观察，不构成投资建议。",
        }[domain],
      keep_stop_start:
        {
          study: { keep: "保留：每周固定阅读节奏。", stop: "停止：同时开三门新课的习惯。", start: "开始：为每一门课设一个具体的『我完成了』证据。" },
          career: { keep: "保留：长期作品/口碑积累。", stop: "停止：为逃避某一次冲突而换赛道。", start: "开始：主动找一位可以复盘你决策的导师。" },
          love: { keep: "保留：允许自己慢开口。", stop: "停止：把深夜聊天当作关系判断依据。", start: "开始：观察对方在琐事里的稳定度。" },
          wealth: { keep: "保留：长期账户不动。", stop: "停止：从长期账户挪钱做短线。", start: "开始：为快钱账户设一个上限。" },
        }[domain],
      self_inquiry: {
        study: [
          "过去三年，我真正学会的一件事是什么？",
          "我最容易半途放弃的科目有什么共通点？",
          "下一步我想让自己成为哪种知识者？",
        ],
        career: [
          "过去两年，我做过最不后悔的职业决定是什么？",
          "我最不能忍受的组织特征是什么？",
          "如果没有外界评价，我最想推进的一件工作是什么？",
        ],
        love: [
          "让我感到被理解的时刻，通常发生在什么样的场景？",
          "过去的关系里，我重复失望的那件小事是什么？",
          "如果对方永远保持现在的样子，我还愿意继续吗？",
        ],
        wealth: [
          "过去三年，我最不后悔的一笔支出是什么？",
          "我最容易冲动花钱的场景是什么？",
          "如果收入减半，我最先保留的三件事是什么？",
        ],
      }[domain],
      method_and_limits:
        "方法：本导读只使用当前已接入的确定性事实（八字、紫微、Vedic Vimshottari、西方九星与主要相位）。当前未接入西方宫位（Placidus/Whole-sign 需另行开启）与推运/行运，因此凡涉及此类事实的判断均标注为『暂不可用』。所有『时间窗口』只是可观察的周期，不是命运预测；本导读不构成医疗、法律或投资建议。",
    },
    evidence_refs: [
      "bazi.day_master",
      "bazi.ten_gods_summary",
      "ziwei.ming_palace",
      "vedic.mahadasha[0]",
      "vedic.moon_nakshatra",
      "western.sun",
      "western.aspects",
    ],
    confidence: "mid",
    generated_at: 0,
  };
}

export const DEMO_DOMAIN_READINGS: Record<DomainKey, GuidedDomainReading> = {
  study: reading("study", DEMO_DOMAIN_SCORES.find((s) => s.domain === "study")!.score, DEMO_PANORAMA_FACTS.facts_hash),
  career: reading("career", DEMO_DOMAIN_SCORES.find((s) => s.domain === "career")!.score, DEMO_PANORAMA_FACTS.facts_hash),
  love: reading("love", DEMO_DOMAIN_SCORES.find((s) => s.domain === "love")!.score, DEMO_PANORAMA_FACTS.facts_hash),
  wealth: reading("wealth", DEMO_DOMAIN_SCORES.find((s) => s.domain === "wealth")!.score, DEMO_PANORAMA_FACTS.facts_hash),
};
