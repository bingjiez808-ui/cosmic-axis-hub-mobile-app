import { useEffect, useMemo, useState } from "react";

import { useLang } from "@/lib/i18n";
import { MainChartGate, type GateState } from "../MainChartGate";
import { GenerationMethod } from "../GenerationMethod";
import { LifeFunctionChart, SensitivityBars } from "./LifeFunctionChart";
import {
  DEFAULT_SCENARIO,
  VARIABLE_LABELS,
  buildLifeSeries,
  curatorSummary,
  seedForChart,
  sensitivityAt,
  type MathScenario,
  type VariableKey,
} from "./MathLifeModel";

/**
 * Math-room interactive body. All state is local; no writes hit the
 * backend in this phase. Personalization only changes the seed used
 * by the model — chart facts other than birthdate are not consumed
 * here, and no AI is called.
 */
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
  const [scenario, setScenario] = useState<MathScenario>(DEFAULT_SCENARIO);
  const [focusAge, setFocusAge] = useState(30);
  const [mode, setMode] = useState<"demo" | "personal">(gate.kind === "ready" ? "personal" : "demo");

  useEffect(() => {
    if (gate.kind !== "ready" && mode === "personal") setMode("demo");
  }, [gate.kind, mode]);

  const seed =
    mode === "personal" && gate.kind === "ready"
      ? seedForChart(primaryBirthISO)
      : "demo";

  const series = useMemo(
    () => buildLifeSeries({ seed, fromAge: 0, toAge: 80, scenario }),
    [seed, scenario],
  );
  const sensitivity = useMemo(
    () => sensitivityAt(focusAge, seed, scenario),
    [focusAge, seed, scenario],
  );
  const focus = series.find((p) => p.age === focusAge);
  const summary = curatorSummary(focusAge, series, sensitivity, lang);

  const updateVar = (k: VariableKey, v: number) =>
    setScenario((s) => ({ ...s, variables: { ...s.variables, [k]: v } }));

  return (
    <div className="grid grid-cols-1 gap-8">
      {/* Opening question + formula */}
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5 md:p-7">
        <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
          {isZh ? "开篇问题" : "Opening question"}
        </div>
        <p className="mt-2 font-serif text-lg leading-snug text-amber-50 md:text-2xl">
          {isZh
            ? "如果人生不是一条命定曲线，而是基线、周期、选择与噪声共同写出的函数呢？"
            : "What if a life isn't a fixed curve, but a function of baseline, cycles, choices and noise?"}
        </p>

        <div className="mt-5 rounded-xl border border-amber-400/15 bg-[#141422]/60 p-4">
          <div className="overflow-x-auto">
            <div className="whitespace-nowrap font-mono text-lg text-amber-100 md:text-xl">
              Y(t) = B + C(t) + Σ wᵢ · Xᵢ + ε
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-xs text-amber-100/75 sm:grid-cols-2">
            <div>
              <dt className="text-amber-200/80">B</dt>
              <dd>{isZh ? "较稳定的性格与资源基线" : "Relatively stable personality & resource baseline"}</dd>
            </div>
            <div>
              <dt className="text-amber-200/80">C(t)</dt>
              <dd>
                {isZh
                  ? "由已支持的确定性周期事实形成的阶段变化"
                  : "Stage change from the deterministic cycle facts we currently support"}
              </dd>
            </div>
            <div>
              <dt className="text-amber-200/80">Xᵢ, wᵢ</dt>
              <dd>
                {isZh
                  ? "你自填的可控变量与它们在当前情景的敏感度"
                  : "Your self-reported controllable variables and their current sensitivity"}
              </dd>
            </div>
            <div>
              <dt className="text-amber-200/80">ε</dt>
              <dd>{isZh ? "不可预测的随机噪声（只作为不确定带展示）" : "Unpredictable noise (shown as an uncertainty band only)"}</dd>
            </div>
          </dl>
          <p className="mt-3 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/80">
            {isZh
              ? "这是解释与自我反思模型，不是统计学验证的科学预测，也不替代专业建议。"
              : "This is an interpretive / self-reflection model, not a statistically validated prediction and not a substitute for professional advice."}
          </p>
        </div>
      </section>

      <MainChartGate state={gate} />

      {/* Mode toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">
          {isZh ? "模式" : "Mode"}
        </span>
        <div className="inline-flex overflow-hidden rounded-full border border-amber-400/30">
          <button
            type="button"
            data-testid="math-mode-demo"
            onClick={() => setMode("demo")}
            className={`min-h-9 px-3 text-xs ${
              mode === "demo" ? "bg-amber-300/20 text-amber-50" : "text-amber-200/70 hover:text-amber-100"
            }`}
          >
            {isZh ? "体验模式（演示数据）" : "Demo (sample data)"}
          </button>
          <button
            type="button"
            data-testid="math-mode-personal"
            onClick={() => gate.kind === "ready" && setMode("personal")}
            disabled={gate.kind !== "ready"}
            className={`min-h-9 border-l border-amber-400/20 px-3 text-xs ${
              mode === "personal" ? "bg-amber-300/20 text-amber-50" : "text-amber-200/70 hover:text-amber-100"
            } ${gate.kind !== "ready" ? "cursor-not-allowed opacity-60" : ""}`}
          >
            {isZh ? "个性化（读取主命盘）" : "Personalized (my chart)"}
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
      <section>
        <LifeFunctionChart
          series={series}
          focusAge={focusAge}
          ariaLabel={isZh ? "人生函数曲线" : "Life function chart"}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex flex-1 min-w-[240px] items-center gap-3 text-xs text-amber-100/80">
            <span className="w-16 shrink-0 uppercase tracking-[0.24em] text-amber-200/60">
              {isZh ? "年龄" : "Age"}
            </span>
            <input
              type="range"
              min={0}
              max={80}
              step={1}
              value={focusAge}
              onChange={(e) => setFocusAge(Number(e.target.value))}
              aria-label={isZh ? "年龄焦点" : "Focus age"}
              className="h-1 flex-1 accent-amber-300"
            />
            <span className="w-10 text-right font-mono text-amber-200">{focusAge}</span>
          </label>
          <button
            type="button"
            data-testid="math-reset"
            onClick={() => {
              setScenario(DEFAULT_SCENARIO);
              setFocusAge(30);
            }}
            className="min-h-9 rounded-full border border-amber-400/30 px-3 text-xs text-amber-100 hover:bg-amber-300/10"
          >
            {isZh ? "重置情景" : "Reset scenario"}
          </button>
          <button
            type="button"
            data-testid="math-save-local"
            onClick={() => {
              try {
                window.localStorage.setItem(
                  "life-studies:math:scenario",
                  JSON.stringify({ scenario, focusAge, seed }),
                );
              } catch {
                /* ignore */
              }
            }}
            className="min-h-9 rounded-full border border-amber-400/20 px-3 text-xs text-amber-200/80 hover:bg-amber-300/10"
            title={isZh ? "本轮仅本地保存" : "Local-only save in this phase"}
          >
            {isZh ? "保存情景（本地）" : "Save scenario (local)"}
          </button>
        </div>
      </section>

      {/* Sliders + sensitivity */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "可控变量 Xᵢ" : "Controllable variables Xᵢ"}
          </div>
          <div className="mt-3 space-y-4">
            {(Object.keys(VARIABLE_LABELS) as VariableKey[]).map((k) => (
              <label key={k} className="block text-xs text-amber-100/85">
                <div className="flex items-center justify-between">
                  <span>{VARIABLE_LABELS[k][lang]}</span>
                  <span className="font-mono text-amber-200">{scenario.variables[k]}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={scenario.variables[k]}
                  onChange={(e) => updateVar(k, Number(e.target.value))}
                  aria-label={VARIABLE_LABELS[k][lang]}
                  data-testid={`math-slider-${k}`}
                  className="mt-1 h-1 w-full accent-amber-300"
                />
              </label>
            ))}
            <label className="block border-t border-amber-400/10 pt-4 text-xs text-amber-100/85">
              <div className="flex items-center justify-between">
                <span>{isZh ? "噪声幅度 ε（只影响不确定带）" : "Noise ε (band width only)"}</span>
                <span className="font-mono text-amber-200">{Math.round(scenario.noise * 100)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(scenario.noise * 100)}
                onChange={(e) => setScenario((s) => ({ ...s, noise: Number(e.target.value) / 100 }))}
                aria-label={isZh ? "噪声幅度" : "Noise amplitude"}
                data-testid="math-slider-noise"
                className="mt-1 h-1 w-full accent-amber-300"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "敏感度分布" : "Sensitivity map"}
          </div>
          <p className="mt-1 text-[11px] text-amber-200/60">
            {isZh
              ? "每一项 +25 后，当前年龄的曲线会移动多少（越大越值得先调整）。"
              : "How much the curve at the focus age would move if that variable rose by +25 (larger = higher current leverage)."}
          </p>
          <div className="mt-4">
            <SensitivityBars
              sensitivity={sensitivity as unknown as Record<string, number>}
              labels={Object.fromEntries(
                (Object.keys(VARIABLE_LABELS) as VariableKey[]).map((k) => [k, VARIABLE_LABELS[k][lang]]),
              )}
            />
          </div>
          {focus && (
            <div className="mt-5 rounded-lg border border-amber-400/15 bg-[#141422]/60 p-3 text-xs text-amber-100/85">
              <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200/60">
                {isZh ? "当前焦点" : "Focus"}
              </div>
              <div className="mt-1 font-mono">
                age {focus.age} · Y(baseline) = {focus.baseline} · Y(scenario) = {focus.scenario}
              </div>
              <div className="mt-1 text-[11px] text-amber-200/60">
                {isZh ? "阴影带" : "Band"}: {focus.bandLow} – {focus.bandHigh}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Curator note (rule-based) */}
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "馆长解说 · 规则生成" : "Curator note · rule-generated"}
          </div>
          <span className="rounded-full border border-amber-400/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-200/70">
            {isZh ? "无 AI" : "No AI"}
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-amber-100/85">{summary}</p>
      </section>

      <GenerationMethod />
    </div>
  );
}
