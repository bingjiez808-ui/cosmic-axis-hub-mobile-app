import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { loadDailyRoomFixture, type DailyRoomFixtureKey } from "@/experiences/daily-room/fixtures";
import { ensureSocialPreviewAllowed } from "@/experiences/daily-room/route-guard";
import { DailyRoomPending, DailyRoomError } from "@/experiences/daily-room/fallback";
import { listUserCharts, type ChartRow } from "@/lib/reports-store.functions";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useDaily, useFormatDate, xlate } from "@/lib/i18n-daily";
import { formatThemeKeyword, formatContradiction, tPhase } from "@/lib/daily-format";
import { interpretAll } from "@/lib/daily-plain-language";
import { DailyDestinyCompass, type CompassAxis } from "@/experiences/daily-room/visuals/DailyDestinyCompass";
import { LifeChapterCard } from "@/experiences/life-guidance/LifeChapterCard";
import { HistoricalEcho } from "@/experiences/life-guidance/HistoricalEcho";
import {
  defaultStageForAge,
  computeAge,
  pickPriorityDomain,
  classifyDomainSignal,
  curatorLetter,
  isOnboardingIntent,
  ONBOARDING_INTENTS,
  LIFE_STAGES,
  normalizeLang,
  type LifeStage,
  type OnboardingIntent,
  type DomainSignalBand,
} from "@/lib/life-guidance-v1";
import { useServerFn } from "@tanstack/react-start";
import {
  getLifeGuidancePrefs,
  setOnboardingIntent as setOnboardingIntentFn,
  setConcern as setConcernFn,
} from "@/lib/life-guidance.functions";
import {
  CONCERNS,
  CONCERN_KEYS,
  isConcernKey,
  resolveConcernRoute,
  selectDailyCounsel,
  type ConcernKey,
  type DailyBand,
} from "@/lib/concern-guidance-v1";






/**
 * /me/home — Today's Reading Room (preview). Fully localized.
 *
 * Pending + error components ensure the route chunk load / hydration
 * gap never surfaces as a blank <main>. The DailyRoomPage body itself
 * NEVER blocks on Supabase — real chart data loads inside its own
 * section so today's fixture-driven signal remains visible even if the
 * backend hangs.
 */
export const Route = createFileRoute("/_authenticated/me/home")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  beforeLoad: () => {
    ensureSocialPreviewAllowed();
  },
  validateSearch: (
    s: Record<string, unknown>,
  ): { focus?: "welcome" | "peers" } => {
    const f = s.focus;
    return f === "welcome" || f === "peers" ? { focus: f } : {};
  },
  pendingMs: 0,
  pendingComponent: DailyRoomPending,
  errorComponent: DailyRoomError,
  component: DailyRoomPage,
});


// Real-chart adapter must never wedge the page. Cap the fetch window so a
// hung Supabase call flips the section to a recoverable error state.
const REAL_CHART_FETCH_TIMEOUT_MS = 8_000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

const FIXTURE_KEYS: DailyRoomFixtureKey[] = [
  "student_youth",
  "working_adult",
  "adult_transition",
  "no_birth_time",
];

const FIXTURE_LABELS: Record<DailyRoomFixtureKey, { zh: string; en: string }> = {
  student_youth: { zh: "学生 · 18 岁", en: "Student · 18" },
  working_adult: { zh: "职场 · 32 岁", en: "Working adult · 32" },
  adult_transition: { zh: "成年转型 · 45 岁", en: "Transition · 45" },
  no_birth_time: { zh: "缺出生时间", en: "No birth time" },
};

const FIXTURE_CHART_LABELS: Record<DailyRoomFixtureKey, { zh: string; en: string }> = {
  student_youth: { zh: "DEMO 学生", en: "DEMO Student" },
  working_adult: { zh: "DEMO 职场", en: "DEMO Working" },
  adult_transition: { zh: "DEMO 转型", en: "DEMO Transition" },
  no_birth_time: { zh: "DEMO 无时", en: "DEMO No-time" },
};

const BAND_COLOR: Record<string, string> = {
  supportive: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10",
  neutral: "text-amber-200 border-amber-400/40 bg-amber-500/10",
  mixed: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  caution: "text-rose-300 border-rose-400/40 bg-rose-500/10",
};

