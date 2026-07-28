import { useEffect, useMemo, useRef, useState } from "react";

import { useLang } from "@/lib/i18n";
import { MainChartGate, type GateState } from "../MainChartGate";
import { GenerationMethod } from "../GenerationMethod";
import {
  ContributionBreakdown,
  FactorWave,
  LeverageBars,
  LifeCompositionChart,
} from "./LifeFunctionChart";
import {
  BASELINE_COLOR,
  CYCLE_COLOR,
  DEFAULT_SCENARIO,
  PRESETS,
  VARIABLE_COLORS,
  VARIABLE_LABELS,
  buildComposition,
  contributionsAt,
  curatorSummary,
  reactionForChange,
  seedForChart,
  sensitivityAt,
  type FactorKey,
  type MathScenario,
  type VariableKey,
} from "./MathLifeModel";

/**
 * Math-room interactive body — "life as a multi-factor synthesizer".
 * All state is local; no writes hit the backend and no AI is called.
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
  const [selectedFactor, setSelectedFactor] = useState<FactorKey | null>(null);
  const [reaction, setReaction] = useState<string>("");
  const [mobileFactor, setMobileFactor] = useState<FactorKey>("action");
  const [mathOpen, setMathOpen] = useState(false);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (gate.kind !== "ready" && mode === "personal") setMode("demo");
  }, [gate.kind, mode]);

  useEffect(() => () => {
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
  }, []);

  const seed = mode === "personal" && gate.kind === "ready" ? seedForChart(primaryBirthISO) : "demo";

  const composition = useMemo(
    () => buildComposition({ seed, fromAge: 0, toAge: 80, scenario }),
    [seed, scenario],
  );
  const focus = contributionsAt(focusAge, composition);
  const sensitivity = useMemo(
    () => sensitivityAt(focusAge, seed, scenario),
    [focusAge, seed, scenario],
  );
  const summary = curatorSummary(focusAge, seed, scenario, lang);

  const factorKeys: FactorKey[] = ["action", "recovery", "learning", "boundaries"];
  const factorLabel = (k: FactorKey) => VARIABLE_LABELS[k][lang];

  const semantic = (v: number): { text: string; tone: "up" | "down" | "flat" } => {
    if (v > 0.8) return { text: isZh ? `正在抬高曲线 +${v.toFixed(1)}` : `pushing curve up +${v.toFixed(1)}`, tone: "up" };
    if (v < -0.8) return { text: isZh ? `当前形成阻力 ${v.toFixed(1)}` : `pulling curve down ${v.toFixed(1)}`, tone: "down" };
    if (Math.abs(v) < 0.3) return { text: isZh ? "影响很弱" : "very weak effect", tone: "flat" };
    return { text: isZh ? `影响较弱 ${v > 0 ? "+" : ""}${v.toFixed(1)}` : `mild effect ${v > 0 ? "+" : ""}${v.toFixed(1)}`, tone: v >= 0 ? "up" : "down" };
  };

  const updateVar = (k: VariableKey, v: number) => {
    const from = scenario.variables[k];
    setScenario((s) => ({ ...s, variables: { ...s.variables, [k]: v } }));
    const msg = reactionForChange(k, from, v, focusAge, seed, scenario, lang);
    setReaction(msg);
    if (reactionTimer.current) clearTimeout(reactionTimer.current);
    reactionTimer.current = setTimeout(() => setReaction(""), 6000);
  };

  const applyPreset = (id: keyof typeof PRESETS) => {
    setScenario((s) => ({ ...s, variables: { ...PRESETS[id].variables } }));
    setReaction(isZh ? `已套用预设：${PRESETS[id].label.zh}` : `Preset applied: ${PRESETS[id].label.en}`);
  };

  const equationChips = [
    { key: "baseline", color: BASELINE_COLOR, icon: "◐", label: isZh ? "稳定基线 B" : "Baseline B" },
    { key: "cycle", color: CYCLE_COLOR, icon: "∿", label: isZh ? "阶段周期 C(t)" : "Cycles C(t)" },
    { key: "action", color: VARIABLE_COLORS.action, icon: "→", label: isZh ? "行动波" : "Action wave" },
    { key: "recovery", color: VARIABLE_COLORS.recovery, icon: "◡", label: isZh ? "恢复波" : "Recovery wave" },
    { key: "learning", color: VARIABLE_COLORS.learning, icon: "△", label: isZh ? "学习波" : "Learning wave" },
    { key: "boundaries", color: VARIABLE_COLORS.boundaries, icon: "◇", label: isZh ? "关系波" : "Boundaries wave" },
    { key: "noise", color: "#94a3b8", icon: "≈", label: isZh ? "不确定性 ε" : "Uncertainty ε" },
  ];

  const currentFactorForMobile = mobileFactor;

  return (
    <div className="grid grid-cols-1 gap-6 md:gap-8">
      {/* Opening + visual equation */}
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5 md:p-7">
        <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
          {isZh ? "开篇 · 一句上手" : "Start here"}
        </div>
        <p className="mt-2 font-serif text-lg leading-snug text-amber-50 md:text-2xl">
          {isZh
            ? "拖动任意一个因素，它会生成自己的一条影响波；四条影响波与人生阶段周期叠加，才形成你看到的总曲线。"
            : "Drag any factor and it draws its own influence wave; the total curve you see is those four waves stacked onto your life-stage cycle."}
        </p>

        <div className="mt-5 rounded-xl border border-amber-400/15 bg-[#141422]/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {equationChips.map((c, i) => (
              <span key={c.key} className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs"
                  style={{ borderColor: `${c.color}55`, color: c.color, background: `${c.color}12` }}
                >
                  <span aria-hidden>{c.icon}</span>
                  <span className="text-amber-50/90">{c.label}</span>
                </span>
                {i < equationChips.length - 1 && (
                  <span className="text-amber-200/40">＋</span>
                )}
              </span>
            ))}
            <span className="text-amber-200/60">＝</span>
            <span
              className="inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium"
              style={{ borderColor: "#fde68a55", color: "#fde68a", background: "#fde68a12" }}
            >
              {isZh ? "当前人生情景曲线" : "Your current life-scenario curve"}
            </span>
          </div>
          <p className="mt-3 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] leading-relaxed text-amber-100/80">
            {isZh
              ? "四个因素是你填入的情景输入，不是命盘事实。个性化模式只改变已支持的基线与阶段周期，不会把你的滑块伪装成命理推断。"
              : "The four factors are scenario inputs from you, not chart facts. Personalized mode only shifts the supported baseline and stage cycles — your sliders are never presented as astrological inferences."}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMathOpen((v) => !v)}
              className="rounded-md border border-amber-400/20 px-3 py-1.5 text-left text-xs text-amber-200/80 hover:bg-amber-300/10"
              aria-expanded={mathOpen}
            >
              {mathOpen ? (isZh ? "▾ 收起数学说明" : "▾ Hide math") : (isZh ? "▸ 查看数学说明 Y(t)=..." : "▸ Show the math Y(t)=...")}
            </button>
            <button
              type="button"
              onClick={() => setAssumptionsOpen((v) => !v)}
              className="rounded-md border border-amber-400/20 px-3 py-1.5 text-left text-xs text-amber-200/80 hover:bg-amber-300/10"
              aria-expanded={assumptionsOpen}
            >
              {assumptionsOpen
                ? (isZh ? "▾ 收起模型假设" : "▾ Hide model assumptions")
                : (isZh ? "▸ 模型假设：每个因素怎样随时间起作用" : "▸ Model assumptions: how each factor acts over time")}
            </button>
          </div>
          {mathOpen && (
            <div className="mt-3 overflow-x-auto rounded-md border border-amber-400/15 bg-[#0f0f1a]/70 p-3">
              <div className="whitespace-nowrap font-mono text-sm text-amber-100 md:text-base">
                Y(t) = B + C(t) + Σ Fᵢ(t) + ε
              </div>
              <dl className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-amber-100/75 sm:grid-cols-2">
                <div><dt className="text-amber-200/80">B</dt><dd>{isZh ? "较稳定的基线（种子决定）" : "Stable baseline (from seed)"}</dd></div>
                <div><dt className="text-amber-200/80">C(t)</dt><dd>{isZh ? "确定性阶段周期" : "Deterministic stage cycles"}</dd></div>
                <div><dt className="text-amber-200/80">Fᵢ(t)</dt><dd>{isZh ? "四个因素各自随时间的贡献波" : "Per-factor time-varying contribution waves"}</dd></div>
                <div><dt className="text-amber-200/80">ε</dt><dd>{isZh ? "只影响不确定带，不改总值" : "Only widens the band; never moves the total"}</dd></div>
              </dl>
            </div>
          )}
          {assumptionsOpen && (
            <ul className="mt-3 space-y-1.5 rounded-md border border-amber-400/15 bg-[#0f0f1a]/70 p-3 text-[11px] leading-relaxed text-amber-100/80">
              <li><span style={{ color: VARIABLE_COLORS.action }}>●</span> {isZh ? "行动投入：短期上升快，长期边际递减；过高且恢复低时产生过载回落。" : "Action: strong short-term lift with diminishing returns; overload dip when action is high and recovery is low."}</li>
              <li><span style={{ color: VARIABLE_COLORS.recovery }}>●</span> {isZh ? "恢复质量：前期变化温和，持续后提高稳定性并缩小不确定带。" : "Recovery: gentle early, then increases stability and narrows the uncertainty band."}</li>
              <li><span style={{ color: VARIABLE_COLORS.learning }}>●</span> {isZh ? "学习积累：短期贡献小，随时间复利式增强，有安全上限。" : "Learning: small short-term, compounds over time, capped for safety."}</li>
              <li><span style={{ color: VARIABLE_COLORS.boundaries }}>●</span> {isZh ? "关系边界：在周期压力增大时贡献更明显，平稳期贡献较小。" : "Boundaries: contributes more during cycle stress, quieter in calm periods."}</li>
              <li className="pt-1 text-amber-200/60">{isZh ? "以上是本产品的解释性规则，不是科学预测。" : "These are this product's interpretive rules, not scientific predictions."}</li>
            </ul>
          )}
        </div>
      </section>

      <MainChartGate state={gate} />

      {/* Mode + preset row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[11px] uppercase tracking-[0.24em] text-amber-200/60">
          {isZh ? "模式" : "Mode"}
        </span>
        <div className="inline-flex overflow-hidden rounded-full border border-amber-400/30">
          <button
            type="button" data-testid="math-mode-demo"
            onClick={() => setMode("demo")}
            className={`min-h-9 px-3 text-xs ${mode === "demo" ? "bg-amber-300/20 text-amber-50" : "text-amber-200/70 hover:text-amber-100"}`}
          >
            {isZh ? "体验模式（演示数据）" : "Demo (sample data)"}
          </button>
          <button
            type="button" data-testid="math-mode-personal"
            onClick={() => gate.kind === "ready" && setMode("personal")}
            disabled={gate.kind !== "ready"}
            className={`min-h-9 border-l border-amber-400/20 px-3 text-xs ${mode === "personal" ? "bg-amber-300/20 text-amber-50" : "text-amber-200/70 hover:text-amber-100"} ${gate.kind !== "ready" ? "cursor-not-allowed opacity-60" : ""}`}
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
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.24em] text-amber-200/50">
            {isZh ? "演示预设" : "Presets"}
          </span>
          {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((id) => (
            <button
              key={id}
              type="button"
              data-testid={`math-preset-${id}`}
              onClick={() => applyPreset(id)}
              className="min-h-8 rounded-full border border-amber-400/25 px-2.5 text-[11px] text-amber-100 hover:bg-amber-300/10"
            >
              {PRESETS[id].label[lang]}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop: two-column console+chart. Mobile: stacked. */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* --- Console (desktop). Hidden on mobile in favor of the swipe card below. --- */}
        <div className="hidden rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5 md:block">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "多维影响波" : "Multi-factor waves"}
          </div>
          <div className="mt-4 space-y-5">
            {factorKeys.map((k) => {
              const contribution = focus?.factors[k] ?? 0;
              const sem = semantic(contribution);
              const isSelected = selectedFactor === k;
              return (
                <div key={k} className={`rounded-lg border p-3 transition ${isSelected ? "border-amber-300/60 bg-amber-300/5" : "border-amber-400/10 bg-[#0f0f1a]/70"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex min-w-0 items-center gap-2 text-xs text-amber-100">
                      <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: VARIABLE_COLORS[k] }} />
                      <span className="truncate">{factorLabel(k)}</span>
                    </label>
                    <button
                      type="button"
                      data-testid={`math-focus-${k}`}
                      onClick={() => setSelectedFactor((s) => (s === k ? null : k))}
                      className={`min-h-7 rounded-full border px-2 text-[10px] uppercase tracking-[0.2em] ${isSelected ? "border-amber-300/70 bg-amber-300/20 text-amber-50" : "border-amber-400/25 text-amber-200/70 hover:text-amber-100"}`}
                      aria-pressed={isSelected}
                    >
                      {isSelected ? (isZh ? "只看此因素 ✓" : "Only this ✓") : (isZh ? "只看此因素" : "Only this")}
                    </button>
                  </div>
                  <div className="mt-2">
                    <FactorWave
                      values={composition.factorSeries[k]}
                      color={VARIABLE_COLORS[k]}
                      active={isSelected}
                      ariaLabel={`${factorLabel(k)} wave`}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]">
                    <span className={sem.tone === "up" ? "text-emerald-300" : sem.tone === "down" ? "text-rose-300" : "text-amber-200/70"}>
                      {sem.text}
                    </span>
                    <span className="font-mono text-amber-200/80">{scenario.variables[k]}</span>
                  </div>
                  <input
                    type="range" min={0} max={100} step={1}
                    value={scenario.variables[k]}
                    onChange={(e) => updateVar(k, Number(e.target.value))}
                    aria-label={factorLabel(k)}
                    data-testid={`math-slider-${k}`}
                    className="mt-2 h-1 w-full"
                    style={{ accentColor: VARIABLE_COLORS[k] }}
                  />
                </div>
              );
            })}
            <label className="block border-t border-amber-400/10 pt-4 text-xs text-amber-100/85">
              <div className="flex items-center justify-between">
                <span>{isZh ? "噪声幅度 ε（只影响不确定带）" : "Noise ε (band width only)"}</span>
                <span className="font-mono text-amber-200">{Math.round(scenario.noise * 100)}</span>
              </div>
              <input
                type="range" min={0} max={100} step={1}
                value={Math.round(scenario.noise * 100)}
                onChange={(e) => setScenario((s) => ({ ...s, noise: Number(e.target.value) / 100 }))}
                aria-label={isZh ? "噪声幅度" : "Noise amplitude"}
                data-testid="math-slider-noise"
                className="mt-1 h-1 w-full accent-amber-300"
              />
            </label>
          </div>
        </div>

        {/* --- Chart + focus tools --- */}
        <div className="min-w-0 space-y-4">
          <LifeCompositionChart
            composition={composition}
            focusAge={focusAge}
            selectedFactor={selectedFactor}
            ariaLabel={isZh ? "人生合成曲线" : "Life composition chart"}
          />
          {focus && (
            <div className="rounded-xl border border-amber-400/15 bg-[#0f0f1a]/70 p-3 text-[11px] text-amber-200/75">
              <span className="font-mono text-amber-100">
                {isZh ? "基线" : "baseline"} {focus.baseline.toFixed(1)}
                {" + "}
                {isZh ? "周期" : "cycle"} {focus.cycle >= 0 ? "+" : ""}{focus.cycle.toFixed(1)}
                {(Object.keys(focus.factors) as FactorKey[]).map((k) => (
                  <span key={k} style={{ color: VARIABLE_COLORS[k] }}>
                    {" + "}{factorLabel(k)} {focus.factors[k] >= 0 ? "+" : ""}{focus.factors[k].toFixed(1)}
                  </span>
                ))}
                {" = "}
                <span className="text-amber-100">{focus.total.toFixed(1)}</span>
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex flex-1 min-w-[220px] items-center gap-3 text-xs text-amber-100/80">
              <span className="w-16 shrink-0 uppercase tracking-[0.24em] text-amber-200/60">
                {isZh ? "年龄" : "Age"}
              </span>
              <input
                type="range" min={0} max={80} step={1}
                value={focusAge}
                onChange={(e) => setFocusAge(Number(e.target.value))}
                aria-label={isZh ? "年龄焦点" : "Focus age"}
                className="h-1 flex-1 accent-amber-300"
              />
              <span className="w-10 text-right font-mono text-amber-200">{focusAge}</span>
            </label>
            <button
              type="button" data-testid="math-reset"
              onClick={() => { setScenario(DEFAULT_SCENARIO); setFocusAge(30); setSelectedFactor(null); setReaction(""); }}
              className="min-h-9 rounded-full border border-amber-400/30 px-3 text-xs text-amber-100 hover:bg-amber-300/10"
            >
              {isZh ? "重置情景" : "Reset scenario"}
            </button>
            <button
              type="button" data-testid="math-save-local"
              onClick={() => { try { window.localStorage.setItem("life-studies:math:scenario", JSON.stringify({ scenario, focusAge, seed })); } catch { /* ignore */ } }}
              className="min-h-9 rounded-full border border-amber-400/20 px-3 text-xs text-amber-200/80 hover:bg-amber-300/10"
            >
              {isZh ? "保存情景（本地）" : "Save scenario (local)"}
            </button>
          </div>
          {reaction && (
            <div role="status" data-testid="math-reaction" className="rounded-lg border border-amber-300/30 bg-amber-300/5 px-3 py-2 text-[12px] text-amber-100">
              {reaction}
            </div>
          )}
          {composition.interactionFlags.overload && (
            <div className="rounded-lg border border-rose-400/40 bg-rose-400/5 px-3 py-2 text-[12px] text-rose-200">
              {isZh
                ? "组合警告：当前高行动 × 低恢复正在触发过载回落，长期会削弱行动本身的贡献。"
                : "Interaction warning: high action × low recovery is triggering an overload dip that erodes action's own gains long-term."}
            </div>
          )}
        </div>
      </section>

      {/* Mobile factor card (one factor at a time) */}
      <section className="md:hidden">
        <div className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-4">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "逐一查看每个因素" : "One factor at a time"}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {factorKeys.map((k) => (
              <button
                key={k} type="button"
                onClick={() => { setMobileFactor(k); setSelectedFactor(k); }}
                className={`min-h-8 rounded-full border px-2.5 text-[11px] ${currentFactorForMobile === k ? "border-amber-300/60 bg-amber-300/15 text-amber-50" : "border-amber-400/25 text-amber-200/70"}`}
                style={{ borderColor: currentFactorForMobile === k ? VARIABLE_COLORS[k] : undefined }}
              >
                <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: VARIABLE_COLORS[k] }} />
                {factorLabel(k)}
              </button>
            ))}
          </div>
          {(() => {
            const k = currentFactorForMobile;
            const contribution = focus?.factors[k] ?? 0;
            const sem = semantic(contribution);
            return (
              <div className="mt-3 space-y-2">
                <FactorWave values={composition.factorSeries[k]} color={VARIABLE_COLORS[k]} active ariaLabel={`${factorLabel(k)} wave`} />
                <div className="flex items-center justify-between text-[11px]">
                  <span className={sem.tone === "up" ? "text-emerald-300" : sem.tone === "down" ? "text-rose-300" : "text-amber-200/70"}>{sem.text}</span>
                  <span className="font-mono text-amber-200/80">{scenario.variables[k]}</span>
                </div>
                <input
                  type="range" min={0} max={100} step={1}
                  value={scenario.variables[k]}
                  onChange={(e) => updateVar(k, Number(e.target.value))}
                  aria-label={factorLabel(k)}
                  className="h-1 w-full"
                  style={{ accentColor: VARIABLE_COLORS[k] }}
                />
              </div>
            );
          })()}
          <label className="mt-4 block border-t border-amber-400/10 pt-3 text-xs text-amber-100/85">
            <div className="flex items-center justify-between">
              <span>{isZh ? "噪声幅度 ε" : "Noise ε"}</span>
              <span className="font-mono text-amber-200">{Math.round(scenario.noise * 100)}</span>
            </div>
            <input
              type="range" min={0} max={100} step={1}
              value={Math.round(scenario.noise * 100)}
              onChange={(e) => setScenario((s) => ({ ...s, noise: Number(e.target.value) / 100 }))}
              aria-label={isZh ? "噪声幅度" : "Noise amplitude"}
              className="mt-1 h-1 w-full accent-amber-300"
            />
          </label>
        </div>
      </section>

      {/* Contribution breakdown + leverage */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? `当前年龄 · 多维贡献分解 (age ${focusAge})` : `Focus age contribution breakdown (age ${focusAge})`}
          </div>
          <p className="mt-1 text-[11px] text-amber-200/60">
            {isZh
              ? "每一条条形显示该分量在当前年龄的推力或阻力，最后合成为总值。"
              : "Each bar shows what that component is pushing or pulling at the focus age; they sum into the total."}
          </p>
          <div className="mt-4">
            {focus && (
              <ContributionBreakdown
                focus={focus}
                labels={{
                  baseline: isZh ? "基线" : "Baseline",
                  cycle: isZh ? "阶段周期" : "Cycle",
                  total: isZh ? "总曲线" : "Total",
                  factors: {
                    action: factorLabel("action"),
                    recovery: factorLabel("recovery"),
                    learning: factorLabel("learning"),
                    boundaries: factorLabel("boundaries"),
                  },
                }}
                colors={VARIABLE_COLORS}
                lang={lang}
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "如果只调整一项 · 哪项最有杠杆" : "If you tweak only one · which has the most leverage"}
          </div>
          <p className="mt-1 text-[11px] text-amber-200/60">
            {isZh
              ? "这是第二层参考：不代表当前贡献，而是「+25 后曲线会移动多少」。"
              : "This is a second-layer signal: it doesn't show current contribution, but how much a +25 bump would move the curve."}
          </p>
          <div className="mt-4">
            <LeverageBars
              sensitivity={sensitivity as unknown as Record<string, number>}
              labels={Object.fromEntries(factorKeys.map((k) => [k, factorLabel(k)]))}
              colors={VARIABLE_COLORS}
            />
          </div>
        </div>
      </section>

      {/* Curator note */}
      <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "馆长解说 · 规则生成" : "Curator note · rule-generated"}
          </div>
          <span className="rounded-full border border-amber-400/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-200/70">
            {isZh ? "无 AI" : "No AI"}
          </span>
        </div>
        <div className="mt-3 space-y-1.5 text-sm leading-relaxed text-amber-100/85">
          {summary.split("\n").map((line, i) => (
            <p key={i} className={i === summary.split("\n").length - 1 ? "text-[11px] text-amber-200/60" : undefined}>
              {line}
            </p>
          ))}
        </div>
      </section>

      <GenerationMethod />
    </div>
  );
}
