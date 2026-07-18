import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  HeartPulse,
  HeartHandshake,
  Coins,
  Moon,
  Sparkles,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";

function watchlistIcon(theme: string): { Icon: LucideIcon; tint: string; label: [string, string] } {
  const k = theme.toLowerCase();
  if (/(career|职|事业|工作|门|职场|晋升|leader|role)/i.test(theme) || /career|role|leader|promot/.test(k))
    return { Icon: Briefcase, tint: "sky", label: ["Career", "事业"] };
  if (/(health|健康|身|重置|reset|sleep|睡|体|vitality)/i.test(theme))
    return { Icon: HeartPulse, tint: "rose", label: ["Health", "健康"] };
  if (/(love|情|婚|相遇|partner|marriage|relation|synastry)/i.test(theme))
    return { Icon: HeartHandshake, tint: "pink", label: ["Love", "情感"] };
  if (/(wealth|财|money|复利|compound|asset|equity)/i.test(theme))
    return { Icon: Coins, tint: "amber", label: ["Wealth", "财富"] };
  if (/(quiet|静|隐|慢|reflect|sabbatical|inward)/i.test(theme))
    return { Icon: Moon, tint: "violet", label: ["Reflection", "静修"] };
  return { Icon: Sparkles, tint: "gold", label: ["Turning", "转折"] };
}

const TINT_CLASSES: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  sky:    { border: "border-sky-300/30",    bg: "bg-sky-300/[0.06]",    text: "text-sky-200",    dot: "bg-sky-300" },
  rose:   { border: "border-rose-300/30",   bg: "bg-rose-300/[0.06]",   text: "text-rose-200",   dot: "bg-rose-300" },
  pink:   { border: "border-pink-300/30",   bg: "bg-pink-300/[0.06]",   text: "text-pink-200",   dot: "bg-pink-300" },
  amber:  { border: "border-amber-300/30",  bg: "bg-amber-300/[0.06]",  text: "text-amber-200",  dot: "bg-amber-300" },
  violet: { border: "border-violet-300/30", bg: "bg-violet-300/[0.06]", text: "text-violet-200", dot: "bg-violet-300" },
  gold:   { border: "border-gold-dust/40",  bg: "bg-gold-dust/[0.08]",  text: "text-gold-light", dot: "bg-gold-dust" },
};


import { useLang, type Lang } from "@/lib/i18n";
import { useAccount } from "@/lib/account";
import { ChartZoomModal } from "@/components/charts/DestinyCharts";
import { PremiumPdfCard } from "@/components/PremiumPdfCard";
import { SageAvatar } from "@/components/SageAvatar";
import { TAROT_78, type TarotCard } from "@/lib/tarot-deck";
import { askOracle } from "@/lib/oracle.functions";
import { TAROT_LIMITS, tarotConsume, tarotRemaining } from "@/lib/tarot-quota";
import { generateChartOutlook, type OutlookAI } from "@/lib/outlook.functions";
import {
  buildReportFingerprint,
  buildReportRequest,
  type ReportSearchLike,
} from "@/lib/report-input";
import { OUTLOOK_AI_VERSION } from "@/lib/ai-cache-version";
import { computeEnergyRange } from "@/lib/energy-score";
import { YearInsightModal, type YearInsightPoint } from "@/components/YearInsightModal";



/* ═══════════════════════════════════════════
   Shared AI outlook (timeline + 90-day windows)
   — one AI call, cached in sessionStorage + saved reading
═══════════════════════════════════════════ */

