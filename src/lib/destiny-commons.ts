/**
 * 命运通识馆 · General Knowledge Hall of Destiny — shared six-hall data source.
 *
 * Single configuration consumed by both the home preview section
 * (PlayfulLibrarySection) and the standalone /life-studies page. Do not
 * duplicate this list — both surfaces must render from here so status,
 * copy, and routes stay in lockstep.
 *
 * Only mathematics and literature are open. The remaining four halls
 * are collections-in-progress and MUST NOT expose a route.
 */

export type HallStatus = "open" | "coming";

export type DestinyCommonsHall = {
  id: "mathematics" | "literature" | "geography" | "physics" | "economics" | "biology";
  code: string;
  nameZh: string;
  nameEn: string;
  subtitleZh: string;
  subtitleEn: string;
  summaryZh: string;
  summaryEn: string;
  status: HallStatus;
  /** Real route, only defined when status === "open". */
  route?: string;
  accent: string; // tailwind gradient tail
  requiresPrimaryChart?: boolean;
  /** What this hall helps the user see. */
  capabilities: { zh: string; en: string }[];
  /** Existing chart evidence it reads from. */
  evidenceSources: { zh: string; en: string };
  /** What it will not do. */
  disclaimer: { zh: string; en: string };
};

export const DESTINY_COMMONS_HALLS: DestinyCommonsHall[] = [
  {
    id: "mathematics",
    code: "01",
    nameZh: "数学馆",
    nameEn: "Mathematics Hall",
    subtitleZh: "把人生写成一条会变化的函数",
    subtitleEn: "Life as a changing function",
    summaryZh:
      "观察学业、事业、关系、家庭、财富与健康，如何在不同年龄共同改变人生曲线。",
    summaryEn:
      "See how study, career, relationships, family, wealth and health together bend your life curve across different ages.",
    status: "open",
    route: "/life-studies/math",
    accent: "from-nebula-purple/60 via-nebula-purple/25 to-transparent",
    requiresPrimaryChart: true,
    capabilities: [
      { zh: "把命盘阶段转成可观察的多维度曲线", en: "Turn chart stages into an observable multi-dimensional curve" },
      { zh: "试算不同选择带来的分支走势", en: "Simulate how each choice bends the branch" },
      { zh: "识别哪个维度此刻权重最高", en: "Identify which dimension weighs most right now" },
    ],
    evidenceSources: {
      zh: "读取：主命盘阶段、大运/流年、性格倾向等既有确定性事实。",
      en: "Reads: primary chart stage, luck cycles and personality tendencies from existing deterministic facts.",
    },
    disclaimer: {
      zh: "示例曲线为情景模拟，不是命运预测；不构成人生决定建议。",
      en: "The curve is a scenario simulation, not a prediction, and is not personal life advice.",
    },
  },
  {
    id: "literature",
    code: "02",
    nameZh: "语文馆",
    nameEn: "Literature Hall",
    subtitleZh: "那些长大后才读懂的句子",
    subtitleEn: "Lines you only understand later",
    summaryZh:
      "根据年龄阶段、人生处境与长期倾向，找到此刻终于能够读懂的诗句与人生注解。",
    summaryEn:
      "Match a line of poetry to your current life stage, situation and long-term tendencies — and read its annotation.",
    status: "open",
    route: "/me/echoes",
    accent: "from-gold-dust/55 via-gold-dust/25 to-transparent",
    requiresPrimaryChart: true,
    capabilities: [
      { zh: "为当前阶段挑选一句能与你共鸣的诗文", en: "Choose a line that may resonate with your current stage" },
      { zh: "说明它原本在说什么、为什么此刻可能触动你", en: "Explain its original meaning and why it may land now" },
      { zh: "留下一条可以带回生活的反思问题", en: "Leave one reflection question to carry into the day" },
    ],
    evidenceSources: {
      zh: "读取：主命盘阶段、年龄事实与命盘长期结构。",
      en: "Reads: primary chart stage, age facts and long-term chart structure.",
    },
    disclaimer: {
      zh: "不虚构古人未曾说过的名言；每一则出处均可追溯。",
      en: "Never fabricates quotations attributed to historical figures; every source is traceable.",
    },
  },
  {
    id: "geography",
    code: "03",
    nameZh: "地理馆",
    nameEn: "Geography Hall",
    subtitleZh: "人生迁移地图",
    subtitleEn: "The life migration map",
    summaryZh:
      "未来将通过占星地理线与迁移盘，阅读不同城市可能带来的生活主题。",
    summaryEn:
      "Will use astrocartography lines and relocation charts to read the life themes different cities may bring.",
    status: "coming",
    accent: "from-sky-500/40 via-sky-500/15 to-transparent",
    capabilities: [
      { zh: "呈现不同地点的生活主题差异", en: "Show how life themes shift across locations" },
      { zh: "对比城市之间可能被放大的维度", en: "Compare which dimensions each city may amplify" },
      { zh: "识别当前所在地的适配感", en: "Read the fit of your current location" },
    ],
    evidenceSources: {
      zh: "计划读取：出生数据、迁移盘计算与占星地理线。",
      en: "Will read: birth data, relocation-chart calculations and astrocartography lines.",
    },
    disclaimer: {
      zh: "不预测地理上的吉凶，不建议迁移决定。",
      en: "Does not predict locational fortune nor advise on relocation decisions.",
    },
  },
  {
    id: "physics",
    code: "04",
    nameZh: "物理馆",
    nameEn: "Physics Hall",
    subtitleZh: "人生惯性与转向成本",
    subtitleEn: "Inertia and the cost of turning",
    summaryZh:
      "用惯性、阻力、推力与临界点，理解为什么有时知道方向，却仍然难以改变。",
    summaryEn:
      "Use inertia, friction, thrust and critical points to see why direction is clear yet change still feels hard.",
    status: "coming",
    accent: "from-cyan-500/40 via-cyan-500/15 to-transparent",
    capabilities: [
      { zh: "识别当下最重的惯性来自哪里", en: "Locate where today's heaviest inertia comes from" },
      { zh: "估算一次转向需要的最小推力", en: "Estimate the minimum push a turn actually requires" },
      { zh: "找出摩擦被吃掉的位置", en: "Find where friction is quietly draining energy" },
    ],
    evidenceSources: {
      zh: "计划读取：元素/宫位事实、当前阶段与近期节律。",
      en: "Will read: element/house facts, current stage and short-term rhythm.",
    },
    disclaimer: {
      zh: "只用物理概念作为解释框架，不宣称人生服从物理定律。",
      en: "Uses physics only as a framing metaphor — not a claim that life obeys physical laws.",
    },
  },
  {
    id: "economics",
    code: "05",
    nameZh: "经济馆",
    nameEn: "Economics Hall",
    subtitleZh: "选择、机会成本与风险",
    subtitleEn: "Choice, opportunity cost and risk",
    summaryZh:
      "阅读人生选择背后的资源分配、时间成本与风险偏好；不提供投资预测。",
    summaryEn:
      "Read the allocation, time cost and risk preference behind life choices — no market or investment predictions.",
    status: "coming",
    accent: "from-emerald-500/40 via-emerald-500/15 to-transparent",
    capabilities: [
      { zh: "看清时间、注意力与关系的当前分配", en: "See how time, attention and relationships are currently allocated" },
      { zh: "估算一项选择的机会成本", en: "Estimate the opportunity cost of a choice" },
      { zh: "识别自身的风险偏好区间", en: "Identify your comfortable range of risk" },
    ],
    evidenceSources: {
      zh: "计划读取：性格倾向、阶段事实与关注领域。",
      en: "Will read: personality tendencies, stage facts and current focus areas.",
    },
    disclaimer: {
      zh: "不提供投资、财务或市场预测建议。",
      en: "Does not provide investment, financial or market forecasting advice.",
    },
  },
  {
    id: "biology",
    code: "06",
    nameZh: "生物馆",
    nameEn: "Biology Hall",
    subtitleZh: "节律、适应与恢复",
    subtitleEn: "Rhythm, adaptation and recovery",
    summaryZh:
      "观察不同人生阶段的精力、压力与恢复节奏；不构成医疗建议。",
    summaryEn:
      "Observe how energy, stress and recovery rhythms shift across life stages — not medical advice.",
    status: "coming",
    accent: "from-pink-500/40 via-pink-500/15 to-transparent",
    capabilities: [
      { zh: "识别当前阶段的能量高低带", en: "Identify the current stage's energy high and low bands" },
      { zh: "看见恢复节律被打断的位置", en: "See where the recovery rhythm gets interrupted" },
      { zh: "标注需要保护的休整窗口", en: "Mark the rest windows worth protecting" },
    ],
    evidenceSources: {
      zh: "计划读取：阶段节律、大运/流年与季节性事实。",
      en: "Will read: stage rhythm, luck cycles and seasonal facts.",
    },
    disclaimer: {
      zh: "不构成医疗建议；不诊断、不替代专业医疗判断。",
      en: "Not medical advice; does not diagnose or replace professional medical judgement.",
    },
  },
];

export const DESTINY_COMMONS_ROUTE = "/life-studies";
export const HISTORICAL_ECHOES_ROUTE = "/me/echoes";

export function openHallCount() {
  return DESTINY_COMMONS_HALLS.filter((h) => h.status === "open").length;
}

export function comingHallCount() {
  return DESTINY_COMMONS_HALLS.filter((h) => h.status === "coming").length;
}
