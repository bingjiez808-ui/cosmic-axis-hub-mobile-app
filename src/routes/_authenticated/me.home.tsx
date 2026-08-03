import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookMarked,
  CalendarCheck,
  ChartNoAxesCombined,
  CheckCircle2,
  Handshake,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserPlus,
} from "lucide-react";

import "@/components/personal-library.css";
import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";

import { loadDailyRoomFixture, type DailyRoomFixtureKey } from "@/experiences/daily-room/fixtures";
import { buildRealDaily } from "@/experiences/daily-room/real-chart-daily";
import { type DailyReadingInput } from "@/lib/daily-reading.functions";
import {
  parseSegment,
  useDailyReadingSegments,
  type SegmentId,
} from "@/lib/use-daily-reading-segments";

import { DailyRoomError } from "@/experiences/daily-room/fallback";
import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { listUserCharts, type ChartRow } from "@/lib/reports-store.functions";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import { useDaily, useFormatDate, xlate } from "@/lib/i18n-daily";
import { formatThemeKeyword, formatContradiction, tPhase } from "@/lib/daily-format";
import { interpretAll } from "@/lib/daily-plain-language";
import { DailyDestinyCompass, type CompassAxis } from "@/experiences/daily-room/visuals/DailyDestinyCompass";
import { DomainDetailDialog, type DomainDetailPayload } from "@/components/daily/DomainDetailDialog";
import {
  pickPriorityDomain,
  curatorLetter,
  isOnboardingIntent,
  ONBOARDING_INTENTS,
  normalizeLang,
  type OnboardingIntent,
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
  validateSearch: (
    s: Record<string, unknown>,
  ): { focus?: "welcome" | "peers" } => {
    const f = s.focus;
    return f === "welcome" || f === "peers" ? { focus: f } : {};
  },
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
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
  const [samplePreview, setSamplePreview] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [compassAxis, setCompassAxis] = useState<CompassAxis>("overall");
  const [domainDetail, setDomainDetail] = useState<DomainDetailPayload | null>(null);
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

  // The visitor's OWN primary chart drives Today's Fate. Demo fixtures are
  // only used when the "sample preview" switch is explicitly on, or while
  // no primary chart exists yet.
  const primaryChart =
    real.kind === "ready"
      ? real.charts.find((c) => c.is_primary && c.chart_role === "self") ?? null
      : null;

  const realDaily = useMemo(() => {
    if (!primaryChart) return null;
    return buildRealDaily({
      name: primaryChart.name,
      birthDate: primaryChart.birth_date,
      birthTime: primaryChart.birth_time,
      birthPlace: primaryChart.birth_place,
      localDate: today,
      timezone: tz,
    });
  }, [primaryChart, today, tz]);

  const usingRealChart = !samplePreview && Boolean(realDaily);
  const facts = usingRealChart ? realDaily!.facts : fixture.facts;
  const score = usingRealChart ? realDaily!.score : fixture.score;
  const chartLabel = usingRealChart
    ? realDaily!.chartLabel || (lang === "zh" ? "我的主命盘" : "My primary chart")
    : FIXTURE_CHART_LABELS[fixtureKey][lang];

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

  // ---- AI explanation layer (daily-reading-v1, on-demand per section) ----
  // Cost policy: the score itself is 100% deterministic (daily-facts-v1 +
  // daily-domain-score-v2) and never calls AI. The AI layer is split into
  // small sections and generated ONLY when the visitor expands the matching
  // module (header note / today's actions / a single domain), each cached per
  // chart+date+lang+score.
  const aiBaseKey =
    usingRealChart && primaryChart && facts
      ? `fate.daily-reading.v2|${primaryChart.id}|${today}|${tz}|${lang}|${score.overall.score}`
      : null;

  const buildAiInput = (segment: SegmentId): DailyReadingInput | null => {
    if (!facts) return null;
    const { section, targetDomain } = parseSegment(segment);
    const domains = score.domains
      .filter((dd) => (targetDomain ? dd.domain === targetDomain : true))
      .map((dd) => ({
        domain: dd.domain,
        label: domainLabel(dd.domain),
        score: dd.score,
        band: dd.band,
        confidence: dd.confidence,
        evidence: dd.evidence_refs.slice(0, 6),
      }));
    return {
      lang,
      section,
      targetDomain,
      localDate: today,
      timezone: tz,
      chartLabel,
      moonPhase: facts.moon.phase,
      moonSign: facts.moon.sign,
      retrogrades: facts.transit_planets.filter((p) => p.retro).map((p) => p.key),
      aspects: facts.transit_to_natal_aspects
        .slice(0, section === "domain" ? 10 : 20)
        .map((a) => `${a.transit}→${a.natal} ${a.kind} orb=${a.orb.toFixed(1)}`),
      overall: {
        score: score.overall.score,
        band: score.overall.band,
        themeKeywords: score.overall.theme_keywords,
      },
      domains,
      contradictions: score.contradictions,
      missingFacts: score.missing_facts,
      concern: concern ?? undefined,
    };
  };

  const aiSegments = useDailyReadingSegments({
    baseKey: aiBaseKey,
    buildInput: buildAiInput,
  });

  const overview = aiSegments.get("overview");
  const actions = aiSegments.get("actions");
  const ai = overview.data;
  const aiState = overview.status;

  // "Today's actions" module — collapsed by default; expanding it is what
  // triggers that one AI call.
  const [actionsOpen, setActionsOpen] = useState(false);
  const toggleActions = () => {
    const next = !actionsOpen;
    setActionsOpen(next);
    if (next) aiSegments.ensure("actions");
  };

  const retryAi = () => aiSegments.retry("overview");

  // Domain modal — opening a domain generates only that domain's section.
  const domainSegmentId = (key: string) => `domain:${key}` as SegmentId;
  const activeDomainSeg = domainDetail
    ? aiSegments.get(domainSegmentId(domainDetail.key))
    : null;
  const hasPrimaryChart = Boolean(primaryChart);
  const appProgress = [
    {
      done: hasPrimaryChart,
      zh: "建立主命盘",
      en: "Build primary chart",
      to: "/ritual" as const,
    },
    {
      done: usingRealChart,
      zh: "读取今日重点",
      en: "Read today's priority",
      to: "/me/home" as const,
    },
    {
      done: Boolean(onboardingIntent || concern),
      zh: "选择当前问题",
      en: "Choose your question",
      to: "/me/home" as const,
    },
  ];

  const [shelfView, setShelfView] = useState<"overview" | "today">("overview");

  if (shelfView === "overview") {
    const shelfSections = [
      {
        icon: CalendarCheck,
        title: lang === "zh" ? "今日阅读" : "Today Reading",
        body: lang === "zh" ? "今日重点、六领域建议、七日趋势。" : "Priority, domain notes and 7-day rhythm.",
        action: lang === "zh" ? "打开今日" : "Open today",
        onClick: () => setShelfView("today"),
      },
      {
        icon: ChartNoAxesCombined,
        title: lang === "zh" ? "命盘与报告" : "Charts & Reports",
        body: lang === "zh" ? "管理主命盘、他人命盘和已生成报告。" : "Manage primary chart, other charts and reports.",
        to: "/me/profile" as const,
      },
      {
        icon: Handshake,
        title: lang === "zh" ? "关系与适配" : "Relationships",
        body: lang === "zh" ? "好友邀请、关系便签、适配分析。" : "Invites, relationship notes and matching.",
        to: "/me/friends" as const,
      },
      {
        icon: BookMarked,
        title: lang === "zh" ? "历史回声" : "Historical Echoes",
        body: lang === "zh" ? "收藏相似人生阶段的故事和书签。" : "Save stories and bookmarks from similar life stages.",
        to: "/me/echoes" as const,
      },
      {
        icon: ShieldCheck,
        title: lang === "zh" ? "会员与订单" : "Membership",
        body: lang === "zh" ? "查看权益、订单、工单和深度报告。" : "Benefits, orders, tickets and premium reports.",
        to: "/me/membership" as const,
      },
    ];

    return (
      <div className="pl-shell min-h-screen bg-[#0a0a12]/25 text-amber-50">
        <div className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <div className="mb-4 flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-amber-300/18 bg-white/[0.035] px-3 text-xs text-amber-100/80 active:scale-[0.98]"
            >
              <ArrowRight aria-hidden className="h-4 w-4 rotate-180" />
              {lang === "zh" ? "回首页" : "Home"}
            </Link>
            <Link
              to="/me"
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-teal-300/18 bg-teal-300/[0.06] px-3 text-xs text-teal-100/85 active:scale-[0.98]"
            >
              {lang === "zh" ? "读者证" : "Reader Pass"}
            </Link>
          </div>

          <header className="mb-5 rounded-[30px] border border-amber-300/18 bg-[#11110f]/88 p-5 shadow-[0_24px_68px_-48px_rgba(251,191,36,0.7)]">
            <p className="text-[10px] uppercase tracking-[0.32em] text-amber-300/62">
              {lang === "zh" ? "命运图书馆 · 我的书架" : "Destiny Library · My Shelf"}
            </p>
            <h1 className="mt-3 text-[2rem] font-semibold leading-tight text-amber-50">
              {lang === "zh" ? "这里保存你的所有阅读。" : "Your readings live here."}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-amber-100/62">
              {lang === "zh"
                ? "命盘、报告、今日阅读、关系记录与会员权益，都归入这张读者书架。"
                : "Charts, reports, today readings, relationships and pass benefits are kept on this shelf."}
            </p>
          </header>

          {!usingRealChart && (
            <div className="mb-4 rounded-2xl border border-amber-400/24 bg-amber-500/[0.055] px-4 py-3 text-xs leading-relaxed text-amber-100/72">
              {hasPrimaryChart
                ? d.demo_banner_home
                : lang === "zh"
                  ? "还没有主命盘。先建立主命盘后，书架里的今日阅读和报告会变成你的个人版本。"
                  : "No primary chart yet. Build one to personalize today readings and reports."}
            </div>
          )}

          <PersonalWorkspaceNav active="/me/home" />

          <section className="mb-4 rounded-[26px] border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-amber-50">
                {lang === "zh" ? "书架状态" : "Shelf status"}
              </h2>
              <Link to={hasPrimaryChart ? "/me/profile" : "/ritual"} search={hasPrimaryChart ? undefined : ({ returnTo: "/me/home" } as never)} className="text-xs text-amber-300">
                {hasPrimaryChart ? (lang === "zh" ? "管理" : "Manage") : (lang === "zh" ? "建档" : "Setup")}
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {appProgress.map((step, index) => (
                <div key={step.en} className="rounded-2xl border border-white/10 bg-[#11130f] p-3">
                  <span className={`grid size-7 place-items-center rounded-full text-xs ${step.done ? "bg-emerald-300/16 text-emerald-100" : "bg-amber-300/12 text-amber-100"}`}>
                    {step.done ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : index + 1}
                  </span>
                  <p className="mt-2 text-[12px] leading-snug text-amber-100/82">
                    {lang === "zh" ? step.zh : step.en}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-3">
            {shelfSections.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-amber-300/18 bg-amber-300/[0.07] text-amber-200">
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-amber-50">{item.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-amber-100/55">{item.body}</span>
                  </span>
                  <span className="text-amber-100/35">
                    <ArrowRight aria-hidden className="h-5 w-5" />
                  </span>
                </>
              );
              if ("onClick" in item) {
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={item.onClick}
                    className="flex min-h-[96px] items-center gap-3 rounded-[24px] border border-amber-300/18 bg-[#11110f]/82 p-3 text-left active:scale-[0.985]"
                  >
                    {content}
                  </button>
                );
              }
              return (
                <Link
                  key={item.title}
                  to={item.to}
                  className="flex min-h-[96px] items-center gap-3 rounded-[24px] border border-white/10 bg-white/[0.04] p-3 active:scale-[0.985]"
                >
                  {content}
                </Link>
              );
            })}
          </section>
        </div>
      </div>
    );
  }



  return (
    <div className="pl-shell min-h-screen bg-[#0a0a12]/25 text-amber-50">
      <div className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-6">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShelfView("overview")}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-amber-300/18 bg-white/[0.035] px-3 text-xs text-amber-100/80 active:scale-[0.98]"
          >
            <ArrowRight aria-hidden className="h-4 w-4 rotate-180" />
            {lang === "zh" ? "返回书架" : "Back to shelf"}
          </button>
          <Link to="/" className="text-xs text-amber-300/80">
            {lang === "zh" ? "回首页" : "Home"}
          </Link>
        </div>
        {/* Demo banner — only while no real primary chart drives the page. */}
        {!usingRealChart && (
          <div className="mb-6 rounded-lg border border-amber-400/30 bg-amber-500/5 px-4 py-2 text-xs text-amber-200/90">
            {d.demo_banner_home}
          </div>
        )}


        {/* Curator welcome bookmark & reading-path breadcrumb render below
            the header — see CuratorWelcomeBookmark. */}




        {/* Page title — "My Library" is the personal reading desk. Today's Fate is its default first module. */}
        <header className="pl-header mb-6">
          <div className="text-[10px] uppercase tracking-[0.36em] text-amber-300/60">
            {lang === "zh" ? "命运图书馆 · 我的书架" : "Destiny Library · My Library"}
          </div>
          <h1 className="mt-2 font-serif text-3xl tracking-wide md:text-4xl">
            {lang === "zh" ? "今日命运" : "Today's Fate"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-amber-100/70">
            {lang === "zh"
              ? "今日重点、六领域白话建议、未来 7 天走向。"
              : "Today's headline, plain-language notes across six domains, and the 7-day arc."}
          </p>
        </header>

        {/* Shared personal-workspace sub-nav (Today's Fate active) */}
        <PersonalWorkspaceNav active="/me/home" />
        <div id="today" className="sr-only" aria-hidden />
        <p className="sr-only" data-testid="home-purpose-hint">
          {lang === "zh"
            ? "今日命运"
            : "Today's fate"}
        </p>

        <section
          className="mb-6 overflow-hidden rounded-lg border border-amber-300/20 bg-[#080810]/80 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.95)]"
          data-testid="app-command-center"
        >
          <div className="border-b border-amber-300/12 px-4 py-4 md:px-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-amber-200/60">
                  <CalendarCheck aria-hidden className="h-4 w-4" />
                  {lang === "zh" ? "今日操作台" : "Today Command Center"}
                </div>
                <h2 className="mt-2 font-serif text-2xl leading-tight text-amber-50">
                  {hasPrimaryChart
                    ? lang === "zh"
                      ? "先看今日重点，再进入需要的房间。"
                      : "Start with today's priority, then enter the right room."
                    : lang === "zh"
                      ? "先建立主命盘，App 才会变成你的个人书房。"
                      : "Build your primary chart first, then the app becomes your library."}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-amber-100/68">
                  {lang === "zh"
                    ? "从今日阅读开始，接着管理命盘、关系、回声与会员。"
                    : "Start with today, then charts, relationships, echoes and membership."}
                </p>
              </div>
              <Link
                to={hasPrimaryChart ? "/me/profile" : "/ritual"}
                search={hasPrimaryChart ? undefined : ({ returnTo: "/me/home" } as never)}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-medium text-[#111016] hover:bg-amber-200"
              >
                {hasPrimaryChart
                  ? lang === "zh"
                    ? "管理命盘"
                    : "Manage charts"
                  : lang === "zh"
                    ? "开始建档"
                    : "Start setup"}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid border-b border-amber-300/12 md:grid-cols-3">
            {appProgress.map((step, index) => (
              <Link
                key={step.en}
                to={step.to}
                search={step.to === "/ritual" ? ({ returnTo: "/me/home" } as never) : undefined}
                className="flex min-h-16 items-center gap-3 border-amber-300/12 px-4 py-3 text-left hover:bg-amber-300/[0.05] md:border-r md:last:border-r-0"
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border text-xs ${
                    step.done
                      ? "border-emerald-300/35 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-300/25 bg-amber-300/8 text-amber-200"
                  }`}
                >
                  {step.done ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm text-amber-100">
                    {lang === "zh" ? step.zh : step.en}
                  </span>
                  <span className="mt-0.5 block text-xs text-amber-100/50">
                    {step.done
                      ? lang === "zh"
                        ? "已完成"
                        : "Complete"
                      : lang === "zh"
                        ? "下一步"
                        : "Next step"}
                  </span>
                </span>
              </Link>
            ))}
          </div>

          <div className="grid gap-px bg-amber-300/10 md:grid-cols-5">
            {[
              {
                icon: CalendarCheck,
                zh: "今日",
                en: "Today",
                bodyZh: "今日主线、六领域、七日趋势",
                bodyEn: "Priority, domains, 7-day arc",
                to: "/me/home" as const,
              },
              {
                icon: ChartNoAxesCombined,
                zh: "建档",
                en: "Profile",
                bodyZh: "主命盘、他人命盘、报告",
                bodyEn: "Charts, people, reports",
                to: "/me/profile" as const,
              },
              {
                icon: Handshake,
                zh: "关系",
                en: "Bonds",
                bodyZh: "好友邀请、便签、适配分析",
                bodyEn: "Invites, notes, matching",
                to: "/me/friends" as const,
              },
              {
                icon: Sparkles,
                zh: "探索",
                en: "Explore",
                bodyZh: "历史回声与同门设置",
                bodyEn: "Echoes and fellowship",
                to: "/me/echoes" as const,
              },
              {
                icon: ShieldCheck,
                zh: "账户",
                en: "Account",
                bodyZh: "会员、订单、工单",
                bodyEn: "Pass, orders, tickets",
                to: "/me/membership" as const,
              },
            ].map((item) => (
              <Link
                key={item.en}
                to={item.to}
                className="group min-h-28 bg-[#0b0b13]/95 p-4 hover:bg-[#11101a]"
              >
                <item.icon
                  aria-hidden
                  className="h-5 w-5 text-amber-300/75 transition group-hover:text-amber-200"
                  strokeWidth={1.8}
                />
                <div className="mt-3 text-sm font-medium text-amber-100">
                  {lang === "zh" ? item.zh : item.en}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-amber-100/55">
                  {lang === "zh" ? item.bodyZh : item.bodyEn}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section
          className="mb-6 grid gap-3 md:grid-cols-3"
          data-testid="app-guided-actions"
        >
          <Link
            to="/me/friends"
            className="rounded-lg border border-amber-300/18 bg-black/30 p-4 hover:border-amber-300/45 hover:bg-black/45"
          >
            <UserPlus aria-hidden className="h-5 w-5 text-amber-300/80" />
            <div className="mt-3 text-sm font-medium text-amber-100">
              {lang === "zh" ? "邀请一个可信好友" : "Invite a trusted friend"}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/58">
              {lang === "zh"
                ? "生成一次性邀请码，对方确认后才建立关系。"
                : "Create a one-time invite; the bond forms only after confirmation."}
            </p>
          </Link>
          <Link
            to="/me/match"
            className="rounded-lg border border-amber-300/18 bg-black/30 p-4 hover:border-amber-300/45 hover:bg-black/45"
          >
            <MessageCircle aria-hidden className="h-5 w-5 text-amber-300/80" />
            <div className="mt-3 text-sm font-medium text-amber-100">
              {lang === "zh" ? "查看适配分析" : "Open match analysis"}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/58">
              {lang === "zh"
                ? "从已保存命盘或匿名匹配池进入关系解读。"
                : "Use saved charts or the anonymous pool for relationship reading."}
            </p>
          </Link>
          <Link
            to="/me/echoes"
            className="rounded-lg border border-amber-300/18 bg-black/30 p-4 hover:border-amber-300/45 hover:bg-black/45"
          >
            <BookMarked aria-hidden className="h-5 w-5 text-amber-300/80" />
            <div className="mt-3 text-sm font-medium text-amber-100">
              {lang === "zh" ? "收藏历史回声" : "Save historical echoes"}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-amber-100/58">
              {lang === "zh"
                ? "把相似人生阶段的故事留下，作为之后回看的书签。"
                : "Keep similar life-stage stories as bookmarks for later."}
            </p>
          </Link>
        </section>




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



        {/* Date row + a collapsed "sample preview" area. The fixture switcher
            used to sit inline next to the date, which made demo charts look
            like the visitor's own reading. It now lives behind an explicit
            opt-in toggle inside its own bordered region. */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="text-sm text-amber-100/70">
              {fmtDate(today, tz)} · {tz}
              {samplePreview ? <> · {d.today_chart_label(FIXTURE_CHART_LABELS[fixtureKey][lang])}</> : null}
            </div>
            <button
              type="button"
              onClick={() => setSamplePreview((v) => !v)}
              aria-expanded={samplePreview}
              aria-controls="sample-preview-panel"
              className={`min-h-9 rounded-full border px-3 py-1 text-xs transition ${
                samplePreview
                  ? "border-amber-300 bg-amber-300/10 text-amber-100"
                  : "border-amber-400/20 text-amber-200/60 hover:border-amber-300/60"
              }`}
            >
              {lang === "zh" ? "样例预览" : "Sample preview"} · {samplePreview ? (lang === "zh" ? "开" : "On") : lang === "zh" ? "关" : "Off"}
            </button>
          </div>

          {samplePreview && (
            <div
              id="sample-preview-panel"
              className="mt-3 rounded-2xl border border-dashed border-amber-400/35 bg-amber-500/[0.04] p-4"
            >
              <p className="text-xs leading-relaxed text-amber-200/70">
                {lang === "zh"
                  ? "以下内容来自样例命盘，仅供演示，不是你本人的命盘。关闭此开关即可回到你自己的解读。"
                  : "The content below comes from a demo chart. It is not your own reading — switch this off to return to yours."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
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
            </div>
          )}
        </div>



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
          priorityDomain={(() => {
            const k = pickPriorityDomain(score.domains);
            return k ? domainLabel(k) : (lang === "zh" ? "总体" : "overall");
          })()}
          onPickConcern={changeConcern}
          onToggleEvidence={() => setShowEvidence((v) => !v)}
        />


        {/* Today's headline — one card, two columns. The score rail stays
            compact on the left; the right column carries the theme AND the
            AI reading so it is never a half-empty box. */}
        <section
          className="mb-8 overflow-hidden rounded-2xl border border-amber-400/30 bg-black/40"
          data-testid="today-headline"
        >
          <div className="grid gap-0 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
            {/* score rail */}
            <div className="flex flex-row items-center gap-4 border-b border-amber-400/15 px-5 py-4 md:flex-col md:items-start md:justify-center md:border-b-0 md:border-r md:px-6 md:py-6">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.22em] text-amber-200/60">
                  {d.overall_signal}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <div className="font-serif text-4xl leading-none text-amber-100 md:text-5xl">
                    {score.overall.score}
                  </div>
                  <div className="text-[11px] text-amber-200/70">{d.overall_out_of}</div>
                </div>
              </div>
              <div
                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${BAND_COLOR[score.overall.band]}`}
              >
                {xlate(d.band, score.overall.band)}
              </div>
            </div>

            {/* theme + AI reading */}
            <div className="min-w-0 px-5 py-5 md:px-6 md:py-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[10px] uppercase tracking-[0.22em] text-amber-200/60">
                  {d.today_theme}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    usingRealChart
                      ? "border-amber-300/50 text-amber-200/90"
                      : "border-dashed border-amber-400/40 text-amber-300/70"
                  }`}
                >
                  {usingRealChart
                    ? `${lang === "zh" ? "本人主命盘" : "Your primary chart"} · ${chartLabel}`
                    : `${lang === "zh" ? "样例命盘" : "Sample chart"} · ${chartLabel}`}
                </span>
              </div>

              <h2 className="mt-2 font-serif text-xl leading-snug text-amber-50 md:text-2xl">
                {ai?.one_line_theme ||
                  (score.partial ? d.theme_pending : d.theme_line(phaseName, themeKeywords))}
              </h2>

              <div className="mt-3 min-h-[3.5rem] text-sm leading-relaxed text-amber-100/85">
                {aiState === "loading" && !ai ? (
                  <div className="space-y-2" aria-live="polite">
                    <div className="h-3 w-11/12 animate-pulse rounded bg-amber-200/10" />
                    <div className="h-3 w-9/12 animate-pulse rounded bg-amber-200/10" />
                    <div className="h-3 w-7/12 animate-pulse rounded bg-amber-200/10" />
                  </div>
                ) : ai?.narrative ? (
                  <p>{ai.narrative}</p>
                ) : (
                  <p>{plain.overall.headline}</p>
                )}
              </div>

              {usingRealChart && !ai && aiState !== "loading" && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-amber-200/70">
                  <button
                    type="button"
                    onClick={() => aiSegments.ensure("overview")}
                    className="min-h-8 rounded-full border border-amber-300/50 px-3 py-1 text-amber-100 hover:bg-amber-500/10"
                  >
                    {lang === "zh" ? "生成今日 AI 解读" : "Generate AI reading"}
                  </button>
                  <span>
                    {lang === "zh"
                      ? "每日一次，为今日信号添一段馆员手记。"
                      : "Once a day, add a librarian's note to today's signal."}
                  </span>
                </div>
              )}

              {/* Today's actions — collapsed by default; expanding it is what
                  triggers this section's own (small) AI call. */}
              {usingRealChart && (
                <div className="mt-4 rounded-lg border border-amber-400/20 bg-black/20">
                  <button
                    type="button"
                    data-testid="daily-actions-toggle"
                    aria-expanded={actionsOpen}
                    onClick={toggleActions}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs text-amber-100/85 hover:bg-amber-500/[0.06]"
                  >
                    <span>{lang === "zh" ? "今天可以做 / 今天留意" : "Do today / Observe today"}</span>
                    <span className="text-amber-300/70">{actionsOpen ? "−" : "+"}</span>
                  </button>

                  {actionsOpen && (
                    <div className="border-t border-amber-400/15 px-3 py-3">
                      {actions.status === "loading" && (
                        <div className="space-y-2" aria-live="polite">
                          <div className="h-3 w-10/12 animate-pulse rounded bg-amber-200/10" />
                          <div className="h-3 w-8/12 animate-pulse rounded bg-amber-200/10" />
                        </div>
                      )}
                      {actions.status === "error" && (
                        <div className="flex flex-wrap items-center gap-3 text-xs text-rose-200/80">
                          <span>
                            {lang === "zh"
                              ? "这一段暂时没有取回，稍后再试。"
                              : "This section could not be fetched; try again."}
                          </span>
                          <button
                            type="button"
                            onClick={() => aiSegments.retry("actions")}
                            className="min-h-8 rounded-full border border-amber-300/50 px-3 py-1 text-amber-100 hover:bg-amber-500/10"
                          >
                            {lang === "zh" ? "重试" : "Retry"}
                          </button>
                        </div>
                      )}
                      {actions.status === "idle" && (
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/[0.06] p-3">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">
                              {lang === "zh" ? "今天可以做" : "Do today"}
                            </div>
                            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-emerald-50/90">
                              {(actions.data?.do_today.length
                                ? actions.data.do_today
                                : supportive.slice(0, 3)
                              ).map((s: string, i: number) => (
                                <li key={i}>· {s}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-3">
                            <div className="text-[10px] uppercase tracking-[0.2em] text-amber-200/80">
                              {lang === "zh" ? "今天留意" : "Observe today"}
                            </div>
                            <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-amber-50/90">
                              {(actions.data?.observe_today.length
                                ? actions.data.observe_today
                                : caution.slice(0, 3)
                              ).map((s: string, i: number) => (
                                <li key={i}>· {s}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}


              {aiState === "error" && (
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-rose-200/80">
                  <span>
                    {lang === "zh"
                      ? "今日解读暂时生成失败，已显示确定性文本。"
                      : "The AI reading failed; the deterministic text is shown instead."}
                  </span>
                  <button
                    type="button"
                    onClick={retryAi}
                    className="min-h-8 rounded-full border border-amber-300/50 px-3 py-1 text-amber-100 hover:bg-amber-500/10"
                  >
                    {lang === "zh" ? "重试" : "Retry"}
                  </button>
                </div>
              )}

              {!usingRealChart && real.kind === "ready" && !primaryChart && (
                <p className="mt-3 text-xs text-amber-200/70">
                  {lang === "zh"
                    ? "还没有主命盘，暂以样例演示。完成开启仪式后，这里会换成你自己的今日解读。"
                    : "No primary chart yet — a sample is shown. Complete the ritual to see your own reading."}
                </p>
              )}
              {usingRealChart && realDaily?.geoUnresolved && (
                <p className="mt-3 text-xs text-amber-200/60">
                  {lang === "zh"
                    ? "出生地未能解析为坐标，已按当地正午近似计算，置信度较低。"
                    : "Birth place could not be resolved; a local-noon approximation is used (lower confidence)."}
                </p>
              )}

              {score.contradictions.length > 0 && (
                <div className="mt-4 rounded-md border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-100/80">
                  <div className="mb-1 font-semibold text-amber-200">{d.contradictions_title}</div>
                  {score.contradictions.map((c, i) => (
                    <div key={i}>{formatContradiction(c, d, lang)}</div>
                  ))}
                </div>
              )}

              <p className="mt-4 text-[11px] leading-relaxed text-amber-100/55">
                {d.overall_note}
              </p>
            </div>
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



        {/* Domain cards — each opens its full plain-language reading in a modal,
            so the page layout never shifts (replaces the old inline <details>). */}
        <section
          className="mb-8 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
          data-testid="domain-card-grid"
        >
          {score.domains.map((dd) => {
            const pd = plain.domains.find((x) => x.domain === dd.domain);
            return (
              <button
                key={dd.domain}
                type="button"
                data-testid={`domain-card-${dd.domain}`}
                aria-haspopup="dialog"
                onClick={() => {
                  if (!pd) return;
                  aiSegments.ensure(domainSegmentId(dd.domain));
                  setDomainDetail({
                    key: dd.domain,
                    label: domainLabel(dd.domain),
                    score: dd.score,
                    bandLabel: xlate(d.band, dd.band),
                    bandClass: BAND_COLOR[dd.band],
                    confidenceLabel: xlate(d.confidence, dd.confidence),
                    headline: pd.headline,
                    mayShowAs: pd.may_show_as,
                    doToday: pd.do_today,
                    avoidToday: pd.avoid_today,
                    weekTrend: pd.week_trend,
                    breakdown: dd.breakdown,
                  });
                }}
                className="group rounded-xl border border-amber-400/20 bg-black/30 p-4 text-left transition hover:border-amber-300/60 hover:bg-black/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
              >
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
                {(() => {
                  const seg = aiSegments.get(domainSegmentId(dd.domain));
                  const aiLine = seg.data?.domain_lines.find(
                    (x: { domain: string }) => x.domain === dd.domain,
                  )?.line;
                  return aiLine ? (
                    <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-amber-100/75">
                      {aiLine}
                    </p>
                  ) : null;
                })()}
                <div className="mt-2 text-[10px] text-amber-300/70 group-hover:text-amber-200">
                  {lang === "zh" ? "查看详细解读 →" : "Open full reading →"}
                </div>

              </button>
            );
          })}
        </section>

        <DomainDetailDialog
          lang={lang}
          payload={domainDetail}
          aiNote={activeDomainSeg?.data?.narrative || undefined}
          aiLine={
            domainDetail
              ? activeDomainSeg?.data?.domain_lines.find(
                  (x: { domain: string }) => x.domain === domainDetail.key,
                )?.line
              : undefined
          }
          aiDoToday={activeDomainSeg?.data?.do_today ?? []}
          aiObserveToday={activeDomainSeg?.data?.observe_today ?? []}
          aiStatus={activeDomainSeg?.status ?? "idle"}
          onRetryAi={
            domainDetail
              ? () => aiSegments.retry(domainSegmentId(domainDetail.key))
              : undefined
          }
          onOpenChange={(open) => {
            if (!open) setDomainDetail(null);
          }}
        />



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
                  <p className="text-amber-200/70">分数是今日天气，不是命运判决；出门时记得带伞，也记得阳光会回来。</p>
                </>
              ) : (
                <>
                  <p>Every domain starts at a neutral 50. Harmonious signals add; straining signals subtract.</p>
                  <p>Contribution = direction(±1) × domain-weight(1–3) × orb-factor × 2. Orb-factor = max(0.2, 1 - orb/6) — closer to exact, larger effect.</p>
                  <p>Mercury weights higher for study/comms; Venus & Moon for relationships; Jupiter/Venus/Saturn for finance; Moon & Sun for body-mind (see DOMAIN_WEIGHTS).</p>
                  <p>Overall = mean of 5 domains × 60% + the most-off-neutral domain × 40%. Missing data pulls back to 50 with lowered confidence.</p>
                  <p className="text-amber-200/70">Scores are today's weather, not a verdict; bring an umbrella, but remember the sun returns.</p>
                </>
              )}
            </div>
          </details>
        </section>

        {/* Per-domain readings now open from the domain cards above (modal),
            so this page no longer repeats the same six blocks inline. */}



        {/* Counter + reflection */}
        <section className="mb-8 rounded-xl border border-amber-400/20 bg-black/30 p-5 text-sm">
          <div className="text-xs uppercase tracking-widest text-amber-200/70">
            {d.countercondition_title}
          </div>
          <p className="mt-2 text-amber-100/80">
            {actions.data?.countercondition || d.countercondition_body}
          </p>
          <div className="mt-4 text-xs uppercase tracking-widest text-amber-200/70">
            {d.reflection_title}
          </div>
          <p className="mt-2 text-amber-100/80">
            {actions.data?.reflection_question || d.reflection_body}
          </p>

        </section>

        {/* Cross-module CTA — Historical Echoes lives on its own page. */}
        <section
          className="mb-12 rounded-xl border border-amber-400/25 bg-black/30 px-5 py-5"
          data-testid="home-echoes-cta"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
                {lang === "zh" ? "跨模块" : "Cross-module"}
              </div>
              <h3 className="mt-1 font-serif text-lg text-amber-100">
                {lang === "zh"
                  ? "去历史回声寻找相似人生阶段"
                  : "Find peers in a similar life chapter"}
              </h3>
              <p className="mt-1 text-xs text-amber-100/60">
                {lang === "zh"
                  ? "历史人物、同龄故事与人生阶段推荐已整合到「历史回声」。"
                  : "Historical figures, peer stories and life-stage matches now live on Historical Echoes."}
              </p>
            </div>
            <Link
              to="/me/echoes"
              className="inline-flex min-h-11 items-center rounded-full border border-amber-300/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
            >
              {lang === "zh" ? "打开历史回声 →" : "Open Historical Echoes →"}
            </Link>
          </div>
        </section>





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

// HomeHubCards removed — duplicated PersonalWorkspaceNav entries.
// Library sub-nav is now the single canonical entry point for /me/*.

