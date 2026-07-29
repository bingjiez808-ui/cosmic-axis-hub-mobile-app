import type { LifeExperiment } from "./types";

/**
 * 八个现实化实验。每次只改一个变量。
 * dimensionEffects 与 costEffects 均为稳态增量, 会由 curve gradient 从
 * startAge 渐进施加, 差值幅度既肉眼可辨也不制造极端。
 */
export const LIFE_EXPERIMENTS: LifeExperiment[] = [
  {
    id: "accumulate-skill",
    title: { zh: "提前积累一项长期能力", en: "Accumulate a long-term skill earlier" },
    description: {
      zh: "在需要之前, 就把一项可迁移能力慢慢磨透。",
      en: "Grind one transferable skill before you strictly need it.",
    },
    startAge: 26,
    dimensionEffects: { study: +6, career: +5, wealth: +2 },
    costEffects:      { relationship: -2, family: -1 },
    shortTerm: {
      zh: "短期收益不明显, 但为 3–5 年后的选择空间打底。",
      en: "Short-term gains are quiet — it lays runway for the choices you'll have in 3–5 years.",
    },
    midTerm: {
      zh: "中期事业与学业曲线抬升更早, 财富曲线随之走稳。",
      en: "Career and study rise earlier in the mid-term; wealth stabilises alongside.",
    },
    cost: {
      zh: "牺牲一部分社交与陪伴时间, 关系与家庭需要提前沟通。",
      en: "Costs some social and companionship time — relationship and family need to be told in advance.",
    },
    curveTransition: "gradual",
  },
  {
    id: "expand-when-opportunity",
    title: { zh: "在机会到来时扩大投入", en: "Scale up when an opportunity arrives" },
    description: {
      zh: "识别到窗口时, 主动加码而不是维持现状。",
      en: "When you spot a window, actively lean in rather than hold steady.",
    },
    startAge: 30,
    dimensionEffects: { career: +8, wealth: +5 },
    costEffects:      { health: -3, family: -3, relationship: -2 },
    shortTerm: {
      zh: "现实路径短期抬升明显, 事业与财富进入扩张。",
      en: "The current path lifts noticeably; career and wealth expand quickly.",
    },
    midTerm: {
      zh: "如果不修复恢复与关系, 3–5 年后回撤压力会集中出现。",
      en: "Without repairing recovery and ties, drawdown pressure clusters 3–5 years later.",
    },
    cost: {
      zh: "透支睡眠、家庭出场与关系带宽; 大机会不等于零代价。",
      en: "Draws down sleep, family presence, and relationship bandwidth. A big window isn't a free window.",
    },
    curveTransition: "gradual",
  },
  {
    id: "delay-risky-finance",
    title: { zh: "延迟一次高风险财务决定", en: "Delay one high-risk financial decision" },
    description: {
      zh: "把一次高杠杆决定推后 12–24 个月, 先建立信息与缓冲。",
      en: "Postpone a high-leverage decision 12–24 months to gather information and buffers.",
    },
    startAge: 34,
    dimensionEffects: { wealth: +4, family: +3, health: +2 },
    costEffects:      { career: -2 },
    shortTerm: {
      zh: "事业推进速度略慢, 但财富波动明显收窄。",
      en: "Career advance slows a step, but wealth volatility narrows visibly.",
    },
    midTerm: {
      zh: "家庭与健康曲线更稳, 现实路径波动收窄。",
      en: "Family and health hold steadier; the current path smooths out.",
    },
    cost: {
      zh: "可能错过一部分高收益机会, 需要接受“更稳但更慢”。",
      en: "You may miss a share of high-return windows — accept slower but steadier.",
    },
    curveTransition: "gradual",
  },
  {
    id: "boundary-earlier",
    title: { zh: "更早建立关系边界", en: "Set relationship boundaries earlier" },
    description: {
      zh: "在关系失衡累积之前, 就把边界与预期讲清楚。",
      en: "Name boundaries and expectations before imbalance accumulates.",
    },
    startAge: 28,
    dimensionEffects: { relationship: +6, health: +3, career: +2 },
    costEffects:      { family: -1 },
    shortTerm: { zh: "短期可能有摩擦, 但透支感明显下降。", en: "Short-term friction rises briefly; drain drops noticeably." },
    midTerm:   { zh: "关系与健康曲线更稳, 事业选择空间被保住。", en: "Relationship and health steady; career choice-space is preserved." },
    cost:      { zh: "某些关系会因为边界而重新排序, 这是代价, 不是失败。", en: "Some ties will reorder around the new boundary — that's a cost, not a failure." },
    curveTransition: "gradual",
  },
  {
    id: "reserve-family",
    title: { zh: "为家庭责任预留资源", en: "Reserve resources for family duty" },
    description: {
      zh: "把一部分时间、金钱与情绪带宽预留给家庭责任窗口。",
      en: "Reserve time, money, and emotional bandwidth for the family duty window.",
    },
    startAge: 38,
    dimensionEffects: { family: +7, relationship: +3, health: +2 },
    costEffects:      { career: -3, wealth: -2 },
    shortTerm: { zh: "事业与财富推进略慢, 家庭曲线明显更稳。", en: "Career and wealth slow slightly; family curve steadies clearly." },
    midTerm:   { zh: "家庭结构性风险下降, 现实路径少了一类突发下探。", en: "Structural family risk drops; a class of sudden dips falls away." },
    cost:      { zh: "预留意味着放弃一部分扩张机会。", en: "Reserving means passing on some expansion windows." },
    curveTransition: "gradual",
  },
  {
    id: "restore-body",
    title: { zh: "优先修复睡眠与体力", en: "Restore sleep and physical energy first" },
    description: {
      zh: "在扩张任何指标之前, 先把睡眠与体力修回可持续区间。",
      en: "Before expanding any indicator, first bring sleep and stamina back to a sustainable band.",
    },
    startAge: 32,
    dimensionEffects: { health: +8, career: +2, relationship: +2 },
    costEffects:      { wealth: -2 },
    shortTerm: { zh: "短期收入曲线略降, 疲惫感明显减轻。", en: "Income curve dips briefly; exhaustion eases visibly." },
    midTerm:   { zh: "事业与关系的可兑现度提高, 极端低点减少。", en: "Career and relationship realisability rise; extreme lows thin out." },
    cost:      { zh: "需要短期减速与调整节奏, 而不是继续加码。", en: "Requires slowing down and re-pacing — not stacking more on top." },
    curveTransition: "gradual",
  },
  {
    id: "leave-mismatch",
    title: { zh: "离开不匹配的环境", en: "Leave an environment that doesn't fit" },
    description: {
      zh: "识别到长期不匹配的环境后, 主动切换而不是硬扛。",
      en: "When an environment is durably ill-fitting, actively switch rather than power through.",
    },
    startAge: 33,
    dimensionEffects: { career: +6, relationship: +4, health: +3 },
    costEffects:      { wealth: -3, family: -2 },
    shortTerm: { zh: "过渡期收入与家庭稳定性会下降。", en: "Transition briefly drops income and family stability." },
    midTerm:   { zh: "事业与关系的长期斜率明显更好。", en: "Long-run slope for career and relationship visibly improves." },
    cost:      { zh: "重启成本真实存在, 需要给自己 6–12 个月缓冲。", en: "Restart cost is real — give yourself a 6–12 month buffer." },
    curveTransition: "gradual",
  },
  {
    id: "hold-baseline",
    title: { zh: "保持当前路径作为对照", en: "Hold current path as the control" },
    description: {
      zh: "什么都不改, 用来给其他实验做参照。",
      en: "Change nothing — use as the control for other experiments.",
    },
    startAge: 30,
    dimensionEffects: {},
    costEffects: {},
    shortTerm: { zh: "现实路径与实验分支重合。", en: "The current path and experiment branch overlap." },
    midTerm:   { zh: "适合先熟悉图表交互, 再做真正的实验。", en: "Good for learning the chart first, before running a real experiment." },
    cost:      { zh: "不做选择本身也是一种选择, 保持时间也会流走。", en: "Not choosing is a choice — time still passes." },
    curveTransition: "gradual",
  },
];

export function experimentById(id: string): LifeExperiment | null {
  return LIFE_EXPERIMENTS.find((e) => e.id === id) ?? null;
}