function useChartOutlook(search: ReportSearchLike | undefined, lang: Lang) {
  const { findReading, updateReadingAI } = useAccount();
  const [outlook, setOutlook] = useState<OutlookAI | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const inflight = useRef(0);
  const outlookLang = search?.lang ?? lang;

  const fingerprint = useMemo(
    () => (search?.date ? buildReportFingerprint(search, outlookLang) : ""),
    [search, outlookLang],
  );

  useEffect(() => {
    if (!search?.date || !fingerprint) {
      setOutlook(null);
      setState("idle");
      return;
    }
    const cacheKey = `destiny-ai-outlook::${OUTLOOK_AI_VERSION}::${fingerprint}`;

    // 1. Saved reading (persisted across sessions).
    const savedHit = findReading({
      id: search.readingId,
      fingerprint,
      name: search.name ?? "Anonymous",
      date: search.date,
      time: search.time,
      place: search.place,
      lang: outlookLang,
    });
    if (savedHit?.aiOutlook && savedHit.aiOutlookVersion === OUTLOOK_AI_VERSION) {
      setOutlook(savedHit.aiOutlook);
      setState("ready");
      return;
    }

    // 2. Session cache.
    try {
      const cached = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(cacheKey) : null;
      if (cached) {
        const parsed = JSON.parse(cached) as OutlookAI;
        setOutlook(parsed);
        setState("ready");
        return;
      }
    } catch {
      /* ignore */
    }

    // 3. Generate.
    const reqId = ++inflight.current;
    setOutlook(null);
    setState("loading");
    generateChartOutlook({ data: buildReportRequest(search, outlookLang) })
      .then((res) => {
        if (reqId !== inflight.current) return;
        setOutlook(res);
        setState("ready");
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res));
        } catch {
          /* ignore quota */
        }
        updateReadingAI(fingerprint, {
          aiOutlook: res,
          aiOutlookVersion: OUTLOOK_AI_VERSION,
          fingerprint,
        });
      })
      .catch((err) => {
        if (reqId !== inflight.current) return;
        console.warn("outlook generation failed", err);
        setState("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fingerprint]);

  return { outlook, state, fingerprint };
}


/* ═══════════════════════════════════════════
   Life Timeline — 大运 / Dashā decades
═══════════════════════════════════════════ */

type Decade = {
  from: number;
  to: number;
  theme: [string, string];
  detail: [string, string];
};

const DECADES: Decade[] = [
  { from: 0, to: 10, theme: ["Root", "扎根"], detail: [
    "Family shapes the temperament — the chart lays its foundation quietly.",
    "家庭塑造性情 —— 命盘在此静静打地基。",
  ] },
  { from: 10, to: 20, theme: ["Sprout", "萌发"], detail: [
    "Mind opens, first attractions and ambitions surface.",
    "心智开启，第一批渴望与野心浮现。",
  ] },
  { from: 20, to: 30, theme: ["Search", "求索"], detail: [
    "Career takes its first real shape; relationships teach more than they last.",
    "事业初具雏形；感情多在教你，而非陪你走远。",
  ] },
  { from: 30, to: 40, theme: ["Forge", "锻造"], detail: [
    "The chart's Officer/Wealth cycle turns — the years you build who you are.",
    "官运财运齐动的十年 —— 你在此炼成真正的自己。",
  ] },
  { from: 40, to: 50, theme: ["Bloom", "盛放"], detail: [
    "Peak of vocation and public influence. The library reads this decade brightest.",
    "事业与影响力的顶峰。此十年最为明亮。",
  ] },
  { from: 50, to: 60, theme: ["Harvest", "收获"], detail: [
    "Wealth compounds, teaching begins. Time to translate — not to prove.",
    "财富开始复利，教学之时。宜翻译传承，不再证明。",
  ] },
  { from: 60, to: 70, theme: ["Return", "回归"], detail: [
    "Inward turn. Relationships and meaning outweigh position and title.",
    "向内回转。关系与意义，重于位置与头衔。",
  ] },
  { from: 70, to: 80, theme: ["Distill", "凝定"], detail: [
    "The chart's quiet chapter — health and legacy come into focus.",
    "命盘中安静的一章 —— 健康与传承，成为主线。",
  ] },
];

function computeCurrentAge(birthISO?: string): number | null {
  if (!birthISO) return null;
  const d = new Date(birthISO);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return Math.max(0, Math.min(age, 90));
}

// Turn a birth string into a stable 32-bit seed so every visitor gets a
// different — but consistent — timeline shape.
function birthSeed(birthISO?: string): number {
  const s = birthISO || "0000-00-00";
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

export function LifeTimeline({
  birthISO,
  search,
  chartId,
}: {
  birthISO?: string;
  search?: ReportSearchLike;
  chartId?: string | null;
}) {
  const { lang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const age = computeCurrentAge(birthISO);
  const currentDecadeIndex = age == null ? 3 : Math.min(DECADES.length - 1, Math.floor(age / 10));
  const [active, setActive] = useState<number>(currentDecadeIndex);

  const { account } = useAccount();
  const plan = (account?.plan ?? "free") as "free" | "sage" | "oracle";
  const isSage = plan === "sage" || plan === "oracle";
  const isLocked = !isSage && active !== currentDecadeIndex;
  const openAccount = () => window.dispatchEvent(new Event("lod:open-account"));

  const { outlook, state: aiState } = useChartOutlook(search, lang);
  const aiDecade = outlook?.timeline.decades[active];

  const nowPct = age == null ? null : Math.min(100, (age / 80) * 100);
  const fallbackDecade = DECADES[active];
  const seed = birthSeed(birthISO);

  const personalTintEn = [
    "For you specifically, this decade tilts toward outward proof more than inward retreat.",
    "For you, this decade rewards steady craft over sudden leaps — the ledger compounds quietly.",
    "In your chart, this decade opens two relationship-shaped doors: choose the slower one.",
    "For you, the second half of this decade is louder than the first — protect early rest.",
    "In your chart, this decade rebuilds around one honest conversation you've postponed.",
    "For you, this decade's real currency is trust — build a small, deep circle over a broad one.",
    "In your chart, this decade tilts your body's demand upward — treat sleep as strategy.",
    "For you, this decade closes with a decision that redefines the next twenty years.",
  ];
  const personalTintZh = [
    "在你的盘里,这十年更偏「向外证明」,而非「向内退守」。",
    "在你的盘里,这十年奖励稳定的手艺胜过突然的跳跃 —— 账本悄悄复利。",
    "在你的盘里,这十年打开两扇「关系形状」的门:选那扇慢的。",
    "在你的盘里,这十年的下半段比上半段更响 —— 提早护住休息。",
    "在你的盘里,这十年围绕一次被拖延的诚实对话,进行重建。",
    "在你的盘里,这十年的真正货币是「信任」—— 养一个小而深的圈子。",
    "在你的盘里,这十年身体的诉求会上抬 —— 把睡眠当作策略。",
    "在你的盘里,这十年以一次「重新定义未来二十年」的决定收束。",
  ];
  const fallbackTint = (lang === "zh" ? personalTintZh : personalTintEn)[
    ((seed + active * 2654435761) >>> 0) % 8
  ];

  const theme = aiDecade?.theme?.trim() || fallbackDecade.theme[li];
  const detail = aiDecade?.detail?.trim() || fallbackDecade.detail[li];
  const personalTint = aiDecade?.personalTint?.trim() || fallbackTint;

  const currentRange = `${DECADES[currentDecadeIndex].from}–${DECADES[currentDecadeIndex].to}`;

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {t.tl_kicker}
            </p>
            <h2 className="font-serif text-2xl italic text-stone-warm md:text-3xl">
              {t.tl_title}
            </h2>
          </div>
          {age != null && (
            <span className="rounded-full border border-gold-dust/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-light">
              {t.tl_now} · {age} {lang === "zh" ? "岁" : ""}
            </span>
          )}
        </div>

        <p className="mb-2 max-w-3xl text-sm text-stone-warm/60">{t.tl_hint}</p>
        {!isSage && age != null && (
          <p className="mb-4 max-w-3xl text-[11px] leading-relaxed text-gold-dust/70">
            {lang === "zh"
              ? `当前免费开放你所处的 ${currentRange} 岁十年的逐年细读,其余十年需开通「贤者」查看。`
              : `Your current decade (${currentRange}) is unlocked for free — unlock Sage to read the other decades.`}
          </p>
        )}
        {aiState === "loading" && (
          <p className="mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
            <span className="size-1.5 animate-pulse rounded-full bg-gold-dust" />
            {lang === "zh" ? "正在依据你的大运与行运重写……" : "Rewriting from your luck pillars & transits…"}
          </p>
        )}
        {outlook?.timeline.summary && (
          <p className="mb-8 max-w-3xl font-serif text-base italic leading-relaxed text-gold-light/80">
            {outlook.timeline.summary}
          </p>
        )}

        <div className="relative mb-10">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-gold-dust/40 to-transparent" />
          {nowPct != null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
              style={{ left: `${nowPct}%` }}
            >
              <span className="block size-3 animate-pulse-gold rounded-full bg-gold-dust shadow-[0_0_20px_hsl(45_70%_60%/0.7)]" />
            </motion.div>
          )}
          <div className="relative grid grid-cols-8 gap-2">
            {DECADES.map((d, i) => {
              const isActive = i === active;
              const isPast = age != null && age >= d.to;
              const isNow = age != null && age >= d.from && age < d.to;
              const isLockedDot = !isSage && i !== currentDecadeIndex;
              return (
                <button
                  key={d.from}
                  type="button"
                  onClick={() => setActive(i)}
                  className="group flex flex-col items-center gap-3 py-2"
                  title={
                    isLockedDot
                      ? lang === "zh"
                        ? "贤者会员可查看"
                        : "Sage members only"
                      : undefined
                  }
                >
                  <span
                    className={`relative size-4 rounded-full border transition-all ${
                      isActive
                        ? "border-gold-dust bg-gold-dust scale-125"
                        : isNow
                          ? "border-gold-dust bg-gold-dust/40"
                          : isPast
                            ? "border-gold-dust/40 bg-gold-dust/20"
                            : "border-white/20 bg-transparent group-hover:border-gold-dust/60"
                    }`}
                  >
                    {isLockedDot && (
                      <span className="absolute -right-1.5 -top-1.5 text-[9px] leading-none">🔒</span>
                    )}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-[0.22em] transition-colors ${
                      isActive ? "text-gold-light" : "text-stone-warm/50 group-hover:text-gold-dust"
                    }`}
                  >
                    {d.from}–{d.to}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-gold-dust/20 bg-gold-dust/[0.04] p-6 md:p-8"
          >
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {lang === "zh"
                ? `${fallbackDecade.from}–${fallbackDecade.to} 岁${active === currentDecadeIndex ? " · 当前十年" : ""}`
                : `${t.tl_age} ${fallbackDecade.from}–${fallbackDecade.to}${active === currentDecadeIndex ? " · current" : ""}`}
            </p>

            {isLocked ? (
              <div className="flex flex-col items-start gap-4 py-4">
                <h3 className="font-serif text-2xl italic text-gold-light/80">
                  {lang === "zh" ? "贤者会员专属" : "Sage members only"}
                </h3>
                <p className="max-w-lg text-sm leading-relaxed text-stone-warm/70">
                  {lang === "zh"
                    ? `你目前处于 ${currentRange} 岁十年,该阶段已为你免费开放逐年细读。${fallbackDecade.from}–${fallbackDecade.to} 岁的逐年推演、大运干支与行运佐证,需开通「贤者」查看。`
                    : `Your current decade (${currentRange}) is unlocked for free. Year-by-year details, luck pillars and transit evidence for age ${fallbackDecade.from}–${fallbackDecade.to} are available to Sage members.`}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={openAccount}
                    className="rounded-full border border-gold-dust/60 bg-gold-dust/10 px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-gold-light hover:bg-gold-dust/20"
                  >
                    {lang === "zh" ? "开通贤者 →" : "Unlock Sage →"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive(currentDecadeIndex)}
                    className="rounded-full border border-white/15 px-4 py-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/70 hover:text-gold-light"
                  >
                    {lang === "zh" ? "返回当前十年" : "Back to current decade"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="mb-4 font-serif text-2xl italic text-gold-light">{theme}</h3>
                <p className="mb-3 font-serif text-lg leading-relaxed text-stone-warm/85">
                  {detail}
                </p>
                <p className="mb-6 font-serif text-[15px] italic leading-relaxed text-gold-light/80">
                  {personalTint}
                </p>

                <YearByYearChart
                  from={fallbackDecade.from}
                  to={fallbackDecade.to}
                  age={age}
                  lang={lang}
                  birthISO={birthISO}
                  aiYears={aiDecade?.years}
                  chartId={chartId ?? null}
                />
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

// Deterministic pseudo-random from a seed integer.
function prand(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Year-by-year visualization within a decade — deterministic energy
// trend (line + soft area) driven by `computeEnergyScore`. AI provides
// only textual themes for the linked list below; the y-axis values
// come exclusively from the calculation module. When birthISO is
// missing/invalid, the chart shows an "insufficient data" placeholder
// and never invents a curve.
function YearByYearChart({
  from,
  to,
  age,
  lang,
  birthISO,
  aiYears,
}: {
  from: number;
  to: number;
  age: number | null;
  lang: Lang;
  birthISO?: string;
  aiYears?: { age: number; intensity: number; theme: string }[];
}) {
  const range = computeEnergyRange(birthISO, from, to);
  const themesEn = [
    "seeding — a quiet beginning",
    "opening — a first door",
    "learning — a skill takes root",
    "friction — a lesson through resistance",
    "breakthrough — visibility rises",
    "harvest — recognition and return",
    "consolidation — you keep what works",
    "shedding — release what no longer fits",
    "pivot — direction quietly changes",
    "integration — the decade completes",
  ];
  const themesZh = [
    "播种 —— 安静的起点",
    "开门 —— 第一次机会",
    "扎根 —— 一项能力落地",
    "磨合 —— 阻力中习得的功课",
    "突破 —— 可见度上升",
    "收获 —— 被看见与回响",
    "巩固 —— 留下真正有用的",
    "剥离 —— 放下不再合身的",
    "转向 —— 方向悄然改变",
    "整合 —— 十年的收束",
  ];
  const pool = lang === "zh" ? themesZh : themesEn;
  const [hovered, setHovered] = useState<number | null>(null);
  const [openYear, setOpenYear] = useState<YearInsightPoint | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const birthYear = useMemo(() => {
    if (!birthISO) return null;
    const d = new Date(birthISO);
    return Number.isNaN(d.getTime()) ? null : d.getFullYear();
  }, [birthISO]);

  const openYearAt = (i: number, opener: HTMLElement | null) => {
    const p = years[i];
    if (!p) return;
    openerRef.current = opener;
    setOpenYear({
      age: p.age,
      score: p.score,
      theme: p.theme,
      year: birthYear != null ? birthYear + p.age : null,
      confidence: "reference",
      reference: true,
    });
  };


  // Insufficient-data path — never fabricate a line.
  if (!range) {
    return (
      <div className="mt-2 rounded-xl border border-white/10 bg-obsidian/40 p-4 text-center md:p-5">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {lang === "zh" ? "生命时间轴 · 大运能量趋势" : "Life timeline · relative energy trend"}
        </p>
        <p className="text-[12px] leading-relaxed text-stone-warm/60">
          {lang === "zh"
            ? "缺少完整的出生资料，暂无法计算能量趋势。"
            : "Not enough birth data to compute the energy trend."}
        </p>
      </div>
    );
  }

  const years = range.map((p, i) => {
    const aiTheme = aiYears?.find((y) => y.age === p.age)?.theme?.trim();
    return {
      age: p.age,
      score: p.score,
      theme: aiTheme || pool[i % pool.length],
      isNow: age != null && age === p.age,
      isPast: age != null && age > p.age,
    };
  });

  // SVG layout — the viewBox uses a fixed 1000 × 220 canvas that
  // scales via width=100%. Y padding keeps the line clear of edges.
  const W = 1000;
  const H = 220;
  const padX = 32;
  const padTop = 20;
  const padBot = 40;
  const n = years.length;
  const stepX = (W - padX * 2) / Math.max(1, n - 1);
  // Local Y domain with padding so subtle changes remain readable,
  // but is always labelled "relative trend" — see caption below.
  const scores = years.map((y) => y.score);
  const minS = Math.min(...scores);
  const maxS = Math.max(...scores);
  const domainMin = Math.max(0, minS - 8);
  const domainMax = Math.min(100, maxS + 8);
  const domainSpan = Math.max(1, domainMax - domainMin);
  const yFor = (score: number) =>
    padTop + ((H - padTop - padBot) * (domainMax - score)) / domainSpan;
  const points = years.map((y, i) => ({ x: padX + i * stepX, y: yFor(y.score), ...y }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(2)},${H - padBot} L${points[0].x.toFixed(2)},${H - padBot} Z`;
  const nowPoint = points.find((p) => p.isNow) ?? null;
  const activeIdx = hovered != null
    ? Math.max(0, Math.min(n - 1, hovered))
    : nowPoint
      ? points.indexOf(nowPoint)
      : -1;
  const activePoint = activeIdx >= 0 ? points[activeIdx] : null;

  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-obsidian/40 p-4 md:p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {lang === "zh" ? "生命时间轴 · 大运能量趋势" : "Life timeline · relative energy trend"}
        </p>
        <p className="text-[10px] uppercase tracking-[0.22em] text-stone-warm/40">
          {lang === "zh" ? `${domainMin}–${domainMax}` : `${domainMin}–${domainMax}`}
        </p>
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-stone-warm/55">
        {lang === "zh"
          ? "仅为相对趋势，用于观察阶段变化，不代表绝对吉凶。"
          : "Relative trend only — for observing phase shifts, not absolute fortune."}
      </p>

      <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="min-w-[520px] md:min-w-0">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={lang === "zh" ? "大运能量趋势图" : "Relative energy trend chart"}
            className="block h-40 w-full md:h-48"
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              <linearGradient id="energy-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="hsl(45 70% 60%)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="hsl(45 70% 60%)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {/* Baseline */}
            <line
              x1={padX}
              x2={W - padX}
              y1={H - padBot}
              y2={H - padBot}
              stroke="hsl(0 0% 100% / 0.08)"
              strokeWidth={1}
            />
            {/* Vertical "now" reference line */}
            {nowPoint && (
              <line
                x1={nowPoint.x}
                x2={nowPoint.x}
                y1={padTop - 4}
                y2={H - padBot}
                stroke="hsl(45 70% 60% / 0.45)"
                strokeDasharray="3 4"
                strokeWidth={1}
              />
            )}
            <path d={areaPath} fill="url(#energy-area)" />
            <path
              d={linePath}
              fill="none"
              stroke="hsl(45 70% 60%)"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((p, i) => (
              <g key={p.age}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.isNow ? 6 : 3.5}
                  fill={p.isNow ? "hsl(45 80% 65%)" : p.isPast ? "hsl(45 70% 60% / 0.6)" : "hsl(45 70% 60% / 0.35)"}
                  stroke={p.isNow ? "hsl(45 90% 78%)" : "transparent"}
                  strokeWidth={p.isNow ? 2 : 0}
                />
                {/* Larger transparent hit area for hover / touch / click */}
                <rect
                  x={p.x - stepX / 2}
                  y={0}
                  width={stepX}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                  onTouchStart={() => setHovered(i)}
                  onClick={(e) => openYearAt(i, e.currentTarget as unknown as HTMLElement)}
                  style={{ cursor: "pointer" }}
                />

                <text
                  x={p.x}
                  y={H - padBot + 20}
                  textAnchor="middle"
                  fontSize={p.isNow ? 12 : 11}
                  fill={p.isNow ? "hsl(45 90% 78%)" : "hsl(0 0% 100% / 0.45)"}
                >
                  {p.age}
                </text>
              </g>
            ))}
            {activePoint && (
              <g>
                <line
                  x1={activePoint.x}
                  x2={activePoint.x}
                  y1={padTop - 4}
                  y2={H - padBot}
                  stroke="hsl(45 90% 78% / 0.35)"
                  strokeWidth={1}
                />
                {(() => {
                  const tipW = 200;
                  const tipH = 54;
                  let tx = activePoint.x + 10;
                  if (tx + tipW > W - 4) tx = activePoint.x - tipW - 10;
                  const ty = Math.max(4, activePoint.y - tipH - 8);
                  return (
                    <g transform={`translate(${tx}, ${ty})`}>
                      <rect
                        width={tipW}
                        height={tipH}
                        rx={8}
                        fill="hsl(0 0% 6% / 0.92)"
                        stroke="hsl(45 70% 60% / 0.45)"
                      />
                      <text x={12} y={20} fontSize={11} fill="hsl(45 90% 78%)">
                        {lang === "zh" ? `${activePoint.age} 岁` : `Age ${activePoint.age}`}
                        {"  · "}
                        {lang === "zh" ? `能量 ${activePoint.score}` : `Energy ${activePoint.score}`}
                      </text>
                      <text x={12} y={38} fontSize={10} fill="hsl(0 0% 100% / 0.75)">
                        {activePoint.theme.length > 28 ? `${activePoint.theme.slice(0, 27)}…` : activePoint.theme}
                      </text>
                    </g>
                  );
                })()}
              </g>
            )}
          </svg>
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-1.5 text-[11px] leading-relaxed md:grid-cols-2">
        {years.map((y, i) => {
          const isHover = hovered === i;
          return (
            <li key={y.age}>
              <button
                type="button"
                data-testid={`year-row-${y.age}`}
                onClick={(e) => openYearAt(i, e.currentTarget)}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                className={`flex w-full items-baseline gap-3 rounded-md border-b border-white/5 px-2 py-1 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-dust/60 ${
                  isHover ? "bg-gold-dust/[0.08] text-gold-light" : y.isNow ? "text-gold-light" : y.isPast ? "text-stone-warm/70" : "text-stone-warm/50"
                }`}
              >
                <span className="w-14 shrink-0 font-serif tabular-nums">
                  {y.age} {lang === "zh" ? "岁" : ""}
                </span>
                <span className="flex-1 [overflow-wrap:break-word]">{y.theme}</span>
                <span className="text-[10px] tabular-nums text-stone-warm/45">{y.score}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <YearInsightModal
        open={openYear != null}
        point={openYear}
        lang={lang}
        onClose={() => setOpenYear(null)}
        returnFocus={openerRef.current}
      />
    </div>
  );

}



function ConfidenceBadge({ level, lang }: { level: "high" | "mid" | "low"; lang: Lang }) {
  const meta = {
    high: {
      label: [lang === "zh" ? "高置信" : "High confidence", "★★★"],
      cls: "border-gold-dust/60 bg-gold-dust/15 text-gold-light",
    },
    mid: {
      label: [lang === "zh" ? "中置信" : "Medium confidence", "★★"],
      cls: "border-nebula-purple/50 bg-nebula-purple/10 text-stone-warm",
    },
    low: {
      label: [lang === "zh" ? "低置信" : "Low confidence", "★"],
      cls: "border-white/15 bg-white/[0.03] text-stone-warm/70",
    },
  }[level];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.28em] ${meta.cls}`}
    >
      <span>{meta.label[1]}</span>
      <span>{meta.label[0]}</span>
    </span>
  );
}

/* ═══════════════════════════════════════════
   Key Events verification — user tells the AI a real event,
   AI infers a specific date from the four traditions, then
   the user confirms or corrects, and a final synthesis is drawn.
═══════════════════════════════════════════ */

import { inferKeyEvents, synthesizeKeyEvents } from "@/lib/key-events.functions";


type EventRow = {
  id: string;
  event: string;
  rangeStart: string;
  rangeEnd: string;
  aiWhen?: string;
  aiReasoning?: string;
  accurate: "unset" | "yes" | "no";
  userCorrection: string;
};

function newEventId() {
  return `ke_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function KeyEventsVerification({
  birthISO,
  search,
}: {
  birthISO?: string;
  search?: ReportSearchLike;
}) {
  const { t, lang } = useLang();
  const [rows, setRows] = useState<EventRow[]>([
    {
      id: newEventId(),
      event: "",
      rangeStart: "",
      rangeEnd: "",
      accurate: "unset",
      userCorrection: "",
    },
  ]);
  const [inferring, setInferring] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesis, setSynthesis] = useState<string>("");
  const [error, setError] = useState<string>("");

  const updateRow = (id: string, patch: Partial<EventRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        id: newEventId(),
        event: "",
        rangeStart: "",
        rangeEnd: "",
        accurate: "unset",
        userCorrection: "",
      },
    ]);

  const readyToInfer = rows.some((r) => r.event.trim().length > 0);
  const readyToSynthesize =
    rows.some((r) => r.aiWhen) &&
    rows.every(
      (r) => !r.event.trim() || r.accurate === "yes" || (r.accurate === "no" && r.userCorrection.trim()),
    );

  const chartFactsBase = useMemo(() => {
    const s: ReportSearchLike = search ?? { date: birthISO, lang };
    return buildReportRequest(s, lang);
  }, [search, birthISO, lang]);

  async function handleInfer() {
    setError("");
    const events = rows
      .filter((r) => r.event.trim())
      .map((r) => ({
        id: r.id,
        event: r.event.trim(),
        rangeStart: r.rangeStart || undefined,
        rangeEnd: r.rangeEnd || undefined,
      }));
    if (!events.length) return;
    setInferring(true);
    try {
      const { results } = await inferKeyEvents({ data: { ...chartFactsBase, events } });
      setRows((rs) =>
        rs.map((r) => {
          const found = results.find((x) => x.id === r.id);
          return found ? { ...r, aiWhen: found.when, aiReasoning: found.reasoning } : r;
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInferring(false);
    }
  }

  async function handleSynthesize() {
    setError("");
    setSynthesizing(true);
    try {
      const events = rows
        .filter((r) => r.event.trim() && r.aiWhen)
        .map((r) => ({
          event: r.event.trim(),
          rangeStart: r.rangeStart || undefined,
          rangeEnd: r.rangeEnd || undefined,
          aiWhen: r.aiWhen,
          aiReasoning: r.aiReasoning,
          accurate: r.accurate,
          userCorrection: r.userCorrection || undefined,
        }));
      const { synthesis: out } = await synthesizeKeyEvents({
        data: { ...chartFactsBase, events },
      });
      setSynthesis(out);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSynthesizing(false);
    }
  }

  const isZh = lang === "zh";

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.ke_kicker}
        </p>
        <h2 className="mb-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {isZh ? "把真实发生过的事告诉命盘" : "Tell the chart what really happened"}
        </h2>
        <p className="mb-4 max-w-3xl text-sm text-stone-warm/60">
          {isZh
            ? "先写下你人生里真实发生过的一件事，并给出大概年份范围（例如：2021–2025 期间的一次分手；2016–2018 期间的一次骨折）。命盘将从西方占星 / 印度占星 / 八字 / 紫微四个体系交叉推演，给出尽量具体的时间点，请你再判断准不准。"
            : "First tell the chart something that actually happened in your life, with a rough year range (e.g. a breakup between 2021 and 2025; a fracture between 2016 and 2018). The reading will cross-check Western astrology, Vedic Jyotish, BaZi, and Zi Wei Dou Shu, then land on the most specific time it can — and you decide if it's accurate."}
        </p>
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.06] px-4 py-3 text-[12px] leading-relaxed text-stone-warm/75">
          <span className="rounded-full bg-gold-dust/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.28em] text-gold-light">
            {isZh ? "下一步" : "Next"}
          </span>
          <span>
            {isZh
              ? "在你标注「准确 / 不准确」之后，点击下方的「生成微调后的综合判断」，命盘会根据你的真实反馈对四大体系重新加权，为你个人做一次专属复盘。"
              : "Once you mark each guess Accurate / Off, tap “Generate recalibrated synthesis” below — the chart will re-weight the four traditions against your real feedback and rewrite the reading for you personally."}
          </span>
        </div>

        <div className="space-y-4">
          {rows.map((r, idx) => (
            <div
              key={r.id}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 md:p-6"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                  {isZh ? `节点 #${idx + 1}` : `Event #${idx + 1}`}
                </p>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/50 hover:text-gold-light"
                  >
                    {isZh ? "移除" : "Remove"}
                  </button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
                <input
                  value={r.event}
                  onChange={(e) => updateRow(r.id, { event: e.target.value, aiWhen: undefined, aiReasoning: undefined })}
                  placeholder={
                    isZh ? "发生了什么？例如：分手 / 骨折 / 换城市" : "What happened? e.g. breakup / fracture / move"
                  }
                  className="ritual-input !py-3 !text-base w-full"
                />
                <input
                  value={r.rangeStart}
                  onChange={(e) => updateRow(r.id, { rangeStart: e.target.value })}
                  placeholder={isZh ? "起始年" : "start year"}
                  inputMode="numeric"
                  className="ritual-input !py-3 !text-base md:w-28"
                />
                <input
                  value={r.rangeEnd}
                  onChange={(e) => updateRow(r.id, { rangeEnd: e.target.value })}
                  placeholder={isZh ? "结束年" : "end year"}
                  inputMode="numeric"
                  className="ritual-input !py-3 !text-base md:w-28"
                />
              </div>

              {r.aiWhen && (
                <div className="mt-4 space-y-3 rounded-xl border border-gold-dust/30 bg-obsidian/40 p-4">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-gold-light">
                    {isZh ? "命盘推测的具体时间" : "Chart's inferred time"}
                  </p>
                  <p className="font-serif text-lg italic text-stone-warm">{r.aiWhen}</p>
                  {r.aiReasoning && (
                    <p className="text-[12px] leading-relaxed text-stone-warm/70">{r.aiReasoning}</p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => updateRow(r.id, { accurate: "yes" })}
                      className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.28em] transition-colors ${
                        r.accurate === "yes"
                          ? "bg-gold-dust text-obsidian"
                          : "border border-gold-dust/40 text-gold-dust hover:bg-gold-dust/10"
                      }`}
                    >
                      {isZh ? "准确" : "Accurate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateRow(r.id, { accurate: "no" })}
                      className={`rounded-full px-4 py-2 text-[10px] uppercase tracking-[0.28em] transition-colors ${
                        r.accurate === "no"
                          ? "bg-gold-dust text-obsidian"
                          : "border border-gold-dust/40 text-gold-dust hover:bg-gold-dust/10"
                      }`}
                    >
                      {isZh ? "不准确" : "Off"}
                    </button>
                  </div>

                  {r.accurate === "no" && (
                    <div className="space-y-2">
                      <p className="text-[11px] text-stone-warm/60">
                        {isZh ? "请告诉命盘真实发生的时间：" : "Tell the chart when it actually happened:"}
                      </p>
                      <input
                        value={r.userCorrection}
                        onChange={(e) => updateRow(r.id, { userCorrection: e.target.value })}
                        placeholder={isZh ? "例如：2022 年 9 月" : "e.g. September 2022"}
                        className="ritual-input !py-3 !text-base w-full"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addRow}
            className="rounded-full border border-white/15 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/70 hover:bg-white/[0.04]"
          >
            {isZh ? "+ 再加一件事" : "+ Add another"}
          </button>
          <button
            type="button"
            disabled={!readyToInfer || inferring}
            onClick={handleInfer}
            className="rounded-full bg-gold-dust px-6 py-2 text-[10px] uppercase tracking-[0.28em] text-obsidian disabled:opacity-40 hover:bg-gold-light"
          >
            {inferring
              ? isZh
                ? "命盘推算中…"
                : "Reading the chart…"
              : isZh
              ? "让命盘推测时间"
              : "Let the chart infer"}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-200">
            {error}
          </p>
        )}

        {rows.some((r) => r.aiWhen) && (
          <div className="mt-8 border-t border-white/10 pt-6">
            <button
              type="button"
              disabled={!readyToSynthesize || synthesizing}
              onClick={handleSynthesize}
              className="rounded-full border border-gold-dust/50 bg-obsidian/40 px-6 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-light disabled:opacity-40 hover:bg-gold-dust/10"
            >
              {synthesizing
                ? isZh
                  ? "生成微调后的综合判断…"
                  : "Recalibrating the synthesis…"
                : isZh
                ? "生成微调后的综合判断"
                : "Generate recalibrated synthesis"}
            </button>
            {!readyToSynthesize && rows.some((r) => r.aiWhen) && (
              <p className="mt-2 text-[11px] text-stone-warm/50">
                {isZh
                  ? "请先对每个推测标记准 / 不准；若不准，请给出真实时间。"
                  : "Mark each guess accurate or off first; if off, fill in the true time."}
              </p>
            )}
          </div>
        )}

        {synthesis && (
          <div className="mt-6 rounded-2xl border border-gold-dust/30 bg-obsidian/40 p-6">
            <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-light">
              {isZh ? "微调后的综合判断" : "Recalibrated synthesis"}
            </p>
            <div className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-stone-warm/85">
              {synthesis}
            </div>
          </div>
        )}

        <p className="mt-6 text-[10px] uppercase tracking-[0.24em] text-stone-warm/30">
          {t.ke_note}
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Tarot — 78-card swipeable deck
═══════════════════════════════════════════ */


export function TarotDraw() {
  const { t, lang } = useLang();
  const { account } = useAccount();
  const li = lang === "zh" ? 1 : 0;
  const plan = (account?.plan ?? "free") as "free" | "sage" | "oracle";
  const isSage = plan === "sage" || plan === "oracle";

  // Deck is shuffled once per session so the user can swipe through all 78.
  // Shuffling happens client-side after mount to avoid SSR hydration mismatch.
  const [deck, setDeck] = useState<TarotCard[]>(() => TAROT_78.slice());
  useEffect(() => {
    const arr = TAROT_78.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setDeck(arr);
  }, []);

  const [stage, setStage] = useState<"ask" | "pick" | "reveal">("ask");
  const [question, setQuestion] = useState("");
  const [picks, setPicks] = useState<number[]>([]);
  const [aiReading, setAiReading] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Example prompts — tap to fill, shuffle for a fresh batch.
  // Tuple order is [en, zh] to match `li = lang === "zh" ? 1 : 0`.
  const EXAMPLE_POOL: [string, string][] = [
    ["Should I stay in this relationship?", "这段关系还值得继续吗？"],
    ["Should I change jobs in the next three months?", "接下来三个月该换工作吗？"],
    ["Is now the right time to start my own venture?", "现在开始创业时机对吗？"],
    ["How should I handle my parents' expectations?", "我该如何面对父母的期待？"],
    ["Should I go ahead with this investment?", "这笔投资该出手吗？"],
    ["Should I move to a different city?", "我该不该搬去另一个城市？"],
    ["Should I reach out to that person first?", "我该主动联系那个人吗？"],
    ["Should I focus on study or love next?", "接下来该专注学业还是感情？"],
    ["How do I move through this confusion?", "现在的迷茫要如何走出？"],
    ["What risk is hidden in this new opportunity?", "这个新机会背后有什么风险？"],
    ["Which relationship most needs mending this year?", "今年最该修复的关系是哪一段？"],
    ["What is my true, undervalued gift?", "我真正的天赋是什么？"],
  ];
  const pickThreeExamples = (from: [string, string][], avoid: string[] = []) => {
    const arr = from.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const filtered = arr.filter((p) => !avoid.includes(p[li]));
    return (filtered.length >= 3 ? filtered : arr).slice(0, 3);
  };
  // Start with the first 3 for SSR stability; shuffle after mount.
  const [examples, setExamples] = useState<[string, string][]>(() => EXAMPLE_POOL.slice(0, 3));
  useEffect(() => {
    setExamples(pickThreeExamples(EXAMPLE_POOL));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const positions: [string, string][] = [
    ["Past", "过去"],
    ["Present", "此刻"],
    ["Emerging", "将来"],
  ];

  const beginPicks = () => {
    if (!question.trim()) return;
    setPicks([]);
    setAiReading(null);
    setStage("pick");
  };

  const pick = (idx: number) => {
    if (picks.includes(idx) || picks.length >= 3) return;
    const next = [...picks, idx];
    setPicks(next);
    if (next.length === 3) setStage("reveal");
  };

  const reset = () => {
    setPicks([]);
    setAiReading(null);
    setStage("ask");
  };

  const tier = (() => {
    if (picks.length !== 3) return null;
    const total = picks.reduce((s, i) => s + deck[i].score, 0);
    if (total >= 4) return "great" as const;
    if (total >= 2) return "good" as const;
    if (total >= 0) return "mid" as const;
    return "low" as const;
  })();

  const tierLabel: Record<"great" | "good" | "mid" | "low", [string, string]> = {
    great: ["Upper-upper fortune · 上上签", "上上签"],
    good: ["Upper fortune · 上签", "上签"],
    mid: ["Middle fortune · 中签", "中签"],
    low: ["Lower fortune · 下签", "下签"],
  };
  const tierVerdict: Record<"great" | "good" | "mid" | "low", [string, string]> = {
    great: [
      "Three cards land in bright company. The wind is at your back — move on the plans you've been quietly rehearsing.",
      "三张牌落在明亮的位置。风顺 —— 请把你私下反复排练的计划真正动起来。",
    ],
    good: [
      "The reading tilts favorable. Real momentum here, though the middle card asks for one honest admission.",
      "整体偏顺。此刻确实有势能，但中间那张牌，要你诚实说出一句你早已知道的话。",
    ],
    mid: [
      "A balanced draw — neither push nor stop. Gather information; don't force a decision this week.",
      "一次持平的签 —— 既非推进，也非停手。多收集信息，本周不强行下决定。",
    ],
    low: [
      "The draw runs cool. Not disaster — a warning to slow down, protect health and money, delay commitments.",
      "签面偏冷。这不是灾难，而是一份「慢下来」的提醒：护住健康与金钱，推迟需要表演的承诺。",
    ],
  };

  // Live quota — scoped to the signed-in account so the same email sees a
  // consistent counter across devices/browsers; anonymous falls back to a
  // device-local key.
  const quotaScope = useMemo(
    () => ({
      accountKey: account?.email ?? null,
      // Roll the monthly counter at midnight in the visitor's local time.
      tz: typeof Intl !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : undefined,
    }),
    [account?.email],
  );
  const [remaining, setRemaining] = useState<number>(() => tarotRemaining(plan, quotaScope));
  const [used, setUsed] = useState<number>(() =>
    plan === "oracle" ? 0 : Math.max(0, TAROT_LIMITS[plan] - tarotRemaining(plan, quotaScope)),
  );
  useEffect(() => {
    const refresh = () => {
      const rem = tarotRemaining(plan, quotaScope);
      setRemaining(rem);
      const limit = TAROT_LIMITS[plan];
      setUsed(isFinite(limit) ? Math.max(0, limit - rem) : 0);
    };
    refresh();
    window.addEventListener("lod:tarot-quota-changed", refresh);
    window.addEventListener("focus", refresh);
    // Cross-tab sync via storage event.
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("lod:tarot-quota")) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("lod:tarot-quota-changed", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
    };
  }, [plan, quotaScope]);

  // In-flight lock — prevents double-charging on rapid clicks / re-entries.
  const chargingRef = useRef(false);

  const requestAiReading = async () => {
    if (!isSage || aiLoading || picks.length !== 3) return;
    if (chargingRef.current) return;
    chargingRef.current = true;
    if (!tarotConsume(plan, quotaScope)) {
      chargingRef.current = false;
      setAiReading(
        lang === "zh"
          ? "本月的塔罗 AI 解读次数已用完 —— 请下月再来，或升级至神谕者享无限次。"
          : "You've used all tarot AI readings this month — try again next month, or upgrade to Oracle for unlimited.",
      );
      return;
    }
    // Sync display immediately from the just-written store.
    const remNow = tarotRemaining(plan, quotaScope);
    setRemaining(remNow);
    const limit = TAROT_LIMITS[plan];
    setUsed(isFinite(limit) ? Math.max(0, limit - remNow) : 0);
    setAiLoading(true);
    try {
      const cards = picks.map((i, pos) => {
        const c = deck[i];
        const p = positions[pos][li];
        return `${p}: ${c.nameEn} / ${c.nameZh} — ${c.hintEn}`;
      }).join("\n");
      const prompt = lang === "zh"
        ? `占卜问题：${question}\n\n三张塔罗牌（Rider–Waite）：\n${cards}\n\n请以「命运图书馆」贤者的口吻，将三张牌与问题深度整合，给出 3 段（过去成因 / 此刻真相 / 下一步建议），并在结尾给出一个可以在本周执行的具体动作。`
        : `Question: ${question}\n\nThree Rider–Waite tarot cards:\n${cards}\n\nAs the Library of Destiny sage, weave the three cards and the question into a deep reading in three short paragraphs (root cause / present truth / next move), and end with one concrete action the visitor can take this week.`;
      const res = await askOracle({ data: { question: prompt, lang, feature: "tarot" } });
      setAiReading(res.text);
    } catch (e) {
      console.error(e);
      setAiReading(lang === "zh" ? "解读暂时无法生成，请稍后再试。" : "The reading could not be generated. Please try again.");
    } finally {
      setAiLoading(false);
      // Release lock slightly after loading flips so the button's disabled
      // state has time to render before another click can re-enter.
      setTimeout(() => { chargingRef.current = false; }, 300);
    }
  };

  const openAccount = () => window.dispatchEvent(new Event("lod:open-account"));

  return (
    <section className="mx-auto max-w-5xl px-4 pb-24 sm:px-6 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-5 sm:p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.tarot_kicker}
        </p>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-serif text-xl italic text-stone-warm sm:text-2xl md:text-3xl">
            {lang === "zh" ? "先提问，再翻牌 · 78 张标准塔罗" : "Ask first, then flip — the full 78-card deck"}
          </h2>
          {/* Quota chip — always visible so the visitor sees used / remaining. */}
          <span
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label={
              plan === "oracle"
                ? (lang === "zh" ? "本月塔罗 AI 解读次数：无限" : "Tarot AI readings this month: unlimited")
                : plan === "sage"
                  ? (lang === "zh"
                      ? `本月塔罗 AI 解读，已使用 ${used} 次，剩余 ${remaining} 次，共 ${TAROT_LIMITS.sage} 次`
                      : `Tarot AI readings this month: ${used} used, ${remaining} of ${TAROT_LIMITS.sage} remaining`)
                  : (lang === "zh" ? "塔罗 AI 解读，仅贤者会员可用" : "Tarot AI readings: Sage members only")
            }
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.28em] ${
              plan === "oracle"
                ? "border-gold-dust/60 bg-gold-dust/10 text-gold-light"
                : plan === "sage"
                  ? remaining > 0
                    ? "border-gold-dust/40 bg-obsidian/40 text-gold-dust"
                    : "border-white/15 bg-white/[0.02] text-stone-warm/50"
                  : "border-white/15 bg-white/[0.02] text-stone-warm/60"
            }`}
            title={lang === "zh" ? "跨设备按账户同步 · 本地时区月度重置" : "Synced per account across devices · resets monthly in your timezone"}
          >
            <span className="size-1.5 rounded-full bg-gold-dust" aria-hidden="true" />
            {plan === "oracle"
              ? lang === "zh" ? "塔罗 AI · 本月无限" : "Tarot AI · unlimited"
              : plan === "sage"
                ? lang === "zh"
                  ? `本月已用 ${used} · 剩余 ${remaining} / ${TAROT_LIMITS.sage}`
                  : `Used ${used} · ${remaining} left / ${TAROT_LIMITS.sage}`
                : lang === "zh" ? "AI 解读 · 升级贤者" : "AI reading · Sage only"}
          </span>
        </div>
        <p className="mb-6 max-w-3xl text-sm text-stone-warm/60">{t.tarot_hint}</p>


        {/* Stage 1 — question */}
        {stage === "ask" && (
          <div className="rounded-2xl border border-gold-dust/25 bg-obsidian/40 p-5 sm:p-6">
            <label className="mb-3 block text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
              {lang === "zh" ? "你今晚要问的事" : "What you are asking tonight"}
            </label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder={lang === "zh" ? "例如：这段关系还值得继续吗？" : "e.g. Should I stay in this relationship?"}
              className="w-full resize-none rounded-xl border border-white/10 bg-obsidian/60 p-4 text-sm text-stone-warm placeholder:text-stone-warm/30 focus:border-gold-dust/60 focus:outline-none"
            />

            {/* Example prompts */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
                  {lang === "zh" ? "示例提问 · 可直接点选" : "Example questions — tap to use"}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setExamples(pickThreeExamples(EXAMPLE_POOL, examples.map((e) => e[li])))
                  }
                  className="whitespace-nowrap rounded-full border border-gold-dust/30 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-gold-dust/80 transition-colors hover:border-gold-dust hover:bg-gold-dust/10"
                >
                  {lang === "zh" ? "换一批 ↻" : "Shuffle ↻"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {examples.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setQuestion(ex[li])}
                    className="max-w-full whitespace-normal break-words rounded-full border border-white/10 bg-obsidian/60 px-3 py-1.5 text-left text-[12px] leading-snug text-stone-warm/80 transition-colors hover:border-gold-dust/50 hover:bg-gold-dust/10 hover:text-gold-light"
                  >
                    {ex[li]}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                {lang === "zh" ? "写下越具体，签越准" : "The clearer the question, the truer the reading"}
              </p>
              <button
                type="button"
                onClick={beginPicks}
                disabled={!question.trim()}
                className="rounded-full bg-gold-dust px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-obsidian transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                {lang === "zh" ? "开始翻牌 →" : "Begin the draw →"}
              </button>
            </div>
          </div>
        )}

        {/* Stage 2 — swipeable 78-card deck */}
        {stage === "pick" && (
          <div>
            <div className="mb-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <button
                type="button"
                onClick={() => setStage("ask")}
                className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-stone-warm/60 hover:border-gold-dust/40 hover:text-gold-dust"
              >
                {lang === "zh" ? "← 改问题" : "← Edit"}
              </button>
              <p className="text-center text-[10px] uppercase tracking-[0.32em] text-gold-dust">
                {picks.length} / 3 — {positions[picks.length]?.[li] ?? ""}
              </p>
              <p className="whitespace-nowrap text-right text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
                {lang === "zh" ? "左右滑动" : "swipe →"}
              </p>
            </div>
            <div className="tarot-scroll -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:gap-4 sm:px-6">
              {deck.map((c, idx) => {
                const chosen = picks.includes(idx);
                const disabled = chosen || picks.length >= 3;
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    onClick={() => pick(idx)}
                    disabled={disabled}
                    whileHover={disabled ? undefined : { y: -6 }}
                    animate={chosen ? { opacity: 0.15 } : { opacity: 1 }}
                    className="relative aspect-[2/3] w-[42vw] max-w-[180px] flex-none snap-center overflow-hidden rounded-xl border border-gold-dust/30 bg-gradient-to-br from-nebula-purple/40 via-void-blue to-obsidian shadow-[0_8px_28px_rgba(0,0,0,0.55)] disabled:cursor-default sm:w-[160px]"
                  >
                    <span className="absolute inset-2 rounded-lg border border-gold-dust/25" />
                    <span className="absolute inset-0 grid place-items-center font-serif text-3xl italic text-gold-dust/50">
                      ✦
                    </span>
                    <span className="absolute bottom-2 left-0 right-0 text-center font-mono text-[9px] tracking-[0.28em] text-gold-dust/50">
                      {String(idx + 1).padStart(2, "0")} / 78
                    </span>
                  </motion.button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
              {lang === "zh"
                ? `问题：${question.length > 40 ? question.slice(0, 40) + "…" : question}`
                : `Question: ${question.length > 60 ? question.slice(0, 60) + "…" : question}`}
            </p>
          </div>
        )}

        {/* Stage 3 — reveal */}
        {stage === "reveal" && tier && (
          <div>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {picks.map((cardIdx, pos) => {
                const c = deck[cardIdx];
                return (
                  <motion.div
                    key={c.id}
                    initial={{ rotateY: 180, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ duration: 0.9, delay: pos * 0.15, ease: [0.32, 0.72, 0, 1] }}
                    className="overflow-hidden rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06]"
                  >
                    <p className="pt-4 text-center text-[10px] uppercase tracking-[0.32em] text-gold-dust">
                      {positions[pos][li]}
                    </p>
                    <div className="mx-auto mt-3 aspect-[2/3] w-[62%] overflow-hidden rounded-lg border border-gold-dust/20 bg-obsidian/60">
                      <img
                        src={c.image}
                        alt={c.nameEn}
                        loading="lazy"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                    <div className="p-4 text-center">
                      <p className="font-serif text-lg italic text-gold-light">{c.glyph}</p>
                      <p className="mt-1 font-serif text-base text-stone-warm">{c.nameZh} · {c.nameEn}</p>
                      <p className="mt-2 text-xs leading-relaxed text-stone-warm/70">{li === 1 ? c.hintZh : c.hintEn}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.5 }}
              className="mb-6 rounded-2xl border border-gold-dust/40 bg-gradient-to-br from-gold-dust/[0.12] via-nebula-purple/[0.06] to-transparent p-5 sm:p-8"
            >
              <p className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.32em] text-gold-light">
                <span className="size-1.5 rounded-full bg-gold-dust" />
                {lang === "zh" ? "签面结论" : "Fortune verdict"}
              </p>
              <p className="mb-3 font-serif text-2xl italic text-gold-light md:text-3xl">
                {tierLabel[tier][li]}
              </p>
              <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
                {lang === "zh" ? "关于：" : "On: "}{question}
              </p>
              <p className="font-serif text-base leading-relaxed text-stone-warm/85 md:text-lg">
                {tierVerdict[tier][li]}
              </p>
            </motion.div>

            {/* Sage AI deep reading */}
            <div className="mb-6 rounded-2xl border border-gold-dust/25 bg-obsidian/40 p-5 sm:p-6">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                  {lang === "zh" ? "贤者会员 · AI 深度解读" : "Sage members · AI deep reading"}
                </p>
                {isSage && (
                  <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
                    {plan === "oracle"
                      ? lang === "zh" ? "本月剩余：无限次" : "This month: unlimited"
                      : lang === "zh"
                        ? `本月已用 ${used} · 剩余 ${remaining} / ${TAROT_LIMITS.sage} 次`
                        : `Used ${used} · ${remaining} left / ${TAROT_LIMITS.sage} this month`}
                  </p>
                )}
              </div>
              {isSage ? (
                <>
                  {!aiReading && !aiLoading && (
                    <button
                      type="button"
                      onClick={requestAiReading}
                      disabled={remaining <= 0}
                      className="rounded-full bg-gold-dust px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-obsidian transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {remaining <= 0
                        ? lang === "zh" ? "本月已用完" : "Monthly quota reached"
                        : lang === "zh" ? "生成 AI 深度解读 →" : "Generate AI deep reading →"}
                    </button>
                  )}
                  {aiLoading && (
                    <p className="text-sm italic text-stone-warm/60">
                      {lang === "zh" ? "贤者正在书写…" : "The sage is writing…"}
                    </p>
                  )}
                  {aiReading && (
                    <div className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-stone-warm/90">
                      {aiReading}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="max-w-md text-sm text-stone-warm/70">
                    {lang === "zh"
                      ? "开通「贤者」，AI 会将你的问题、三张牌与命盘一起深度解读。"
                      : "Unlock Sage to have the AI weave your question, three cards and chart into one deep reading."}
                  </p>
                  <button
                    type="button"
                    onClick={openAccount}
                    className="rounded-full border border-gold-dust/50 px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
                  >
                    {lang === "zh" ? "开通贤者 →" : "Unlock Sage →"}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
                {picks.map((i) => deck[i].nameZh).join(" · ")}
              </p>
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-gold-dust/40 px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10"
              >
                {t.tarot_reset}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Future Watchlist — Oracle members
═══════════════════════════════════════════ */

const WATCHLIST: {
  year: string;
  theme: [string, string];
  note: [string, string];
  detail?: [string, string];
  locked?: boolean;
}[] = [
  {
    year: "2026 · Q3",
    theme: ["Career door opens", "事业开门"],
    note: [
      "A recognizable inflection — say yes carefully; the shape of the yes matters more than the yes itself.",
      "一个可识别的转折 —— 谨慎地说「好」；「好」的形状比「好」本身更重要。",
    ],
    detail: [
      "Jupiter transits your 10th house while BaZi shows a 正官 year — a promotion, an invitation to lead, or a public-facing role. Negotiate scope and title before compensation; the framing you accept now defines the next three years.",
      "木星过境事业宫，八字流年逢正官 —— 晋升、被点名带团队或走到台前的窗口。先谈边界与头衔，再谈薪酬；此刻接受的「框」将定义未来三年的位置。",
    ],
  },
  {
    year: "2027 · spring",
    theme: ["Health reset window", "健康重置窗口"],
    note: [
      "The chart flags a two-month window to rebuild sleep, breath and cardio — small habits with 10-year returns.",
      "命盘标出约两个月的窗口：重建睡眠、呼吸与有氧 —— 小习惯，十年回报。",
    ],
    detail: [
      "Saturn squares your Ascendant while 大运 shifts into a 印 phase — the body asks to be re-parented. Sleep before midnight, morning sunlight, low-intensity cardio 4×/week. Avoid crash diets and stimulants; this is a rebuild, not a sprint.",
      "土星刑上升点，大运走印 —— 身体请求被重新照料。子时前入睡、晨光、每周四次低强度有氧。切忌节食与依赖咖啡因；这是「重建」，不是「冲刺」。",
    ],
  },
  {
    year: "2028",
    theme: ["Meaningful encounter", "重要相遇"],
    note: [
      "The synastry indicates a partnership-shape year. Details on Oracle.",
      "合盘指向一个「关系形状」的年份。神谕者可见细节。",
    ],
    detail: [
      "Venus-Jupiter conjunction in your 7th, and BaZi 桃花 activates on the day pillar. A relationship (romantic or a serious business partnership) arrives with real weight. Do not confuse chemistry with alignment — check three months of behavior before committing structure.",
      "金木合相入夫妻宫，八字日柱桃花开 —— 一段有分量的关系（感情或深度合伙）到来。不要把化学反应当作契合度 —— 观察三个月的行为再落实结构。",
    ],
  },
  {
    year: "2029–2030",
    theme: ["Wealth compounding phase", "财富复利期"],
    note: [
      "Two BaZi wealth stars form a bridge. Details on Oracle.",
      "两颗财星形成桥梁。神谕者可见细节。",
    ],
    detail: [
      "偏财 and 正财 both active while Jupiter enters your 2nd house — passive income, equity, or a side business can materially compound. Move from earning to owning: index funds, equity in your own work, one long-hold asset. Avoid leverage-heavy speculation.",
      "正财、偏财双动，木星入财帛宫 —— 被动收入、股权、副业可实质复利。从「赚薪水」转到「拥有资产」：指数、自身股权、一项长期持有。避开高杠杆投机。",
    ],
  },
  {
    year: "2031",
    theme: ["A quieter chapter", "转入静章"],
    note: [
      "Deliberate slowing. Details on Oracle.",
      "有意识的放慢。神谕者可见细节。",
    ],
    detail: [
      "Saturn return-adjacent for many, and the 大运 shifts into a reflective 食伤 or 印 phase. Output slows, meaning deepens. Take the sabbatical, write the book, mentor. Public metrics dim; inner metrics brighten.",
      "接近土星回归，大运转入食伤或印 —— 输出变慢，意义变深。请长假、写那本书、开始带人。外部指标转暗，内部指标转亮。",
    ],
  },
];

export function FutureWatchlist({ search }: { search?: ReportSearchLike }) {
  const { t, lang } = useLang();
  const { account } = useAccount();
  const plan = (account?.plan ?? "free") as "free" | "sage" | "oracle";
  const isOracle = plan === "oracle";
  const li = lang === "zh" ? 1 : 0;

  const { outlook, state: aiState } = useChartOutlook(search, lang);
  const aiWatch = outlook?.watchlist && outlook.watchlist.length > 0 ? outlook.watchlist : null;

  // AI-driven items when ready; otherwise fall back to seed WATCHLIST as skeleton copy.
  const items = aiWatch
    ? aiWatch.map((w) => ({
        year: w.year,
        theme: w.theme,
        note: w.note,
        detail: w.detail,
        locked: false as const,
      }))
    : WATCHLIST.map((w) => ({
        year: w.year,
        theme: w.theme[li],
        note: w.note[li],
        detail: w.detail?.[li] ?? "",
        locked: w.locked ?? false,
      }));

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.fw_kicker}
        </p>
        <h2 className="mb-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {t.fw_title}
        </h2>
        <p className="mb-4 max-w-3xl text-sm text-stone-warm/60">{t.fw_hint}</p>
        {search?.date && aiState === "loading" && (
          <p className="mb-6 text-[11px] uppercase tracking-[0.28em] text-gold-dust/70">
            {lang === "zh" ? "老者正在推演未来的窗口…" : "The elder is scrying the years ahead…"}
          </p>
        )}
        {search?.date && aiState === "error" && (
          <p className="mb-6 text-[11px] uppercase tracking-[0.28em] text-red-300/80">
            {lang === "zh" ? "推演暂未完成，先以骨架示意。" : "Divination unfinished — showing skeleton for now."}
          </p>
        )}

        {/* Horizontal year timeline — visualises the span of the 5 windows at a glance */}
        {(() => {
          const years = items
            .map((w) => parseInt((w.year.match(/\d{4}/)?.[0]) ?? "0", 10))
            .filter((n) => n > 0);
          if (years.length < 2) return null;
          const minY = Math.min(...years);
          const maxY = Math.max(...years);
          const span = Math.max(1, maxY - minY);
          return (
            <div className="mb-8 hidden sm:block">
              <div className="relative h-14">
                <div className="absolute inset-x-4 top-1/2 h-px bg-gradient-to-r from-transparent via-gold-dust/40 to-transparent" />
                {items.map((w, i) => {
                  const y = parseInt((w.year.match(/\d{4}/)?.[0]) ?? "0", 10);
                  if (!y) return null;
                  const pct = ((y - minY) / span) * 100;
                  const meta = watchlistIcon(w.theme);
                  const c = TINT_CLASSES[meta.tint];
                  const Icon = meta.Icon;
                  return (
                    <a
                      key={`tl-${w.year}-${i}`}
                      href={`#watch-${i}`}
                      className="group absolute -translate-x-1/2 top-1/2 -translate-y-1/2"
                      style={{ left: `calc(${pct}% * 0.92 + 4%)` }}
                    >
                      <span className={`flex size-8 items-center justify-center rounded-full border ${c.border} ${c.bg} ${c.text} shadow-[0_0_18px_-6px_hsl(45_70%_60%/0.35)] transition-transform group-hover:scale-110`}>
                        <Icon size={14} strokeWidth={1.6} />
                      </span>
                      <span className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[9px] uppercase tracking-[0.28em] text-stone-warm/55">
                        {y}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <ol className="relative space-y-4 border-l border-gold-dust/30 pl-6">
          {items.map((w, idx) => {
            const unlocked = isOracle || !w.locked;
            const meta = watchlistIcon(w.theme);
            const c = TINT_CLASSES[meta.tint];
            const Icon = meta.Icon;
            return (
              <li key={`${w.year}-${idx}`} id={`watch-${idx}`} className="relative scroll-mt-32">
                <span className={`absolute -left-[31px] top-3 flex size-6 items-center justify-center rounded-full border ${c.border} ${c.bg} ${c.text} shadow-[0_0_12px_hsl(45_70%_60%/0.4)]`}>
                  <Icon size={11} strokeWidth={1.8} />
                </span>
                <div className={`rounded-2xl border p-5 ${unlocked ? `${c.border} ${c.bg}` : "border-white/10 bg-white/[0.02]"}`}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust">
                      {w.year}
                    </p>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[9px] uppercase tracking-[0.28em] ${c.border} ${c.text}`}>
                      <Icon size={10} strokeWidth={2} />
                      {lang === "zh" ? meta.label[1] : meta.label[0]}
                    </span>
                  </div>
                  <p className="mb-2 font-serif text-lg italic text-stone-warm">
                    {w.theme}
                  </p>
                  {unlocked ? (
                    <>
                      <p className="text-sm leading-relaxed text-stone-warm/75">{w.note}</p>
                      {isOracle && w.detail && (
                        <details className="group mt-3 overflow-hidden rounded-xl border border-gold-dust/20 bg-obsidian/40 transition-colors open:border-gold-dust/35">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[9px] uppercase tracking-[0.32em] text-gold-dust/80 hover:text-gold-light [&::-webkit-details-marker]:hidden">
                            <span>{lang === "zh" ? "流年运势 · 详解" : "Yearly forecast · detail"}</span>
                            <ChevronDown size={12} className="transition-transform group-open:rotate-180" />
                          </summary>
                          <p className="px-4 pb-4 text-sm leading-relaxed text-stone-warm/85">
                            {w.detail}
                          </p>
                        </details>
                      )}
                    </>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-stone-warm/50">
                      <span>🔒</span> {t.fw_locked}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}


/* ═══════════════════════════════════════════
   Save-this-reading (uses local account)
═══════════════════════════════════════════ */

export function SaveReadingBar({
  reading,
  onOpenAccount,
  fingerprint,
  aiReport,
  aiReportVersion,
  aiOutlook,
  aiOutlookVersion,
}: {
  reading: { name?: string; date?: string; time?: string; place?: string; lang?: "en" | "zh" };
  onOpenAccount: () => void;
  fingerprint?: string;
  aiReport?: import("@/lib/report.functions").ReportAI | null;
  aiReportVersion?: string;
  aiOutlook?: OutlookAI | null;
  aiOutlookVersion?: string;
}) {
  const { t } = useLang();
  const { account, saveReading, saved } = useAccount();
  const [justSaved, setJustSaved] = useState(false);

  const alreadySaved = saved.some(
    (s) => s.name === (reading.name ?? "") && s.date === reading.date && s.place === reading.place,
  );

  const handleSave = () => {
    if (!account) return onOpenAccount();
    saveReading({
      name: reading.name ?? "Anonymous",
      date: reading.date,
      time: reading.time,
      place: reading.place,
      lang: reading.lang,
      fingerprint,
      aiReport: aiReport ?? undefined,
      aiReportVersion: aiReportVersion,
      aiOutlook: aiOutlook ?? undefined,
      aiOutlookVersion: aiOutlookVersion,
    });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2400);
  };

  return (
    <div className="mx-auto mb-10 max-w-5xl px-6 print:hidden md:px-12">
      <div className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-full px-6 py-3">
        <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/60">
          {account ? `${t.acc_signed_as} · ${account.name}` : t.acc_desc}
        </p>
        <button
          type="button"
          onClick={handleSave}
          className="rounded-full bg-gold-dust px-5 py-2 text-[10px] uppercase tracking-[0.28em] text-obsidian hover:bg-gold-light"
        >
          {justSaved || alreadySaved ? t.acc_reading_saved : t.acc_save_reading}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Membership + PDF export + AI follow-up
═══════════════════════════════════════════ */

/**
 * AskSageCard — the "your private Sage" invitation panel that sits next to
 * the premium PDF card on the report page. Uses the shared SageAvatar so
 * identity stays consistent with the global tree-hole entry.
 */
function AskSageCard({
  lang,
  locked,
  onOpen,
}: {
  lang: Lang;
  locked: string;
  onOpen: () => void;
}) {
  const zh = lang === "zh";
  const kicker = zh ? "神谕者提问 · 私人智者" : "Ask the Sage · Private oracle";
  const badge = zh ? "神谕者" : "Oracle";
  const title = zh
    ? "问一位读过你命盘的智者"
    : "Ask the Sage who has read your chart";
  const bullets = zh
    ? [
        "继续追问感情、事业与财富。",
        "看见家庭、健康与关键时间窗口。",
        "回答会结合你已经生成的完整命盘。",
      ]
    : [
        "Follow up on love, vocation and wealth.",
        "Explore family, wellbeing and key timing windows.",
        "Every answer is grounded in your saved chart.",
      ];
  const cta = zh ? "开始向智者提问" : "Ask the Sage";
  const recommended = zh ? "推荐" : "Recommended";

  return (
    <div
      role="group"
      className="relative flex flex-col overflow-hidden rounded-2xl border border-gold-dust/20 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6"
    >
      {/* Recommended star — top-left, restrained gold glow */}
      <span
        className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1"
        title={recommended}
      >
        <span className="relative inline-grid place-items-center">
          <span
            className="absolute inset-0 rounded-full animate-pulse-gold"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklab, var(--gold-light) 55%, transparent) 0%, transparent 70%)",
            }}
            aria-hidden="true"
          />
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="relative h-3.5 w-3.5"
            fill="var(--gold-light)"
          >
            <path d="M12 2 L13.6 9.2 L20.8 10.8 L14.6 14.6 L16.4 22 L12 17.6 L7.6 22 L9.4 14.6 L3.2 10.8 L10.4 9.2 Z" />
          </svg>
        </span>
        <span className="sr-only">{recommended}</span>
      </span>

      <div className="mb-3 flex items-center justify-between gap-2 pl-6">
        <p className="min-w-0 truncate text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {kicker}
        </p>
        <span className="shrink-0 rounded-full border border-gold-dust/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.28em] text-gold-light">
          {badge}
        </span>
      </div>

      <p className="mb-4 font-serif text-lg italic text-stone-warm">{title}</p>

      <ul className="mb-5 flex-1 space-y-2 text-sm text-stone-warm/70">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="mt-1 size-1.5 shrink-0 rounded-full bg-gold-dust/70" />
            <span className="italic">{b}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onOpen}
        aria-label={cta}
        className="mt-auto inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-full bg-gold-dust px-5 py-2.5 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
      >
        <SageAvatar
          glow={false}
          className="h-6 w-6 shrink-0 rounded-full border border-obsidian/20 bg-obsidian/10"
        />
        <span>{cta}</span>
        <span className="sr-only"> · {locked}</span>
      </button>
    </div>
  );
}


type Plan = "free" | "sage" | "oracle";
type PayMethod = "wechat" | "alipay" | "unionpay" | "visa";

export function MembershipSection({
  birthISO,
  search,
}: {
  birthISO?: string;
  search?: ReportSearchLike;
} = {}) {
  const { lang, t } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const { account, setPlan: persistPlan } = useAccount();
  const plan: Plan = (account?.plan ?? "free") as Plan;
  const setPlan = (p: Plan) => persistPlan(p);
  const [chatOpen, setChatOpen] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<Plan | null>(null);
  const [signInPrompt, setSignInPrompt] = useState(false);
  // Treat the current session as "new" until the user upgrades once — grants the first-time discount.
  const [firstTime, setFirstTime] = useState(true);

  const plans = useMemo(
    () => [
      {
        id: "free" as const,
        name: t.mem_free,
        desc: t.mem_free_desc,
        price: [`$0`, `¥0`][li],
        highlight: false,
      },
      {
        id: "sage" as const,
        name: t.mem_sage,
        desc:
          lang === "zh"
            ? "站内深度阅读体验 · 生命时间轴精解 · 合盘关系分析 · 每月 10 次塔罗 AI 解读（贤者专属）。"
            : "In-app deep reading · life-timeline analysis · Synastry reading · 10 tarot AI readings / month (Sage exclusive).",
        price: [`$2.99 / mo`, `¥19.9 / 月`][li],
        highlight: true,
      },
      {
        id: "oracle" as const,
        name: t.mem_oracle,
        desc:
          lang === "zh"
            ? "包含贤者所有权益 · 无限 AI 追问 · 无限次塔罗 AI 解读 · 近 90 天状态与时间节点分析（神谕者专属）。"
            : "Everything in Sage · unlimited AI follow-up · unlimited tarot AI readings · 90-day state & window analysis (Oracle exclusive).",
        price: [`$5.99 / mo`, `¥39.9 / 月`][li],
        highlight: false,
      },
    ],
    [t, li, lang],
  );


  const handleUpgradeClick = (target: Plan) => {
    if (!account) {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("lod:open-account"));
      return;
    }
    if (target === "free") {
      setPlan("free");
      return;
    }
    setUpgradeTarget(target);
  };

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {t.mem_kicker}
        </p>
        <h2 className="mb-6 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {t.mem_title}
        </h2>

        {/* Login gate */}
        {!account && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold-dust/40 bg-gold-dust/[0.06] p-5">
            <div>
              <p className="mb-1 text-[10px] uppercase tracking-[0.32em] text-gold-light">
                {lang === "zh" ? "请先登录以升级" : "Sign in to upgrade"}
              </p>
              <p className="text-sm text-stone-warm/70">
                {lang === "zh"
                  ? "会员权益需要账户来承载 —— 登录或创建账号后即可选择支付方式。首次升级享专属优惠。"
                  : "Membership requires an account. Sign in or create one to pick a payment method — first-time upgrades get an exclusive discount."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") window.dispatchEvent(new Event("lod:open-account"));
              }}
              className="rounded-full bg-gold-dust px-5 py-2.5 text-[10px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light"
            >
              {lang === "zh" ? "登录 / 创建账号" : "Sign in / Create"}
            </button>
          </div>
        )}

        {account && firstTime && (
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-nebula-purple/40 bg-nebula-purple/[0.10] px-5 py-3">
            <span className="rounded-full bg-nebula-purple/40 px-3 py-0.5 text-[9px] uppercase tracking-[0.32em] text-stone-warm">
              {lang === "zh" ? "首次优惠" : "First-time offer"}
            </span>
            <p className="text-sm text-stone-warm/80">
              {lang === "zh"
                ? "新账户首次升级享 -30% 折扣 —— 结算时自动应用。"
                : "New accounts get 30% off their first upgrade — applied automatically at checkout."}
            </p>
          </div>
        )}

        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((p) => {
            const rank = (x: Plan) => (x === "oracle" ? 2 : x === "sage" ? 1 : 0);
            const userRank = rank(plan);
            const tierRank = rank(p.id);
            const isCurrent = p.id === plan;
            const isIncluded = !isCurrent && tierRank < userRank;
            const disabled = isCurrent || isIncluded;
            const label = isCurrent
              ? t.mem_current
              : isIncluded
                ? lang === "zh" ? "已包含" : "Included"
                : t.mem_upgrade;
            return (
              <div
                key={p.id}
                className={`relative flex flex-col rounded-2xl border p-6 transition-colors ${
                  isCurrent
                    ? "border-gold-dust/70 bg-gold-dust/[0.10]"
                    : isIncluded
                      ? "border-gold-dust/25 bg-gold-dust/[0.03]"
                      : p.highlight
                        ? "border-gold-dust/50 bg-gold-dust/[0.06]"
                        : "border-white/10 bg-white/[0.02]"
                }`}
              >
                {p.highlight && !isIncluded && (
                  <span className="absolute -top-3 left-6 rounded-full bg-gold-dust px-3 py-0.5 text-[9px] uppercase tracking-[0.32em] text-obsidian">
                    ★
                  </span>
                )}
                {isIncluded && (
                  <span className="absolute -top-3 left-6 rounded-full border border-gold-dust/40 bg-obsidian px-3 py-0.5 text-[9px] uppercase tracking-[0.32em] text-gold-dust">
                    {lang === "zh" ? "已包含" : "Included"}
                  </span>
                )}
                <p className="mb-1 font-serif text-xl text-stone-warm">{p.name}</p>
                <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
                  {p.price}
                </p>
                <p className="mb-6 flex-1 text-sm leading-relaxed text-stone-warm/60">
                  {p.desc}
                </p>
                <button
                  type="button"
                  onClick={() => handleUpgradeClick(p.id)}
                  disabled={disabled}
                  className={`rounded-full px-5 py-2.5 text-[10px] uppercase tracking-[0.28em] transition-colors ${
                    disabled
                      ? "cursor-default border border-white/10 text-stone-warm/40"
                      : p.highlight
                        ? "bg-gold-dust text-obsidian hover:bg-gold-light"
                        : "border border-gold-dust/40 text-gold-dust hover:bg-gold-dust/10"
                  }`}
                >
                  {label}
                </button>
              </div>
            );
          })}
        </div>

        {/* Top row — three equal-width cards: Synastry teaser, 90-day teaser, Ask Sage. */}
        <TierTeasers
          lang={lang}
          li={li}
          plan={plan}
          onUpgrade={handleUpgradeClick}
          onOpenChat={() => setChatOpen(true)}
          chatLocked={t.mem_ai_locked}
        />

        {/* Full-width premium PDF bar below the three cards. */}
        <PremiumPdfCard search={search} variant="bar" />

      </div>


      {/* Sage-exclusive: Synastry relationship reading */}
      {(plan === "sage" || plan === "oracle") && (
        <div className="mt-10">
          <div className="mx-auto mb-6 flex max-w-5xl items-center gap-3 px-6 md:px-12">
            <span className="h-px flex-1 bg-gold-dust/30" />
            <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">
              {lang === "zh" ? "贤者专属 · 合盘分析" : "Sage exclusive · Synastry"}
            </p>
            <span className="h-px flex-1 bg-gold-dust/30" />
          </div>
          <SynastryPreview userBirthISO={birthISO} />
        </div>
      )}

      {/* Oracle-exclusive: 90-day windows + future watchlist */}
      {plan === "oracle" && (
        <div className="mt-4">
          <div className="mx-auto mb-6 flex max-w-5xl items-center gap-3 px-6 md:px-12">
            <span className="h-px flex-1 bg-gold-dust/30" />
            <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust">
              {lang === "zh" ? "神谕者专属 · 近 90 天状态分析" : "Oracle exclusive · 90-day analysis"}
            </p>
            <span className="h-px flex-1 bg-gold-dust/30" />
          </div>
          <RecentWindows birthISO={birthISO} search={search} />
          <FutureWatchlist search={search} />
        </div>
      )}

      <AIFollowupModal open={chatOpen} onClose={() => setChatOpen(false)} lang={lang} plan={plan} onUpgrade={() => { setChatOpen(false); setUpgradeTarget("oracle"); }} />
      <SignInPromptModal
        open={signInPrompt}
        onClose={() => setSignInPrompt(false)}
        lang={lang}
      />
      <UpgradeCheckoutModal
        target={upgradeTarget}
        firstTime={firstTime}
        lang={lang}
        onClose={() => setUpgradeTarget(null)}
        onConfirm={() => {
          if (upgradeTarget) {
            setPlan(upgradeTarget);
            setFirstTime(false);
          }
          setUpgradeTarget(null);
        }}
      />
    </section>
  );
}

/* Tier teasers — three equal-width cards on the report page:
   1. Sage · Synastry teaser
   2. Oracle · 90-day windows teaser
   3. Your private Sage — Ask the Sage entry
   Cards use a stable grid-cols-3 at md+ and stack single-column on mobile. */
function TierTeasers({
  lang,
  li,
  plan,
  onUpgrade,
  onOpenChat,
  chatLocked,
}: {
  lang: Lang;
  li: 0 | 1;
  plan: Plan;
  onUpgrade: (target: Plan) => void;
  onOpenChat: () => void;
  chatLocked: string;
}) {
  const items: {
    target: Plan;
    unlocked: boolean;
    kicker: [string, string];
    title: [string, string];
    bullets: [string, string][];
  }[] = [
    {
      target: "sage",
      unlocked: plan === "sage" || plan === "oracle",
      kicker: ["Sage Synastry · Relationship", "贤者合盘 · 关系分析"],
      title: ["Two charts, one honest reading", "两张命盘的诚实对话"],
      bullets: [
        ["Five axes of resonance — scored, not romanticized.", "五维契合度 —— 有分数，不美化。"],
        ["Where you harmonize; where you generate noise.", "何处和声，何处噪音。"],
        ["A verdict the chart is willing to defend.", "一个命盘愿意为之背书的结论。"],
      ],
    },
    {
      target: "oracle",
      unlocked: plan === "oracle",
      kicker: ["Oracle Now · 90-day windows", "神谕者近况 · 90 天窗口"],
      title: ["The next 90 days, in four windows", "接下来 90 天，四个窗口"],
      bullets: [
        ["A signal week is opening.", "一个「信号周」正在打开。"],
        ["A wealth channel wants a message you've been avoiding.", "一条财路，在等你迟迟未发的消息。"],
        ["A postponed conversation becomes unavoidable.", "一段被拖延的对话，将无法回避。"],
      ],
    },
  ];

  return (
    <div className="mb-10 grid grid-cols-1 items-stretch gap-4 md:grid-cols-3">
      {items.map((it) => (
        <div
          key={it.kicker[0]}
          className="relative flex flex-col overflow-hidden rounded-2xl border border-gold-dust/20 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {it.kicker[li]}
            </p>
            <span className="shrink-0 rounded-full border border-gold-dust/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.28em] text-gold-light">
              {it.target === "sage" ? (lang === "zh" ? "贤者" : "Sage") : lang === "zh" ? "神谕者" : "Oracle"}
            </span>
          </div>
          <p className="mb-4 font-serif text-lg italic text-stone-warm">{it.title[li]}</p>
          <ul className="mb-5 flex-1 space-y-2 text-sm text-stone-warm/70">
            {it.bullets.map((b) => (
              <li key={b[0]} className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-gold-dust/70" />
                <span className="italic">{b[li]}</span>
              </li>
            ))}
          </ul>
          {!it.unlocked ? (
            <button
              type="button"
              onClick={() => onUpgrade(it.target)}
              className="mt-auto w-full min-h-[44px] rounded-full border border-gold-dust/40 px-5 py-2.5 text-[10px] uppercase tracking-[0.32em] text-gold-dust transition-colors hover:bg-gold-dust hover:text-obsidian"
            >
              {lang === "zh"
                ? `升级至${it.target === "sage" ? "贤者" : "神谕者"}`
                : `Upgrade to ${it.target === "sage" ? "Sage" : "Oracle"}`}
            </button>
          ) : (
            <p className="mt-auto text-[10px] uppercase tracking-[0.32em] text-gold-light">
              {lang === "zh" ? "✓ 已解锁 —— 详见下方" : "✓ Unlocked — see below"}
            </p>
          )}
        </div>
      ))}

      {/* Third card — Ask the Sage */}
      <AskSageCard lang={lang} locked={chatLocked} onOpen={onOpenChat} />
    </div>
  );
}


/* Sign-in prompt (shown when a not-logged-in user clicks Upgrade) */
function SignInPromptModal({
  open,
  onClose,
  lang,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-obsidian/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ duration: 0.35 }}
            className="glass-card w-full max-w-md rounded-3xl p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust">
              {lang === "zh" ? "需要登录" : "Sign in required"}
            </p>
            <h3 className="mb-3 font-serif text-2xl italic text-stone-warm">
              {lang === "zh" ? "登录后即可升级" : "Sign in to upgrade"}
            </h3>
            <p className="mb-6 text-sm text-stone-warm/60">
              {lang === "zh"
                ? "请先关闭此窗口并点击右上角「登录 / 创建账号」。首次升级享 -30% 优惠。"
                : "Close this and use the Sign in / Create button at the top-right. First-time upgrades get 30% off."}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light"
            >
              {lang === "zh" ? "知道了" : "Got it"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Upgrade checkout — pick a payment method, show first-time discount */
function UpgradeCheckoutModal({
  target,
  firstTime,
  lang,
  onClose,
  onConfirm,
}: {
  target: Plan | null;
  firstTime: boolean;
  lang: Lang;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [method, setMethod] = useState<PayMethod>("wechat");
  const li = lang === "zh" ? 1 : 0;

  const methods: { id: PayMethod; label: [string, string]; hint: [string, string]; emoji: string }[] = [
    {
      id: "wechat",
      label: ["WeChat Pay", "微信支付"],
      hint: ["扫码支付 / Scan & pay", "扫码支付"],
      emoji: "💬",
    },
    {
      id: "alipay",
      label: ["Alipay", "支付宝支付"],
      hint: ["Alipay balance / 花呗", "余额 / 花呗"],
      emoji: "🅰",
    },
    {
      id: "unionpay",
      label: ["UnionPay card", "银联卡支付"],
      hint: ["China UnionPay · debit / credit", "银联借记卡 / 信用卡"],
      emoji: "🀄",
    },
    {
      id: "visa",
      label: ["Visa / Mastercard", "Visa 信用卡"],
      hint: ["International card", "国际信用卡"],
      emoji: "💳",
    },
  ];

  if (!target) return null;

  const basePrice = target === "sage" ? 19.9 : 39.9;
  const discounted = firstTime ? Math.round(basePrice * 0.7 * 10) / 10 : basePrice;

  return (
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-obsidian/70 backdrop-blur-md p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.98 }}
            transition={{ duration: 0.35 }}
            className="glass-card relative w-full max-w-lg rounded-3xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50 hover:text-gold-dust"
            >
              {lang === "zh" ? "关闭" : "Close"}
            </button>

            <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust">
              {lang === "zh" ? "升级至" : "Upgrade to"} {target === "sage" ? (lang === "zh" ? "贤者" : "Sage") : (lang === "zh" ? "神谕者" : "Oracle")}
            </p>
            <h3 className="mb-6 font-serif text-2xl italic text-stone-warm">
              {lang === "zh" ? "选择支付方式" : "Choose a payment method"}
            </h3>

            <div className="mb-6 flex items-baseline gap-3">
              <span className="font-serif text-4xl italic text-gold-light">
                ¥{discounted}
              </span>
              {firstTime && (
                <>
                  <span className="text-sm text-stone-warm/40 line-through">¥{basePrice}</span>
                  <span className="rounded-full bg-nebula-purple/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.28em] text-stone-warm">
                    {lang === "zh" ? "首次 -30%" : "-30% first-time"}
                  </span>
                </>
              )}
              <span className="text-xs text-stone-warm/50">/ {lang === "zh" ? "月" : "mo"}</span>
            </div>

            <div className="mb-6 space-y-2">
              {methods.map((m) => {
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                      active
                        ? "border-gold-dust/60 bg-gold-dust/10"
                        : "border-white/10 bg-white/[0.02] hover:border-gold-dust/30"
                    }`}
                  >
                    <span className="grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.03] text-lg">
                      {m.emoji}
                    </span>
                    <div className="flex-1">
                      <p className="font-serif text-base text-stone-warm">{m.label[li]}</p>
                      <p className="text-[11px] uppercase tracking-[0.24em] text-stone-warm/50">
                        {m.hint[li]}
                      </p>
                    </div>
                    <span
                      className={`grid size-6 place-items-center rounded-full border transition-colors ${
                        active
                          ? "border-gold-dust bg-gold-dust text-obsidian"
                          : "border-white/20 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onConfirm}
              className="w-full rounded-full bg-gold-dust px-6 py-3 text-[10px] uppercase tracking-[0.32em] text-obsidian hover:bg-gold-light"
            >
              {lang === "zh" ? `确认支付 · ¥${discounted}` : `Confirm · ¥${discounted}`}
            </button>
            <p className="mt-3 text-center text-[10px] uppercase tracking-[0.24em] text-stone-warm/30">
              {lang === "zh"
                ? "这是演示结算 —— 真实支付网关将在正式版接入。"
                : "Demo checkout — real payment gateway to be wired in production."}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}



function AIFollowupModal({
  open,
  onClose,
  lang,
  plan,
  onUpgrade,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  plan: "free" | "sage" | "oracle";
  onUpgrade: () => void;
}) {
  const { t } = useLang();
  const { account, saved } = useAccount();
  const isOracle = plan === "oracle";
  const [input, setInput] = useState("");
  const [thread, setThread] = useState<{ role: "user" | "oracle"; text: string }[]>([]);
  const [thinking, setThinking] = useState(false);

  // Enlarged prompt pool — random subset with a "refresh" button.
  const PROMPT_POOL: [string, string][] = [
    ["我这两年适合创业还是继续在大公司积累？请结合我的命盘。", "Should I start something of my own in the next two years, or keep compounding inside a large company — based on my chart?"],
    ["我的感情模式里最需要注意的盲区是什么？如何避免重复？", "What is the biggest blind spot in my relationship pattern, and how do I stop it from repeating?"],
    ["未来12个月里最值得抓住的时间窗口具体是哪些？", "Which specific time windows in the next 12 months are worth prioritizing?"],
    ["我的财富最容易积累的方式是被动收入还是主动收入？", "Given my chart, is my wealth more likely to compound through active or passive income?"],
    ["我和父母的关系里，命盘想让我先修复什么？", "In my relationship with my parents, what does the chart want me to repair first?"],
    ["如果我现在感觉停滞，应该向内修还是向外动？", "If I feel stuck right now, should I turn inward or outward?"],
    ["我此生的核心使命方向是什么？如何在下一步落地？", "What is the core mission of this life — and how do I take the next step?"],
    ["我最适合的合作者是什么样的性格与命盘组合？", "What kind of temperament and chart makes the best collaborator for me?"],
    ["我的健康在未来两年最需要照看的是哪一部分？", "Which part of my health most needs care over the next two years?"],
    ["我天生最容易低估自己的哪一项天赋？", "Which of my innate gifts am I most likely to underestimate?"],
    ["婚姻或长期关系最可能在哪个年龄段稳定下来？", "Around which age is a long-term partnership most likely to settle?"],
    ["有没有一个我一直在回避、但命盘反复提醒的功课？", "Is there a lesson I keep avoiding that the chart keeps circling back to?"],
    ["我做重大决定时，应该更信任直觉还是分析？", "When making big decisions, should I trust intuition or analysis more?"],
    ["我的原生家庭对成年后的哪一部分影响最深？", "Which part of my adult life is most shaped by my family of origin?"],
    ["未来三年最不该错过的一个「转弯」是哪个？", "Which single pivot in the next three years should I not miss?"],
  ];
  const li = lang === "zh" ? 0 : 1;

  // Refreshable random 4-prompt sample.
  const [promptSeed, setPromptSeed] = useState(0);
  const prompts = useMemo(() => {
    const arr = [...PROMPT_POOL];
    // Fisher–Yates with a lightweight seed so "refresh" gives a new set.
    let s = (Date.now() + promptSeed * 9301) >>> 0;
    const rnd = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0x100000000;
    };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptSeed, open]);

  // Reset conversation when re-opened.
  useEffect(() => {
    if (open) {
      setThread([]);
      setInput("");
    }
  }, [open]);

  const reading = saved[0];
  const buildChartSnapshot = () => {
    if (!reading) return {};
    const seed = `${reading.name || ""}|${reading.date || ""}|${reading.time || ""}|${reading.place || ""}`;
    return {
      name: reading.name || account?.name,
      astrology: `Birth ${reading.date ?? "?"} ${reading.time ?? ""} @ ${reading.place ?? "?"}. Seed=${seed}`,
      jyotish: "Sidereal Moon-anchored — Vimśottarī Dashā keyed to Moon's Nakshatra.",
      bazi: `Four pillars derived from ${reading.date ?? "?"} ${reading.time ?? ""}; year pillar per 立春.`,
      ziwei: "Palace of Self derived from lunar month + hour branch (approximation).",
    };
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setThread((tr) => [...tr, { role: "user", text: q }]);
    setInput("");
    setThinking(true);
    try {
      const { askOracle } = await import("@/lib/oracle.functions");
      const res = await askOracle({
        data: { question: q, lang, chart: buildChartSnapshot(), feature: "oracle_chat" },
      });
      setThread((tr) => [...tr, { role: "oracle", text: res.text || "…" }]);
    } catch (err) {
      console.error("Oracle call failed", err);
      const fallback =
        lang === "zh"
          ? `图书馆的信号今晚不太稳定 —— 请稍后再问。\n\n（若持续发生，可能是本次配额已用尽或网络中断。）`
          : `The library's signal is unsteady tonight — please try again in a moment.\n\n(If this persists, the quota may be exhausted or the network broken.)`;
      setThread((tr) => [...tr, { role: "oracle", text: fallback }]);
    } finally {
      setThinking(false);
    }
  };

  // Typewriter reveal for oracle messages so the reply feels like handwriting.
  const [reveal, setReveal] = useState<Record<number, number>>({});
  useEffect(() => {
    const idx = thread.length - 1;
    if (idx < 0) return;
    const m = thread[idx];
    if (m.role !== "oracle") return;
    if (reveal[idx] != null && reveal[idx] >= m.text.length) return;
    let i = reveal[idx] ?? 0;
    const total = m.text.length;
    const id = setInterval(() => {
      i = Math.min(total, i + 4);
      setReveal((r) => ({ ...r, [idx]: i }));
      if (i >= total) clearInterval(id);
    }, 20);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.length]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#0a0705]"
          onClick={onClose}
        >
          {/* Ambient library scene */}
          <div className="pointer-events-none absolute inset-0">
            {/* Warm candle glow behind the elder */}
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.55, 0.75, 0.55] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute left-1/2 top-[18%] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(212,163,72,0.35),rgba(212,163,72,0.08)_45%,transparent_70%)] blur-2xl"
            />
            {/* Bookshelf silhouette */}
            <svg
              aria-hidden
              viewBox="0 0 1200 800"
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 h-full w-full opacity-[0.28]"
            >
              <defs>
                <linearGradient id="shelf" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="#3a2a17" />
                  <stop offset="1" stopColor="#0a0705" />
                </linearGradient>
              </defs>
              {Array.from({ length: 6 }).map((_, row) => (
                <g key={row} transform={`translate(0 ${80 + row * 110})`}>
                  <rect x="0" y="70" width="1200" height="6" fill="#5b3d1e" opacity="0.6" />
                  {Array.from({ length: 40 }).map((__, i) => {
                    const h = 40 + ((i * 37 + row * 11) % 30);
                    const w = 12 + ((i * 13 + row * 7) % 10);
                    const hue = 25 + ((i + row) % 6) * 6;
                    return (
                      <rect
                        key={i}
                        x={10 + i * 30}
                        y={70 - h}
                        width={w}
                        height={h}
                        fill={`hsl(${hue} 40% ${14 + ((i + row) % 5) * 3}%)`}
                        stroke="#000"
                        strokeOpacity="0.4"
                      />
                    );
                  })}
                </g>
              ))}
            </svg>
            {/* Floating dust motes */}
            {Array.from({ length: 18 }).map((_, i) => (
              <motion.span
                key={i}
                aria-hidden
                initial={{ opacity: 0, y: 0 }}
                animate={{
                  opacity: [0, 0.7, 0],
                  y: [0, -60 - (i % 6) * 20, -140],
                  x: [0, (i % 2 === 0 ? 1 : -1) * (10 + (i % 5) * 4), 0],
                }}
                transition={{ duration: 8 + (i % 5), repeat: Infinity, delay: i * 0.4, ease: "easeInOut" }}
                className="absolute block size-[3px] rounded-full bg-gold-light/70"
                style={{ left: `${(i * 53) % 100}%`, top: `${30 + (i * 17) % 60}%` }}
              />
            ))}
            {/* Vignette */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.85)_100%)]" />
          </div>

          {/* Foreground panel */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
            className="relative z-10 mx-auto flex h-full max-h-[100dvh] w-full max-w-3xl flex-col px-3 pb-[env(safe-area-inset-bottom)] pt-[max(env(safe-area-inset-top),0.75rem)] sm:px-6 sm:pt-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with elder + close */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                {/* Elder silhouette */}
                <motion.div
                  aria-hidden
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
                  className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border border-gold-dust/40 bg-gradient-to-b from-gold-dust/25 to-obsidian/60 sm:size-16"
                >
                  <svg viewBox="0 0 64 64" className="size-10 sm:size-12">
                    {/* Hooded elder */}
                    <path d="M12 60 C 14 40, 22 30, 32 30 C 42 30, 50 40, 52 60 Z" fill="#2a1a0c" stroke="#d4a348" strokeOpacity="0.6" />
                    <ellipse cx="32" cy="26" rx="10" ry="12" fill="#e9c88a" opacity="0.85" />
                    <path d="M22 22 C 24 12, 40 12, 42 22 L 42 28 C 40 22, 24 22, 22 28 Z" fill="#2a1a0c" />
                    {/* Beard */}
                    <path d="M25 32 Q 32 46 39 32 Q 36 40 32 42 Q 28 40 25 32 Z" fill="#f0e2c2" opacity="0.9" />
                    {/* Eyes */}
                    <circle cx="28.5" cy="27" r="0.9" fill="#0a0705" />
                    <circle cx="35.5" cy="27" r="0.9" fill="#0a0705" />
                  </svg>
                  {/* Candle flicker halo */}
                  <motion.span
                    animate={{ opacity: [0.4, 0.9, 0.4] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                    className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-gold-dust/40"
                  />
                </motion.div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                    {lang === "zh" ? "神谕图书馆" : "The Oracle's Library"}
                  </p>
                  <h3 className="font-serif text-lg italic text-stone-warm sm:text-2xl">
                    {lang === "zh" ? "向智者提问" : "Ask the Elder"}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={lang === "zh" ? "关闭" : "Close"}
                className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-obsidian/70 px-2.5 text-[10px] uppercase tracking-[0.24em] text-stone-warm/70 backdrop-blur transition-colors hover:border-gold-dust/50 hover:text-gold-dust sm:px-3 sm:tracking-[0.28em]"
              >
                <span aria-hidden className="text-base leading-none">×</span>
                <span className="hidden sm:inline">{t.mem_close}</span>
              </button>
            </div>

            {/* Conversation scroll */}
            <div className="mt-3 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 sm:mt-4">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl border border-gold-dust/25 bg-gold-dust/[0.05] p-4 text-sm italic text-stone-warm/85"
              >
                {lang === "zh"
                  ? "「孩子，坐下。烛火还在。你的太阳落火象、日主为阳火 —— 想追问哪一维度？」"
                  : "\u201CChild, sit. The candle still burns. Your Sun rests in Fire, your Day Master is Yang Fire — which thread shall we pull?\u201D"}
              </motion.div>

              {thread.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                      {lang === "zh" ? "从卷轴中挑一题 · 点击即问" : "Pick a scroll · tap to ask"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setPromptSeed((s) => s + 1)}
                      className="rounded-full border border-gold-dust/30 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-gold-dust/80 transition hover:border-gold-dust hover:bg-gold-dust/10"
                    >
                      {lang === "zh" ? "换一批 ↻" : "Refresh ↻"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {prompts.map((p, i) => (
                      <motion.button
                        key={p[0]}
                        type="button"
                        disabled={!isOracle}
                        onClick={() => send(p[li])}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.55 + i * 0.06 }}
                        whileHover={{ x: 2 }}
                        className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-stone-warm/80 transition hover:border-gold-dust/40 hover:bg-gold-dust/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="mr-2 text-gold-dust/70">§</span>
                        {p[li]}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {thread.map((m, i) => {
                const shown =
                  m.role === "oracle" ? m.text.slice(0, reveal[i] ?? 0) : m.text;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className={`rounded-2xl border p-4 text-sm leading-relaxed backdrop-blur-sm ${
                      m.role === "user"
                        ? "ml-8 border-gold-dust/30 bg-gold-dust/[0.10] text-stone-warm/95"
                        : "mr-8 border-gold-dust/20 bg-[#1a1108]/70 text-stone-warm/85"
                    }`}
                  >
                    <p className="mb-1 text-[9px] uppercase tracking-[0.32em] text-gold-dust/70">
                      {m.role === "user"
                        ? lang === "zh" ? "你" : "You"
                        : lang === "zh" ? "智者" : "The Elder"}
                    </p>
                    <p className={`whitespace-pre-line ${m.role === "oracle" ? "font-serif italic" : ""}`}>
                      {shown}
                      {m.role === "oracle" && shown.length < m.text.length && (
                        <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-gold-dust align-middle" />
                      )}
                    </p>
                  </motion.div>
                );
              })}
              {thinking && (
                <motion.p
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  className="text-[11px] uppercase tracking-[0.32em] text-gold-dust/70"
                >
                  {lang === "zh" ? "智者正在翻阅古卷…" : "The elder turns an old page…"}
                </motion.p>
              )}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); if (isOracle) send(input); }}
              className="mt-3 flex items-center gap-2 rounded-full border border-gold-dust/20 bg-obsidian/80 px-3 py-2 backdrop-blur sm:mt-4 sm:px-4"
            >
              <span aria-hidden className="text-gold-dust/60">✒</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!isOracle}
                placeholder={isOracle ? t.mem_ai_placeholder : (lang === "zh" ? "升级神谕者后可提问…" : "Upgrade to Oracle to ask…")}
                className="min-w-0 flex-1 bg-transparent text-[13px] text-stone-warm outline-none placeholder:text-stone-warm/30 disabled:cursor-not-allowed sm:text-sm"
              />
              <button
                type="submit"
                disabled={!isOracle || !input.trim() || thinking}
                className="shrink-0 rounded-full bg-gold-dust px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-obsidian transition-colors hover:bg-gold-light disabled:bg-gold-dust/40 disabled:text-obsidian/50 sm:px-4 sm:tracking-[0.28em]"
              >
                {t.mem_ai_send}
              </button>
            </form>

            {!isOracle && (
              <div className="mt-3 rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06] p-4 backdrop-blur">
                <p className="mb-3 font-serif text-sm italic leading-relaxed text-stone-warm/85">
                  {t.mem_ai_upsell}
                </p>
                <button
                  type="button"
                  onClick={onUpgrade}
                  className="w-full rounded-full bg-gold-dust px-6 py-2.5 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light"
                >
                  {t.mem_upgrade} → {t.mem_oracle}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}



/* ═══════════════════════════════════════════
   Synastry preview — 合盘 (Oracle member perk)
═══════════════════════════════════════════ */

type Tradition = {
  tag: [string, string];
  title: [string, string];
  body: [string, string];
  score: number;
};

function TraditionDiagram({ tag }: { tag: string }) {
  // Lightweight, stylised diagrams so each tradition has a recognisable
  // "big picture" when the user zooms in. All decorative — real engines
  // would replace these with authentic charts.
  const size = 320;
  const c = size / 2;
  if (tag.startsWith("Western")) {
    // Circular zodiac with 12 divisions
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={c} cy={c} r={c - 8} fill="none" stroke="var(--gold-dust)" strokeOpacity={0.35} />
        <circle cx={c} cy={c} r={c - 46} fill="none" stroke="var(--gold-dust)" strokeOpacity={0.2} />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = ((i * 30 - 90) * Math.PI) / 180;
          const x1 = c + Math.cos(a) * (c - 46);
          const y1 = c + Math.sin(a) * (c - 46);
          const x2 = c + Math.cos(a) * (c - 8);
          const y2 = c + Math.sin(a) * (c - 8);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--gold-dust)" strokeOpacity={0.25} />;
        })}
        {["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"].map((g, i) => {
          const a = ((i * 30 + 15 - 90) * Math.PI) / 180;
          const r = c - 26;
          return (
            <text key={g} x={c + Math.cos(a) * r} y={c + Math.sin(a) * r + 6}
              textAnchor="middle" fontSize="18" fill="var(--gold-light)">{g}</text>
          );
        })}
        {[0, 3, 5, 8].map((i, k) => {
          const a = ((i * 30 + 15 - 90) * Math.PI) / 180;
          const x = c + Math.cos(a) * (c - 70);
          const y = c + Math.sin(a) * (c - 70);
          return <circle key={k} cx={x} cy={y} r={5} fill="var(--gold-light)" />;
        })}
      </svg>
    );
  }
  if (tag.startsWith("Vedic")) {
    // North-Indian diamond kundali
    const s = size;
    return (
      <svg viewBox={`0 0 ${s} ${s}`} width={s} height={s}>
        <rect x={12} y={12} width={s - 24} height={s - 24} fill="none" stroke="var(--gold-dust)" strokeOpacity={0.5} />
        <line x1={12} y1={12} x2={s - 12} y2={s - 12} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        <line x1={s - 12} y1={12} x2={12} y2={s - 12} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        <line x1={c} y1={12} x2={s - 12} y2={c} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        <line x1={s - 12} y1={c} x2={c} y2={s - 12} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        <line x1={c} y1={s - 12} x2={12} y2={c} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        <line x1={12} y1={c} x2={c} y2={12} stroke="var(--gold-dust)" strokeOpacity={0.4} />
        {["1","2","3","4","5","6","7","8","9","10","11","12"].map((n, i) => {
          const positions = [
            [c, 40],[s - 60, 40],[s - 40, c],[s - 60, s - 40],
            [c, s - 40],[60, s - 40],[40, c],[60, 40],
            [c - 60, c - 40],[c + 60, c - 40],[c + 60, c + 40],[c - 60, c + 40],
          ][i];
          return (
            <text key={n} x={positions[0]} y={positions[1]} textAnchor="middle"
              fontSize="14" fill="var(--gold-light)" opacity={0.75}>{n}</text>
          );
        })}
      </svg>
    );
  }
  if (tag.startsWith("BaZi")) {
    // Four Pillars grid
    const cols = ["年","月","日","时"];
    const rows = ["天干","地支","藏干","十神"];
    const cw = (size - 20) / 4;
    const rh = (size - 40) / 4;
    return (
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        {cols.map((col, i) => (
          <text key={col} x={10 + cw * (i + 0.5)} y={22} textAnchor="middle"
            fontSize="14" fill="var(--gold-dust)">{col}</text>
        ))}
        {rows.map((row, r) =>
          cols.map((_, i) => (
            <g key={`${r}-${i}`}>
              <rect x={10 + cw * i} y={30 + rh * r} width={cw - 4} height={rh - 4}
                fill="none" stroke="var(--gold-dust)" strokeOpacity={0.35} />
              <text x={10 + cw * (i + 0.5)} y={30 + rh * (r + 0.5) + 6} textAnchor="middle"
                fontSize="13" fill="var(--stone-warm)" opacity={0.85}>
                {["甲乙丙丁戊己庚辛壬癸"[(i * 3 + r) % 10],
                  "子丑寅卯辰巳午未申酉戌亥"[(i * 5 + r * 2) % 12],
                  "藏","印"][r] ?? ""}
              </text>
            </g>
          )),
        )}
        <text x={c} y={size - 6} textAnchor="middle" fontSize="10"
          fill="var(--stone-warm)" opacity={0.5}>示意 · 非真实排盘</text>
      </svg>
    );
  }
  // Ziwei 12-palace square
  const palaces = ["命宫","兄弟","夫妻","子女","财帛","疾厄","迁移","奴仆","官禄","田宅","福德","父母"];
  const cw = (size - 20) / 4;
  const rh = (size - 20) / 4;
  const layout = [
    [3, 0],[3, 1],[3, 2],[3, 3],
    [2, 3],[1, 3],[0, 3],
    [0, 2],[0, 1],[0, 0],
    [1, 0],[2, 0],
  ];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {layout.map(([col, row], i) => (
        <g key={palaces[i]}>
          <rect x={10 + cw * col} y={10 + rh * row} width={cw - 4} height={rh - 4}
            fill="none" stroke="var(--gold-dust)" strokeOpacity={0.35} />
          <text x={10 + cw * (col + 0.5)} y={10 + rh * (row + 0.5) + 6} textAnchor="middle"
            fontSize="13" fill="var(--gold-light)">{palaces[i]}</text>
        </g>
      ))}
      <text x={c} y={c} textAnchor="middle" fontSize="12" fill="var(--stone-warm)" opacity={0.55}>紫微斗数 · 十二宫</text>
    </svg>
  );
}

function TraditionCard({
  tr,
  li,
  lang,
}: {
  tr: Tradition;
  li: 0 | 1;
  lang: Lang;
}) {
  const [zoom, setZoom] = useState(false);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[9px] uppercase tracking-[0.28em] text-gold-dust/70">
          {tr.tag[li]}
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-gold-dust/30 px-2 py-0.5 text-[9px] text-gold-light">
            {tr.score}
          </span>
          <button
            onClick={() => setZoom(true)}
            className="rounded-full border border-white/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] text-stone-warm/60 transition-colors hover:border-gold-dust/50 hover:text-gold-light"
            aria-label={lang === "zh" ? "放大查看" : "Enlarge"}
          >
            {lang === "zh" ? "⤢ 放大" : "⤢ Enlarge"}
          </button>
        </div>
      </div>
      <p className="mb-1 font-serif text-sm italic text-stone-warm">{tr.title[li]}</p>
      <p className="text-[12px] leading-relaxed text-stone-warm/65">{tr.body[li]}</p>

      <ChartZoomModal
        open={zoom}
        onClose={() => setZoom(false)}
        title={tr.tag[li]}
        subtitle={tr.title[li]}
      >
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[auto_1fr]">
          <div className="flex justify-center text-stone-warm/50">
            <TraditionDiagram tag={tr.tag[0]} />
          </div>
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
              {lang === "zh" ? "契合度" : "Compatibility"} · {tr.score}
            </p>
            <p className="mb-4 text-sm leading-relaxed text-stone-warm/85">{tr.body[li]}</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-stone-warm/40">
              {lang === "zh"
                ? "图示为示意版式，仅供理解体系结构 · 精算需接入专业排盘引擎"
                : "Diagram is stylised — for structural understanding only. Precise readings require a professional engine."}
            </p>
          </div>
        </div>
      </ChartZoomModal>
    </div>
  );
}

export function SynastryPreview({ userBirthISO }: { userBirthISO?: string } = {}) {
  const { lang } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const [partner, setPartner] = useState({ name: "", date: "", time: "", place: "" });
  const [revealed, setRevealed] = useState(false);

  // Deterministic pseudo-score — now blends BOTH birth dates so the reading
  // is personal to the visitor, not just to the partner they typed in.
  const score = useMemo(() => {
    if (!revealed || !partner.date) return null;
    let h = 2166136261 >>> 0;
    const combo = (userBirthISO || "0000-00-00") + "|" + partner.date + "|" + partner.name;
    for (let i = 0; i < combo.length; i++) {
      h ^= combo.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return 62 + (h % 32); // 62–93
  }, [revealed, partner.date, partner.name, userBirthISO]);

  const axes: { label: [string, string]; value: number }[] = useMemo(() => {
    if (score == null) return [];
    const seed = score;
    const jitter = (i: number) => ((seed * 9301 + i * 49297) % 233280) / 233280;
    return [
      { label: ["Emotional resonance", "情感共振"], value: Math.round(55 + jitter(1) * 40) },
      { label: ["Communication rhythm", "沟通节奏"], value: Math.round(50 + jitter(2) * 45) },
      { label: ["Values & long-term fit", "价值观与长期契合"], value: Math.round(45 + jitter(3) * 50) },
      { label: ["Physical / sensual pull", "身体与感官吸引"], value: Math.round(50 + jitter(4) * 40) },
      { label: ["Growth catalyst", "成长催化"], value: Math.round(50 + jitter(5) * 45) },
    ];
  }, [score]);

  const verdict = (score ?? 0) >= 85
    ? ["Rare alignment · a partnership the chart wants you to protect.", "罕见的对齐 —— 命盘希望你保护的关系。"]
    : (score ?? 0) >= 72
      ? ["Warm, workable · differences that teach rather than tear.", "温暖可行 —— 差异用来教导，而非撕裂。"]
      : ["Chemistry present, calibration needed · agree on rhythm before agreeing on future.", "有化学反应，但需校准 —— 先约好节奏，再谈未来。"];

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {lang === "zh" ? "会员合盘 · 关系分析" : "Oracle Synastry · Relationship reading"}
        </p>
        <h2 className="mb-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {lang === "zh" ? "两张命盘的对话" : "A dialogue between two charts"}
        </h2>
        <p className="mb-8 max-w-3xl text-sm text-stone-warm/60">
          {lang === "zh"
            ? "输入对方的出生资料，图书馆会把两张命盘叠合，读出你们之间真正的和声与噪音 —— 而不是浪漫化的猜测。"
            : "Enter your partner's birth data. The library overlays both charts and reads the real harmony — and the real noise — between you, not romanticized guesses."}
        </p>

        <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4">
          <input
            className="ritual-input !text-base"
            placeholder={lang === "zh" ? "对方姓名" : "Partner's name"}
            value={partner.name}
            onChange={(e) => setPartner((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className="ritual-input !text-base"
            type="date"
            min="1900-01-01"
            max="2099-12-31"
            value={partner.date}
            onChange={(e) => {
              let val = e.target.value;
              const m = val.match(/^(\d+)(-\d{2}-\d{2})?$/);
              if (m && m[1].length > 4) val = m[1].slice(0, 4) + (m[2] || "");
              setPartner((p) => ({ ...p, date: val }));
            }}
            style={{ colorScheme: "dark" }}
          />
          <input
            className="ritual-input !text-base"
            type="time"
            value={partner.time}
            onChange={(e) => setPartner((p) => ({ ...p, time: e.target.value }))}
            style={{ colorScheme: "dark" }}
          />
          <input
            className="ritual-input !text-base"
            placeholder={lang === "zh" ? "出生地点" : "Birthplace"}
            value={partner.place}
            onChange={(e) => setPartner((p) => ({ ...p, place: e.target.value }))}
          />
        </div>

        <button
          type="button"
          onClick={() => setRevealed(true)}
          disabled={!partner.date}
          className="rounded-full bg-gold-dust px-6 py-2.5 text-[10px] uppercase tracking-[0.32em] text-obsidian transition-colors hover:bg-gold-light disabled:opacity-40"
        >
          {lang === "zh" ? "叠合两盘" : "Overlay the charts"}
        </button>

        {score != null && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mt-8 rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06] p-6 md:p-8"
          >
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
              <p className="font-serif text-lg italic text-stone-warm/80">
                {lang === "zh" ? "整体契合度" : "Overall resonance"}
              </p>
              <p className="font-serif text-5xl italic text-gold-light">{score}<span className="text-xl text-stone-warm/50">/100</span></p>
            </div>
            <div className="space-y-3">
              {axes.map((a) => (
                <div key={a.label[0]}>
                  <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.28em] text-stone-warm/60">
                    <span>{a.label[li]}</span>
                    <span className="text-gold-dust">{a.value}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${a.value}%` }}
                      transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-gold-dust via-gold-light to-nebula-purple"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-6 font-serif text-lg italic leading-relaxed text-stone-warm/85">
              {verdict[li]}
            </p>

            {/* Four-tradition breakdown */}
            <div className="mt-8 border-t border-gold-dust/20 pt-6">
              <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                {lang === "zh" ? "四种传统 · 四个角度" : "Four traditions · four angles"}
              </p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {(() => {
                  const j = (n: number) => Math.round(45 + ((score * 1000 + n * 997) % 45));
                  const traditions: {
                    tag: [string, string];
                    title: [string, string];
                    body: [string, string];
                    score: number;
                  }[] = [
                    {
                      tag: ["Western Astrology", "西方星盘"],
                      title: ["Chart-to-chart aspects", "两盘相位对话"],
                      body: [
                        "Sun–Moon midpoints sit within a soft trine — the day-to-day emotional weather aligns more than it clashes; friction lives in the Mars–Venus square, mostly about pace of intimacy.",
                        "太阳—月亮中点落于柔和三分相 —— 日常情绪同频多于对撞；摩擦来自火星—金星四分相，主要是「亲密节奏」的差异。",
                      ],
                      score: j(1),
                    },
                    {
                      tag: ["Vedic / Jyotish", "印度占星"],
                      title: ["Kuta compatibility · Nakshatra fit", "Kuta 契合 · 二十七宿"],
                      body: [
                        "Ashtakoot-style score points to strong Bhakoot and Nadi channels — the karmic thread is long, though the Gana axis warns of temperament mismatches under stress.",
                        "八项契合（Ashtakoot）中 Bhakoot 与 Nadi 通道良好 —— 因缘线较长；但 Gana 轴提示：压力下的性情差异需要留意。",
                      ],
                      score: j(2),
                    },
                    {
                      tag: ["BaZi 八字", "八字合婚"],
                      title: ["Day-master resonance · Ten Gods", "日主呼应 · 十神关系"],
                      body: [
                        "Day-masters form a partial 合 (union) with light 冲 in the branch — the pair helps each other's Useful God, but a shared 忌神 in the month pillar flags recurring money-topic arguments.",
                        "两方日主见「合」并微「冲」—— 彼此可扶用神；但月柱有共同忌神，暗示围绕「钱」的话题反复出现分歧。",
                      ],
                      score: j(3),
                    },
                    {
                      tag: ["Zi Wei 紫微斗数", "紫微斗数"],
                      title: ["Palace overlay · Star transfers", "宫位叠合 · 星曜互飞"],
                      body: [
                        "Your 夫妻宫 receives their 命宫 主星 — a deep pull toward long-form partnership; but 化忌 lands in 财帛宫, so joint decisions about money and property will be the recurring test.",
                        "对方命宫主星飞入你的夫妻宫 —— 长期伴侣式的深度拉力；化忌落在财帛宫，因此关于「共同金钱与财产」的决定会是反复出现的考验。",
                      ],
                      score: j(4),
                    },
                  ];
                  return traditions.map((tr) => (
                    <TraditionCard key={tr.tag[0]} tr={tr} li={li} lang={lang} />
                  ));
                })()}
              </div>
            </div>

            {/* Recent-relationship read */}
            <div className="mt-6 rounded-2xl border border-nebula-purple/30 bg-nebula-purple/[0.08] p-5">
              <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                {lang === "zh" ? "最近这段关系 · 现况解读" : "Recent state of the bond"}
              </p>
              <ul className="space-y-2 text-sm text-stone-warm/80">
                <li>
                  <span className="text-gold-light">
                    {lang === "zh" ? "近 30 天基调：" : "Last 30 days · tone: "}
                  </span>
                  {lang === "zh"
                    ? "沟通密度较前 90 天上升，但深度略降 —— 更多「日常报备」，更少「真心话」。"
                    : "Contact frequency rose vs. the prior 90 days, but depth dipped — more logistics, fewer core conversations."}
                </li>
                <li>
                  <span className="text-gold-light">
                    {lang === "zh" ? "情绪流向：" : "Emotional flow: "}
                  </span>
                  {lang === "zh"
                    ? "你付出较多情绪劳动，对方处于「回应模式」而非「主动模式」；不是不在意，是节奏差异。"
                    : "You're carrying more emotional labour; they're in response-mode rather than initiator-mode — not disengagement, a rhythm gap."}
                </li>
                <li>
                  <span className="text-gold-light">
                    {lang === "zh" ? "关键节点：" : "Key inflection: "}
                  </span>
                  {lang === "zh"
                    ? "未来 2–3 周会出现一次「小误会 / 小承诺」，处理得当会成为信任跃迁点。"
                    : "A small misunderstanding or small promise will surface in the next 2–3 weeks — handled well, it becomes a trust jump."}
                </li>
                <li>
                  <span className="text-gold-light">
                    {lang === "zh" ? "建议动作：" : "Suggested move: "}
                  </span>
                  {lang === "zh"
                    ? "主动发起一次不为「解决问题」的对话 —— 只交换感受，不做决策。"
                    : "Initiate one conversation that isn't about solving anything — exchange feelings, defer decisions."}
                </li>
              </ul>
              <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                {lang === "zh" ? "以上仅供参考，请以真实相处为准。" : "For reference only — trust lived experience."}
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   Recent windows — the next 90 days, personal state
═══════════════════════════════════════════ */

export function RecentWindows({
  birthISO,
  search,
}: {
  birthISO?: string;
  search?: ReportSearchLike;
}) {
  const { lang } = useLang();
  const li = lang === "zh" ? 1 : 0;
  const { outlook, state: aiState } = useChartOutlook(search, lang);

  // Deterministic per-user rotation of fallback windows.
  const seed = useMemo(() => {
    const base = (birthISO ?? "0000-00-00") + new Date().toISOString().slice(0, 10);
    let h = 0;
    for (const c of base) h = (h * 33 + c.charCodeAt(0)) >>> 0;
    return h;
  }, [birthISO]);

  const fmt = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric" });
  };

  type WindowRow = { range: string; tone: string; body: string; score: number };
  type BarRow = { label: string; value: number };

  const fallbackWindows: WindowRow[] = [
    {
      range: `${fmt(0)} — ${fmt(6)}`,
      tone: lang === "zh" ? "信号周" : "Signal week",
      body:
        lang === "zh"
          ? "水星与日主本周都在发言 —— 会有一条消息、一次回电、或一个看似小的决定，其涟漪比表面更远。"
          : "Mercury and your Day-Master both talk this week — expect a message, a callback, or a small decision that ripples further than it looks.",
      score: 55 + (seed % 30),
    },
    {
      range: `${fmt(7)} — ${fmt(20)}`,
      tone: lang === "zh" ? "先歇后进" : "Rest before push",
      body:
        lang === "zh"
          ? "本窗口中段能量下沉，后段回弹。前半段护住睡眠；后半段，你敲的门才会有回应。"
          : "Energy dips mid-window then rebounds. Protect sleep now; the second half is when doors respond to knocks.",
      score: 45 + ((seed >> 3) % 30),
    },
    {
      range: `${fmt(21)} — ${fmt(45)}`,
      tone: lang === "zh" ? "财路开通" : "Wealth channel opens",
      body:
        lang === "zh"
          ? "会有一个小而真实的收入或机会信号。不是彩票 —— 而是一条你一直不愿发送的消息，被打开后的回报。"
          : "A small but real income or opportunity signal. Not a lottery — a channel that rewards a message you've been avoiding sending.",
      score: 65 + ((seed >> 5) % 25),
    },
    {
      range: `${fmt(46)} — ${fmt(90)}`,
      tone: lang === "zh" ? "关系再校准" : "Relationship recalibration",
      body:
        lang === "zh"
          ? "一段你一直拖延的对话，会变得无法回避。处理得当，信任加深；再拖，就会硬化成怨。"
          : "A conversation you've postponed becomes unavoidable. Handled well, it deepens trust; postponed further, it hardens into resentment.",
      score: 50 + ((seed >> 7) % 30),
    },
  ];

  const fallbackBars: BarRow[] = [
    { label: lang === "zh" ? "元气" : "Vitality", value: 40 + ((seed >> 2) % 55) },
    { label: lang === "zh" ? "专注" : "Focus", value: 40 + ((seed >> 4) % 55) },
    { label: lang === "zh" ? "情绪" : "Mood", value: 40 + ((seed >> 6) % 55) },
    { label: lang === "zh" ? "运气窗口" : "Luck window", value: 40 + ((seed >> 8) % 55) },
  ];

  const ai = outlook?.outlook90;

  const windows: WindowRow[] = ai && ai.windows.length > 0
    ? ai.windows.map((w) => ({
        range: `${fmt(w.offsetFromDays)} — ${fmt(w.offsetToDays)}`,
        tone: w.tone,
        body: w.body,
        score: Math.max(0, Math.min(100, w.score)),
      }))
    : fallbackWindows;

  const bars: BarRow[] = ai && ai.bars.length > 0
    ? ai.bars.map((b) => ({
        label: b.label,
        value: Math.max(0, Math.min(100, b.value)),
      }))
    : fallbackBars;

  const stateScore = ai ? Math.max(0, Math.min(100, ai.stateScore)) : 45 + (seed % 40);

  const iconForKey: Record<string, string> = {
    career: "◈",
    study: "✎",
    love: "❥",
    health: "✦",
  };
  const dimTitleFallback: Record<string, [string, string]> = {
    career: ["Career", "事业"],
    study: ["Study", "学业"],
    love: ["Love", "爱情"],
    health: ["Health", "健康"],
  };
  const fallbackDims = [
    {
      key: "career",
      points: [
        lang === "zh"
          ? "信号周（第 1–6 天）—— 对主动找来的信息尽快回应；此时的迟回，往后会失去一个位子。"
          : "Signal week (Days 1–6) — respond fast to inbound messages; a late reply now costs a slot later.",
        lang === "zh" ? "第 25–35 天出现谈判窗口 —— 准备数字，不是情绪。" : "A negotiation window opens around Day 25–35 — prepare numbers, not emotion.",
        lang === "zh" ? "对外展示（提案 / 面试 / 上线）最佳窗口在第 46–65 天。" : "Public-facing move (pitch/interview/launch) best placed Day 46–65.",
      ],
      cautions: [
        lang === "zh" ? "第 10–18 天能量低谷期，避免签署多年期承诺。" : "Avoid signing multi-year commitments in the mid-window energy dip (Day 10–18).",
        lang === "zh" ? "别在即时消息中争论；此期语气容易误读，会留下小而持久的裂痕。" : "Don't argue over chat; misread tone triggers a small-but-lasting rupture.",
      ],
      mitigations: [
        lang === "zh" ? "涉及金钱的内容，写完先搁置 12 小时再发送。" : "Draft, then wait 12h before sending anything with financial stakes.",
        lang === "zh" ? "每周留一天缓冲日 —— 用来收尾，不接新承诺。" : "Book one buffer day per week — used for cleanup, not new commitments.",
      ],
    },
    {
      key: "study",
      points: [
        lang === "zh" ? "前 20 天记忆更清晰 —— 把背诵与核心概念放在前段。" : "Retention is sharper in the first 20 days — front-load core concepts.",
        lang === "zh" ? "第 21–45 天利于综合：写作、项目、框架复盘。" : "Day 21–45 favours synthesis: essays, coding projects, revision.",
        lang === "zh" ? "第 60 天后适合主动寻求导师或同伴反馈。" : "Day 60+ is a good window to seek mentor / peer feedback.",
      ],
      cautions: [
        lang === "zh" ? "本季不宜频繁更换学习方法 —— 命盘偏爱稳定。" : "Avoid switching study methods mid-window.",
        lang === "zh" ? "第 40 天后的熬夜冲刺，会在其后一周悄悄侵蚀专注力。" : "Late-night marathon sessions after Day 40 erode focus.",
      ],
      mitigations: [
        lang === "zh" ? "本窗口内，「90 分钟固定 + 20 分钟散步」优于「不定长冲刺」。" : "Fixed 90-min blocks + 20-min walk beats variable sprints.",
        lang === "zh" ? "每周一页手写复盘；本季未落笔的知识不易内化。" : "Weekly one-page written recap; unwritten knowledge doesn't stick.",
      ],
    },
    {
      key: "love",
      points: [
        lang === "zh" ? "既有关系：第 46–70 天，一次拖延的对话变得不可回避。" : "A postponed conversation becomes unavoidable around Day 46–70.",
        lang === "zh" ? "单身：真正的连结（非闪电式）出现在共同兴趣场景，而非软件。" : "Single: a real connection appears via shared-interest contexts.",
        lang === "zh" ? "本季，身体温度与小仪式，比宏大宣言更重要。" : "Warmth and small rituals matter more than grand statements.",
      ],
      cautions: [
        lang === "zh" ? "第 7–20 天的怀旧低谷中，避免与旧人重启 —— 那是记忆，不是信号。" : "Don't restart with an old ex in the Day 7–20 nostalgia dip.",
        lang === "zh" ? "情绪中段低谷，不宜表白；等回弹再说。" : "Avoid confessing during the mid-window emotional trough.",
      ],
      mitigations: [
        lang === "zh" ? "只命名感受，不索取决定 —— 一次 5 分钟的诚实，胜过 2 小时的绕圈。" : "Name feelings without demanding decisions.",
        lang === "zh" ? "用 3 条具体行为检验新对象，而非「感觉」。" : "Screen new interests against 3 concrete behaviours.",
      ],
    },
    {
      key: "health",
      points: [
        lang === "zh" ? "元气在最后一个窗口（第 60 天后）到达峰值 —— 把一次身体挑战留到那时。" : "Vitality peaks in the last window — save one physical challenge for it.",
        lang === "zh" ? "本季，睡眠结构比睡眠长度更重要。" : "Sleep architecture matters more than sleep length.",
        lang === "zh" ? "消化系统是当前的薄弱环节 —— 命盘提示肠胃 / 肝气讯号。" : "Digestive system is the weak link now.",
      ],
      cautions: [
        lang === "zh" ? "第 10–25 天，避免新的刺激物（浓咖啡 / 极端节食）。" : "Avoid new stimulants during Day 10–25.",
        lang === "zh" ? "现在忽视一处反复的小痛，会在第 60 天后放大成阻碍。" : "Ignoring a small recurring pain now compounds later.",
      ],
      mitigations: [
        lang === "zh" ? "固定睡眠窗口（前后 30 分钟内），本季能同时护住情绪、专注与皮肤。" : "Fixed sleep window (±30 min) protects mood, focus, and skin.",
        lang === "zh" ? "每日一顿温热正餐 + 饭后 20 分钟步行 —— 小而不可让步。" : "One warm meal + a 20-min walk after dinner — non-negotiable.",
      ],
    },
  ];

  const dims = ai && ai.dimensions.length > 0
    ? ai.dimensions.map((d) => ({
        key: d.key,
        icon: iconForKey[d.key] ?? "◈",
        title: d.title || dimTitleFallback[d.key]?.[li] || d.key,
        points: d.points,
        cautions: d.cautions,
        mitigations: d.mitigations,
      }))
    : fallbackDims.map((d) => ({
        key: d.key,
        icon: iconForKey[d.key] ?? "◈",
        title: dimTitleFallback[d.key][li],
        points: d.points,
        cautions: d.cautions,
        mitigations: d.mitigations,
      }));

  return (
    <section className="mx-auto max-w-5xl px-6 pb-24 md:px-12 print:hidden">
      <div className="glass-card rounded-3xl p-8 md:p-12">
        <p className="mb-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {lang === "zh" ? "会员近况 · 最近的时间节点与状态" : "Oracle Now · Near-term windows & personal state"}
        </p>
        <h2 className="mb-3 font-serif text-2xl italic text-stone-warm md:text-3xl">
          {lang === "zh" ? "接下来的 90 天，命盘在说什么" : "What the chart is saying, next 90 days"}
        </h2>
        <p className="mb-4 max-w-3xl text-sm text-stone-warm/60">
          {lang === "zh"
            ? "四个近期窗口 + 你此刻的四条状态曲线 —— 每天不必再问「今天适不适合」，直接看窗口。"
            : "Four near-term windows and four live state bars — stop asking daily whether today is auspicious; read the window instead."}
        </p>
        {aiState === "loading" && (
          <p className="mb-6 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
            <span className="size-1.5 animate-pulse rounded-full bg-gold-dust" />
            {lang === "zh" ? "正在结合当前行运重算……" : "Recomputing with current transits…"}
          </p>
        )}
        {ai?.stateSummary && (
          <p className="mb-6 max-w-3xl font-serif text-base italic leading-relaxed text-gold-light/80">
            {ai.stateSummary}
          </p>
        )}

        <div className="mb-8 rounded-2xl border border-gold-dust/30 bg-gold-dust/[0.06] p-6">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-serif text-lg italic text-stone-warm/85">
              {lang === "zh" ? "此刻状态指数" : "Personal state index"}
            </p>
            <p className="font-serif text-4xl italic text-gold-light">
              {stateScore}<span className="text-base text-stone-warm/50">/100</span>
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.28em] text-stone-warm/60">
                  <span>{b.label}</span>
                  <span className="text-gold-dust">{b.value}</span>
                </div>
                <div className="h-1 rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${b.value}%` }}
                    transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
                    className="h-full rounded-full bg-gradient-to-r from-nebula-purple via-gold-dust to-gold-light"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <ol className="relative space-y-4 border-l border-gold-dust/30 pl-6">
          {windows.map((w) => (
            <li key={w.range} className="relative">
              <span className="absolute -left-[29px] top-2 size-2.5 rounded-full bg-gold-dust shadow-[0_0_12px_hsl(45_70%_60%/0.6)]" />
              <div className="rounded-2xl border border-gold-dust/20 bg-white/[0.02] p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust">{w.range}</p>
                  <span className="rounded-full border border-gold-dust/30 px-3 py-0.5 text-[9px] uppercase tracking-[0.28em] text-gold-light">
                    {w.tone} · {w.score}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-stone-warm/75">{w.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Detailed four-dimension guidance */}
        <div className="mt-10">
          <p className="mb-4 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
            {lang === "zh" ? "四大维度 · 分点提醒" : "Four life dimensions · pointed guidance"}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {dims.map((d) => (
              <div
                key={d.key}
                className="rounded-2xl border border-gold-dust/20 bg-white/[0.02] p-5"
              >
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-lg text-gold-light">{d.icon}</span>
                  <p className="font-serif text-lg italic text-stone-warm">{d.title}</p>
                </div>
                <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-gold-dust/70">
                  {lang === "zh" ? "关键提示" : "Key signals"}
                </p>
                <ul className="mb-3 space-y-1.5 text-[13px] leading-relaxed text-stone-warm/75">
                  {d.points.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-gold-dust/70">·</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-nebula-purple/80">
                  {lang === "zh" ? "注意事项" : "Cautions"}
                </p>
                <ul className="mb-3 space-y-1.5 text-[13px] leading-relaxed text-stone-warm/70">
                  {d.cautions.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-nebula-purple/80">△</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-gold-light/80">
                  {lang === "zh" ? "规避方式" : "Mitigations"}
                </p>
                <ul className="space-y-1.5 text-[13px] leading-relaxed text-stone-warm/70">
                  {d.mitigations.map((p, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-gold-light/80">✓</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
            {lang === "zh" ? "以上均为命盘趋势参考 · 请结合自身判断" : "Trend reference only · combine with your own judgement"}
          </p>
        </div>
      </div>
    </section>
  );
}

