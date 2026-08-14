import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  ChevronRight,
  Loader2,
  Moon,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { DomainDetailDialog, type DomainDetailPayload } from "@/components/daily/DomainDetailDialog";
import { computeDailyDomainScore } from "@/lib/daily-domain-score";
import { computeDailyFacts } from "@/lib/daily-facts";
import { tDomain } from "@/lib/daily-format";
import { interpretAll } from "@/lib/daily-plain-language";
import { useLang } from "@/lib/i18n";
import { useDaily, xlate } from "@/lib/i18n-daily";
import { useSupabaseSession } from "@/lib/session";
import { lookupCityGeo, localBirthToUTC } from "@/lib/city-geo";
import { computeWesternChart } from "@/lib/western-natal";
import { supabase } from "@/integrations/supabase/client";

type TodayChart = {
  id: string;
  name: string | null;
  birth_date: string | null;
  birth_time: string | null;
  birth_place: string | null;
  lang: "en" | "zh";
  chart_role: "self" | "other";
  is_primary: boolean;
  input_snapshot: unknown;
};

type ChartState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "no_primary" }
  | { kind: "incomplete"; missing: string[] }
  | { kind: "ready"; chart: TodayChart };

type TodayReading = {
  chart: TodayChart;
  geo: { lat: number; lng: number; tz: string };
  timezone: string;
  localDate: string;
  facts: ReturnType<typeof computeDailyFacts> | null;
  score: ReturnType<typeof computeDailyDomainScore>;
  plain: ReturnType<typeof interpretAll>;
};

export const Route = createFileRoute("/today")({
  head: () => ({
    meta: [
      { title: "今日 · 命运书房 App" },
      { name: "description", content: "今日命运：主命盘驱动的今日主线、六领域信号与行动建议。" },
    ],
  }),
  component: TodayPage,
});

function todayISO(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function safeTimezone(candidate: unknown) {
  const fallback = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai";
  const zone = typeof candidate === "string" && candidate.trim() ? candidate : fallback;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return zone;
  } catch {
    return "Asia/Shanghai";
  }
}

function bandTone(band: string) {
  if (band === "supportive") return "border-emerald-300/24 bg-emerald-300/[0.08] text-emerald-100";
  if (band === "caution") return "border-rose-300/24 bg-rose-300/[0.08] text-rose-100";
  if (band === "mixed") return "border-amber-300/24 bg-amber-300/[0.08] text-amber-100";
  return "border-white/10 bg-white/[0.045] text-amber-50";
}

const BAND_COLOR: Record<string, string> = {
  supportive: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  neutral: "text-amber-200 border-amber-400/40 bg-amber-500/10",
  mixed: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  caution: "text-rose-300 border-rose-400/40 bg-rose-500/10",
};

async function loadTodayCharts(userId: string): Promise<TodayChart[]> {
  const { data, error } = await supabase
    .from("charts")
    .select("id, name, birth_date, birth_time, birth_place, lang, chart_role, is_primary, input_snapshot, created_at")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name ?? null,
    birth_date: row.birth_date ?? null,
    birth_time: row.birth_time ?? null,
    birth_place: row.birth_place ?? null,
    lang: row.lang === "zh" ? "zh" : "en",
    chart_role: row.chart_role === "self" ? "self" : "other",
    is_primary: Boolean(row.is_primary),
    input_snapshot: row.input_snapshot ?? null,
  }));
}

