import {
  buildDomainSeries,
  type BuildDomainResult,
} from "../LifeDomainModel";
import type { DomainKey } from "../domains";
import {
  LIFE_DIMENSIONS,
  type LifeDimensionKey,
  type LifeExperiment,
  type LifeMathPoint,
} from "./types";

/** 命盘 domain → v2 dimension 的映射 (relationship 合并 love + social)。 */
function toDimensions(source: BuildDomainResult, index: number): Record<LifeDimensionKey, number> {
  const g = (k: DomainKey) => source.domainSeries[k][index] ?? 50;
  return {
    study:        g("study"),
    career:       g("career"),
    relationship: (g("love") * 0.6 + g("social") * 0.4),
    family:       g("family"),
    wealth:       g("wealthRisk"),
    health:       g("health"),
  };
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** 滚动均值, 拿到 "生命基线" —— 消除周期性波动的长期趋势线。 */
function smoothBaseline(series: number[], window = 9): number[] {
  const half = Math.floor(window / 2);
  return series.map((_, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(series.length - 1, i + half); j += 1) {
      sum += series[j];
      n += 1;
    }
    return sum / n;
  });
}

/** 渐进增长因子: 从 startAge 开始经过 5 年逼近 1。 */
function ramp(age: number, startAge: number): number {
  if (age < startAge) return 0;
  const t = Math.min(1, (age - startAge) / 5);
  // easeOutCubic
  return 1 - Math.pow(1 - t, 3);
}

export type ComputeInput = {
  mode: "demo" | "personal";
  seed: string;
  experiment: LifeExperiment | null;
};

export type ComputeResult = {
  points: LifeMathPoint[];
  keyEvents: number[]; // ages, at most maxEvents
};

/**
 * 输出 [0, 80] 逐岁数据点。同一 (mode, seed, experiment.id) 走内存缓存。
 */
const memo = new Map<string, ComputeResult>();

export function computeLifeMath(input: ComputeInput, maxEvents = 5): ComputeResult {
  const cacheKey = `${input.mode}::${input.seed}::${input.experiment?.id ?? "none"}::${maxEvents}`;
  const cached = memo.get(cacheKey);
  if (cached) return cached;

  const source = buildDomainSeries({ mode: input.mode, seed: input.seed, fromAge: 0, toAge: 80 });
  const ages = source.ages;
  const currentPath = source.compositeSeries.slice();
  const baseline = smoothBaseline(currentPath, 11);

  const exp = input.experiment;
  const dimSeries: Record<LifeDimensionKey, number[]> = {} as never;
  for (const d of LIFE_DIMENSIONS) dimSeries[d] = new Array(ages.length).fill(50);

  const experimentPath = new Array<number>(ages.length);
  for (let i = 0; i < ages.length; i += 1) {
    const age = ages[i];
    const dims = toDimensions(source, i);

    if (exp) {
      const r = ramp(age, exp.startAge);
      let sumDelta = 0;
      let weight = 0;
      for (const d of LIFE_DIMENSIONS) {
        const eff = (exp.dimensionEffects[d] ?? 0) + (exp.costEffects[d] ?? 0);
        const nextVal = clamp(dims[d] + eff * r);
        dims[d] = nextVal;
        sumDelta += eff * r;
        weight += Math.abs(eff);
      }
      // 综合影响: 稍微弱化累加, 避免瞬间跳变
      const scale = weight > 0 ? 0.55 : 0;
      experimentPath[i] = clamp(currentPath[i] + sumDelta * scale);
    } else {
      experimentPath[i] = currentPath[i];
    }
    for (const d of LIFE_DIMENSIONS) dimSeries[d][i] = dims[d];
  }

  // 关键节点识别 (peak/low/crossing/risk/branch)
  const rawEvents: Array<{ age: number; kind: LifeMathPoint["eventType"]; hint: { zh: string; en: string } }> = [];
  for (let i = 2; i < ages.length - 2; i += 1) {
    const a = ages[i];
    const c = currentPath[i];
    const cPrev = currentPath[i - 2];
    const cNext = currentPath[i + 2];
    const b = baseline[i];
    if (c > cPrev && c > cNext && c - b > 4) {
      rawEvents.push({ age: a, kind: "peak", hint: { zh: `${a} 岁附近 · 资源扩张, 别把顺势误当无限。`, en: `Around age ${a} · resources expand — don't mistake the wave for a permit to keep stacking.` } });
    } else if (c < cPrev && c < cNext && b - c > 4) {
      rawEvents.push({ age: a, kind: "low", hint: { zh: `${a} 岁附近 · 短期低点, 先保恢复, 再做重要决定。`, en: `Around age ${a} · a short trough — protect recovery before large decisions.` } });
    } else if ((currentPath[i - 1] - baseline[i - 1]) * (c - b) < 0 && Math.abs(c - b) > 1) {
      rawEvents.push({ age: a, kind: "crossing", hint: { zh: `${a} 岁附近 · 与基线交叉, 节奏发生切换。`, en: `Around age ${a} · crosses baseline — the rhythm switches.` } });
    } else if (c - cPrev < -6) {
      rawEvents.push({ age: a, kind: "risk", hint: { zh: `${a} 岁附近 · 短期波动放大, 注意缓冲。`, en: `Around age ${a} · short-term volatility widens — mind the buffer.` } });
    } else if (exp && Math.abs(experimentPath[i] - currentPath[i]) - Math.abs(experimentPath[i - 1] - currentPath[i - 1]) > 1.5) {
      rawEvents.push({ age: a, kind: "branch", hint: { zh: `${a} 岁附近 · 实验分支明显偏离现实路径。`, en: `Around age ${a} · the experiment branch clearly diverges from the current path.` } });
    }
  }

  // 稀疏化: 相邻节点至少间隔 4 岁; 取幅度最大的 maxEvents 个
  const sorted = rawEvents.sort((a, b) => Math.abs(currentPath[ages.indexOf(b.age)] - baseline[ages.indexOf(b.age)]) - Math.abs(currentPath[ages.indexOf(a.age)] - baseline[ages.indexOf(a.age)]));
  const picked: typeof rawEvents = [];
  for (const ev of sorted) {
    if (picked.every((p) => Math.abs(p.age - ev.age) >= 4)) picked.push(ev);
    if (picked.length >= maxEvents) break;
  }

  const points: LifeMathPoint[] = ages.map((age, i) => {
    const ev = picked.find((p) => p.age === age);
    return {
      age,
      baseline: Math.round(baseline[i] * 10) / 10,
      currentPath: Math.round(currentPath[i] * 10) / 10,
      experimentPath: Math.round(experimentPath[i] * 10) / 10,
      dimensions: {
        study:        Math.round(dimSeries.study[i]),
        career:       Math.round(dimSeries.career[i]),
        relationship: Math.round(dimSeries.relationship[i]),
        family:       Math.round(dimSeries.family[i]),
        wealth:       Math.round(dimSeries.wealth[i]),
        health:       Math.round(dimSeries.health[i]),
      },
      eventType: ev?.kind,
      shortHint: ev?.hint,
    };
  });

  const keyEvents = picked.map((p) => p.age).sort((a, b) => a - b);
  const result: ComputeResult = { points, keyEvents };
  memo.set(cacheKey, result);
  return result;
}
