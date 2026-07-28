/**
 * PlayfulLibrarySection — "趣味图书馆 · 换一种学科，重新读懂人生"
 *
 * Layout: an "exploration corridor". A gently S-curved dashed spine runs
 * down the section; hall cards alternate left/right along it. Nodes on
 * the spine light up per hall status; short connectors reach each card.
 *
 * We do not open any payment modal here. CTA routing is delegated to
 * `resolveCta` (see `src/lib/home-cta.ts`); paid pages own their own
 * upgrade surface via RoomLockedShell + MembershipCheckoutModal.
 */

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

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
// Mini visualisations (unchanged)
// ─────────────────────────────────────────────────────────────

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
// Hall card (rendered inside a corridor slot)
// ─────────────────────────────────────────────────────────────

type HallCardProps = {
  book: BookDef;
  side: "left" | "right"; // desktop side; mobile is always right
  open: boolean;
  hovered: boolean;
  onToggle: () => void;
  onComingClick: () => void;
  onHoverChange: (h: boolean) => void;
  isSignedIn: boolean;
  hasPrimaryChart: boolean;
  tier: "none" | "sage" | "oracle";
  isZh: boolean;
  reduce: boolean;
  index: number;
};

function HallCard({
  book,
  side,
  open,
  hovered,
  onToggle,
  onComingClick,
  onHoverChange,
  isSignedIn,
  hasPrimaryChart,
  tier,
  isZh,
  reduce,
  index,
}: HallCardProps) {
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

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isComing) onComingClick();
      else onToggle();
    }
  };

  // Accent strip lives on the side facing the corridor (mobile: always left;
  // desktop-left cards: right edge; desktop-right cards: left edge).
  const stripSide = side === "left" ? "md:right-0 md:left-auto left-0" : "left-0";

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: side === "left" ? -18 : 18 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1], delay: index * 0.04 }}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      className={`relative overflow-hidden rounded-2xl border transition ${
        isComing
          ? "border-white/5 bg-obsidian/40"
          : hovered
            ? "border-gold-dust/40 bg-obsidian/70 shadow-[0_18px_44px_-24px_rgba(212,162,74,0.35)]"
            : "border-white/10 bg-obsidian/60 hover:border-gold-dust/30"
      } ${isComing ? "opacity-70" : ""}`}
      style={reduce ? undefined : { transform: hovered ? "translateY(-3px)" : undefined, transition: "transform .3s ease" }}
    >
      {/* Corridor-side vertical color strip */}
      <span
        aria-hidden
        className={`absolute top-0 h-full w-[3px] bg-gradient-to-b ${book.accent} ${stripSide}`}
      />
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isComing ? undefined : open}
        aria-controls={isComing ? undefined : `book-panel-${book.id}`}
        onClick={() => (isComing ? onComingClick() : onToggle())}
        onKeyDown={handleKey}
        className="flex w-full cursor-pointer items-start gap-4 px-5 py-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-gold-dust/60"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/60">
              {book.code}
            </span>
            <AccessChip tag={book.status} isZh={isZh} />
          </div>
          <p className="mt-2 font-serif text-base leading-snug text-stone-warm sm:text-lg">
            {title}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-warm/55">{tagline}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.28em]">
            {isComing ? (
              <span className="text-stone-warm/45">
                {isZh ? "馆藏整理中" : "Collection in progress"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gold-dust/80">
                {isZh ? "进入此馆" : "Enter this hall"}
                <span aria-hidden>→</span>
              </span>
            )}
            {!isComing && (
              <span
                aria-hidden
                className={`text-gold-dust/50 transition-transform ${open ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            )}
          </div>
        </div>
      </div>

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
            <div className="grid gap-5 px-5 py-5">
              <div className="text-sm leading-relaxed text-stone-warm/70">
                {book.id === "math" && (
                  <>
                    <p>
                      {isZh
                        ? "人生不是一条注定的直线。事业、学业、关系、家庭、财富和健康会在不同年龄改变权重；选择、机会与偶然事件，则让同一张命盘走出不同的曲线。"
                        : "Life is not a fixed straight line. Study, career, love, wealth, family and health each carry different weight at different ages — and choice, opportunity and chance bend the same chart down different curves."}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-xs text-stone-warm/55">
                      <li>{isZh ? "· 悬停曲线查看某个年龄哪些维度贡献大、哪些正在消耗" : "· Hover the curve to see which dimensions contribute or drain at each age"}</li>
                      <li>{isZh ? "· 点击「人生分支」看同一张命盘在不同选择下的走势" : "· Try the branches to see how the same chart bends under different choices"}</li>
                      <li>{isZh ? "· 大数定律、幸存者偏差、辛普森悖论、墨菲定律、回归均值 — 五张人生卡片" : "· Five cards: law of large numbers, survivorship bias, Simpson's paradox, Murphy, regression to the mean"}</li>
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
                      <li>{isZh ? "· 根据年龄阶段、当前关注领域和命盘长期结构推荐一句" : "· A line chosen for your life stage, current focus and long-term chart pattern"}</li>
                      <li>{isZh ? "· 解释它原本在说什么、为什么此刻可能与你共鸣" : "· What it originally meant, and why it may resonate now"}</li>
                      <li>{isZh ? "· 一条可以带回现实生活的反思问题" : "· One reflection question to carry into the day"}</li>
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-4">
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
    </motion.div>
  );
}

function ctaLabel(state: string, book: BookDef, isZh: boolean): string {
  if (state === "signed_out") return isZh ? "登录以继续" : "Sign in to continue";
  if (state === "no_primary")
    return isZh
      ? book.id === "math"
        ? "完成仪式 · 生成我的人生函数"
        : "完成仪式 · 领取此刻的句子"
      : "Complete the ritual";
  return isZh
    ? `进入${book.id === "math" ? "数学馆" : "语文馆"}`
    : book.id === "math"
      ? "Open the Math Hall"
      : "Open the Letters Hall";
}

// ─────────────────────────────────────────────────────────────
// Corridor row — three-column desktop, two-column mobile.
// ─────────────────────────────────────────────────────────────

type CorridorRowProps = HallCardProps & { total: number };

function CorridorRow(props: CorridorRowProps) {
  const { book, side, hovered, index, total, isZh, reduce } = props;
  const isComing = book.status === "coming";
  const isLast = index === total - 1;

  const nodeClasses = [
    "relative z-10 grid h-6 w-6 place-items-center rounded-full border-2 transition",
    isComing
      ? "border-gold-dust/25 bg-obsidian"
      : hovered
        ? "border-gold-light bg-gold-dust/30 shadow-[0_0_18px_2px_rgba(224,182,90,0.55)]"
        : "border-gold-dust/70 bg-obsidian",
    !isComing && !reduce ? "animate-pulse-gold" : "",
  ].join(" ");

  const connectorBase =
    "pointer-events-none absolute top-1/2 hidden h-px -translate-y-1/2 md:block transition-opacity";
  const connectorTone = hovered && !isComing ? "opacity-90" : "opacity-40";

  return (
    <div
      className="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] md:gap-6"
      style={{ gridTemplateColumns: undefined }}
    >
      {/* Mobile: left node gutter */}
      <div className="relative flex md:hidden">
        <div className="relative flex w-11 shrink-0 items-center justify-center">
          <div className={nodeClasses} aria-hidden>
            <span className="text-[9px] font-medium tracking-widest text-gold-dust/80">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <HallCard {...props} />
        </div>
      </div>

      {/* Desktop: three-column layout */}
      <div className={`hidden md:block ${side === "left" ? "" : "md:invisible"}`}>
        {side === "left" ? <HallCard {...props} /> : null}
      </div>
      <div className="relative hidden md:flex md:h-full md:items-center md:justify-center">
        {/* Node */}
        <div className={nodeClasses} aria-hidden>
          <span className="text-[9px] font-medium tracking-widest text-gold-dust/80">
            {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        {/* Connector to left card */}
        {side === "left" && (
          <span
            aria-hidden
            className={`${connectorBase} right-1/2 mr-3 w-10 bg-gradient-to-l from-gold-dust/70 to-transparent ${connectorTone}`}
          />
        )}
        {/* Connector to right card */}
        {side === "right" && (
          <span
            aria-hidden
            className={`${connectorBase} left-1/2 ml-3 w-10 bg-gradient-to-r from-gold-dust/70 to-transparent ${connectorTone}`}
          />
        )}
        {/* Vertical dashed spine segment through this row */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-dashed border-gold-dust/25"
          style={isLast ? { bottom: "50%" } : undefined}
        />
      </div>
      <div className={`hidden md:block ${side === "right" ? "" : "md:invisible"}`}>
        {side === "right" ? <HallCard {...props} /> : null}
      </div>
    </div>
  );
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

  const [openId, setOpenId] = useState<BookId | null>(null);
  const [hoverId, setHoverId] = useState<BookId | null>(null);
  const reduce = !!useReducedMotion();

  const notifyComing = () => {
    toast(
      isZh
        ? "此馆仍在整理馆藏，开放后会在导览室亮灯。"
        : "This hall is still arranging its collection. Its light will appear in the Guide Hall when ready.",
    );
  };

  return (
    <section
      id="playful-library"
      data-testid="playful-library"
      className="relative z-10 mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-16"
    >
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust/80">
          {isZh ? "跨学科馆藏" : "Cross-discipline exhibits"}
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-warm md:text-4xl">
          {isZh ? "趣味图书馆" : "The Curious Library"}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-stone-warm/60">
          {isZh
            ? "沿着馆内长廊，选择一种新的语言重新阅读自己。"
            : "Follow the library corridor and choose a new language for reading your life."}
        </p>
        <p className="mx-auto mt-3 max-w-xl text-[11px] leading-relaxed text-stone-warm/40">
          {isZh
            ? "先完成一次出生信息仪式，趣味图书馆才知道该把哪一本书递给你。"
            : "Complete the birth-information ritual first, so the library knows which book to hand you."}
        </p>
      </header>

      {/* Corridor start marker */}
      <div className="mt-14 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.42em] text-gold-dust/60">
        <span aria-hidden className="h-px w-10 bg-gold-dust/40" />
        <span>{isZh ? "探索从这里开始" : "Your exploration begins here"}</span>
        <span aria-hidden className="h-px w-10 bg-gold-dust/40" />
      </div>

      {/* Corridor rows */}
      <div className="relative mt-10 space-y-14 md:space-y-16">
        {BOOKS.map((book, i) => (
          <CorridorRow
            key={book.id}
            book={book}
            side={i % 2 === 0 ? "left" : "right"}
            index={i}
            total={BOOKS.length}
            open={openId === book.id}
            hovered={hoverId === book.id}
            onToggle={() => setOpenId((id) => (id === book.id ? null : book.id))}
            onComingClick={notifyComing}
            onHoverChange={(h) => setHoverId(h ? book.id : null)}
            isSignedIn={isSignedIn}
            hasPrimaryChart={hasPrimaryChart}
            tier={tier}
            isZh={isZh}
            reduce={reduce}
          />
        ))}
      </div>

      {/* Corridor end marker */}
      <div className="mt-14 flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.42em] text-stone-warm/40">
        <span aria-hidden className="h-px w-10 bg-stone-warm/20" />
        <span>{isZh ? "更多馆室，仍在整理馆藏。" : "More halls are still arranging their collections."}</span>
        <span aria-hidden className="h-px w-10 bg-stone-warm/20" />
      </div>
    </section>
  );
}
