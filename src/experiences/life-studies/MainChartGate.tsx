import { Link } from "@tanstack/react-router";

import { useLang } from "@/lib/i18n";

/**
 * Gate banner shown INSIDE a subject room. It never blocks demo-mode
 * interaction — it only steers users toward the right next step for
 * the personalized mode of THIS room.
 *
 * States:
 *   - "signed-out"      → CTA to /auth with redirect back
 *   - "no-primary"      → CTA to /ritual to complete intake
 *   - "ready"           → soft confirmation (name of primary chart)
 */
export type GateState =
  | { kind: "loading" }
  | { kind: "signed-out"; returnTo: string }
  | { kind: "no-primary" }
  | {
      kind: "ready";
      chartName: string | null;
      birthDate?: string | null;
      birthPlace?: string | null;
    };

export function MainChartGate({ state }: { state: GateState }) {
  const { lang } = useLang();
  const isZh = lang === "zh";

  if (state.kind === "loading") {
    return (
      <div
        data-testid="main-chart-gate"
        data-state="loading"
        className="mb-4 rounded-[20px] border border-teal-300/18 bg-teal-300/[0.045] px-4 py-3 text-xs text-teal-100/75"
      >
        <div className="h-3 w-32 animate-pulse rounded-full bg-teal-100/15" />
        <div className="mt-2 h-3 w-56 animate-pulse rounded-full bg-teal-100/10" />
      </div>
    );
  }

  if (state.kind === "ready") {
    return (
      <div
        data-testid="main-chart-gate"
        data-state="ready"
        className="mb-4 rounded-[20px] border border-amber-300/24 bg-amber-300/[0.055] px-4 py-3 text-xs text-amber-100/80"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-amber-50">
            {isZh
              ? `已读取主命盘${state.chartName ? `：${state.chartName}` : ""}`
              : `Using primary chart${state.chartName ? `: ${state.chartName}` : ""}`}
          </span>
          {state.birthDate ? (
            <span className="rounded-full border border-amber-300/18 bg-black/18 px-2 py-0.5 text-[10px] text-amber-100/65">
              {state.birthDate}
            </span>
          ) : null}
          {state.birthPlace ? (
            <span className="rounded-full border border-teal-300/18 bg-teal-300/[0.06] px-2 py-0.5 text-[10px] text-teal-100/72">
              {state.birthPlace}
            </span>
          ) : null}
        </div>
        <p className="mt-1 leading-relaxed text-amber-100/58">
          {isZh
            ? "本馆已切换到你的个人曲线；仍可在下方切回演示数据对照。"
            : "This room is using your personal curve; you can still switch back to demo data below."}
        </p>
      </div>
    );
  }

  if (state.kind === "signed-out") {
    return (
      <div
        data-testid="main-chart-gate"
        data-state="signed-out"
        className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-[#141422]/70 p-4 text-xs text-amber-100/80 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="max-w-2xl">
          {isZh
            ? "下方图表可以立即体验，使用演示数据。登录后可读取你的主命盘生成个性化版本，且不写入公共资料。"
            : "The chart below is fully interactive right now with demo data. Sign in to generate a personalized version from your primary chart."}
        </p>
        <Link
          to="/auth"
          search={{ mode: "login", redirect: state.returnTo }}
          data-testid="gate-cta-signin"
          className="inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-amber-300/90 px-4 py-2 text-xs font-medium text-obsidian hover:bg-amber-200"
        >
          {isZh ? "登录以读取主命盘" : "Sign in to use my chart"}
        </Link>
      </div>
    );
  }

  return (
    <div
      data-testid="main-chart-gate"
      data-state="no-primary"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-amber-400/20 bg-[#141422]/70 p-4 text-xs text-amber-100/80 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="max-w-2xl">
        {isZh
          ? "你还没有主命盘。请先完成“开启仪式”并把生成的命盘设为主命盘，之后回到此页读取个性化版本。演示数据始终可用。"
          : "You don't have a primary chart yet. Complete the intake ritual and set the generated chart as your primary; then return here for the personalized version. Demo data stays available."}
      </p>
      <Link
        to="/ritual"
        data-testid="gate-cta-ritual"
        className="inline-flex min-h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-amber-300/60 px-4 py-2 text-xs text-amber-100 hover:bg-amber-300/10"
      >
        {isZh ? "开启仪式 →" : "Start the ritual →"}
      </Link>
    </div>
  );
}