function snapshotString(snapshot: unknown, key: string): string | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function snapshotNumber(snapshot: unknown, key: string): number | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildDomainPayload({
  domain,
  reading,
  dict,
}: {
  domain: ReturnType<typeof interpretAll>["domains"][number];
  reading: TodayReading;
  dict: ReturnType<typeof useDaily>;
}): DomainDetailPayload | null {
  const score = reading.score.domains.find((d) => d.domain === domain.domain);
  return {
    key: domain.domain,
    label: tDomain(dict, domain.domain),
    score: score?.score ?? 50,
    bandLabel: xlate(dict.band, domain.band),
    bandClass: BAND_COLOR[domain.band] ?? BAND_COLOR.neutral,
    confidenceLabel: xlate(dict.confidence, domain.confidence),
    headline: domain.headline,
    mayShowAs: domain.may_show_as,
    doToday: domain.do_today ?? [],
    avoidToday: domain.avoid_today ?? [],
    weekTrend: domain.week_trend,
    breakdown: score?.breakdown ?? [],
  };
}

function TodayPage() {
  const { lang } = useLang();
  const dict = useDaily();
  const zh = lang === "zh";
  const { session, loading: sessionLoading } = useSupabaseSession();
  const [chartState, setChartState] = useState<ChartState>({ kind: "loading" });
  const [selected, setSelected] = useState<DomainDetailPayload | null>(null);
  const [showAllDomains, setShowAllDomains] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (sessionLoading) {
        setChartState({ kind: "loading" });
        return;
      }
      let activeSession = session;
      if (!activeSession) {
        const { data } = await supabase.auth.getSession();
        activeSession = data.session ?? null;
      }
      if (!activeSession) {
        setChartState({ kind: "signed_out" });
        return;
      }
      setChartState({ kind: "loading" });
      try {
        const charts = await loadTodayCharts(activeSession.user.id);
        const primary =
          charts.find((chart) => chart.is_primary && chart.chart_role === "self") ??
          charts.find((chart) => chart.chart_role === "self") ??
          charts[0] ??
          null;
        if (!primary) {
          if (!cancelled) setChartState({ kind: "no_primary" });
          return;
        }
        const missing = [
          !primary.birth_date ? (zh ? "出生日期" : "birth date") : "",
          !primary.birth_time ? (zh ? "出生时间" : "birth time") : "",
          !primary.birth_place ? (zh ? "出生地点" : "birth place") : "",
        ].filter(Boolean);
        if (missing.length > 0) {
          if (!cancelled) setChartState({ kind: "incomplete", missing });
          return;
        }
        if (!cancelled) setChartState({ kind: "ready", chart: primary });
      } catch {
        if (!cancelled) setChartState({ kind: "no_primary" });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session, sessionLoading, zh]);

  const reading = useMemo<TodayReading | null>(() => {
    if (chartState.kind !== "ready" || !chartState.chart) return null;
    const chart = chartState.chart;
    try {
      const snapshot = chart.input_snapshot;
      const geo = lookupCityGeo(chart.birth_place) ?? {
        lat: snapshotNumber(snapshot, "lat") ?? snapshotNumber(snapshot, "latitude") ?? 31.2304,
        lng: snapshotNumber(snapshot, "lng") ?? snapshotNumber(snapshot, "longitude") ?? 121.4737,
        tz: safeTimezone(snapshotString(snapshot, "timezone") ?? snapshotString(snapshot, "tz")),
      };
      const timezone = safeTimezone(geo.tz);
      const localDate = todayISO(timezone);
      const utc =
        chart.birth_date && chart.birth_time
          ? localBirthToUTC(chart.birth_date, chart.birth_time.slice(0, 5), timezone)
          : null;
      const natal = utc ? computeWesternChart({ utc, lat: geo.lat, lng: geo.lng }) : null;
      const facts = natal ? computeDailyFacts({ natal: natal.planets, localDate, timezone }) : null;
      const score = computeDailyDomainScore({
        facts,
        natalHasTime: Boolean(natal?.ascendant),
      });
      const plain = interpretAll({ score, facts, lang });
      return { chart, geo, timezone, localDate, facts, score, plain };
    } catch {
      return null;
    }
  }, [chartState, lang]);

  const loading = chartState.kind === "loading";

  return (
    <main className="min-h-screen bg-[#04050a] text-amber-50">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#080910] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/65">
              {zh ? "今日阅览室" : "Today's Reading Room"}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-amber-50">
              {zh ? "今天先看一页" : "Read one page today"}
            </h1>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-amber-300/16 bg-amber-300/8 text-amber-200">
            {loading ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <CalendarCheck aria-hidden className="h-5 w-5" />}
          </div>
        </header>

        {chartState.kind === "signed_out" ? (
          <StateCard
            icon={BookOpen}
            title={zh ? "登录后打开你的今日页" : "Sign in for your daily page"}
            body={zh ? "今日需要读取你的主命盘。登录后会进入个人版本，不再停留在预览页。" : "Today needs your primary chart. Sign in to open the personal version instead of the preview."}
            primary={{ label: zh ? "登录 / 注册" : "Login / Sign up", to: "/auth", search: { redirect: "/today" } as never }}
            secondary={{ label: zh ? "先建立命盘" : "Build chart", to: "/ritual", search: { returnTo: "/today" } as never }}
          />
        ) : null}

        {chartState.kind === "no_primary" ? (
          <StateCard
            icon={Sparkles}
            title={zh ? "需要先指定一张主命盘" : "Choose a primary chart first"}
            body={zh ? "今日页不是通用运势，会以你的主命盘计算当天的领域信号。完成仪式或在命盘页设为主命盘后即可打开。" : "This is not a generic forecast. It uses your primary chart to compute today's domain signals."}
            primary={{ label: zh ? "开启仪式" : "Open ritual", to: "/ritual", search: { returnTo: "/today" } as never }}
            secondary={{ label: zh ? "管理命盘" : "Manage charts", to: "/chart" }}
          />
        ) : null}

        {chartState.kind === "incomplete" ? (
          <StateCard
            icon={Moon}
            title={zh ? "主命盘资料还不完整" : "Primary chart is incomplete"}
            body={(zh ? "缺少：" : "Missing: ") + chartState.missing.join(" / ")}
            primary={{ label: zh ? "重新完成仪式" : "Complete ritual again", to: "/ritual", search: { returnTo: "/today" } as never }}
            secondary={{ label: zh ? "查看命盘" : "Open charts", to: "/chart" }}
          />
        ) : null}

        {loading ? (
          <section className="mt-6 rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
            <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
            <div className="mt-5 h-8 w-3/4 animate-pulse rounded-full bg-white/10" />
            <div className="mt-4 h-20 animate-pulse rounded-3xl bg-white/10" />
          </section>
        ) : null}

        {reading ? (
          <>
            <section className="mt-5 overflow-hidden rounded-[30px] border border-amber-300/16 bg-gradient-to-br from-amber-300/14 via-white/[0.045] to-teal-300/10 p-4 shadow-[0_24px_80px_-54px_rgba(20,184,166,0.72)]">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-amber-300/18 bg-black/20 px-3 py-1 text-[11px] text-amber-100/76">
                  {reading.localDate}
                </span>
                <span className="rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-[11px] text-teal-100/78">
                  {reading.chart.name || (zh ? "我的主命盘" : "Primary chart")}
                </span>
              </div>
              <p className="mt-5 text-[10px] uppercase tracking-[0.3em] text-amber-300/62">
                {dict.today_theme}
              </p>
              <h2 className="mt-2 text-[22px] font-semibold leading-tight text-amber-50">
                {reading.plain.overall.headline}
              </h2>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-amber-100/62">
                {reading.plain.overall.may_show_as}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Metric label={zh ? "综合" : "Overall"} value={`${reading.score.overall.score}`} />
                <Metric label={zh ? "月相" : "Moon"} value={reading.facts?.moon.illumination_pct ? `${reading.facts.moon.illumination_pct}%` : "--"} />
                <Metric label={zh ? "领域" : "Rooms"} value="5" />
              </div>
              <button
                type="button"
                onClick={() => {
                  const first = reading.plain.domains[0];
                  if (first) setSelected(buildDomainPayload({ domain: first, reading, dict }));
                }}
                className="mt-4 flex min-h-12 w-full items-center justify-between rounded-2xl bg-amber-300 px-4 text-left text-sm font-semibold text-[#111016] transition active:scale-[0.98]"
              >
                <span>{reading.plain.overall.do_today[0] ?? (zh ? "查看今日重点" : "View today's focus")}</span>
                <ChevronRight aria-hidden className="h-4 w-4" />
              </button>
            </section>

            <section className="mt-4">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-medium text-amber-100">
                  {zh ? "领域信号" : "Domain signals"}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowAllDomains((v) => !v)}
                  className="rounded-full border border-amber-300/14 px-3 py-1 text-[11px] text-amber-100/58 transition active:scale-[0.98]"
                >
                  {showAllDomains ? (zh ? "收起" : "Less") : (zh ? "全部" : "All")}
                </button>
              </div>
              <div className={showAllDomains ? "grid gap-2" : "flex snap-x gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"}>
                {(showAllDomains ? reading.plain.domains : reading.plain.domains.slice(0, 3)).map((domain) => {
                  const score = reading.score.domains.find((d) => d.domain === domain.domain);
                  const label = tDomain(dict, domain.domain);
                  return (
                    <button
                      key={domain.domain}
                      type="button"
                  onClick={() =>
                        setSelected(buildDomainPayload({ domain, reading, dict }))
                      }
                      className={`${showAllDomains ? "w-full" : "min-w-[238px] snap-start"} flex min-h-[86px] items-center gap-3 rounded-[22px] border p-3 text-left transition active:scale-[0.98] ${bandTone(domain.band)}`}
                    >
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-black/20 text-base font-semibold">
                        {score?.score ?? 50}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold">{label}</h3>
                          <span className="rounded-full bg-black/18 px-2 py-0.5 text-[10px] opacity-75">
                            {domain.band}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed opacity-72">
                          {domain.headline}
                        </p>
                      </div>
                      <ChevronRight aria-hidden className="h-5 w-5 shrink-0 opacity-55" />
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-3 rounded-[22px] border border-amber-300/10 bg-black/12 px-3 py-2">
              <p className="text-xs leading-relaxed text-amber-100/48">
                {zh
                  ? "今日信号只用于文化体验和自我反思；如果现实安排与页面不同，以现实为准。"
                  : "Today's signals are for cultural reflection. If reality differs, reality wins."}
              </p>
            </section>
          </>
        ) : null}

        <DomainDetailDialog
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          payload={selected}
          lang={lang}
        />
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
      <div className="text-lg font-semibold text-amber-50">{value}</div>
      <div className="mt-1 text-[10px] text-amber-100/45">{label}</div>
    </div>
  );
}

function StateCard({
  icon: Icon,
  title,
  body,
  primary,
  secondary,
}: {
  icon: typeof CalendarCheck;
  title: string;
  body: string;
  primary: { label: string; to: string; search?: never };
  secondary?: { label: string; to: string; search?: never };
}) {
  return (
    <section className="mt-6 rounded-[30px] border border-amber-300/14 bg-white/[0.04] p-5">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-300/10 text-amber-200">
        <Icon aria-hidden className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-xl font-semibold text-amber-50">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-amber-100/56">{body}</p>
      <div className="mt-5 grid gap-2">
        <Link
          to={primary.to as never}
          search={primary.search}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 text-sm font-semibold text-[#111016] transition active:scale-[0.98]"
        >
          {primary.label}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
        {secondary ? (
          <Link
            to={secondary.to as never}
            search={secondary.search}
            className="flex min-h-12 items-center justify-center rounded-2xl border border-teal-300/22 px-4 text-sm font-medium text-teal-100 transition active:scale-[0.98]"
          >
            {secondary.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