function todayInTz(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const dP = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${dP}`;
}

type RealChartAdapterState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "error"; message: string }
  | { kind: "ready"; charts: ChartRow[]; canDelete: boolean; canRename: boolean; canSetDefault: boolean };

// (contradiction/theme/signal formatting now lives in `@/lib/daily-format`.)

function DailyRoomPage() {
  const { lang } = useLang();
  const d = useDaily();
  const fmtDate = useFormatDate();
  const search = Route.useSearch();
  const focus = search.focus ?? null;
  const tz =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai"
      : "Asia/Shanghai";
  const today = todayInTz(tz);
  const [fixtureKey, setFixtureKey] = useState<DailyRoomFixtureKey>("working_adult");
  const [showEvidence, setShowEvidence] = useState(false);
  const [compassAxis, setCompassAxis] = useState<CompassAxis>("overall");
  // Membership toggle (dev-only "mock member") removed from this route.
  const [real, setReal] = useState<RealChartAdapterState>({ kind: "loading" });
  const [onboardingIntent, setOnboardingIntent] = useState<OnboardingIntent | null>(null);
  const [concern, setConcernState] = useState<ConcernKey | null>(null);
  const getPrefsFn = useServerFn(getLifeGuidancePrefs);
  const saveIntentFn = useServerFn(setOnboardingIntentFn);
  const saveConcernFn = useServerFn(setConcernFn);
  useEffect(() => {
    let cancelled = false;
    getPrefsFn()
      .then((row) => {
        if (cancelled) return;
        const v = row?.onboarding_intent;
        if (isOnboardingIntent(v)) setOnboardingIntent(v);
        const c = row?.concern;
        if (isConcernKey(c)) setConcernState(c);
        else if (typeof window !== "undefined") {
          try {
            const s = window.sessionStorage.getItem("fate.concern.v1");
            if (isConcernKey(s)) {
              setConcernState(s);
              // migrate to cloud once
              saveConcernFn({ data: { concern: s } }).catch(() => {});
              window.sessionStorage.removeItem("fate.concern.v1");
            }
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {
        /* keep null */
      });
    return () => {
      cancelled = true;
    };
  }, [getPrefsFn, saveConcernFn]);

  const changeIntent = async (next: OnboardingIntent) => {
    setOnboardingIntent(next);
    try {
      await saveIntentFn({ data: { intent: next } });
    } catch {
      /* keep optimistic; RLS will re-sync on next visit */
    }
  };

  const changeConcern = async (next: ConcernKey) => {
    setConcernState(next);
    try {
      await saveConcernFn({ data: { concern: next } });
    } catch {
      /* keep optimistic */
    }
  };



  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          REAL_CHART_FETCH_TIMEOUT_MS,
          "session",
        );
        if (!data.session) {
          if (!cancelled) setReal({ kind: "anonymous" });
          return;
        }
        const charts = await withTimeout(
          listUserCharts(),
          REAL_CHART_FETCH_TIMEOUT_MS,
          "list_charts",
        );
        if (cancelled) return;
        setReal({
          kind: "ready",
          charts,
          canDelete: true,
          canRename: true,
          canSetDefault: false,
        });
      } catch (err) {
        if (!cancelled)
          setReal({ kind: "error", message: err instanceof Error ? err.message : "unknown" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fixture = loadDailyRoomFixture(fixtureKey, today, tz);
  const { facts, score } = fixture;

  const domainLabel = (k: string) =>
    d.domain[k as keyof typeof d.domain] ?? xlate({}, k);

  const themeKeywords = useMemo(() => {
    if (!score.overall.theme_keywords.length) return d.theme_default_keyword;
    return score.overall.theme_keywords
      .map((kw) => formatThemeKeyword(kw, d, lang))
      .join(" · ");
  }, [score.overall.theme_keywords, d, lang]);

  const phaseName = facts ? tPhase(d, facts.moon.phase) : "";
  const plain = useMemo(
    () => interpretAll({ score, facts, lang }),
    [score, facts, lang],
  );
  const supportive = plain.overall.do_today;
  const caution = plain.overall.avoid_today;

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        {/* Demo banner */}
        <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
          {d.demo_banner_home}
        </div>

        {/* Curator welcome bookmark & reading-path breadcrumb render below
            the header — see CuratorWelcomeBookmark. */}




        {/* Page title — "My Home" is the personal reading desk. Today's Fate is its default first module. */}
        <header className="mb-6">
          <div className="text-[10px] uppercase tracking-[0.36em] text-amber-300/60">
            {lang === "zh" ? "命运图书馆 · 个人阅览桌" : "Destiny Library · Personal desk"}
          </div>
          <h1 className="mt-2 font-serif text-3xl tracking-wide md:text-4xl">
            {lang === "zh" ? "我的主页" : "My Home"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-amber-100/70">
            {lang === "zh"
              ? "这是你每天回到图书馆的个人阅览桌。默认打开「今日命运」，也可从下方进入命盘、好友、历史回声与会员。"
              : "This is your personal reading desk in the library. It opens with today's fate; use the cards below to reach charts, friends, historical echoes and membership."}
          </p>
        </header>

        {/* Hub cards — clear next step for each personal module */}
        <HomeHubCards real={real} lang={lang} />

        {/* Secondary in-page nav — "Today" is the active module */}
        <nav
          aria-label={lang === "zh" ? "我的主页 · 模块" : "My Home · sections"}
          className="mb-6 flex flex-wrap items-center gap-2 text-xs"
        >
          <a
            href="#today"
            aria-current="page"
            className="rounded-full border border-amber-300 bg-amber-300/10 px-3 py-1 text-amber-100"
          >
            {lang === "zh" ? "今日命运" : "Today's Fate"}
          </a>
          <Link
            to="/me/profile"
            className="rounded-full border border-amber-400/25 px-3 py-1 text-amber-200/80 hover:border-amber-300/60"
          >
            {lang === "zh" ? "命盘与报告" : "Charts & Reports"}
          </Link>
          <Link
            to="/me/friends"
            className="rounded-full border border-amber-400/25 px-3 py-1 text-amber-200/80 hover:border-amber-300/60"
          >
            {d.home_secondary_nav_friends}
          </Link>
          <Link
            to="/me/match"
            className="rounded-full border border-amber-400/25 px-3 py-1 text-amber-200/80 hover:border-amber-300/60"
          >
            {d.home_secondary_nav_match}
          </Link>
        </nav>
        <div id="today" className="sr-only" aria-hidden />


        {/* Lightweight context bar — full chart management lives on /me/profile */}
        <section
          className="mb-6 rounded-xl border border-amber-400/15 bg-black/20 px-4 py-3 text-xs"
          data-testid="home-context-bar"
        >
          {real.kind === "loading" && (
            <div className="text-amber-200/60">{d.my_charts_loading}</div>
          )}
          {real.kind === "anonymous" && (
            <div className="text-amber-200/60">{d.my_charts_anonymous}</div>
          )}
          {real.kind === "error" && (
            <div className="text-rose-300/80">{d.my_charts_error(real.message)}</div>
          )}
          {real.kind === "ready" && (() => {
            const primary = real.charts.find(
              (c) => c.is_primary && c.chart_role === "self",
            );
            if (!primary) {
              return (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-amber-100">{d.charts_primary_missing_title}</div>
                    <div className="mt-1 text-amber-200/70">{d.charts_primary_missing_body}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/ritual"
                      search={{ returnTo: "/me/home" }}
                      className="min-h-11 rounded-full border border-amber-300/60 bg-amber-500/10 px-4 py-2 text-amber-100 hover:bg-amber-500/20"
                    >
                      {d.charts_primary_missing_cta_ritual}
                    </Link>
                    <Link
                      to="/me/profile"
                      className="min-h-11 rounded-full border border-amber-400/30 px-4 py-2 text-amber-200 hover:bg-amber-500/5"
                    >
                      {d.charts_primary_missing_cta_shelf}
                    </Link>
                  </div>
                </div>
              );
            }

            return (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-amber-100/90">
                  <span className="text-amber-200/60">
                    {d.charts_primary_title} ·{" "}
                  </span>
                  <span className="font-medium">
                    {primary.name ?? d.my_charts_unnamed}
                  </span>
                  <span className="ml-2 text-amber-200/50">{today}</span>
                </div>
                <Link
                  to="/me/profile"
                  className="min-h-11 rounded-full border border-amber-400/40 px-4 py-2 text-amber-200 hover:bg-amber-500/10"
                >
                  {d.charts_manage_link}
                </Link>
              </div>
            );
          })()}
        </section>



        {/* Welcome */}
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.2em] text-amber-300/60">
            {d.today_kicker}
          </div>
          <h1 className="mt-2 text-3xl font-serif tracking-wide md:text-4xl">{d.today_title}</h1>
          <div className="mt-2 text-sm text-amber-100/70">
            {fmtDate(today, tz)} · {tz} ·{" "}
            {d.today_chart_label(FIXTURE_CHART_LABELS[fixtureKey][lang])}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {FIXTURE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setFixtureKey(k)}
                aria-pressed={fixtureKey === k}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  fixtureKey === k
                    ? "border-amber-300 bg-amber-300/10 text-amber-100"
                    : "border-amber-400/20 text-amber-200/70 hover:border-amber-300/60"
                }`}
              >
                {FIXTURE_LABELS[k][lang]}
              </button>
            ))}
          </div>
        </header>

        {/* Curator's welcome bookmark — always present, always the same anchor.
            Signed-in visitors see today's welcomeBack line; without an intent
            we invite them to pick one right here. focus=welcome deep-links
            scroll here and pulse a soft ring. */}
        <CuratorWelcomeBookmark
          lang={lang}
          intent={onboardingIntent}
          onChange={changeIntent}
          focused={focus === "welcome"}
        />

        {/* DailyCuratorCounsel — 3-layer deterministic message tied to the
            user's picked concern + today's band + priority domain. */}
        <DailyCuratorCounsel
          lang={lang}
          concern={concern}
          band={score.overall.band as DailyBand}
          priorityDomain={pickPriorityDomain(score.domains) ?? "overall"}
          onPickConcern={changeConcern}
          onToggleEvidence={() => setShowEvidence((v) => !v)}
        />

        {/* Reading-path breadcrumb — bookmarks pinned to today's page. */}
        <ReadingPath lang={lang} focus={focus} hasIntent={onboardingIntent != null} />

        {/* Overall + theme */}

        <section className="mb-8 grid gap-4 md:grid-cols-[1fr_2fr]">
          <div className="rounded-xl border border-amber-400/30 bg-black/40 p-6">
            <div className="text-xs uppercase tracking-widest text-amber-200/60">
              {d.overall_signal}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className="text-5xl font-serif text-amber-100">{score.overall.score}</div>
              <div className="text-xs text-amber-200/70">{d.overall_out_of}</div>
            </div>
            <div
              className={`mt-3 inline-block rounded-full border px-2 py-0.5 text-xs ${BAND_COLOR[score.overall.band]}`}
            >
              {xlate(d.band, score.overall.band)}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-amber-100/70">{d.overall_note}</p>
          </div>

          <div className="rounded-xl border border-amber-400/30 bg-black/40 p-6">
            <div className="text-xs uppercase tracking-widest text-amber-200/60">
              {d.today_theme}
            </div>
            <div className="mt-3 text-lg text-amber-100">
              {score.partial ? d.theme_pending : d.theme_line(phaseName, themeKeywords)}
            </div>
            {score.contradictions.length > 0 && (
              <div className="mt-4 rounded-md border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-100/80">
                <div className="mb-1 font-semibold text-amber-200">{d.contradictions_title}</div>
                {score.contradictions.map((c, i) => (
                  <div key={i}>{formatContradiction(c, d, lang)}</div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Destiny Compass · 6-dimensional radar */}
        <section className="mb-8 rounded-xl border border-amber-400/25 bg-gradient-to-br from-black/60 via-black/40 to-purple-950/20 p-4 md:p-6">
          <div className="mb-3 text-[11px] uppercase tracking-widest text-amber-200/70">
            {lang === "zh" ? "命运罗盘 · 六维今日态" : "Destiny Compass · six dimensions"}
          </div>
          <div className="mx-auto w-full max-w-[460px]">
            <DailyDestinyCompass
              score={score}
              activeAxis={compassAxis}
              onSelectAxis={setCompassAxis}
              labels={{
                overall: d.overall_signal,
                love: d.domain.love,
                study: d.domain.study,
                career: d.domain.career,
                body_mind: d.domain.body_mind,
                finance: d.domain.finance,
              }}
              bandLabels={{
                supportive: xlate(d.band, "supportive"),
                neutral: xlate(d.band, "neutral"),
                mixed: xlate(d.band, "mixed"),
                caution: xlate(d.band, "caution"),
                high: xlate(d.confidence, "high"),
                medium: xlate(d.confidence, "medium"),
                low: xlate(d.confidence, "low"),
                push: lang === "zh" ? "推进" : "push",
                observe: lang === "zh" ? "观察" : "observe",
                pause: lang === "zh" ? "缓行" : "pause",
              }}
              centreCaption={
                lang === "zh"
                  ? "点击维度切换，中心为总体节奏"
                  : "Tap a dimension; centre is the overall pace"
              }
            />
          </div>
        </section>



        <section className="mb-8 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {score.domains.map((dd) => (
            <div key={dd.domain} className="rounded-xl border border-amber-400/20 bg-black/30 p-4">
              <div className="text-xs text-amber-200/70">{domainLabel(dd.domain)}</div>
              <div className="mt-1 flex items-baseline gap-2">
                <div className="text-3xl font-serif text-amber-100">{dd.score}</div>
                <div className="text-[10px] text-amber-200/50">{d.overall_out_of}</div>
              </div>
              <div
                className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] ${BAND_COLOR[dd.band]}`}
              >
                {xlate(d.band, dd.band)} · {xlate(d.confidence, dd.confidence)}
              </div>
            </div>
          ))}
        </section>

        {/* Plain-language: what to do / what to watch (0-AI templates) */}
        <section className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-5">
            <div className="text-xs uppercase tracking-widest text-emerald-200/80">
              {d.supportive_title}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-emerald-50">
              {plain.overall.headline}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-emerald-50/90">
              {supportive.slice(0, 3).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-emerald-300">·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-rose-400/20 bg-rose-500/5 p-5">
            <div className="text-xs uppercase tracking-widest text-rose-200/80">
              {d.caution_title}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-rose-50">
              {plain.overall.may_show_as}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-rose-50/90">
              {caution.slice(0, 3).map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-rose-300">·</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How the score is computed — transparency */}
        <section className="mb-8 rounded-xl border border-amber-400/15 bg-black/20 p-5 text-xs text-amber-100/80">
          <details>
            <summary className="cursor-pointer text-amber-200">
              {lang === "zh" ? "分数不是命运判决 · 查看计算方法" : "Scores aren't a verdict · how they're computed"}
            </summary>
            <div className="mt-3 space-y-2 leading-relaxed">
              {lang === "zh" ? (
                <>
                  <p>每个领域从 50 分中性基准开始。和谐信号（三分/六分/木星或金星合相）为加分，紧张信号（四分/对分/土星合相）为减分。</p>
                  <p>单条影响值 = 方向(±1) × 领域相关权重(1–3) × 精确度系数 × 2。精确度系数 = max(0.2, 1 - orb/6)，越接近精确相位影响越大。</p>
                  <p>水星对学业/表达权重较高；金星、月亮对关系权重较高；木星、金星、土星对财务权重较高；月亮、太阳对身心权重较高（详见代码 DOMAIN_WEIGHTS 矩阵）。</p>
                  <p>总体分 = 五领域平均分 × 60% + 偏离 50 最远的那一项 × 40%。资料不完整时回到中性 50 并降低置信度。</p>
                  <p className="text-amber-200/70">分数不是好运概率、成功率或事件必然发生率，只表示当日该领域的可用资源与调整成本。现实情境永远优先。</p>
                </>
              ) : (
                <>
                  <p>Every domain starts at a neutral 50. Harmonious signals add; straining signals subtract.</p>
                  <p>Contribution = direction(±1) × domain-weight(1–3) × orb-factor × 2. Orb-factor = max(0.2, 1 - orb/6) — closer to exact, larger effect.</p>
                  <p>Mercury weights higher for study/comms; Venus & Moon for relationships; Jupiter/Venus/Saturn for finance; Moon & Sun for body-mind (see DOMAIN_WEIGHTS).</p>
                  <p>Overall = mean of 5 domains × 60% + the most-off-neutral domain × 40%. Missing data pulls back to 50 with lowered confidence.</p>
                  <p className="text-amber-200/70">Scores are not a luck probability, success rate, or certainty of events — only the day's usable resources and adjustment cost. Reality always wins.</p>
                </>
              )}
            </div>
          </details>
        </section>

        {/* Per-domain plain-language ledger */}
        <section className="mb-8 grid gap-3 md:grid-cols-2">
          {plain.domains.map((pd) => {
            const row = score.domains.find((x) => x.domain === pd.domain);
            if (!row) return null;
            return (
              <details
                key={pd.domain}
                className="rounded-xl border border-amber-400/15 bg-black/25 p-4 text-sm"
              >
                <summary className="cursor-pointer">
                  <span className="text-amber-100">{domainLabel(pd.domain)}</span>
                  <span className="ml-2 text-xs text-amber-300/80">{row.score}</span>
                  <span
                    className={`ml-2 inline-block rounded-full border px-2 py-0.5 text-[10px] ${BAND_COLOR[row.band]}`}
                  >
                    {xlate(d.band, row.band)}
                  </span>
                </summary>
                <div className="mt-3 space-y-2 text-amber-100/85 leading-relaxed">
                  <p>{pd.headline}</p>
                  <p className="text-amber-100/70">{pd.may_show_as}</p>
                  {pd.do_today.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-emerald-200/80">
                        {lang === "zh" ? "建议做" : "Do today"}
                      </div>
                      <ul className="mt-1 list-disc pl-5 text-emerald-50/90">
                        {pd.do_today.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {pd.avoid_today.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-rose-200/80">
                        {lang === "zh" ? "注意避免" : "Avoid today"}
                      </div>
                      <ul className="mt-1 list-disc pl-5 text-rose-50/90">
                        {pd.avoid_today.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="text-[11px] text-amber-200/60">{pd.week_trend}</div>
                  {/* Score ledger */}
                  <div className="mt-2 border-t border-amber-400/10 pt-2">
                    <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
                      {lang === "zh" ? "本日加减分账单" : "Today's score ledger"}
                    </div>
                    <div className="mt-1 text-[11px] text-amber-100/70">
                      {lang === "zh" ? "基础分 50" : "Base 50"}
                    </div>
                    {row.breakdown.length === 0 ? (
                      <div className="mt-1 text-[11px] text-amber-100/60">
                        {lang === "zh"
                          ? "今天没有足够强的单项信号，保持中性观察。"
                          : "No strong single signal today — stay observant."}
                      </div>
                    ) : (
                      <ul className="mt-1 space-y-0.5">
                        {row.breakdown.slice(0, 6).map((b, i) => (
                          <li key={i} className="flex justify-between text-[11px] text-amber-100/75">
                            <span>
                              {b.direction > 0
                                ? (lang === "zh" ? "和谐信号" : "Harmonious")
                                : (lang === "zh" ? "紧张信号" : "Straining")}
                              {" · "}
                              {lang === "zh" ? "权重" : "w"} {b.weight} · orb {b.orb.toFixed(1)}°
                            </span>
                            <span className={b.delta_applied >= 0 ? "text-emerald-300" : "text-rose-300"}>
                              {b.delta_applied >= 0 ? "+" : ""}{b.delta_applied}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-1 text-[11px] text-amber-200/70">
                      {lang === "zh" ? "最终分" : "Final"} · {row.score} ·{" "}
                      {lang === "zh" ? "置信度" : "confidence"} {xlate(d.confidence, row.confidence)}
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </section>


        {/* Counter + reflection */}
        <section className="mb-8 rounded-xl border border-amber-400/20 bg-black/30 p-5 text-sm">
          <div className="text-xs uppercase tracking-widest text-amber-200/70">
            {d.countercondition_title}
          </div>
          <p className="mt-2 text-amber-100/80">{d.countercondition_body}</p>
          <div className="mt-4 text-xs uppercase tracking-widest text-amber-200/70">
            {d.reflection_title}
          </div>
          <p className="mt-2 text-amber-100/80">{d.reflection_body}</p>
        </section>

        {/* ─── Life chapter right now (deterministic, 0-AI) ─── */}
        {(() => {
          const primaryBirthDate =
            real.kind === "ready"
              ? real.charts.find((c) => c.is_primary && c.chart_role === "self")
                  ?.birth_date ?? null
              : null;
          const priority = pickPriorityDomain(score.domains);
          const peersFocused = focus === "peers";
          return (
            <div
              id="life-chapter"
              data-focus={peersFocused ? "peers" : undefined}
              className={`scroll-mt-24 ${peersFocused ? "rounded-2xl ring-2 ring-amber-300/60 ring-offset-2 ring-offset-[#0a0a12] transition-shadow" : ""}`}
            >
              {peersFocused ? (
                <div
                  className="mb-3 rounded-lg border border-amber-400/25 bg-amber-500/5 px-4 py-2 text-xs text-amber-100/85"
                  data-testid="peers-path-hint"
                >
                  {lang === "zh"
                    ? "你正在阅读：同龄人的人生章节 → 历史回声"
                    : "You're reading: your peers' life chapter → historical echoes"}
                </div>
              ) : null}
              {!primaryBirthDate && peersFocused ? (
                <section
                  className="mb-8 rounded-xl border border-amber-400/30 bg-black/40 p-6"
                  data-testid="peers-empty-no-primary"
                >
                  <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
                    {lang === "zh" ? "同龄人的人生章节" : "Your peers' life chapter"}
                  </div>
                  <h3 className="mt-2 font-serif text-2xl text-amber-100">
                    {lang === "zh"
                      ? "先登记出生日期，图书馆才能找到与你处于相近人生阶段的回声。"
                      : "Add your birth date first — the library then knows which chapter to open beside yours."}
                  </h3>
                  <Link
                    to="/ritual"
                    search={{ returnTo: "/me/home?focus=peers#life-chapter" } as never}
                    className="mt-4 inline-flex min-h-11 rounded-full border border-amber-300/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
                  >
                    {lang === "zh" ? "登记出生日期 →" : "Register your birth date →"}
                  </Link>
                </section>
              ) : (
                <>
                  <LifeChapterCard
                    primaryBirthDate={primaryBirthDate}
                    todayISO={today}
                    domainScores={score.domains}
                    domainLabels={{
                      love: d.domain.love,
                      study: d.domain.study,
                      career: d.domain.career,
                      body_mind: d.domain.body_mind,
                      finance: d.domain.finance,
                    }}
                  />
                  <HistoricalEchoSlot
                    primaryBirthDate={primaryBirthDate}
                    todayISO={today}
                    priority={priority}
                    concern={concern}
                    domainScore={
                      priority
                        ? score.domains.find((dd) => dd.domain === priority)?.score ?? null
                        : null
                    }
                    domainLabel={priority ? domainLabel(priority) : null}
                    initialExpanded={peersFocused}
                  />

                </>
              )}
            </div>
          );
        })()}




        {/* Evidence section — collapsed by default; membership gating moved to /me/profile */}
        {(
          <section className="mb-16 rounded-xl border border-amber-400/15 bg-black/20">

            <button
              type="button"
              onClick={() => setShowEvidence((v) => !v)}
              aria-expanded={showEvidence}
              className="flex w-full items-center justify-between px-5 py-4 text-left text-sm text-amber-100/80"
            >
              <span>{d.evidence_title}</span>
              <span className="text-amber-300/70">
                {showEvidence ? d.evidence_collapse : d.evidence_expand}
              </span>
            </button>
            {showEvidence && (
              <div className="border-t border-amber-400/10 px-5 py-5 text-xs leading-relaxed text-amber-100/80">
                <div className="mb-3">
                  <div className="text-amber-200/80">{d.evidence_sample}</div>
                  <div className="text-amber-100/70">
                    {facts ? facts.sample_utc : "(missing)"} · {d.evidence_calc}{" "}
                    <code className="text-amber-300/80">daily-facts-v1</code> ·{" "}
                    <code className="text-amber-300/80">daily-domain-score-v1</code>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="text-amber-200/80">{d.evidence_slower}</div>
                  <div className="text-amber-100/70">
                    {d.evidence_slower_line(
                      fixture.slower.vedic,
                      fixture.slower.bazi,
                      fixture.slower.ziwei,
                    )}
                  </div>
                  <div className="mt-1 text-amber-100/50">{d.evidence_slower_note}</div>
                </div>
                <div className="mb-3">
                  <div className="text-amber-200/80">{d.evidence_refs}</div>
                  {score.domains.map((dd) => (
                    <div key={dd.domain} className="mt-2">
                      <div className="text-amber-300/80">{domainLabel(dd.domain)}</div>
                      {dd.evidence_refs.length === 0 ? (
                        <div className="text-amber-100/50">{d.evidence_no_strong}</div>
                      ) : (
                        <ul className="ml-3 list-disc text-amber-100/70">
                          {dd.evidence_refs.map((r, i) => (
                            <li key={i}>
                              <code className="text-[11px] text-amber-200/80">{r}</code>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
                {score.missing_facts.length > 0 && (
                  <div className="mb-3">
                    <div className="text-amber-200/80">{d.evidence_missing}</div>
                    <ul className="ml-3 list-disc text-amber-100/70">
                      {score.missing_facts.map((m, i) => (
                        <li key={i}>{m}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-4 border-t border-amber-400/10 pt-3 text-amber-100/50">
                  {d.evidence_footer}
                </div>
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}

/**
 * HistoricalEchoSlot — resolves the user's active life stage (server
 * preference override → age-derived default) and hands it to
 * HistoricalEcho along with today's priority domain.
 */
function HistoricalEchoSlot({
  primaryBirthDate,
  todayISO,
  priority,
  concern,
  domainScore,
  domainLabel,
  initialExpanded,
}: {
  primaryBirthDate: string | null;
  todayISO: string;
  priority: ReturnType<typeof pickPriorityDomain>;
  concern: ConcernKey | null;
  domainScore: number | null;
  domainLabel: string | null;
  initialExpanded?: boolean;
}) {
  const defaultStage: LifeStage | null = defaultStageForAge(
    computeAge(primaryBirthDate, todayISO),
  );
  const [stage, setStage] = useState<LifeStage | null>(defaultStage);
  const getPrefs = useServerFn(getLifeGuidancePrefs);

  useEffect(() => {
    let cancelled = false;
    getPrefs()
      .then((row) => {
        if (cancelled) return;
        if (
          row?.life_stage &&
          (LIFE_STAGES as readonly string[]).includes(row.life_stage)
        ) {
          setStage(row.life_stage as LifeStage);
        }
      })
      .catch(() => {
        /* keep default */
      });
    return () => {
      cancelled = true;
    };
  }, [getPrefs]);

  useEffect(() => {
    if (defaultStage && !stage) setStage(defaultStage);
  }, [defaultStage, stage]);

  if (!primaryBirthDate || !stage) return null;
  const signal: DomainSignalBand = classifyDomainSignal(domainScore);
  return (
    <HistoricalEcho
      stage={stage}
      domain={priority}
      concern={concern}
      domainSignal={signal}
      domainLabel={domainLabel}
      initialExpanded={initialExpanded}
    />
  );
}

/**
 * ReadingPath — bookmark-style breadcrumb pinned to today's page. Quiet
 * in-page anchor row, not a SaaS nav bar. Active step reflects `focus`.
 */
function ReadingPath({
  lang,
  focus,
  hasIntent,
}: {
  lang: "en" | "zh";
  focus: "welcome" | "peers" | null;
  hasIntent: boolean;
}) {
  const steps: Array<{ key: "welcome" | "chapter" | "echo"; label: string; href: string }> = [
    { key: "welcome", label: lang === "zh" ? "馆长序言" : "Curator's welcome", href: "#curator-welcome" },
    { key: "chapter", label: lang === "zh" ? "此刻的人生页码" : "Life chapter now", href: "#life-chapter" },
    { key: "echo", label: lang === "zh" ? "历史回声" : "Historical echoes", href: "#historical-echo" },
  ];
  const active: "welcome" | "chapter" | "echo" =
    focus === "welcome" ? "welcome" : focus === "peers" ? "chapter" : "welcome";
  void hasIntent;
  return (
    <nav
      aria-label={lang === "zh" ? "阅读路径" : "Reading path"}
      className="mb-6 flex flex-wrap items-center gap-1.5 text-[11px] text-amber-200/70"
      data-testid="reading-path"
    >
      {steps.map((s, i) => (
        <span key={s.key} className="flex items-center gap-1.5">
          {i > 0 ? <span aria-hidden className="text-amber-300/40">→</span> : null}
          <a
            href={s.href}
            aria-current={active === s.key ? "true" : undefined}
            className={`rounded-full border px-3 py-1 transition ${
              active === s.key
                ? "border-amber-300 bg-amber-300/10 text-amber-100"
                : "border-amber-400/20 hover:border-amber-300/60 hover:text-amber-100"
            }`}
          >
            {s.label}
          </a>
        </span>
      ))}
    </nav>
  );
}

/**
 * CuratorWelcomeBookmark — golden bookmark clipped to today's page. Stable
 * `id="curator-welcome"` anchor. Empty-intent state invites picking one;
 * intent-present state shows welcomeBack(intent) with "Why?" and change
 * affordances. When `focused`, pulses a ring for ~1.5s and (if not already
 * in view) scrolls itself into view exactly once.
 */
function CuratorWelcomeBookmark({
  lang,
  intent,
  onChange,
  focused,
}: {
  lang: "en" | "zh";
  intent: OnboardingIntent | null;
  onChange: (v: OnboardingIntent) => void | Promise<void>;
  focused: boolean;
}) {
  const L = normalizeLang(lang);
  const copy = curatorLetter[L];
  const rootRef = useRef<HTMLElement | null>(null);
  const scrolledRef = useRef(false);
  const [explain, setExplain] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!focused) return;
    if (scrolledRef.current) return;
    scrolledRef.current = true;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const inView =
      rect.top >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
    if (!inView) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 1500);
    return () => window.clearTimeout(t);
  }, [focused]);

  const pickerLabel = L === "zh" ? "换一句我现在更需要的" : "Try another line I need more right now";
  const whyLabel = L === "zh" ? "为什么会看到这句话？" : "Why am I seeing this line?";
  const kicker = L === "zh" ? "馆长今日留言" : "Today's note from the Curator";
  const emptyPrompt = L === "zh" ? "让馆长知道你此刻最需要什么" : "Tell the Curator what you most want right now";
  const explainBody =
    L === "zh"
      ? "这句话来自你在序言中自选的意图，只影响馆长的叙事欢迎语，不改变你的命盘计算。"
      : "This line comes from the intent you picked in the Curator's letter. It shapes only this welcome sentence — it never changes any chart calculation.";

  return (
    <section
      ref={rootRef}
      id="curator-welcome"
      aria-label={kicker}
      data-testid="curator-welcome-card"
      className={`relative mb-6 scroll-mt-24 rounded-2xl border p-5 md:p-6 transition-shadow ${
        pulse ? "border-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.35)]" : "border-amber-400/35"
      } bg-gradient-to-br from-amber-950/25 via-black/50 to-purple-950/20`}
    >
      <div
        aria-hidden
        className="absolute -left-1 top-4 hidden h-9 w-2 rounded-r-full bg-gradient-to-b from-amber-300 to-amber-600 md:block"
      />
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-1 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-gradient-to-br from-red-700 via-red-800 to-red-950 font-serif italic text-amber-100 shadow-[inset_0_0_6px_rgba(0,0,0,0.55)] ring-1 ring-red-950/80"
          >
            ✦
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-[0.32em] text-amber-300/70">{kicker}</div>
            {intent ? (
              <p
                className="mt-2 font-serif text-lg italic leading-relaxed text-amber-50 md:text-xl"
                data-testid="curator-welcome-line"
              >
                {copy.welcomeBack(intent)}
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-100/80">{emptyPrompt}</p>
            )}
          </div>
        </div>
        {intent ? (
          <div className="flex flex-none flex-wrap items-start gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setExplain((v) => !v)}
              aria-expanded={explain}
              className="min-h-9 rounded-full border border-amber-400/30 px-3 py-1 text-amber-200 hover:border-amber-300"
              data-testid="curator-welcome-why"
            >
              {whyLabel}
            </button>
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              className="min-h-9 rounded-full border border-amber-300/60 bg-amber-500/10 px-3 py-1 text-amber-100 hover:bg-amber-500/20"
              data-testid="curator-welcome-change"
            >
              {pickerLabel}
            </button>
          </div>
        ) : null}
      </div>

      {explain ? (
        <p className="mt-3 rounded-md border border-amber-400/20 bg-black/40 p-3 text-[11px] leading-relaxed text-amber-100/80">
          {explainBody}
        </p>
      ) : null}

      {(picking || !intent) ? (
        <div
          role="radiogroup"
          aria-label={copy.intentPrompt}
          className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"
          data-testid="curator-welcome-picker"
        >
          {ONBOARDING_INTENTS.map((k) => {
            const active = intent === k;
            const o = copy.intentOptions[k];
            return (
              <button
                key={k}
                role="radio"
                type="button"
                aria-checked={active}
                onClick={() => {
                  void onChange(k);
                  setPicking(false);
                }}
                data-testid={`curator-welcome-intent-${k}`}
                className={`min-h-11 rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? "border-amber-300 bg-amber-400/15 text-amber-100"
                    : "border-amber-400/25 text-amber-200/85 hover:border-amber-300 hover:bg-amber-500/5"
                }`}
              >
                <div className="text-sm font-semibold">{o.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-amber-100/70">{o.hint}</div>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

/* ChartManager and inline row actions moved to src/experiences/profile/
 * ChartManager.tsx and re-hosted on the dedicated /me/profile page. Today's
 * Reading Room only shows a lightweight context bar. */

/**
 * DailyCuratorCounsel — three deterministic paragraphs tied to the user's
 * picked concern, today's overall band, and today's priority domain.
 *
 * When no concern is set we render the 7-concern picker instead of a
 * fabricated message. Everything is sourced from `selectDailyCounsel`.
 */
function DailyCuratorCounsel({
  lang,
  concern,
  band,
  priorityDomain,
  onPickConcern,
  onToggleEvidence,
}: {
  lang: "en" | "zh";
  concern: ConcernKey | null;
  band: DailyBand;
  priorityDomain: string;
  onPickConcern: (c: ConcernKey) => void | Promise<void>;
  onToggleEvidence: () => void;
}) {
  const [changing, setChanging] = useState(false);

  const L = {
    kicker: { zh: "馆长今日留言", en: "Today's note from the Curator" },
    empty: {
      zh: "让馆长知道你此刻最需要什么",
      en: "Tell the Curator what you most want right now",
    },
    t1: { zh: "你带来的问题", en: "The question you brought" },
    t2: { zh: "今天值得留意", en: "What today's data shows" },
    t3: { zh: "今天可以尝试", en: "One thing to try today" },
    why: { zh: "查看今天为什么这样判断", en: "Why today reads this way" },
    change: { zh: "我现在关心的已经变了", en: "My concern has changed" },
    cont: (topic: string) => (lang === "zh" ? `继续阅读我的【${topic}】` : `Continue reading my ${topic}`),
    domainNote: (d: string) =>
      lang === "zh"
        ? `今日「${d}」是被最多信号点到的领域。`
        : `«${d}» is the domain most signals point to today.`,
  };

  const triple = concern ? selectDailyCounsel({ concern, band, lang }) : null;
  const rec = concern ? CONCERNS[concern] : null;
  const domainLabel = priorityDomain; // already localized upstream via domain-score lang-agnostic key
  const ctaHref = rec
    ? resolveConcernRoute({ concern: rec.key, isSignedIn: true, hasPrimaryChart: false })
    : "/ritual";

  return (
    <section
      id="daily-counsel"
      data-testid="daily-counsel"
      className="mb-8 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-950/25 via-black/50 to-purple-950/25 p-5 md:p-6"
    >
      <div className="text-[10px] uppercase tracking-[0.32em] text-amber-300/70">
        {L.kicker[lang]}
      </div>

      {!concern || changing ? (
        <div className="mt-3">
          <p className="mb-3 text-sm text-amber-100/80">{L.empty[lang]}</p>
          <div
            role="radiogroup"
            aria-label={L.empty[lang]}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
          >
            {CONCERN_KEYS.map((k) => (
              <button
                key={k}
                role="radio"
                type="button"
                aria-checked={concern === k}
                onClick={() => {
                  void onPickConcern(k);
                  setChanging(false);
                }}
                data-testid={`daily-counsel-concern-${k}`}
                className={`min-h-11 rounded-lg border px-3 py-2 text-left transition ${
                  concern === k
                    ? "border-amber-300 bg-amber-400/15 text-amber-100"
                    : "border-amber-400/25 text-amber-200/85 hover:border-amber-300 hover:bg-amber-500/5"
                }`}
              >
                <div className="text-sm font-medium">{CONCERNS[k].chip[lang]}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-amber-100/70">
                  {CONCERNS[k].question[lang]}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : triple && rec ? (
        <div className="mt-3 space-y-4">
          <div data-testid="counsel-p1">
            <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200/70">
              {L.t1[lang]}
            </div>
            <p className="mt-1 font-serif italic leading-relaxed text-amber-50/95">
              {triple.response}
            </p>
          </div>
          <div data-testid="counsel-p2">
            <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200/70">
              {L.t2[lang]}
            </div>
            <p className="mt-1 leading-relaxed text-amber-100/90">{triple.today}</p>
            <p className="mt-1 text-[12px] leading-snug text-amber-200/60">
              {L.domainNote(domainLabel)}
            </p>
          </div>
          <div data-testid="counsel-p3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200/70">
              {L.t3[lang]}
            </div>
            <p className="mt-1 leading-relaxed text-amber-100/90">{triple.move}</p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={onToggleEvidence}
              className="min-h-9 rounded-full border border-amber-400/30 px-3 py-1 text-[11px] text-amber-200 hover:border-amber-300"
            >
              {L.why[lang]}
            </button>
            <Link
              to={ctaHref}
              className="min-h-9 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-4 py-1 text-[11px] font-medium text-black hover:brightness-110"
            >
              {L.cont(rec.chip[lang])}
            </Link>
            <button
              type="button"
              onClick={() => setChanging(true)}
              className="min-h-9 rounded-full border border-amber-400/25 px-3 py-1 text-[11px] text-amber-200/80 hover:border-amber-300"
            >
              {L.change[lang]}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ---------- Home Hub Cards ---------- */

function HomeHubCards({
  real,
  lang,
}: {
  real: RealChartAdapterState;
  lang: "en" | "zh";
}) {
  const isZh = lang === "zh";
  const ready = real.kind === "ready" ? real : null;
  const charts = ready?.charts ?? [];
  const primary = charts.find((c) => c.is_primary && c.chart_role === "self") ?? null;
  const otherCount = charts.filter((c) => !c.is_primary || c.chart_role !== "self").length;

  const cards: Array<{
    to: string;
    title: string;
    desc: string;
    reveal: string;
    status: string;
    accent?: boolean;
  }> = [
    {
      to: "#today",
      accent: true,
      title: isZh ? "今日命运" : "Today's Fate",
      desc: isZh
        ? "今天与未来 7 天：总体、学业、事业、爱情、人际、财富、健康。"
        : "Today and the next 7 days: overall, study, career, love, people, wealth, health.",
      reveal: isZh ? "打开：白话结论 · 六维罗盘 · 计算说明。" : "Opens: plain-word verdict, six-axis compass, calculation notes.",
      status: primary
        ? isZh
          ? "主命盘已就绪"
          : "Primary chart ready"
        : isZh
          ? "尚未设置主命盘"
          : "No primary chart yet",
    },
    {
      to: "/me/profile",
      title: isZh ? "命盘与报告" : "Charts & Reports",
      desc: isZh
        ? "管理主命盘、他人命盘、已购报告；重命名或删除。"
        : "Manage the primary chart, others' charts, purchased reports; rename or delete.",
      reveal: isZh ? "打开：个人书架与图书证。" : "Opens: personal bookshelf & library card.",
      status: primary
        ? isZh
          ? `共 ${charts.length} 张 · 主命盘：${primary.title ?? primary.subject_name ?? (isZh ? "已设置" : "set")}`
          : `${charts.length} chart${charts.length === 1 ? "" : "s"} · primary set`
        : charts.length > 0
          ? isZh
            ? `共 ${charts.length} 张 · 尚未指定主命盘`
            : `${charts.length} chart${charts.length === 1 ? "" : "s"} · no primary yet`
          : isZh
            ? "尚未添加任何命盘"
            : "No charts yet",
    },
    {
      to: "/me/friends",
      title: isZh ? "好友与匹配" : "Friends & Match",
      desc: isZh
        ? "好友申请、导入他人命盘、双方授权后计算适配。"
        : "Friend requests, import others' charts, mutual-consent compatibility.",
      reveal: isZh ? "打开：邀请、授权、匹配面板。" : "Opens: invites, consent, match panels.",
      status: isZh ? `他人命盘 ${otherCount} 张` : `${otherCount} other chart${otherCount === 1 ? "" : "s"}`,
    },
    {
      to: "#historical-echo",
      title: isZh ? "历史回声" : "Historical Echoes",
      desc: isZh
        ? "寻找曾面对相似处境的人 —— 不是宣称命格相同。"
        : "Find people who once faced a similar situation — not claiming an identical chart.",
      reveal: isZh ? "打开：按处境推荐 · 收藏 · 我的私密回应。" : "Opens: situation-based figures, bookmarks, private notes.",
      status: isZh ? "按当前关注与今日信号推荐" : "Ranked by concern & today's signal",
    },
    {
      to: "/me/oracle",
      title: isZh ? "会员与订单" : "Membership & Orders",
      desc: isZh
        ? "智者 / 神谕者月度会员、一次性综合报告、订单与工单。"
        : "Sage / Oracle monthly plans, one-time reports, orders and tickets.",
      reveal: isZh ? "打开：神谕者阅读室与账户菜单。" : "Opens: Oracle reading room and account menu.",
      status: isZh ? "查看当前会员与工单状态" : "View plan & ticket status",
    },
  ];

  return (
    <section
      aria-label={isZh ? "个人中枢" : "Personal hub"}
      data-testid="home-hub-cards"
      className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {cards.map((c) => {
        const isAnchor = c.to.startsWith("#");
        const cls = `group flex h-full flex-col justify-between rounded-xl border p-4 text-left transition ${
          c.accent
            ? "border-amber-300/60 bg-amber-500/5 hover:bg-amber-500/10"
            : "border-amber-400/20 bg-black/25 hover:border-amber-300/50 hover:bg-black/40"
        }`;
        const body = (
          <>
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-base text-amber-50 md:text-lg">{c.title}</h2>
                <span aria-hidden className="text-amber-300/60 transition group-hover:translate-x-0.5">→</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-amber-100/75">{c.desc}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-amber-200/55">{c.reveal}</p>
            </div>
            <div className="mt-3 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-amber-300/70">
              <span aria-hidden className="h-1 w-1 rounded-full bg-amber-300/70" />
              {c.status}
            </div>
          </>
        );
        return isAnchor ? (
          <a key={c.title} href={c.to} className={cls}>
            {body}
          </a>
        ) : (
          <Link key={c.title} to={c.to} className={cls}>
            {body}
          </Link>
        );
      })}
    </section>
  );
}





