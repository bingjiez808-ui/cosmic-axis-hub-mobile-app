import { buildDomainSeries } from "../LifeDomainModel";
import type { DomainKey } from "../domains";
import {
  DIMENSION_LABELS,
  LIFE_DIMENSIONS,
  composeFromDimensions,
  type LifeDimensionKey,
  type LifeExperiment,
  type LifeMathPoint,
} from "./types";

/** LifeDomainModel domain → v2 dimension. `wealthRisk` renamed to `wealth`. */
const DOMAIN_TO_DIM: Record<DomainKey, LifeDimensionKey> = {
  study: "study",
  career: "career",
  love: "love",
  family: "family",
  social: "social",
  wealthRisk: "wealth",
  health: "health",
};

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/** Rolling mean over a symmetric window. */
function smooth(series: number[], window = 11): number[] {
  const half = Math.floor(window / 2);
  return series.map((_, i) => {
    let sum = 0, n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(series.length - 1, i + half); j += 1) {
      sum += series[j]; n += 1;
    }
    return sum / n;
  });
}

/** Ease-out cubic ramp for gradual experiment onset. */
function ramp(age: number, startAge: number): number {
  if (age < startAge) return 0;
  const t = Math.min(1, (age - startAge) / 5);
  return 1 - Math.pow(1 - t, 3);
}

export type ComputeInput = {
  mode: "demo" | "personal";
  seed: string;
  experiment: LifeExperiment | null;
};

export type ComputeResult = {
  points: LifeMathPoint[];
  keyEvents: number[];
};

const memo = new Map<string, ComputeResult>();

