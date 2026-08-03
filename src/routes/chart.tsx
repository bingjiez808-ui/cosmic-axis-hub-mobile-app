import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpenCheck,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Compass,
  LibraryBig,
  Loader2,
  Plus,
  ScrollText,
  Sparkles,
  Star,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  listUserCharts,
  setPrimaryChart,
  type ChartRow,
} from "@/lib/reports-store.functions";
import { useLang } from "@/lib/i18n";

export const Route = createFileRoute("/chart")({
  head: () => ({
    meta: [
      { title: "命盘分析 · 命运书房 App" },
      { name: "description", content: "命盘分析功能总览：选择已有命盘、继续阅读报告、查看样本和进入仪式。" },
    ],
  }),
  component: ChartHubPage,
});

type ChartState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "error"; message: string }
  | { kind: "ready"; charts: ChartRow[] };

function ChartHubPage() {
  const { lang } = useLang();
  const zh = lang === "zh";
  const [state, setState] = useState<ChartState>({ kind: "loading" });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) setState({ kind: "guest" });
          return;
        }
        const charts = await listUserCharts();
        if (cancelled) return;
        setState({ kind: "ready", charts });
        const first = charts.find((chart) => chart.is_primary && chart.chart_role === "self") ?? charts[0] ?? null;
        setActiveId(first?.id ?? null);
      } catch (error) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "unknown",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const charts = state.kind === "ready" ? state.charts : [];
  const selfCharts = useMemo(
    () => charts.filter((chart) => chart.chart_role === "self"),
    [charts],
  );
  const relationCharts = useMemo(
    () => charts.filter((chart) => chart.chart_role === "other"),
    [charts],
  );
  const activeChart =
    charts.find((chart) => chart.id === activeId) ??
    selfCharts.find((chart) => chart.is_primary) ??
    charts[0] ??
    null;

  const refreshCharts = async (preferredId?: string) => {
    const next = await listUserCharts();
    setState({ kind: "ready", charts: next });
    setActiveId(preferredId ?? activeId ?? next[0]?.id ?? null);
  };

  const makePrimary = async (chart: ChartRow) => {
    setBusyId(chart.id);
    try {
      await setPrimaryChart({ data: { chartId: chart.id } });
      await refreshCharts(chart.id);
    } finally {
      setBusyId(null);
    }
  };

  const paths = [
    {
      icon: Compass,
      title: zh ? "问题导览" : "Question guide",
      body: zh ? "先看我们能回答哪些真实问题，再决定进入哪类解读。" : "See which real questions the reading can answer.",
      to: "/chart/questions",
      accent: "from-amber-300/16 to-teal-300/10",
    },
    {
      icon: ScrollText,
      title: zh ? "报告样本" : "Preview report",
      body: zh ? "查看命盘报告大致长什么样，避免盲目进入。" : "Preview report shape before starting.",
      to: "/chart/sample",
      accent: "from-teal-300/14 to-white/[0.045]",
    },
    {
      icon: BookOpenCheck,
      title: zh ? "四系合参" : "Four-system synthesis",
      body: zh ? "了解西占、印度、八字、紫微如何交叉验证。" : "How four traditions cross-check one birth chart.",
      to: "/chart/systems",
      accent: "from-amber-300/10 to-rose-300/8",
    },
  ];

  return (
    <main className="min-h-screen bg-[#04050a] text-amber-50">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#080910] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.24em] text-amber-300/62">
              {zh ? "命盘控制台" : "Chart Console"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-amber-50">
              {zh ? "选择一张命盘继续读。" : "Pick a chart to continue."}
            </h1>
          </div>
          <Link
            to="/ritual"
            search={{ returnTo: "/report" } as never}
            aria-label={zh ? "新建命盘" : "New chart"}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-amber-300/25 bg-amber-300/12 text-amber-100 transition active:scale-95"
          >
            <Plus aria-hidden className="h-5 w-5" />
          </Link>
        </header>

        {state.kind === "loading" && <LoadingPanel zh={zh} />}
        {state.kind === "error" && <ErrorPanel zh={zh} message={state.message} />}
        {state.kind === "guest" && <GuestPanel zh={zh} paths={paths} />}

        {state.kind === "ready" && (
          <div className="space-y-4">
            {activeChart ? (
              <ActiveChartPanel chart={activeChart} zh={zh} onMakePrimary={makePrimary} busy={busyId === activeChart.id} />
            ) : (
              <EmptyChartPanel zh={zh} />
            )}

            {charts.length > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between px-1">
                  <h2 className="text-sm font-medium text-amber-100">
                    {zh ? "已保存命盘" : "Saved charts"}
                  </h2>
                  <span className="text-xs text-amber-100/45">
                    {zh ? "点选切换" : "Tap to switch"}
                  </span>
                </div>
                <div className="flex snap-x gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {charts.map((chart) => (
                    <button
                      key={chart.id}
                      type="button"
                      onClick={() => setActiveId(chart.id)}
                      className={`app-chart-chip min-w-[172px] snap-start rounded-[24px] border p-3 text-left transition active:scale-[0.985] ${
                        activeChart?.id === chart.id
                          ? "border-amber-300/48 bg-amber-300/14 shadow-[0_18px_46px_-36px_rgba(251,191,36,0.9)]"
                          : "border-white/10 bg-white/[0.045]"
                      }`}
                    >
                      <span className="mb-4 flex items-center justify-between">
                        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-black/24 text-amber-200">
                          {chart.is_primary ? <Star aria-hidden className="h-4 w-4 fill-current" /> : <ChartNoAxesCombined aria-hidden className="h-4 w-4" />}
                        </span>
                        {activeChart?.id === chart.id && <Check aria-hidden className="h-4 w-4 text-amber-200" />}
                      </span>
                      <span className="block truncate text-sm font-semibold text-amber-50">
                        {chart.name || (zh ? "未命名命盘" : "Untitled chart")}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-amber-100/55">
                        {formatBirth(chart, zh)}
                      </span>
                      <span className="mt-2 inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-amber-100/55">
                        {chart.chart_role === "other" ? (zh ? "他人命盘" : "Other") : chart.is_primary ? (zh ? "主命盘" : "Primary") : (zh ? "本人" : "Self")}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {relationCharts.length > 0 && (
              <section className="rounded-[26px] border border-teal-300/14 bg-teal-300/[0.045] p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-300/10 text-teal-100">
                    <LibraryBig aria-hidden className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-sm font-medium text-amber-50">
                      {zh ? "关系命盘也在这里" : "Relationship charts are here too"}
                    </h2>
                    <p className="mt-1 text-xs leading-relaxed text-amber-100/55">
                      {zh ? `已保存 ${relationCharts.length} 张他人命盘，可进入关系适配继续使用。` : `${relationCharts.length} other chart(s) saved for compatibility readings.`}
                    </p>
                  </div>
                </div>
                <Link
                  to="/bonds"
                  className="mt-4 flex min-h-11 items-center justify-center rounded-2xl border border-teal-200/22 bg-teal-200/10 text-sm font-medium text-teal-50 transition active:scale-[0.98]"
                >
                  {zh ? "打开关系适配" : "Open bonds"}
                </Link>
              </section>
            )}

            <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-medium text-amber-100">
                  {zh ? "继续了解" : "Explore"}
                </h2>
                <Link to="/ritual" search={{ returnTo: "/report" } as never} className="text-xs text-amber-300">
                  {zh ? "新建命盘" : "New chart"}
                </Link>
              </div>
              <div className="grid gap-2">
                {paths.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to as never}
                    className={`group flex min-h-[86px] items-center gap-3 rounded-[22px] border border-white/10 bg-gradient-to-br ${item.accent} p-3 transition active:scale-[0.985]`}
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/24 text-amber-200">
                      <item.icon aria-hidden className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-amber-50">{item.title}</span>
                      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-amber-100/56">{item.body}</span>
                    </span>
                    <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-amber-100/40 transition group-active:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .app-chart-orbit {
            animation: app-chart-orbit 18s linear infinite;
          }
          .app-chart-chip {
            animation: app-chart-chip-in 420ms ease both;
          }
          @keyframes app-chart-orbit {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes app-chart-chip-in {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>
    </main>
  );
}

function ActiveChartPanel({
  chart,
  zh,
  busy,
  onMakePrimary,
}: {
  chart: ChartRow;
  zh: boolean;
  busy: boolean;
  onMakePrimary: (chart: ChartRow) => void;
}) {
  const completedReport = chart.reports.find((report) => report.kind === "report" && report.status === "completed");
  const hasReport = !!completedReport;
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-amber-300/18 bg-[#111018] p-4 shadow-[0_26px_82px_-54px_rgba(251,191,36,0.75)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full border border-amber-200/12 app-chart-orbit" />
      <div className="pointer-events-none absolute right-8 top-8 h-24 w-24 rounded-full border border-teal-200/12 app-chart-orbit" />
      <div className="relative">
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-3 py-1 text-[11px] text-amber-100/75">
            <ChartNoAxesCombined aria-hidden className="h-3.5 w-3.5 text-amber-300" />
            {chart.is_primary ? (zh ? "当前主命盘" : "Current primary") : chart.chart_role === "other" ? (zh ? "他人命盘" : "Other chart") : (zh ? "已保存命盘" : "Saved chart")}
          </span>
          {hasReport && (
            <span className="rounded-full border border-teal-200/18 bg-teal-300/10 px-3 py-1 text-[11px] text-teal-100">
              {zh ? "已有报告" : "Report ready"}
            </span>
          )}
        </div>
        <h2 className="text-2xl font-semibold leading-tight text-amber-50">
          {chart.name || (zh ? "未命名命盘" : "Untitled chart")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/58">
          {formatBirth(chart, zh)}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Metric label={zh ? "资料" : "Data"} value={chart.birth_time && chart.birth_place ? (zh ? "完整" : "Full") : (zh ? "待补" : "Partial")} />
          <Metric label={zh ? "身份" : "Role"} value={chart.chart_role === "other" ? (zh ? "他人" : "Other") : (zh ? "本人" : "Self")} />
          <Metric label={zh ? "报告" : "Report"} value={hasReport ? (zh ? "可读" : "Ready") : (zh ? "待生成" : "New")} />
        </div>
        <div className="mt-5 grid gap-2">
          <Link
            to="/report"
            search={{ readingId: chart.id }}
            className="flex min-h-13 items-center justify-between rounded-2xl bg-gradient-to-r from-amber-100 via-amber-200 to-amber-400 px-4 text-sm font-semibold text-[#111016] transition active:scale-[0.98]"
          >
            {hasReport ? (zh ? "继续阅读这张命盘" : "Continue this report") : (zh ? "生成这张命盘解读" : "Generate this reading")}
            <ChevronRight aria-hidden className="h-5 w-5" />
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/today"
              className="flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-sm text-amber-100 transition active:scale-[0.98]"
            >
              {zh ? "今日阅读" : "Today"}
            </Link>
            {chart.is_primary ? (
              <Link
                to="/me/profile"
                className="flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-sm text-amber-100 transition active:scale-[0.98]"
              >
                {zh ? "管理资料" : "Manage"}
              </Link>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onMakePrimary(chart)}
                className="flex min-h-11 items-center justify-center rounded-2xl border border-teal-200/20 bg-teal-200/10 text-sm text-teal-50 transition active:scale-[0.98] disabled:opacity-60"
              >
                {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : zh ? "设为主命盘" : "Make primary"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/18 p-3">
      <div className="text-[10px] text-amber-100/44">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-amber-50">{value}</div>
    </div>
  );
}

function LoadingPanel({ zh }: { zh: boolean }) {
  return (
    <section className="grid min-h-[360px] place-items-center rounded-[32px] border border-white/10 bg-white/[0.035] p-6 text-center">
      <div>
        <Loader2 aria-hidden className="mx-auto h-7 w-7 animate-spin text-amber-200" />
        <p className="mt-4 text-sm text-amber-100/62">
          {zh ? "正在打开你的命盘书架..." : "Opening your chart shelf..."}
        </p>
      </div>
    </section>
  );
}

function ErrorPanel({ zh, message }: { zh: boolean; message: string }) {
  return (
    <section className="rounded-[28px] border border-rose-300/20 bg-rose-500/10 p-4">
      <h2 className="text-base font-semibold text-rose-100">
        {zh ? "命盘暂时没有打开" : "Could not open charts"}
      </h2>
      <p className="mt-2 text-sm text-rose-100/68">{message}</p>
    </section>
  );
}

function EmptyChartPanel({ zh }: { zh: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-amber-300/18 bg-[#111018] p-5">
      <Sparkles aria-hidden className="h-7 w-7 text-amber-200" />
      <h2 className="mt-5 text-2xl font-semibold leading-tight text-amber-50">
        {zh ? "还没有保存的命盘。" : "No saved chart yet."}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-amber-100/58">
        {zh ? "进入仪式建立第一张命盘。之后再回到这里，可以直接选择已填写过的信息继续阅读。" : "Start the ritual once. After that, come back here to continue from saved details."}
      </p>
      <Link
        to="/ritual"
        search={{ returnTo: "/report" } as never}
        className="mt-5 flex min-h-12 items-center justify-center rounded-2xl bg-amber-300 text-sm font-semibold text-[#111016] transition active:scale-[0.98]"
      >
        {zh ? "进入仪式" : "Start ritual"}
      </Link>
    </section>
  );
}

function GuestPanel({
  zh,
  paths,
}: {
  zh: boolean;
  paths: Array<{
    icon: typeof Compass;
    title: string;
    body: string;
    to: string;
    accent: string;
  }>;
}) {
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[32px] border border-amber-300/18 bg-[#111018] p-5 shadow-[0_26px_82px_-54px_rgba(251,191,36,0.75)]">
        <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full border border-amber-200/12" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-3 py-1 text-[11px] text-amber-100/75">
            <Sparkles aria-hidden className="h-3.5 w-3.5 text-amber-300" />
            {zh ? "第一次来到命盘控制台" : "First time here"}
          </span>
          <h2 className="mt-5 text-2xl font-semibold leading-tight text-amber-50">
            {zh ? "先建立命盘，之后就不用重复填写。" : "Build once, continue anytime."}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/58">
            {zh ? "登录后，已填写过的出生信息和报告会保存在命盘控制台。下次打开可以直接选择继续阅读。" : "After sign-in, birth details and reports stay in this console so you can pick up where you left off."}
          </p>
          <div className="mt-5 grid gap-2">
            <Link
              to="/auth"
              search={{ redirect: "/chart" } as never}
              className="flex min-h-12 items-center justify-center rounded-2xl bg-amber-300 text-sm font-semibold text-[#111016] transition active:scale-[0.98]"
            >
              {zh ? "登录查看我的命盘" : "Sign in to see my charts"}
            </Link>
            <Link
              to="/ritual"
              search={{ returnTo: "/report" } as never}
              className="flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.055] text-sm text-amber-100 transition active:scale-[0.98]"
            >
              {zh ? "先进入仪式" : "Start ritual first"}
            </Link>
          </div>
        </div>
      </section>
      <section className="rounded-[28px] border border-white/10 bg-white/[0.035] p-3">
        <div className="grid gap-2">
          {paths.map((item) => (
            <Link
              key={item.to}
              to={item.to as never}
              className={`group flex min-h-[86px] items-center gap-3 rounded-[22px] border border-white/10 bg-gradient-to-br ${item.accent} p-3 transition active:scale-[0.985]`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/24 text-amber-200">
                <item.icon aria-hidden className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-amber-50">{item.title}</span>
                <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-amber-100/56">{item.body}</span>
              </span>
              <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-amber-100/40 transition group-active:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function formatBirth(chart: ChartRow, zh: boolean) {
  const parts = [
    chart.birth_date || (zh ? "缺出生日期" : "No date"),
    chart.birth_time || null,
    chart.birth_place || null,
  ].filter(Boolean);
  return parts.join(" · ");
}
