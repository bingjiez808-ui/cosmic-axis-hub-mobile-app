import { Link, useNavigate } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLang } from "@/lib/i18n";
import { listUserCharts } from "@/lib/reports-store.functions";
import { useMembershipTier, type MemTier } from "@/lib/use-membership-tier";
import { useSupabaseSession } from "@/lib/session";
import { cn } from "@/lib/utils";

/**
 * HomeBentoMap — "馆内导览" bento shown right after the hero. Pure
 * navigational surface: seven cards that each point to an existing
 * feature route (or open a preview dialog when the target requires a
 * primary chart the visitor doesn't have yet). No AI calls, no new
 * pricing surface, no chart calculation.
 */

type AccessTag = "free" | "sage" | "oracle" | "open" | "onetime";

type PreviewKey = "synthesis" | "timeline" | "tarot" | null;

function TagPill({ tag }: { tag: AccessTag }) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const map: Record<AccessTag, { zh: string; en: string; cls: string }> = {
    free: { zh: "免费", en: "Free", cls: "border-emerald-300/30 text-emerald-200/85 bg-emerald-400/5" },
    sage: { zh: "贤者", en: "Sage", cls: "border-amber-300/40 text-amber-200 bg-amber-400/5" },
    oracle: { zh: "神谕者", en: "Oracle", cls: "border-fuchsia-300/40 text-fuchsia-200 bg-fuchsia-400/5" },
    open: { zh: "已开放", en: "Open", cls: "border-white/15 text-stone-warm/75 bg-white/5" },
    onetime: { zh: "一次购买", en: "One-time", cls: "border-amber-300/40 text-amber-200 bg-amber-400/10" },
  };
  const it = map[tag];
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.22em]", it.cls)}>
      {isZh ? it.zh : it.en}
    </span>
  );
}

/** Reusable card shell with a mouse-tracking spotlight. */
function BentoCard({
  className,
  children,
  onClick,
  as = "button",
  href,
  ariaLabel,
  testId,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
  as?: "button" | "link";
  href?: string;
  ariaLabel: string;
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const handle = (e: PointerEvent) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
        raf = 0;
      });
    };
    el.addEventListener("pointermove", handle);
    return () => {
      el.removeEventListener("pointermove", handle);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const inner = (
    <div
      ref={ref}
      className={cn(
        "group relative h-full min-h-[148px] overflow-hidden rounded-2xl border border-amber-300/20 bg-[rgba(14,13,16,0.78)]",
        "p-5 text-left transition-all duration-300 hover:-translate-y-[3px] hover:border-amber-300/45 md:p-6",
        "focus-within:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60 focus-visible:ring-offset-0",
        className,
      )}
      style={{ "--mx": "50%", "--my": "50%" } as React.CSSProperties}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(320px circle at var(--mx) var(--my), rgba(240,213,143,0.14), transparent 55%)",
        }}
      />
      {children}
    </div>
  );

  if (as === "link" && href) {
    // Full-card link that still allows internal focus targets
    return (
      <Link
        to={href}
        data-testid={testId}
        aria-label={ariaLabel}
        className="block h-full focus:outline-none focus-visible:outline-none"
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-label={ariaLabel}
      className="block h-full w-full text-left focus:outline-none focus-visible:outline-none"
    >
      {inner}
    </button>
  );
}

function CardMeta({ eyebrow, tags, title, body, footer }: {
  eyebrow: string;
  tags?: AccessTag[];
  title: string;
  body: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-light uppercase tracking-[0.32em] text-gold-dust/80">{eyebrow}</p>
        {tags && tags.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {tags.map((t) => <TagPill key={t} tag={t} />)}
          </div>
        )}
      </div>
      <h3 className="mt-3 font-serif text-xl leading-snug text-stone-warm md:text-[22px]">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-stone-warm/70">{body}</p>
      {footer && <div className="mt-auto pt-4">{footer}</div>}
    </div>
  );
}

// ---------------- Preview dialog / drawer ----------------

