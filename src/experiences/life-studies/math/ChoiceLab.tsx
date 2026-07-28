import { useEffect, useMemo, useState } from "react";

import { DOMAIN_COLORS, DOMAIN_LABELS, type DomainKey } from "./domains";
import {
  scenarioBranches,
  type ScenarioBranch,
  type ScenarioChoiceKind,
} from "./LifeDomainModel";

const CHOICE_LABELS: Record<ScenarioChoiceKind, { zh: string; en: string }> = {
  career: { zh: "事业方向", en: "Career direction" },
  study:  { zh: "学习安排", en: "Study plan" },
  love:   { zh: "亲密关系", en: "Intimate relationship" },
  family: { zh: "家庭责任", en: "Family duty" },
  wealth: { zh: "财富配置", en: "Wealth allocation" },
};

const CHOICE_ORDER: ScenarioChoiceKind[] = ["career", "study", "love", "family", "wealth"];

export const BRANCH_COLORS = ["#22d3ee", "#f472b6", "#fbbf24"];

const REV_LABEL = {
  high:   { zh: "可逆性高", en: "highly reversible" },
  medium: { zh: "可逆性中等", en: "medium reversibility" },
  low:    { zh: "可逆性低", en: "low reversibility" },
} as const;
const COST_LABEL = {
  low:    { zh: "资源占用低", en: "low resource cost" },
  medium: { zh: "资源占用中等", en: "medium cost" },
  high:   { zh: "资源占用高", en: "high resource cost" },
} as const;
const PRESSURE_LABEL = {
  low:    { zh: "压力低", en: "low pressure" },
  medium: { zh: "压力中等", en: "medium pressure" },
  high:   { zh: "压力高", en: "high pressure" },
} as const;
const CYCLE_LABEL = {
  aligned: { zh: "与当前周期契合", en: "aligned with current cycle" },
  neutral: { zh: "与当前周期中性", en: "neutral with current cycle" },
  against: { zh: "与当前周期相逆", en: "against current cycle" },
} as const;

export function ChoiceLab({
  focusAge,
  activeBranchCount,
  onBranchesChange,
  onCompareRequest,
  lang,
}: {
  focusAge: number;
  activeBranchCount: number;
  onBranchesChange: (b: Array<{ branch: ScenarioBranch; color: string }>) => void;
  onCompareRequest?: () => void;
  lang: "zh" | "en";
}) {
  const isZh = lang === "zh";
  const [choice, setChoice] = useState<ScenarioChoiceKind>("career");
  const branches = useMemo(() => scenarioBranches(focusAge, choice, 5), [focusAge, choice]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Reset selection when choice or age changes.
  useEffect(() => {
    setSelectedIds([]);
    onBranchesChange([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice, focusAge]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const runCompare = () => {
    if (selectedIds.length === 0) return;
    const active = branches
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => selectedIds.includes(b.id))
      .map(({ b, i }) => ({ branch: b, color: BRANCH_COLORS[i % 3] }));
    onBranchesChange(active);
    onCompareRequest?.();
  };

  const clearCompare = () => {
    setSelectedIds([]);
    onBranchesChange([]);
  };

  const runLabel = activeBranchCount > 0
    ? (isZh ? `已显示在主图 (${activeBranchCount})` : `On chart (${activeBranchCount})`)
    : (isZh ? "在主图比较" : "Compare on chart");

  return (
    <section id="choice-lab" className="rounded-2xl border border-cyan-400/20 bg-[#0b0b14]/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">
            {isZh ? "选择实验室" : "Choice Lab"}
          </div>
          <h3 className="mt-1 font-serif text-lg text-amber-50">
            {isZh ? `如果在 ${focusAge} 岁做出不同选择…` : `If at age ${focusAge} you chose differently…`}
          </h3>
          <p className="mt-1 text-[11px] text-amber-200/60">
            {isZh
              ? "先勾选 1–3 条方案（勾选后卡片会高亮），再点“在主图比较”把它们叠加到人生七线图上。分支来自固定规则，只做资源与压力的情景比较，不是命运预测。"
              : "Tick 1–3 options first (selected cards highlight), then press \"Compare on chart\" to overlay them on the seven-line chart. Branches come from fixed rules — a resource/pressure comparison, not a fate prediction."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runCompare}
            disabled={selectedIds.length === 0}
            data-testid="choice-lab-run"
            className={`rounded-full border px-3 py-1.5 text-xs ${
              selectedIds.length === 0
                ? "cursor-not-allowed border-cyan-300/20 bg-cyan-300/5 text-cyan-200/40"
                : "border-cyan-300/50 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20"
            }`}
          >
            {runLabel}
          </button>
          <button
            type="button"
            onClick={clearCompare}
            data-testid="choice-lab-clear"
            className="rounded-full border border-amber-400/25 px-3 py-1.5 text-xs text-amber-200/80 hover:bg-amber-300/10"
          >
            {isZh ? "清除分支" : "Clear branches"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHOICE_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setChoice(c)}
            data-testid={`choice-lab-kind-${c}`}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              choice === c
                ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-50"
                : "border-amber-400/25 text-amber-200/70 hover:text-amber-100"
            }`}
          >
            {CHOICE_LABELS[c][lang]}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {branches.map((b, i) => {
          const isSelected = selectedIds.includes(b.id);
          const color = BRANCH_COLORS[i % 3];
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => toggleSelect(b.id)}
              data-testid={`choice-lab-branch-${b.id}`}
              aria-pressed={isSelected}
              className={`group text-left rounded-xl border p-3 transition ${
                isSelected
                  ? "border-cyan-300/70 bg-cyan-300/10 shadow-[0_0_0_1px_rgba(103,232,249,0.35)]"
                  : "border-amber-400/15 bg-[#0f0f1a]/70 hover:border-amber-400/30"
              }`}
              style={isSelected ? { borderColor: color, boxShadow: `0 0 0 1px ${color}66` } : undefined}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-amber-50">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {b.label[lang]}
                </div>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-[10px] ${
                    isSelected ? "border-cyan-300/60 text-cyan-100" : "border-amber-400/20 text-amber-200/50"
                  }`}
                >
                  {isSelected ? (isZh ? "已加入比较" : "In comparison") : (isZh ? "点击选中" : "Tap to select")}
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-[11px] text-amber-200/80">
                <li>· {REV_LABEL[b.reversibility][lang]}</li>
                <li>· {COST_LABEL[b.resourceCost][lang]}</li>
                <li>· {PRESSURE_LABEL[b.pressure][lang]}</li>
                <li>· {CYCLE_LABEL[b.cycleFit][lang]}</li>
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-amber-100/80">{b.note[lang]}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(b.perYearDeltas[0] ?? {}).map(([dk, dv]) => (
                  <span
                    key={dk}
                    className="rounded-full border px-1.5 py-0.5 text-[10px]"
                    style={{
                      borderColor: `${DOMAIN_COLORS[dk as DomainKey]}55`,
                      color: DOMAIN_COLORS[dk as DomainKey],
                    }}
                  >
                    {DOMAIN_LABELS[dk as DomainKey][lang]} {dv! > 0 ? "+" : ""}{dv?.toFixed(1)}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] text-amber-200/50">
        {isZh
          ? "这是资源占用与压力的情景比较，不是结果保证；不构成投资 / 医疗 / 婚姻建议。"
          : "A resource/pressure scenario comparison, not a guarantee of outcomes; not investment, medical, or relationship advice."}
      </p>
    </section>
  );
}
