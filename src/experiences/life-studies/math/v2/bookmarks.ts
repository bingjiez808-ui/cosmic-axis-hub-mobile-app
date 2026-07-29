import type { LifeMathPoint, MathBookmark } from "./types";

/**
 * 高亮辅助: 找到满足条件的连续年龄区间。
 */
function findRanges(
  points: LifeMathPoint[],
  test: (p: LifeMathPoint, i: number) => boolean,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start: number | null = null;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    if (test(p, i)) {
      if (start == null) start = p.age;
    } else if (start != null) {
      out.push([start, points[i - 1].age]);
      start = null;
    }
  }
  if (start != null && points.length > 0) out.push([start, points[points.length - 1].age]);
  return out;
}

export const MATH_BOOKMARKS: MathBookmark[] = [
  {
    id: "law-of-large-numbers",
    title:       { zh: "大数定律", en: "Law of Large Numbers" },
    summary:     { zh: "做得足够多, 偶然才会逐渐接近你的真实水平。", en: "Do it often enough and chance settles toward your real level." },
    explanation: {
      zh: "一次结果可能被运气盖过; 重复尝试、记录反馈并持续修正, 曲线才会稳定靠近你真正的能力。不要用一次失败给整条曲线下结论。",
      en: "A single outcome can be drowned out by luck. Repeat, log, and adjust — only then does the curve settle near your real capability. Don't judge the whole curve from one attempt.",
    },
    actionPrompt: { zh: "把这件事拆成 20 次可重复尝试, 记录每次的结果和反馈。", en: "Split this into 20 repeatable attempts and log each outcome with feedback." },
    relatedPattern: "repetition",
    highlight: (pts) =>
      findRanges(pts, (p, i) => {
        if (i < 3) return false;
        const window = pts.slice(Math.max(0, i - 3), i + 1).map((x) => x.currentPath);
        const spread = Math.max(...window) - Math.min(...window);
        return spread > 4 && spread < 12; // 小幅波动区间
      }),
  },
  {
    id: "survivorship",
    title:       { zh: "幸存者偏差", en: "Survivorship Bias" },
    summary:     { zh: "你看到的成功样本, 往往没有展示同时发生的失败。", en: "The success stories you see rarely show the failures beside them." },
    explanation: {
      zh: "别人的成功案例里, 那些退出者常常沉默。判断“他们能, 我也能”之前, 先想想你没听到的样本在哪里。",
      en: "In others' success cases, the drop-outs stay silent. Before assuming \"they could, so can I\", ask where the unheard samples went.",
    },
    actionPrompt: { zh: "扩大投入前, 主动去找 3 个失败或退出的样本对照。", en: "Before scaling up, actively look for 3 failed or exited cases to compare." },
    relatedPattern: "selection_bias",
    highlight: (pts) => findRanges(pts, (p) => (p.experimentPath ?? p.currentPath) - p.currentPath > 4),
  },
  {
    id: "murphy",
    title:       { zh: "墨菲定律", en: "Murphy's Law" },
    summary:     { zh: "可能出错的环节值得提前留缓冲。", en: "Whatever can go wrong deserves a buffer up front." },
    explanation: {
      zh: "不是坏事一定发生, 而是关键节点值得预留时间、金钱与备份方案。缓冲不是浪费, 是让你敢于承担的成本。",
      en: "Not a claim that bad things must happen — critical points deserve time, cash, and backups. Buffer isn't waste; it's what lets you take the swing.",
    },
    actionPrompt: { zh: "为下一次重要决定预留 20% 的时间与资金缓冲。", en: "Reserve a 20% time-and-cash buffer for your next important decision." },
    relatedPattern: "extreme",
    highlight: (pts) => findRanges(pts, (p) => p.currentPath < 42 || p.eventType === "risk"),
  },
  {
    id: "simpson",
    title:       { zh: "辛普森悖论", en: "Simpson's Paradox" },
    summary:     { zh: "总体趋势可能掩盖分组后的真相。", en: "An aggregate trend can hide the real story inside subgroups." },
    explanation: {
      zh: "一年“很差”里, 可能某个维度其实进步很大; 把整体拆成学业、事业、关系、家庭、财富、健康分别评估, 才不会用一句话盖住努力。",
      en: "A \"bad year\" can hide real progress inside one dimension. Split the year into study, career, relationship, family, wealth, health before you decide.",
    },
    actionPrompt: { zh: "把当前阶段拆到六个维度, 分别打分再看趋势。", en: "Split the current phase into the six dimensions, score each, then look at the trend." },
    relatedPattern: "contradiction",
    highlight: (pts) => findRanges(pts, (p) => Math.abs(p.currentPath - p.baseline) > 6),
  },
  {
    id: "regression-to-mean",
    title:       { zh: "回归均值", en: "Regression to the Mean" },
    summary:     { zh: "极端的好与坏通常不会永远持续。", en: "Extreme highs and lows rarely last forever." },
    explanation: {
      zh: "顺境时不必过度自信, 低谷也不等于永久身份。下一段大概率会靠近你的长期均值, 用长期视角做决定, 别被峰谷绑架。",
      en: "In peaks don't overreach; in troughs don't take temporary states as identity. The next stretch usually settles nearer to your long-run mean.",
    },
    actionPrompt: { zh: "在最近的高点或低点旁写下:“下一段更可能靠近平均值”。", en: "Beside the recent peak or trough, note: \"next stretch likely settles nearer the average\"." },
    relatedPattern: "extreme",
    highlight: (pts) =>
      findRanges(pts, (p, i) => {
        if (i === 0) return false;
        const prev = pts[i - 1];
        return Math.abs(prev.currentPath - prev.baseline) > 8 && Math.abs(p.currentPath - p.baseline) < Math.abs(prev.currentPath - prev.baseline);
      }),
  },
  {
    id: "opportunity-cost",
    title:       { zh: "机会成本", en: "Opportunity Cost" },
    summary:     { zh: "选一条路, 就意味着暂时放下另一条。", en: "Choosing one path means setting the others aside for now." },
    explanation: {
      zh: "看单条路径的收益不够, 还要看它挤掉了什么。把未来三个月的时间、金钱与恢复带宽同时比较, 才能看到代价。",
      en: "It's not enough to see one path's returns — you must see what it displaces. Compare the next three months of time, money, and recovery bandwidth.",
    },
    actionPrompt: { zh: "写下你选它之后, 未来三个月被占用的另外两件事。", en: "Write down two other things the next three months lose if you take this path." },
    relatedPattern: "tradeoff",
    highlight: (pts) => findRanges(pts, (p) => p.eventType === "crossing" || p.eventType === "branch"),
  },
  {
    id: "marginal",
    title:       { zh: "边际效应", en: "Diminishing Marginal Effect" },
    summary:     { zh: "同一件事继续加码, 每单位回报会越来越小。", en: "Piling more into the same lever brings smaller returns each time." },
    explanation: {
      zh: "一件事做到 70 分后, 再往上抬 10 分的成本, 常常大于换一件事从 30 分抬到 60 分。留意你正在给哪一维“重复加码”。",
      en: "After 70/100, moving up ten more points often costs more than lifting a different lever from 30 to 60. Notice which dimension you keep stacking on.",
    },
    actionPrompt: { zh: "找出最近被反复加码的那一维, 计算它的下一步成本。", en: "Find the dimension you keep stacking on, and estimate its next-step cost." },
    relatedPattern: "tradeoff",
    highlight: (pts) => findRanges(pts, (p) => p.currentPath > 70),
  },
  {
    id: "compounding",
    title:       { zh: "复利效应", en: "Compounding" },
    summary:     { zh: "小而稳定的积累会改变长期斜率。", en: "Small, steady accumulation reshapes the long-run slope." },
    explanation: {
      zh: "一次断裂不必重来, 只需重启; 只要长期斜率不变, 五年后的曲线就明显不同。选一个每天都能重复的小动作。",
      en: "A miss doesn't reset the run — just restart. If the long-run slope holds, five years compound into a visibly different curve. Pick one small daily action.",
    },
    actionPrompt: { zh: "选一个每天 15 分钟、失败后容易重启的最小动作。", en: "Pick one 15-min daily action that's easy to restart after a miss." },
    relatedPattern: "compound",
    highlight: (pts) => findRanges(pts, (p, i) => {
      if (i < 5) return false;
      return p.baseline - pts[i - 5].baseline > 2;
    }),
  },
];

export function bookmarkById(id: string): MathBookmark {
  return MATH_BOOKMARKS.find((b) => b.id === id) ?? MATH_BOOKMARKS[0];
}