function PreviewShell({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="border-amber-300/20 bg-[#0d0c10] text-stone-warm">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-serif text-xl text-stone-warm">{title}</DrawerTitle>
            <DrawerDescription className="text-stone-warm/60">{description}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-amber-300/20 bg-[#0d0c10] text-stone-warm">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-stone-warm">{title}</DialogTitle>
          <DialogDescription className="text-stone-warm/60">{description}</DialogDescription>
        </DialogHeader>
        <div>{children}</div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Main ----------------

export function HomeBentoMap() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const { session } = useSupabaseSession();
  const isSignedIn = !!session;
  const tierState = useMembershipTier();
  const tier: MemTier = tierState.kind === "ready" ? tierState.tier : "none";
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const [chartsLoading, setChartsLoading] = useState(false);
  const [primaryChart, setPrimaryChart] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      setPrimaryChart(null);
      return;
    }
    let cancelled = false;
    setChartsLoading(true);
    (async () => {
      try {
        const rows = await listUserCharts();
        if (cancelled) return;
        // Try to identify a primary chart. Fallback: user's own first row.
        const list = (rows ?? []) as Array<{ id: string; display_name?: string | null; is_primary?: boolean | null; role?: string | null }>;
        const primary = list.find((r) => r.is_primary) ?? list.find((r) => r.role === "self") ?? list[0];
        if (primary) setPrimaryChart({ id: primary.id, name: primary.display_name || (isZh ? "我的主命盘" : "My primary chart") });
        else setPrimaryChart(null);
      } catch {
        // Fail-closed: treat as no primary chart. Bento is a nav, not blocking.
        if (!cancelled) setPrimaryChart(null);
      } finally {
        if (!cancelled) setChartsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSignedIn, isZh]);

  const hasPrimary = !!primaryChart;

  const [preview, setPreview] = useState<PreviewKey>(null);
  const [needChartPreview, setNeedChartPreview] = useState<null | { title: string; body: string; target: string }>(null);

  // Handlers per card ------------------------------------------------------

  const goToConcern = () => {
    const el = document.getElementById("concern");
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "start" });
    el.classList.add("bento-target-flash");
    window.setTimeout(() => el.classList.remove("bento-target-flash"), 1200);
  };

  const handleRitualOrReading = () => {
    if (!isSignedIn) return navigate({ to: "/auth", search: { redirect: "/ritual" } as never });
    if (hasPrimary) return navigate({ to: "/report" });
    return navigate({ to: "/ritual" });
  };

  const handleSynthesis = () => {
    if (!isSignedIn || !hasPrimary) {
      setNeedChartPreview({
        title: isZh ? "先建立你的主命盘" : "Set up your primary chart first",
        body: isZh
          ? "综合解读会从你的真实命盘展开。请先完成一次开启仪式，我们会保留你此刻想读的问题。"
          : "The synthesis reading opens from your real chart. Please complete the ritual first — we'll keep the question you wanted to explore.",
        target: "/ritual",
      });
      return;
    }
    navigate({ to: "/report" });
  };

  const handleTimeline = () => setPreview("timeline");
  const handleTarot = () => setPreview("tarot");
  const handleCommons = () => navigate({ to: "/life-studies" });

  // ---------- Card contents ----------

  const cardA = (
    <BentoCard
      testId="bento-card-a"
      onClick={goToConcern}
      ariaLabel={isZh ? "选择我的问题" : "Choose my question"}
      className="md:col-span-7"
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-amber-300/15" />
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-amber-300/10 animate-slow-rotate" />
      <CardMeta
        eyebrow={isZh ? "推荐入口" : "Recommended entry"}
        tags={["free"]}
        title={isZh ? "今天，你最想看清什么？" : "What do you most want to see clearly today?"}
        body={
          isZh
            ? "学业、事业、爱情、关系、财富或人生阶段——先选一个最靠近此刻的问题。"
            : "Study, career, love, relationships, wealth or life stage — pick the one closest to now."
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-stone-warm/55">
              {isZh ? "选择后，图书馆会推荐优先阅读的那本书。" : "Once chosen, the library recommends which book to open first."}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 px-4 py-1.5 text-[11px] uppercase tracking-[0.28em] text-gold-dust group-hover:bg-amber-300/10">
              {isZh ? "选择我的问题" : "Choose my question"} <span aria-hidden>↓</span>
            </span>
          </div>
        }
      />
    </BentoCard>
  );

  const bBtnLabel = hasPrimary
    ? isZh ? "回到我的解读" : "Back to my reading"
    : isZh ? "开启仪式" : "Open the ritual";

  const bStatus = !isSignedIn
    ? (isZh ? "登录后开始" : "Sign in to begin")
    : chartsLoading
      ? ""
      : hasPrimary
        ? (isZh ? `主命盘：${primaryChart!.name}` : `Primary chart: ${primaryChart!.name}`)
        : (isZh ? "尚未建立主命盘" : "No primary chart yet");

  const cardB = (
    <BentoCard
      testId="bento-card-b"
      onClick={handleRitualOrReading}
      ariaLabel={bBtnLabel}
      className={cn("md:col-span-5", hasPrimary && "border-amber-300/45")}
    >
      <div className="pointer-events-none absolute inset-x-6 bottom-4 h-24 rounded-md border border-amber-300/20 bg-gradient-to-t from-amber-300/10 to-transparent" />
      <CardMeta
        eyebrow={isZh ? "第一份借阅证" : "Your first library card"}
        tags={["free"]}
        title={isZh ? "建立一本以你为名的书" : "Open a book that bears your name"}
        body={
          isZh
            ? "登记完整出生资料，由四大体系共同生成你的主命盘与阅读入口。"
            : "Register your birth details; the four traditions will together form your primary chart and reading entry."
        }
        footer={
          <div className="flex items-center justify-between gap-3">
            {chartsLoading ? (
              <Skeleton className="h-3 w-32 bg-white/5" />
            ) : (
              <span className="text-[11px] text-stone-warm/55">{bStatus}</span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 px-4 py-1.5 text-[11px] uppercase tracking-[0.28em] text-gold-dust group-hover:bg-amber-300/10">
              {bBtnLabel} <span aria-hidden>→</span>
            </span>
          </div>
        }
      />
    </BentoCard>
  );

  const cardC = (
    <BentoCard
      testId="bento-card-c"
      onClick={handleSynthesis}
      ariaLabel={isZh ? "综合解读" : "Synthesis reading"}
      className="md:col-span-4"
    >
      <CardMeta
        eyebrow={isZh ? "免费馆藏" : "Free collection"}
        tags={["free"]}
        title={isZh ? "一次读懂命盘全景" : "Read the full chart in one sitting"}
        body={
          isZh
            ? "从性格、学业、事业、财富、关系、家庭、健康与人生阶段展开阅读。"
            : "Character, study, career, wealth, relationships, family, health and life stage — read together."
        }
        footer={
          <span className="text-[11px] text-stone-warm/55">
            {isZh ? "完成仪式后优先打开你最关心的章节。" : "After the ritual, opens on the chapter closest to your concern."}
          </span>
        }
      />
    </BentoCard>
  );

  const cardD = (
    <BentoCard
      testId="bento-card-d"
      onClick={handleTimeline}
      ariaLabel={isZh ? "时间与验证" : "Time & verification"}
      className="md:col-span-4"
    >
      <CardMeta
        eyebrow={isZh ? "特色馆藏" : "Signature collection"}
        tags={["sage"]}
        title={isZh ? "生命时间轴与关键节点" : "Life timeline & key nodes"}
        body={
          isZh
            ? "将大运、流年与阶段变化画成可阅读的时间线，并用过去经历反向验证。"
            : "Major luck, annual pillars and life stages drawn as a readable timeline — verified against your past."
        }
        footer={
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-stone-warm/70">
              {isZh ? "生命时间轴·大运" : "Timeline · Major luck"}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-stone-warm/70">
              {isZh ? "关键节点·反向验证" : "Key nodes · Verification"}
            </span>
          </div>
        }
      />
    </BentoCard>
  );

  const cardE = (
    <BentoCard
      testId="bento-card-e"
      onClick={handleTarot}
      ariaLabel={isZh ? "塔罗·第二位证人" : "Tarot · A second witness"}
      className="md:col-span-4"
    >
      <CardMeta
        eyebrow={isZh ? "第二视角" : "Second perspective"}
        tags={["sage"]}
        title={isZh ? "让另一个系统回应此刻" : "Let another system reply to this moment"}
        body={
          isZh
            ? "当命盘给出长期结构时，塔罗为当前问题补充一份独立的短期观察。"
            : "Where the chart shows long-term structure, tarot adds an independent short-term reading."
        }
        footer={
          <span className="text-[11px] text-stone-warm/55">
            {isZh ? "它不是重复命盘结论，而是第二位证人。" : "Not repeating the chart's verdict — a second witness."}
          </span>
        }
      />
    </BentoCard>
  );

  const cardF = (
    <BentoCard
      testId="bento-card-f"
      as="link"
      href="/life-studies"
      onClick={handleCommons}
      ariaLabel={isZh ? "进入命运通识馆" : "Enter the General Knowledge Hall"}
      className="md:col-span-7"
    >
      <CardMeta
        eyebrow={isZh ? "本馆独有" : "Only in this library"}
        tags={["free"]}
        title={isZh ? "换一种学科，重新理解人生" : "Read your life through another discipline"}
        body={
          isZh
            ? "数学馆把人生画成会变化的函数；语文馆为当下的人生阶段翻开一句终于读懂的话。"
            : "The Math Hall draws life as a changing function; the Literature Hall opens a sentence you can finally read now."
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[10px] text-amber-200">
              {isZh ? "数学馆 · 已开放" : "Math Hall · Open"}
            </span>
            <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-[10px] text-amber-200">
              {isZh ? "语文馆 · 已开放" : "Literature Hall · Open"}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-stone-warm/50">
              {isZh ? "其他四馆 · 整理中" : "Four more halls · Coming"}
            </span>
          </div>
        }
      />
    </BentoCard>
  );

  const cardG = (
    <BentoCard
      testId="bento-card-g"
      as="link"
      href="/me/membership"
      ariaLabel={isZh ? "会员阅览室" : "Membership reading rooms"}
      className="md:col-span-5"
    >
      <CardMeta
        eyebrow={isZh ? "会员阅览室" : "Membership rooms"}
        tags={tier === "oracle" ? ["oracle"] : tier === "sage" ? ["sage"] : ["sage", "oracle"]}
        title={isZh ? "当你想读得更深" : "When you want to read deeper"}
        body={
          isZh
            ? "贤者适合时间轴、关系合盘与深度阅读；神谕者在此基础上增加持续追问与近 90 天关键节点。"
            : "Sage is for the timeline, relationship charts and deep reading; Oracle adds ongoing questions and the next-90-day key nodes."
        }
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/me/sage"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg border border-amber-300/25 bg-black/30 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-amber-200 hover:border-amber-300/60"
            >
              {isZh ? "贤者阅览室" : "Sage room"}
            </Link>
            <Link
              to="/me/oracle"
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg border border-fuchsia-300/25 bg-black/30 px-3 py-2 text-[11px] uppercase tracking-[0.22em] text-fuchsia-200 hover:border-fuchsia-300/60"
            >
              {isZh ? "神谕者阅览室" : "Oracle room"}
            </Link>
          </div>
        }
      />
    </BentoCard>
  );

  // Stagger config with reduced-motion escape
  const cards = useMemo(() => [cardA, cardB, cardC, cardD, cardE, cardF, cardG], [
    cardA, cardB, cardC, cardD, cardE, cardF, cardG,
  ]);

  return (
    <section
      id="library-bento"
      aria-label={isZh ? "馆内导览" : "Library guide"}
      className="relative z-10 mx-auto w-full max-w-[1180px] px-5 py-16 sm:px-6 md:py-24"
    >
      <style>{`
        .bento-target-flash { animation: bento-flash 1.2s ease-out; }
        @keyframes bento-flash {
          0%   { box-shadow: 0 0 0 0 rgba(240,213,143,0.0); }
          20%  { box-shadow: 0 0 0 8px rgba(240,213,143,0.18); }
          100% { box-shadow: 0 0 0 0 rgba(240,213,143,0.0); }
        }
      `}</style>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mb-10 text-center md:mb-12"
      >
        <p className="text-[10px] font-light uppercase tracking-[0.42em] text-gold-dust/80">
          {isZh ? "初次到访 · 馆内导览" : "First visit · Library guide"}
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-warm md:text-4xl">
          {isZh ? "你想先翻开哪一页？" : "Which page would you like to open first?"}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-stone-warm/65 md:text-base">
          {isZh
            ? "不必一次读完所有内容。选择此刻最想看清的事，图书馆会告诉你应该从哪里开始。"
            : "You do not need to read everything at once. Begin with what you most want to understand, and the library will show you where to go."}
        </p>
        <p className="mx-auto mt-2 text-[11px] text-stone-warm/45">
          {isZh
            ? "每扇门都通向现有功能，不会改变你的命盘数据。"
            : "Each door leads to an existing feature and does not alter your chart data."}
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-12 md:gap-5">
        {cards.map((c, i) => (
          <motion.div
            key={i}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: prefersReducedMotion ? 0 : i * 0.075 }}
            className={cn(
              "flex",
              // Tablet: A + F span 2 cols.
              i === 0 || i === 5 ? "sm:col-span-2" : "",
            )}
          >
            {c}
          </motion.div>
        ))}
      </div>

      {/* ---------------- Preview dialogs / drawers ---------------- */}
      <PreviewShell
        open={preview === "timeline"}
        onOpenChange={(v) => !v && setPreview(null)}
        title={isZh ? "生命时间轴与关键节点" : "Life timeline & key nodes"}
        description={
          isZh
            ? "两个功能共同回答“过去是否被解释、未来是否有节点”。"
            : "Two features together answer: was the past explained, will the future have key nodes?"
        }
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-300/20 bg-black/30 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-gold-dust/80">
              {isZh ? "生命时间轴·大运" : "Timeline · Major luck"}
            </p>
            <p className="mt-2 text-sm text-stone-warm/75">
              {isZh
                ? "把八字大运、紫微大限与流年阶段画成一条可阅读的时间线。"
                : "BaZi major luck, ZiWei limits and annual pillars drawn as one readable timeline."}
            </p>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-black/30 p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-gold-dust/80">
              {isZh ? "关键节点·反向验证" : "Key nodes · Reverse verification"}
            </p>
            <p className="mt-2 text-sm text-stone-warm/75">
              {isZh
                ? "用你已发生的经历回头对照命盘节点，让图书馆变得可校准。"
                : "Compare what actually happened against the chart's key nodes — so the library stays calibratable."}
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-1 sm:flex-row">
            {isSignedIn && hasPrimary ? (
              <Button asChild className="bg-amber-400/90 text-black hover:bg-amber-300">
                <Link to="/me/echoes" onClick={() => setPreview(null)}>
                  {isZh ? "查看我的时间轴" : "Open my timeline"}
                </Link>
              </Button>
            ) : (
              <Button asChild className="bg-amber-400/90 text-black hover:bg-amber-300">
                <Link to="/ritual" onClick={() => setPreview(null)}>
                  {isZh ? "先完成仪式" : "Complete the ritual first"}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </PreviewShell>

      <PreviewShell
        open={preview === "tarot"}
        onOpenChange={(v) => !v && setPreview(null)}
        title={isZh ? "塔罗·第二位证人" : "Tarot · A second witness"}
        description={
          isZh
            ? "塔罗作为第二视角，属于贤者阅览室的深度阅读能力，未来会开放更细的入口。"
            : "Tarot is a second-perspective feature inside the Sage reading room; finer entries will open later."
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-stone-warm/75">
            {isZh
              ? "当前塔罗以“第二位证人”身份出现在贤者的关系合盘与深度阅读中，未在首页单独售卖，也不会重复命盘结论。"
              : "For now, tarot appears as a 'second witness' inside the Sage room's relationship and deep readings — not sold separately here, never repeating the chart's own verdict."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="secondary" className="bg-white/5 text-stone-warm hover:bg-white/10">
              <Link to="/me/sage" onClick={() => setPreview(null)}>
                {isZh ? "进入贤者阅览室" : "Open Sage room"}
              </Link>
            </Button>
            <Button asChild variant="ghost" className="text-stone-warm/70 hover:text-gold-dust">
              <Link to="/me/membership" onClick={() => setPreview(null)}>
                {isZh ? "查看会员权益" : "See membership benefits"}
              </Link>
            </Button>
          </div>
        </div>
      </PreviewShell>

      <PreviewShell
        open={!!needChartPreview}
        onOpenChange={(v) => !v && setNeedChartPreview(null)}
        title={needChartPreview?.title ?? ""}
        description={needChartPreview?.body ?? ""}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild className="bg-amber-400/90 text-black hover:bg-amber-300">
            <Link
              to={needChartPreview?.target ?? "/ritual"}
              onClick={() => setNeedChartPreview(null)}
            >
              {isZh ? "开启仪式" : "Open the ritual"}
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="text-stone-warm/70 hover:text-gold-dust"
            onClick={() => setNeedChartPreview(null)}
          >
            {isZh ? "稍后再说" : "Not now"}
          </Button>
        </div>
      </PreviewShell>
    </section>
  );
}

export default HomeBentoMap;
