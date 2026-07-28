import { useEffect, useMemo, useState } from "react";

import { useLang } from "@/lib/i18n";
import { MainChartGate, type GateState } from "../MainChartGate";
import { GenerationMethod } from "../GenerationMethod";
import { AgeCrossSection, LifeLinesChart } from "./LifeLinesChart";
import { ChoiceLab } from "./ChoiceLab";
import { LifeYearModal } from "./LifeYearModal";
import {
  DOMAIN_COLORS,
  DOMAIN_KEYS,
  DOMAIN_LABELS,
  DOMAIN_PRESETS,
  type DomainKey,
} from "./domains";
import {
  ageSnapshot,
  buildDomainSeries,
  type ScenarioBranch,
} from "./LifeDomainModel";
import { seedForChart } from "./MathLifeModel";

export function MathRoom({
  gate,
  primaryBirthISO,
  primaryName,
  isSignedIn,
}: {
  gate: GateState;
  primaryBirthISO: string | null;
  primaryName: string | null;
  isSignedIn: boolean;
}) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const [mode, setMode] = useState<"demo" | "personal">(gate.kind === "ready" ? "personal" : "demo");
  const [focusAge, setFocusAge] = useState(30);
  const [visible, setVisible] = useState<Set<DomainKey>>(new Set(["career", "wealthRisk", "health"]));
  const [modalOpen, setModalOpen] = useState(false);
  const [branches, setBranches] = useState<Array<{ branch: ScenarioBranch; color: string }>>([]);
  const [modelOpen, setModelOpen] = useState(false);

  useEffect(() => {
    if (gate.kind !== "ready" && mode === "personal") setMode("demo");
  }, [gate.kind, mode]);

  const seed = mode === "personal" && gate.kind === "ready" ? seedForChart(primaryBirthISO) : "demo:v1";
  const result = useMemo(
    () => buildDomainSeries({ mode, seed, fromAge: 0, toAge: 80 }),
    [mode, seed],
  );
  const snapshot = useMemo(() => ageSnapshot(focusAge, result), [focusAge, result]);
  const currentScores = useMemo(() => {
    const out = {} as Record<DomainKey, number>;
    const idx = result.ages.indexOf(focusAge);
    for (const k of DOMAIN_KEYS) out[k] = result.domainSeries[k][idx] ?? 50;
    return out;
  }, [result, focusAge]);

  const applyPreset = (id: (typeof DOMAIN_PRESETS)[number]["id"]) => {
    const p = DOMAIN_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setVisible(new Set(p.domains));
  };

  const toggleDomain = (k: DomainKey) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8">
      {/* Opening */}
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5 md:p-7">
        <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
          {isZh ? "开篇" : "Start here"}
        </div>
        <h2 className="mt-2 font-serif text-2xl leading-snug text-amber-50 md:text-3xl">
          {isZh ? "人生函数" : "Life as a Function"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-amber-100/85 md:text-base">
          {isZh
            ? "不是让你给人生打分，而是看看在不同年龄，学业、事业、爱情、家庭、财富与健康如何彼此推动、彼此消耗。"
            : "Not a scorecard for your life — a look at how study, career, love, family, wealth and health push and drain each other at different ages."}
        </p>
        <div className="mt-3 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/80">
          {isZh
            ? "例如：事业指数上升，不代表一定升职；如果健康恢复与家庭缓冲同时降低，事业机会的可兑现度也会下降。"
            : "Example: a rising career index doesn't mean a promotion — if health recovery and family buffers both drop, that career window becomes harder to realise."}
        </div>
        <button
          type="button"
          onClick={() => setModelOpen((v) => !v)}
          className="mt-3 rounded-md border border-amber-400/20 px-3 py-1.5 text-xs text-amber-200/80 hover:bg-amber-300/10"
          aria-expanded={modelOpen}
        >
          {modelOpen
            ? (isZh ? "▾ 收起模型与计算说明" : "▾ Hide model & scoring notes")
            : (isZh ? "▸ 模型与计算说明（含公式与假设）" : "▸ Model & scoring notes (formulas + assumptions)")}
        </button>
        {modelOpen && (
          <div className="mt-3 space-y-2 rounded-md border border-amber-400/15 bg-[#0f0f1a]/70 p-3 text-[11px] leading-relaxed text-amber-100/80">
            <p>
              {isZh
                ? "分数为解释性指数 (0–100)，50 为中性。不是成功概率、医学指标或投资收益。"
                : "Scores are interpretive indices (0–100), 50 = neutral. Not success probabilities, medical readings, or investment returns."}
            </p>
            <p>
              {isZh
                ? "读取的确定性事实：八字四柱/十神/五行/大运流年、紫微十二宫与四化/大限、印度 Lahiri 本命与 Mahadasha/Antardasha、西方仅本命行星与相位（暂不提供年度行运加权）。"
                : "Deterministic facts read: bazi pillars/ten gods/five elements/DaYun, ziwei palaces & four transformations/limits, Vedic Lahiri natal + Mahadasha/Antardasha, Western natal aspects only (no yearly transit weighting yet)."}
            </p>
            <p>
              {isZh
                ? "综合分为加权和后再乘以“健康可兑现度因子”；健康偏低时会自动折损当年最高的两个领域。"
                : "Composite = weighted mean × a health realisability factor; low health automatically damps the year's top two domains."}
            </p>
            <p className="text-amber-200/60">
              {result.facts.disclosure[lang]}
            </p>
          </div>
        )}
      </section>

      <MainChartGate state={gate} />

      {/* Mode + preset row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">
          {isZh ? "模式" : "Mode"}
        </span>
        <div className="inline-flex overflow-hidden rounded-full border border-amber-400/30">
          <button type="button" data-testid="math-mode-demo" onClick={() => setMode("demo")}
            className={`min-h-9 px-3 text-xs ${mode === "demo" ? "bg-amber-300/20 text-amber-50" : "text-amber-200/70 hover:text-amber-100"}`}>
            {isZh ? "演示命盘" : "Demo chart"}
          </button>
          <button type="button" data-testid="math-mode-personal"
            onClick={() => gate.kind === "ready" && setMode("personal")}
            disabled={gate.kind !== "ready"}
            className={`min-h-9 border-l border-amber-400/20 px-3 text-xs ${mode === "personal" ? "bg-amber-300/20 text-amber-50" : "text-amber-200/70 hover:text-amber-100"} ${gate.kind !== "ready" ? "cursor-not-allowed opacity-60" : ""}`}>
            {isZh ? "个性化（我的主命盘）" : "Personalized (my chart)"}
          </button>
        </div>
        {mode === "personal" && primaryName && (
          <span className="text-[11px] text-amber-200/60">
            {isZh ? `种子：${primaryName}` : `Seed: ${primaryName}`}
          </span>
        )}
        {!isSignedIn && (
          <span className="text-[10px] uppercase tracking-[0.24em] text-amber-200/50">
            {isZh ? "未登录 · 不会写入账户" : "Signed out · nothing is saved"}
          </span>
        )}
      </div>

      {/* Chart */}
      <section className="grid grid-cols-1 gap-4">
        <LifeLinesChart
          result={result}
          visibleDomains={visible}
          focusAge={focusAge}
          onFocusAge={setFocusAge}
          branches={branches}
          ariaLabel={isZh ? "人生七线图" : "Seven life lines chart"}
          lang={lang}
        />

        {/* Domain toggles */}
        <div className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">
              {isZh ? "选择要看的领域" : "Choose which domains to show"}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DOMAIN_PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => applyPreset(p.id)} data-testid={`life-preset-${p.id}`}
                  className="rounded-full border border-amber-400/25 px-2.5 py-1 text-[11px] text-amber-100 hover:bg-amber-300/10">
                  {p.label[lang]}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-7">
            {DOMAIN_KEYS.map((k) => {
              const on = visible.has(k);
              return (
                <button key={k} type="button" onClick={() => toggleDomain(k)}
                  data-testid={`life-toggle-${k}`}
                  aria-pressed={on}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] transition ${
                    on ? "border-amber-300/60 bg-amber-300/10 text-amber-50"
                       : "border-amber-400/15 text-amber-200/70 hover:text-amber-100"
                  }`}>
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: DOMAIN_COLORS[k] }} />
                  <span className="truncate">{DOMAIN_LABELS[k][lang]}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3 text-[11px] text-amber-200/70">
            <label className="flex flex-1 items-center gap-2">
              <span className="w-16">{isZh ? "年龄游标" : "Age cursor"}</span>
              <input
                type="range" min={result.ages[0] ?? 0} max={result.ages[result.ages.length - 1] ?? 80} step={1}
                value={focusAge}
                onChange={(e) => setFocusAge(Number(e.target.value))}
                data-testid="life-age-cursor"
                className="h-1 flex-1 accent-amber-300"
                suppressHydrationWarning
              />
              <span className="w-8 text-right font-mono text-amber-100">{focusAge}</span>
            </label>
            <button type="button" onClick={() => setModalOpen(true)}
              data-testid="life-open-year"
              className="rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-[11px] text-amber-50 hover:bg-amber-300/20">
              {isZh ? "打开这一年" : "Open this year"}
            </button>
          </div>
        </div>
      </section>

      {/* Age cross-section */}
      <section className="grid grid-cols-1 gap-4 rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5 md:grid-cols-[280px_minmax(0,1fr)]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">
            {isZh ? "这一年的生活横截面" : "Life cross-section at this age"}
          </div>
          <div className="mt-3 flex justify-center">
            <AgeCrossSection scores={currentScores} ariaLabel={isZh ? "七领域雷达" : "Seven-domain radar"} lang={lang} />
          </div>
        </div>
        <div>
          <h3 className="font-serif text-lg text-amber-50">
            {isZh ? `${focusAge} 岁 综合指数 ${snapshot?.composite.toFixed(1) ?? "-"}` : `Age ${focusAge} · composite ${snapshot?.composite.toFixed(1) ?? "-"}`}
          </h3>
          {snapshot && (
            <>
              <p className="mt-1 text-xs text-amber-200/70">
                {isZh ? "最值得投入：" : "Best-fit domain: "}
                <span className="text-amber-100">{DOMAIN_LABELS[snapshot.dominantDomain][lang]}</span>
                {isZh ? " / 最需防摩擦：" : " / Watch for friction in: "}
                <span className="text-amber-100">{DOMAIN_LABELS[snapshot.topFriction][lang]}</span>
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-1.5 text-[12px] sm:grid-cols-2">
                {DOMAIN_KEYS.map((k) => {
                  const d = snapshot.domains[k];
                  return (
                    <li key={k} className="flex items-center gap-2">
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: DOMAIN_COLORS[k] }} />
                      <span className="w-24 shrink-0 text-amber-100/80">{DOMAIN_LABELS[k][lang]}</span>
                      <span className="font-mono text-amber-200">{d.score.toFixed(0)}</span>
                      <span className="text-[10px] text-amber-200/50">
                        [{d.band[0].toFixed(0)}, {d.band[1].toFixed(0)}]
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-[10px] text-amber-200/60">
                {isZh
                  ? `数据覆盖 ${snapshot.dataCoverage}。分数为解释性指数，不预测事件、不诊断疾病、不构成投资建议。`
                  : `Data coverage ${snapshot.dataCoverage}. Interpretive indices only — not event forecasts, diagnoses, or investment advice.`}
              </p>
            </>
          )}
        </div>
      </section>

      <ChoiceLab focusAge={focusAge} onBranchesChange={setBranches} lang={lang} />

      <LifeYearModal
        snapshot={modalOpen ? snapshot : null}
        onClose={() => setModalOpen(false)}
        onOpenLab={() => { /* scroll into ChoiceLab */
          if (typeof document !== "undefined") {
            document.querySelector('[data-testid="choice-lab-run"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }}
        lang={lang}
      />

      <GenerationMethod />
    </div>
  );
}
