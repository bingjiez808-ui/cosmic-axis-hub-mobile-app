/**
 * PlayfulLibrarySection — "趣味图书馆 · 换一种学科，重新读懂人生"
 *
 * Cross-disciplinary exhibits that translate the long-form chart into
 * languages the visitor already knows (functions, curves, poems, maps).
 *
 * Interaction model
 *   - Desktop: horizontal exhibit table, one book expands in place.
 *   - Mobile: vertical spine list, one book expands in place.
 *   - Only ONE book open at a time; the rest collapse.
 *   - Coming-soon books are visually dimmed and NOT clickable.
 *
 * We do not open any payment modal here. CTA routing is delegated to
 * `resolveCta` (see `src/lib/home-cta.ts`); paid pages own their own
 * upgrade surface via RoomLockedShell + MembershipCheckoutModal.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import {
  accessTagLabel,
  accessTagTooltip,
  ctaMicroCopy,
  resolveCta,
  type AccessTag,
} from "@/lib/home-cta";
import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";
import { listUserCharts } from "@/lib/reports-store.functions";
import { useMembershipTier } from "@/lib/use-membership-tier";

// ─────────────────────────────────────────────────────────────
// Book catalogue — real routes only. Coming-soon books have no href.
// ─────────────────────────────────────────────────────────────

type BookId = "math" | "chinese" | "geo" | "history" | "physics" | "econ" | "biology";

type BookDef = {
  id: BookId;
  code: string; // 金色馆藏编号
  titleZh: string;
  titleEn: string;
  taglineZh: string;
  taglineEn: string;
  accent: string; // spine gradient
  status: AccessTag; // "open" | "coming"
  target?: string; // real route only, undefined for coming-soon
  targetLabelZh?: string;
  targetLabelEn?: string;
  requiresPrimaryChart?: boolean;
};

const BOOKS: BookDef[] = [
  {
    id: "math",
    code: "MS·001",
    titleZh: "数学馆 · 把人生写成一条会变化的函数",
    titleEn: "Math Hall · Life as a Changing Function",
    taglineZh: "六个现实维度按年龄换权重，选择让曲线走出不同分支",
    taglineEn: "Six life dimensions reweight with age; each choice bends the curve",
    accent: "from-nebula-purple/60 via-nebula-purple/30 to-transparent",
    status: "open",
    target: "/life-studies/math",
    targetLabelZh: "数学馆",
    targetLabelEn: "the Math Hall",
    requiresPrimaryChart: true,
  },
  {
    id: "chinese",
    code: "LT·002",
    titleZh: "语文馆 · 那些长大后才读懂的句子",
    titleEn: "Letters Hall · Lines You Only Understand Later",
    taglineZh: "根据年龄阶段与命盘长期结构，推荐此刻能与你共鸣的一句",
    taglineEn: "A poem or line matched to your life stage and long-term chart pattern",
    accent: "from-gold-dust/50 via-gold-dust/25 to-transparent",
    status: "open",
    target: "/me/echoes",
    targetLabelZh: "语文馆",
    targetLabelEn: "the Letters Hall",
    requiresPrimaryChart: true,
  },
  {
    id: "geo",
    code: "GA·—",
    titleZh: "地理馆 · 人生迁移地图",
    titleEn: "Geography Hall · The Life Migration Map",
    taglineZh: "西方占星地理线与迁移盘，展示不同城市的生活主题",
    taglineEn: "Astrocartography lines and relocation charts across the world map",
    accent: "from-sky-500/40 via-sky-500/20 to-transparent",
    status: "coming",
  },
  {
    id: "history",
    code: "HT·—",
    titleZh: "历史馆 · 与你同龄的回声",
    titleEn: "History Hall · Echoes at Your Age",
    taglineZh: "相似人生阶段中的历史人物如何面对当时的困惑",
    taglineEn: "Historical figures who faced your stage's questions",
    accent: "from-amber-500/40 via-amber-500/20 to-transparent",
    status: "coming",
  },
  {
    id: "physics",
    code: "PH·—",
    titleZh: "物理馆 · 人生惯性与转向成本",
    titleEn: "Physics Hall · Inertia and the Cost of Turning",
    taglineZh: "惯性、阻力、势能与临界点解释改变",
    taglineEn: "Inertia, friction, potential and critical points frame change",
    accent: "from-cyan-500/40 via-cyan-500/20 to-transparent",
    status: "coming",
  },
  {
    id: "econ",
    code: "EC·—",
    titleZh: "经济馆 · 选择、机会成本与风险",
    titleEn: "Economics Hall · Choice, Opportunity Cost, Risk",
    taglineZh: "人生选择的资源分配与机会成本",
    taglineEn: "How life choices allocate scarce time, energy and money",
    accent: "from-emerald-500/40 via-emerald-500/20 to-transparent",
    status: "coming",
  },
  {
    id: "biology",
    code: "BI·—",
    titleZh: "生物馆 · 节律、适应与恢复",
    titleEn: "Biology Hall · Rhythm, Adaptation, Recovery",
    taglineZh: "不同阶段的精力、压力与恢复节律（非医疗建议）",
    taglineEn: "Energy, stress and recovery rhythms by life stage (not medical advice)",
    accent: "from-pink-500/40 via-pink-500/20 to-transparent",
    status: "coming",
  },
];

// ─────────────────────────────────────────────────────────────
// Mini visualisations
// ─────────────────────────────────────────────────────────────

/** Math book preview — main life curve + six dimension chips + branch demo. */
function MathBookPreview({ isZh }: { isZh: boolean }) {
  const [branch, setBranch] = useState<"base" | "job" | "relation" | "move" | "risk">("base");
  const [hoverAge, setHoverAge] = useState<number | null>(null);

  const dims = useMemo(
    () =>
      isZh
        ? ["学业", "事业", "爱情与关系", "财富", "家庭", "健康"]
        : ["Study", "Career", "Love", "Wealth", "Family", "Health"],
    [isZh],
  );

  // Deterministic pseudo-curves (age 18..70). Not a prediction — a demo.
  const width = 520;
  const height = 140;
  const ages = Array.from({ length: 53 }, (_, i) => 18 + i);
  const pathFor = (kind: typeof branch) => {
    const points = ages.map((a, i) => {
      const t = i / (ages.length - 1);
      const base = 50 + 22 * Math.sin(t * Math.PI * 1.4);
      const jitter =
        kind === "job"
          ? -6 * Math.cos(t * Math.PI * 2.2) + (t > 0.35 ? 8 : 0)
          : kind === "relation"
            ? 4 * Math.sin(t * Math.PI * 3)
            : kind === "move"
              ? (t > 0.5 ? -4 : 3) + 6 * Math.sin(t * Math.PI * 1.8)
              : kind === "risk"
                ? 10 * Math.sin(t * Math.PI * 4)
                : 0;
      const y = Math.max(8, Math.min(height - 8, base + jitter));
      const x = 10 + t * (width - 20);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${(height - y).toFixed(1)}`;
    });
    return points.join(" ");
  };

  const branches = isZh
    ? [
        { k: "base", label: "继续当前路径" },
        { k: "job", label: "换工作" },
        { k: "relation", label: "进入一段关系" },
        { k: "move", label: "搬到新城市" },
        { k: "risk", label: "高风险投资" },
      ]
    : [
        { k: "base", label: "Stay the course" },
        { k: "job", label: "Change job" },
        { k: "relation", label: "Enter a relationship" },
        { k: "move", label: "Move city" },
        { k: "risk", label: "High-risk bet" },
      ];

  return (
    <div className="rounded-2xl border border-white/5 bg-obsidian/60 p-4">
      <div
        className="relative overflow-hidden rounded-xl bg-gradient-to-b from-nebula-purple/10 to-transparent"
        onMouseMove={(e) => {
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * (ages.length - 1);
          setHoverAge(Math.round(18 + x));
        }}
        onMouseLeave={() => setHoverAge(null)}
      >
        <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" aria-hidden>
          <defs>
            <linearGradient id="mathCurve" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="hsl(268 60% 70%)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="hsl(45 80% 65%)" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <path d={pathFor("base")} stroke="rgba(255,255,255,0.14)" strokeWidth={1.5} fill="none" />
          <motion.path
            key={branch}
            d={pathFor(branch)}
            stroke="url(#mathCurve)"
            strokeWidth={2}
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9 }}
          />
        </svg>
        {hoverAge !== null && (
          <div className="pointer-events-none absolute right-3 top-2 text-[10px] uppercase tracking-[0.32em] text-stone-warm/60">
            {isZh ? `年龄 ${hoverAge}` : `Age ${hoverAge}`}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {dims.map((d) => (
          <span
            key={d}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] text-stone-warm/60"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {branches.map((b) => (
          <button
            key={b.k}
            type="button"
            onClick={() => setBranch(b.k as typeof branch)}
            aria-pressed={branch === b.k}
            className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] transition ${
              branch === b.k
                ? "border-gold-dust/60 bg-gold-dust/10 text-gold-light"
                : "border-white/10 text-stone-warm/60 hover:border-gold-dust/40"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-stone-warm/40">
        {isZh
          ? "示例为情景模拟，不是确定预测。完成仪式后会用你的真实命盘生成属于你的曲线。"
          : "Demonstration only — a scenario, not a prediction. After the ritual we draw your own curve from the real chart."}
      </p>
    </div>
  );
}

/** Chinese book preview — a sealed letter that opens to one sample line. */
function ChineseBookPreview({ isZh }: { isZh: boolean }) {
  const samples = isZh
    ? [
        { line: "山重水复疑无路，柳暗花明又一村。", source: "陆游" },
        { line: "此心安处是吾乡。", source: "苏轼" },
        { line: "行到水穷处，坐看云起时。", source: "王维" },
      ]
    : [
        { line: "Not till the mountains fold do a new village and blossoms appear.", source: "Lu You" },
        { line: "Where the heart rests, there is my home.", source: "Su Shi" },
        { line: "Walk until the water ends, then sit and watch the clouds rise.", source: "Wang Wei" },
      ];
  const [idx, setIdx] = useState(0);
  const [showWhy, setShowWhy] = useState(false);
  const s = samples[idx];
  return (
    <div className="rounded-2xl border border-white/5 bg-obsidian/60 p-5">
      <div className="rounded-xl border border-gold-dust/20 bg-gradient-to-b from-gold-dust/8 to-transparent p-5">
        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
          {isZh ? "示例馆藏" : "Sample volume"}
        </p>
        <p className="mt-3 font-serif text-lg italic leading-relaxed text-stone-warm">
          「{s.line}」
        </p>
        <p className="mt-2 text-[11px] uppercase tracking-[0.32em] text-stone-warm/50">
          — {s.source}
        </p>
        {showWhy && (
          <p className="mt-4 border-t border-white/5 pt-3 text-xs leading-relaxed text-stone-warm/65">
            {isZh
              ? "首页示例仅展示格式。完成仪式后，语文馆会根据你此刻的年龄阶段与命盘长期结构，挑出一句可能与你处境共鸣的诗句，并说明它原本在说什么、为什么此刻可能触动你，以及一条可以带回生活的反思问题。"
              : "The homepage sample only shows the format. After the ritual, the Letters Hall chooses a line that may resonate with your current life stage and chart pattern, explains its original context, and offers one question to bring back into your day."}
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          aria-expanded={showWhy}
          className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-dust"
        >
          {isZh ? (showWhy ? "收起说明" : "为什么是这句话") : showWhy ? "Hide" : "Why this line?"}
        </button>
        <button
          type="button"
          onClick={() => {
            setIdx((i) => (i + 1) % samples.length);
            setShowWhy(false);
          }}
          className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.24em] text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-dust"
        >
          {isZh ? "换一页" : "Turn the page"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Access chip
// ─────────────────────────────────────────────────────────────

function AccessChip({ tag, isZh }: { tag: AccessTag; isZh: boolean }) {
  const tone =
    tag === "open"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
      : tag === "coming"
        ? "border-white/10 bg-white/5 text-stone-warm/45"
        : tag === "sage"
          ? "border-gold-dust/40 bg-gold-dust/10 text-gold-light"
          : tag === "oracle"
            ? "border-nebula-purple/40 bg-nebula-purple/15 text-stone-warm"
            : "border-white/10 bg-white/5 text-stone-warm/70";
  return (
    <span
      title={accessTagTooltip(tag, isZh)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.24em] ${tone}`}
    >
      <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
      {accessTagLabel(tag, isZh)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────
// Book row
// ─────────────────────────────────────────────────────────────

type BookRowProps = {
  book: BookDef;
  open: boolean;
  onToggle: () => void;
  isSignedIn: boolean;
  hasPrimaryChart: boolean;
  tier: "none" | "sage" | "oracle";
  isZh: boolean;
  reduce: boolean;
};

function BookRow({ book, open, onToggle, isSignedIn, hasPrimaryChart, tier, isZh, reduce }: BookRowProps) {
  const isComing = book.status === "coming";
  const cta = book.target
    ? resolveCta({
        target: book.target,
        requiresPrimaryChart: book.requiresPrimaryChart ?? true,
        comingSoon: isComing,
        isSignedIn,
        hasPrimaryChart,
        tier,
      })
    : { href: null, state: "coming_soon" as const, disabled: true };
  const title = isZh ? book.titleZh : book.titleEn;
  const tagline = isZh ? book.taglineZh : book.taglineEn;
  const targetLabel = { zh: book.targetLabelZh ?? "", en: book.targetLabelEn ?? "" };

  return (
    <div
      className={`overflow-hidden rounded-2xl border transition ${
        isComing
          ? "border-white/5 bg-obsidian/40 opacity-70"
          : "border-white/10 bg-obsidian/60 hover:border-gold-dust/30"
      }`}
    >
      <button
        type="button"
        onClick={isComing ? undefined : onToggle}
        aria-expanded={open}
        aria-controls={`book-panel-${book.id}`}
        disabled={isComing}
        className={`flex w-full items-center gap-4 px-4 py-4 text-left transition ${
          isComing ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        {/* Spine strip */}
        <div
          aria-hidden
          className={`h-14 w-2.5 shrink-0 rounded-sm bg-gradient-to-b ${book.accent}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/60">
              {book.code}
            </span>
            <AccessChip tag={book.status} isZh={isZh} />
          </div>
          <p className="mt-1.5 font-serif text-base leading-snug text-stone-warm sm:text-lg">
            {title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-stone-warm/55">{tagline}</p>
        </div>
        {!isComing && (
          <span
            aria-hidden
            className={`text-gold-dust/60 transition-transform ${open ? "rotate-180" : ""}`}
          >
            ▾
          </span>
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && !isComing && (
          <motion.div
            id={`book-panel-${book.id}`}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="grid gap-5 px-4 py-5 md:grid-cols-[1fr_1.15fr] md:gap-6">
              <div className="text-sm leading-relaxed text-stone-warm/70">
                {book.id === "math" && (
                  <>
                    <p>
                      {isZh
                        ? "人生不是一条注定的直线。事业、学业、关系、家庭、财富和健康会在不同年龄改变权重；选择、机会与偶然事件，则让同一张命盘走出不同的曲线。"
                        : "Life is not a fixed straight line. Study, career, love, wealth, family and health each carry different weight at different ages — and choice, opportunity and chance bend the same chart down different curves."}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-stone-warm/55">
                      <li>
                        {isZh
                          ? "· 悬停曲线查看某个年龄哪些维度贡献大、哪些正在消耗"
                          : "· Hover the curve to see which dimensions contribute or drain at each age"}
                      </li>
                      <li>
                        {isZh
                          ? "· 点击「人生分支」看同一张命盘在不同选择下的走势"
                          : "· Try the branches to see how the same chart bends under different choices"}
                      </li>
                      <li>
                        {isZh
                          ? "· 大数定律、幸存者偏差、辛普森悖论、墨菲定律、回归均值 — 五张人生卡片"
                          : "· Five cards: law of large numbers, survivorship bias, Simpson's paradox, Murphy, regression to the mean"}
                      </li>
                    </ul>
                  </>
                )}
                {book.id === "chinese" && (
                  <>
                    <p>
                      {isZh
                        ? "有些诗句小时候只会背，走到某个年纪才发现，它早已写过自己的困惑。"
                        : "Some lines you only recite as a child — and only years later discover they had already named the thing you're struggling with."}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-stone-warm/55">
                      <li>
                        {isZh
                          ? "· 根据年龄阶段、当前关注领域和命盘长期结构推荐一句"
                          : "· A line chosen for your life stage, current focus and long-term chart pattern"}
                      </li>
                      <li>
                        {isZh
                          ? "· 解释它原本在说什么、为什么此刻可能与你共鸣"
                          : "· What it originally meant, and why it may resonate now"}
                      </li>
                      <li>
                        {isZh
                          ? "· 一条可以带回现实生活的反思问题"
                          : "· One reflection question to carry into the day"}
                      </li>
                    </ul>
                  </>
                )}
              </div>
              <div>
                {book.id === "math" ? (
                  <MathBookPreview isZh={isZh} />
                ) : (
                  <ChineseBookPreview isZh={isZh} />
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-4 py-4">
              <span className="text-[11px] leading-relaxed text-stone-warm/50">
                {ctaMicroCopy(cta.state, targetLabel, isZh)}
              </span>
              {cta.href ? (
                <Link
                  to={cta.href}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-gold-dust/40 bg-obsidian/80 px-6 py-2.5 text-[11px] uppercase tracking-[0.28em] text-gold-dust transition hover:bg-gold-dust/10"
                >
                  {ctaLabel(cta.state, book, isZh)}
                </Link>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ctaLabel(state: string, book: BookDef, isZh: boolean): string {
  if (state === "signed_out") return isZh ? "登录以继续" : "Sign in to continue";
  if (state === "no_primary")
    return isZh
      ? book.id === "math"
        ? "完成仪式 · 生成我的人生函数"
        : "完成仪式 · 领取此刻的句子"
      : book.id === "math"
        ? "Complete the ritual"
        : "Complete the ritual";
  return isZh
    ? `进入${book.id === "math" ? "数学馆" : "语文馆"}`
    : book.id === "math"
      ? "Open the Math Hall"
      : "Open the Letters Hall";
}

// ─────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────

export function PlayfulLibrarySection() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const { session } = useSupabaseSession();
  const isSignedIn = !!session;
  const membership = useMembershipTier();
  const tier: "none" | "sage" | "oracle" =
    membership.kind === "ready" ? membership.tier : "none";

  const [hasPrimaryChart, setHasPrimaryChart] = useState(false);
  useEffect(() => {
    if (!isSignedIn) {
      setHasPrimaryChart(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await listUserCharts();
        if (!cancelled) setHasPrimaryChart(rows.some((c) => c.is_primary));
      } catch {
        if (!cancelled) setHasPrimaryChart(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  // Only one open at a time. Default first open book on desktop for
  // 6-second scan; mobile starts collapsed to avoid a tall first paint.
  const [openId, setOpenId] = useState<BookId | null>(null);
  const reduce = !!useReducedMotion();

  return (
    <section
      id="playful-library"
      data-testid="playful-library"
      className="relative z-10 mx-auto max-w-6xl px-5 py-24 sm:px-6"
    >
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust/80">
          {isZh ? "跨学科馆藏" : "Cross-discipline exhibits"}
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-warm md:text-4xl">
          {isZh
            ? "趣味图书馆 · 换一种学科，重新读懂人生"
            : "Playful Library — read your life in another discipline"}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-stone-warm/60">
          {isZh
            ? "如果命理术语离生活太远，就换一种你熟悉的语言。这里把命盘中的长期结构，翻译成函数、曲线、诗句、地图与可以分享的人生卡片。"
            : "When the traditional vocabulary feels far from daily life, switch to a language you already know. Here the long-term structure of the chart is translated into functions, curves, poems, maps — and small cards worth sharing."}
        </p>
        <p className="mx-auto mt-3 max-w-xl text-[11px] leading-relaxed text-stone-warm/40">
          {isZh
            ? "先完成一次出生信息仪式，趣味图书馆才知道该把哪一本书递给你。"
            : "Complete the birth-information ritual first, so the library knows which book to hand you."}
        </p>
      </header>

      {/* How to enter — three steps */}
      <ol className="mx-auto mt-8 grid max-w-3xl gap-3 text-[11px] uppercase tracking-[0.24em] text-stone-warm/55 sm:grid-cols-3">
        {[
          isZh ? "01 · 完成出生信息仪式" : "01 · Complete the ritual",
          isZh ? "02 · 命盘设为主命盘" : "02 · Set as your primary chart",
          isZh ? "03 · 从这里进入已开放馆藏" : "03 · Open any available exhibit",
        ].map((step) => (
          <li
            key={step}
            className="rounded-xl border border-white/5 bg-obsidian/50 px-4 py-3 text-center"
          >
            {step}
          </li>
        ))}
      </ol>

      {/* Book stack */}
      <div className="mt-10 grid gap-3">
        {BOOKS.map((b) => (
          <BookRow
            key={b.id}
            book={b}
            open={openId === b.id}
            onToggle={() => setOpenId((id) => (id === b.id ? null : b.id))}
            isSignedIn={isSignedIn}
            hasPrimaryChart={hasPrimaryChart}
            tier={tier}
            isZh={isZh}
            reduce={reduce}
          />
        ))}
      </div>
    </section>
  );
}