export function computeLifeMath(input: ComputeInput, maxEvents = 5): ComputeResult {
  const key = `${input.mode}::${input.seed}::${input.experiment?.id ?? "none"}::${maxEvents}`;
  const cached = memo.get(key);
  if (cached) return cached;

  const source = buildDomainSeries({ mode: input.mode, seed: input.seed, fromAge: 0, toAge: 80 });
  const ages = source.ages;

  // 1. Seven dimension raw series, aligned with LifeDomainModel.
  const dimRaw: Record<LifeDimensionKey, number[]> = {
    study: [], career: [], love: [], family: [], social: [], wealth: [], health: [],
  };
  for (const domain of Object.keys(source.domainSeries) as DomainKey[]) {
    const dim = DOMAIN_TO_DIM[domain];
    dimRaw[dim] = source.domainSeries[domain].slice();
  }

  // 2. Per-dim long-run baseline (11y rolling mean).
  const dimBaseline: Record<LifeDimensionKey, number[]> = {} as never;
  for (const d of LIFE_DIMENSIONS) dimBaseline[d] = smooth(dimRaw[d], 11);

  // 3. Experiment: apply per-dim effect to build experiment dim series.
  const exp = input.experiment;
  const dimExp: Record<LifeDimensionKey, number[]> = {} as never;
  for (const d of LIFE_DIMENSIONS) dimExp[d] = new Array(ages.length);
  for (let i = 0; i < ages.length; i += 1) {
    const age = ages[i];
    const r = exp ? ramp(age, exp.startAge) : 0;
    for (const d of LIFE_DIMENSIONS) {
      const eff = exp ? ((exp.dimensionEffects[d] ?? 0) + (exp.costEffects[d] ?? 0)) : 0;
      dimExp[d][i] = clamp(dimRaw[d][i] + eff * r);
    }
  }

  // 4. Composite series: baseline (long-run) / currentPath (raw dims) / experimentPath (exp dims).
  const compositeBaseline = new Array<number>(ages.length);
  const compositeCurrent  = new Array<number>(ages.length);
  const compositeExp      = new Array<number>(ages.length);
  for (let i = 0; i < ages.length; i += 1) {
    const bl: Record<LifeDimensionKey, number> = {} as never;
    const cr: Record<LifeDimensionKey, number> = {} as never;
    const ex: Record<LifeDimensionKey, number> = {} as never;
    for (const d of LIFE_DIMENSIONS) {
      bl[d] = dimBaseline[d][i];
      cr[d] = dimRaw[d][i];
      ex[d] = dimExp[d][i];
    }
    compositeBaseline[i] = composeFromDimensions(bl);
    compositeCurrent[i]  = composeFromDimensions(cr);
    compositeExp[i]      = composeFromDimensions(ex);
  }

  // 5. Deterministic event detection across dimensions + composite.
  type RawEvent = {
    age: number;
    kind: LifeMathPoint["eventType"];
    dims: LifeDimensionKey[];
    severity: number;
    hint: { zh: string; en: string };
    caution?: { zh: string; en: string };
  };
  const events: RawEvent[] = [];
  const dimShortZh = (d: LifeDimensionKey) => DIMENSION_LABELS[d].zh;
  const dimShortEn = (d: LifeDimensionKey) => DIMENSION_LABELS[d].en;

  for (let i = 2; i < ages.length - 2; i += 1) {
    const age = ages[i];

    // Per-dim peak / low.
    for (const d of LIFE_DIMENSIONS) {
      const v = dimRaw[d][i];
      const vP = dimRaw[d][i - 2];
      const vN = dimRaw[d][i + 2];
      const b = dimBaseline[d][i];
      if (v > vP && v > vN && v - b > 5) {
        events.push({
          age, kind: "peak", dims: [d], severity: Math.abs(v - b),
          hint: {
            zh: `${age} 岁附近 · ${dimShortZh(d)}进入相对高点, 资源与选择更集中。`,
            en: `Around age ${age} · ${dimShortEn(d)} enters a relative high — resources and choices concentrate.`,
          },
          caution: {
            zh: "扩张前先看健康与家庭是否同步承压, 高点不是无限窗口。",
            en: "Before scaling, check whether health and family are absorbing the same load — a peak isn't an unlimited window.",
          },
        });
      } else if (v < vP && v < vN && b - v > 5) {
        events.push({
          age, kind: "low", dims: [d], severity: Math.abs(b - v),
          hint: {
            zh: `${age} 岁附近 · ${dimShortZh(d)}出现短期低点, 先保恢复再做重要决定。`,
            en: `Around age ${age} · ${dimShortEn(d)} dips briefly — protect recovery before major decisions.`,
          },
        });
      }
    }

    // Career + Wealth resonance.
    if (dimRaw.career[i] - dimBaseline.career[i] > 4 && dimRaw.wealth[i] - dimBaseline.wealth[i] > 4) {
      events.push({
        age, kind: "resonance", dims: ["career", "wealth"], severity: 6,
        hint: {
          zh: `${age} 岁附近 · 事业与财富共振, 资源与行动机会更集中。`,
          en: `Around age ${age} · career and wealth resonate — resources and action windows cluster.`,
        },
        caution: {
          zh: "扩大投入前, 也要查看健康与家庭责任是否同步承压。",
          en: "Before scaling investment, check whether health and family duty are under matching load.",
        },
      });
    }
    // Family up + Career down = tension.
    if (dimRaw.family[i] - dimBaseline.family[i] > 3 && dimRaw.career[i] - dimBaseline.career[i] < -3) {
      events.push({
        age, kind: "tension", dims: ["family", "career"], severity: 5,
        hint: {
          zh: `${age} 岁附近 · 家庭责任上升, 事业推进节奏短暂放缓。`,
          en: `Around age ${age} · family duty rises while career pace briefly slows.`,
        },
        caution: {
          zh: "这更像资源重新分配, 不等于事业失败。",
          en: "This looks more like resource reallocation than career failure.",
        },
      });
    }
    // Health recovery crossing baseline from below.
    if (dimRaw.health[i - 1] < dimBaseline.health[i - 1] && dimRaw.health[i] >= dimBaseline.health[i]) {
      events.push({
        age, kind: "crossing", dims: ["health"], severity: 4,
        hint: {
          zh: `${age} 岁附近 · 健康曲线回到长期基准, 恢复窗口正在打开。`,
          en: `Around age ${age} · health returns to its long-run baseline — a recovery window is opening.`,
        },
        caution: {
          zh: "恢复不是立即回到过去的负荷, 而是重新建立可持续节奏。",
          en: "Recovery isn't returning to old load — it's rebuilding a sustainable pace.",
        },
      });
    }
    // Experiment branch divergence.
    if (exp && Math.abs(compositeExp[i] - compositeCurrent[i]) - Math.abs(compositeExp[i - 1] - compositeCurrent[i - 1]) > 1.2) {
      events.push({
        age, kind: "branch", dims: [], severity: Math.abs(compositeExp[i] - compositeCurrent[i]),
        hint: {
          zh: `${age} 岁附近 · 实验分支明显偏离现实路径。`,
          en: `Around age ${age} · the experiment branch clearly diverges from the current path.`,
        },
      });
    }
  }

  // Sparsify: at least 4y apart, take top by severity.
  events.sort((a, b) => b.severity - a.severity);
  const picked: RawEvent[] = [];
  for (const e of events) {
    if (picked.every((p) => Math.abs(p.age - e.age) >= 4)) picked.push(e);
    if (picked.length >= maxEvents) break;
  }
  const byAge = new Map(picked.map((e) => [e.age, e]));

  // 6. Assemble points.
  const points: LifeMathPoint[] = ages.map((age, i) => {
    const dims: Record<LifeDimensionKey, number> = {} as never;
    const dimsBaseline: Record<LifeDimensionKey, number> = {} as never;
    const dimsExp: Record<LifeDimensionKey, number> = {} as never;
    for (const d of LIFE_DIMENSIONS) {
      dims[d]         = Math.round(dimRaw[d][i]);
      dimsBaseline[d] = Math.round(dimBaseline[d][i] * 10) / 10;
      dimsExp[d]      = Math.round(dimExp[d][i]);
    }
    const ev = byAge.get(age);
    return {
      age,
      dimensions: dims,
      dimensionBaselines: dimsBaseline,
      dimensionsExperiment: dimsExp,
      baseline: Math.round(compositeBaseline[i] * 10) / 10,
      currentPath: Math.round(compositeCurrent[i] * 10) / 10,
      experimentPath: Math.round(compositeExp[i] * 10) / 10,
      eventType: ev?.kind,
      eventDimensions: ev?.dims,
      shortHint: ev?.hint,
      caution: ev?.caution,
    };
  });

  const result: ComputeResult = {
    points,
    keyEvents: picked.map((p) => p.age).sort((a, b) => a - b),
  };
  memo.set(key, result);
  return result;
}
