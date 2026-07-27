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
  curatorLetter,
  isOnboardingIntent,
  ONBOARDING_INTENTS,
  LIFE_STAGES,
  normalizeLang,
  type LifeStage,
  type OnboardingIntent,
} from "@/lib/life-guidance-v1";
import { useServerFn } from "@tanstack/react-start";
import {
  getLifeGuidancePrefs,
  setOnboardingIntent as setOnboardingIntentFn,
} from "@/lib/life-guidance.functions";






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
  const getPrefsFn = useServerFn(getLifeGuidancePrefs);
  const saveIntentFn = useServerFn(setOnboardingIntentFn);
  useEffect(() => {
    let cancelled = false;
    getPrefsFn()
      .then((row) => {
        if (cancelled) return;
        const v = row?.onboarding_intent;
        if (isOnboardingIntent(v)) setOnboardingIntent(v);
      })
      .catch(() => {
        /* keep null */
      });
    return () => {
      cancelled = true;
    };
  }, [getPrefsFn]);

  const changeIntent = async (next: OnboardingIntent) => {
    setOnboardingIntent(next);
    try {
      await saveIntentFn({ data: { intent: next } });
    } catch {
      /* keep optimistic; RLS will re-sync on next visit */
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




        {/* Secondary in-page nav */}
        <nav
          aria-label={d.nav_today}
          className="mb-6 flex flex-wrap items-center gap-2 text-xs"
        >
          <Link
            to="/me/home"
            className="rounded-full border border-amber-300 bg-amber-300/10 px-3 py-1 text-amber-100"
            aria-current="page"
          >
            {d.nav_today}
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
  initialExpanded,
}: {
  primaryBirthDate: string | null;
  todayISO: string;
  priority: ReturnType<typeof pickPriorityDomain>;
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
  return (
    <HistoricalEcho
      stage={stage}
      domain={priority}
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



