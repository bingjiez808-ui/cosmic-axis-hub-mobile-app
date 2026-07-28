import { useMemo, useState } from "react";

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

const BRANCH_COLORS = ["#22d3ee", "#f472b6", "#fbbf24"];

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
  onBranchesChange,
  lang,
}: {
  focusAge: number;
  onBranchesChange: (b: Array<{ branch: ScenarioBranch; color: string }>) => void;
  lang: "zh" | "en";
}) {
  const isZh = lang === "zh";
  const [choice, setChoice] = useState<ScenarioChoiceKind>("career");
  const branches = useMemo(() => scenarioBranches(focusAge, choice, 5), [focusAge, choice]);

  const activate = () => onBranchesChange(branches.map((b, i) => ({ branch: b, color: BRANCH_COLORS[i % 3] })));
  const reset = () => onBranchesChange([]);

  return (
    <section className="rounded-2xl border border-cyan-400/20 bg-[#0b0b14]/70 p-5">
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
              ? "以下分支来自固定规则计算，只做资源与压力的比较，不预测哪条一定成功，也不构成投资/医疗/婚姻建议。"
              : "Branches come from fixed rules — a resource/pressure comparison, not a success forecast, and not investment/medical/relationship advice."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={activate} data-testid="choice-lab-run"
            className="rounded-full border border-cyan-300/50 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-300/20">
            {isZh ? "叠加分支到主图" : "Overlay on chart"}
          </button>
          <button type="button" onClick={reset}
            className="rounded-full border border-amber-400/25 px-3 py-1.5 text-xs text-amber-200/80 hover:bg-amber-300/10">
            {isZh ? "清除" : "Clear"}
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
        {branches.map((b, i) => (
          <div key={b.id} className="rounded-xl border border-amber-400/15 bg-[#0f0f1a]/70 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-amber-50">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: BRANCH_COLORS[i % 3] }} />
                {b.label[lang]}
              </div>
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
          </div>
        ))}
      </div>
    </section>
  );
}
