/**
 * HomeScrollStack — the seven-card guide-desk experience shown after
 * the entrance overlay dismisses.
 *
 * Layout:
 *   LibraryInteriorBackdrop (fixed video)
 *   ├── GuideDeskHero              (welcome + brand copy)
 *   ├── plain vertical card sections (no stacking effect)
 *   └── StackProgress               (right rail desktop / bottom pill mobile)
 *
 * Each card is a bookmark. Clicking a card opens LibraryFeatureDrawer
 * with the corresponding existing feature module (ConcernSelector,
 * FeatureLibraryShelf, PlayfulLibrarySection, PostRitualRoomsSection,
 * HomePersonalDeskTeaser). Cards 02 (ritual) and 03 (report) navigate
 * to routes because their downstream flow owns its own state machine.
 * The drawer state is mirrored to the URL as ?feature=<id> so the back
 * button closes the drawer.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";

import { useLang } from "@/lib/i18n";
import { resolveCta, ctaMicroCopy, accessTagLabel, type AccessTag } from "@/lib/home-cta";
import { HOME_GUIDE_CARDS, type HomeGuideCard, type HomeCardId } from "@/lib/home-guide-cards";
import { useHomeFacts } from "@/lib/use-home-facts";


import LineSidebar from "@/components/react-bits/LineSidebar/LineSidebar";
import { LibraryInteriorBackdrop } from "./LibraryInteriorBackdrop";
import { HomeCardVisual } from "./HomeCardVisual";
import { LibraryFeatureDrawer } from "./LibraryFeatureDrawer";
import { ResponsiveHeroTitle } from "@/components/ResponsiveHeroTitle";
import { MotionModeToggle } from "./MotionModeToggle";
import "./home-corridor.css";

import { ConcernSelector } from "@/components/ConcernSelector";
import { FeatureLibraryShelf } from "@/components/FeatureLibraryShelf";
import { PlayfulLibrarySection } from "@/components/PlayfulLibrarySection";
import { PostRitualRoomsSection } from "@/components/PostRitualRoomsSection";
import { HomePersonalDeskTeaser } from "@/components/HomePersonalDeskTeaser";
import { HallHomeIntro } from "@/components/HallHomeIntro";
import { ReaderPassCard } from "@/components/reader-pass/ReaderPassCard";

const DRAWER_IDS = new Set<HomeCardId>(["concern", "commons", "rooms", "hall", "desk"]);

function readHashFeature(): HomeCardId | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  const match = hash.match(/^feature=([\w-]+)$/);
  if (!match) return null;
  const id = match[1] as HomeCardId;
  return DRAWER_IDS.has(id) ? id : null;
}

export function HomeScrollStack() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const facts = useHomeFacts();

  const [openId, setOpenId] = useState<HomeCardId | null>(null);

  // Hydrate + follow browser back / forward.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpenId(readHashFeature());
    const onHash = () => setOpenId(readHashFeature());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const openCard = useCallback((id: HomeCardId | null) => {
    if (typeof window !== "undefined") {
      const nextHash = id ? `#feature=${id}` : "";
      const url = `${window.location.pathname}${window.location.search}${nextHash}`;
      window.history.replaceState(null, "", url);
    }
    setOpenId(id);
  }, []);

  const [activeIndex, setActiveIndex] = useState(0);

  // Track which card is closest to viewport top for StackProgress.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cards = HOME_GUIDE_CARDS.map((c) => document.getElementById(c.id)).filter(
      Boolean
    ) as HTMLElement[];
    if (!cards.length) return;
    let rafId: number | null = null;
    let lastIdx = -1;
    const compute = () => {
      rafId = null;
      let bestIdx = 0;
      let bestDist = Infinity;
      const anchor = window.innerHeight * 0.3;
      for (let i = 0; i < cards.length; i++) {
        const rect = cards[i].getBoundingClientRect();
        const dist = Math.abs(rect.top - anchor);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      if (bestIdx !== lastIdx) {
        lastIdx = bestIdx;
        setActiveIndex(bestIdx);
      }
    };
    const onScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  const activeCard = openId ? HOME_GUIDE_CARDS.find((c) => c.id === openId) ?? null : null;

  return (
    <div className="relative">
      <LibraryInteriorBackdrop />

      <GuideDeskHero isZh={isZh} />

      {/* Plain vertical section list — no stacking / pinning effects. */}
      {/* Guide corridor — plain vertical flow, no stacking / pinning. */}
      <div className="corridor pb-24 pt-6">
        {HOME_GUIDE_CARDS.map((card, i) => (
          <div id={card.id} key={card.id} className="scroll-mt-24">
            <HomeCard
              card={card}
              isZh={isZh}
              facts={facts}
              flip={i % 2 === 1}
              onOpenDrawer={() => openCard(card.id)}
            />
          </div>
        ))}
      </div>



      <HomeSideRail
        cards={HOME_GUIDE_CARDS}
        activeIndex={activeIndex}
        isZh={isZh}
      />

      <MotionModeToggle />

      <FeatureDrawerHost
        card={activeCard}
        isZh={isZh}
        facts={facts}
        onClose={() => openCard(null)}
      />
    </div>
  );
}

function GuideDeskHero({ isZh }: { isZh: boolean }) {
  const eyebrow = isZh ? "命运图书馆 · 导览室" : "Destiny Library · Guide Desk";
  const headingLines = isZh
    ? ["每一个文明，", "都在追问同一个问题", { text: "「我是谁？」", accent: true }]
    : ["Every civilization", "returns to the same question", { text: "\u201cWho am I?\u201d", accent: true }];
  const bodyLines = isZh
    ? ["命盘不会替你定义答案，", "只陪你读懂正在成为谁。"]
    : ["The chart does not define your answer.", "It helps you understand who you are becoming."];
  const scrollHint = isZh ? "向下走进书架" : "Scroll into the shelves";

  return (
    // HeroSection: the pass overlay is an absolute sibling of HeroContent, so
    // it never enters the content's width calculation. HeroContent stays
    // centred on the viewport (margin-inline: auto, no asymmetric padding).
    <header className="hero-shell relative flex min-h-[62vh] w-full flex-col items-center justify-center px-6 pb-14 pt-24 text-center sm:min-h-[70vh]">
      <ReaderPassCard />
      {/* Vignette scrim behind copy so text never dissolves into the library backdrop. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 h-[70%] -translate-y-1/2"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(8,10,18,0.72) 0%, rgba(8,10,18,0.45) 45%, rgba(8,10,18,0) 75%)",
        }}
      />
      <div
        className="relative z-[15] flex flex-col items-center"
        style={{ width: "min(1120px, calc(100vw - 48px))", marginInline: "auto" }}
      >
        <p className="text-[10px] uppercase tracking-[0.5em] text-gold-dust/80 sm:text-xs [text-shadow:0_1px_12px_rgba(0,0,0,0.85)]">
          {eyebrow}
        </p>
        <ResponsiveHeroTitle
          lang={isZh ? "zh" : "en"}
          lines={headingLines}
          className="hero-gap-title font-serif text-stone-warm [text-shadow:0_2px_24px_rgba(0,0,0,0.9),0_0_2px_rgba(0,0,0,0.6)]"
        />

        <p className="hero-sub hero-gap-sub leading-relaxed text-stone-warm/90 [text-shadow:0_1px_14px_rgba(0,0,0,0.85)]">
          {bodyLines.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
        <div className="hero-gap-cta flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-gold-dust/60 [text-shadow:0_1px_10px_rgba(0,0,0,0.8)]">
          <span aria-hidden>↓</span>
          <span>{scrollHint}</span>
        </div>
      </div>
    </header>

  );
}


const ACCESS_STYLE: Record<AccessTag, string> = {
  open: "border-emerald-300/40 text-emerald-200/90 bg-emerald-500/10",
  basic: "border-sky-300/40 text-sky-200/90 bg-sky-500/10",
  sage: "border-amber-300/40 text-amber-200/90 bg-amber-500/10",
  oracle: "border-fuchsia-300/40 text-fuchsia-200/90 bg-fuchsia-500/10",
  coming: "border-white/20 text-stone-warm/60 bg-white/5",
};

function useRevealOnce<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setRevealed(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, revealed };
}

function HomeCard({
  card,
  isZh,
  facts,
  flip,
  onOpenDrawer,
}: {
  card: HomeGuideCard;
  isZh: boolean;
  facts: ReturnType<typeof useHomeFacts>;
  flip: boolean;
  onOpenDrawer: () => void;
}) {
  const { ref, revealed } = useRevealOnce<HTMLElement>();
  const isDrawer = card.mode === "drawer";
  const routeTarget = card.target ?? "/";


  const plan = resolveCta({
    target: routeTarget,
    requiresAuth: !(card.id === "concern" || card.id === "commons" || card.id === "hall"),
    requiresPrimaryChart: !!card.requiresPrimaryChart,
    requiresTier: card.requiresTier,
    isSignedIn: facts.isSignedIn,
    hasPrimaryChart: facts.hasPrimaryChart,
    tier: facts.tier,
  });

  const targetLabel = { zh: card.titleZh, en: card.titleEn };
  const micro = ctaMicroCopy(plan.state, targetLabel, isZh);
  const accessTag = card.access as AccessTag;

  const ctaText = isDrawer
    ? isZh
      ? card.ctaZh
      : card.ctaEn
    : plan.state === "signed_out"
    ? isZh
      ? "先登录再进入"
      : "Sign in to enter"
    : plan.state === "no_primary"
    ? isZh
      ? "先建立命盘"
      : "Build the chart first"
    : isZh
    ? card.ctaZh
    : card.ctaEn;

  const ctaClasses =
    "corridor-cta inline-flex min-h-[46px] items-center justify-center rounded-full border border-gold-dust/50 bg-gold-dust/15 px-6 py-2.5 text-xs uppercase tracking-[0.28em] text-gold-light transition hover:bg-gold-dust/25 focus:outline-none focus:ring-2 focus:ring-gold-dust/40";

  return (
    <article
      ref={ref}
      data-revealed={revealed ? "true" : "false"}
      data-flip={flip ? "true" : "false"}
      className="corridor-card border border-gold-dust/20 bg-obsidian/70 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl"
      data-testid={`home-card-${card.id}`}
    >
      <div aria-hidden className="corridor-card__wash" />
      <div className="corridor-card__inner">
        <div className="corridor-head min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-gold-dust/30 px-3 py-1 text-[10px] uppercase tracking-[0.36em] text-gold-dust/80">
              {card.number}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.3em] ${ACCESS_STYLE[accessTag]}`}
            >
              {accessTagLabel(accessTag, isZh)}
            </span>
          </div>
          <h2 className="corridor-title mt-4 font-serif text-stone-warm">
            {isZh ? card.titleZh : card.titleEn}
          </h2>
          <p className="mt-3 text-[11px] uppercase tracking-[0.24em] text-gold-dust/70">
            {isZh ? card.taglineZh : card.taglineEn}
          </p>
          <p className="corridor-body mt-4 text-stone-warm/80">
            {isZh ? card.descriptionZh : card.descriptionEn}
          </p>
        </div>

        <div className="corridor-visual">
          <div className="relative h-full max-h-[190px] w-full max-w-[260px] p-3">

            <HomeCardVisual kind={card.visual} />
          </div>
        </div>

        <div className="corridor-actions min-w-0 space-y-3">
          {isDrawer ? (
            <button type="button" className={ctaClasses} onClick={onOpenDrawer}>
              {ctaText}
            </button>
          ) : plan.disabled || !plan.href ? (
            <button type="button" className={`${ctaClasses} cursor-not-allowed opacity-60`} disabled>
              {isZh ? "馆藏整理中" : "Still curating"}
            </button>
          ) : (
            <Link to={plan.href} className={ctaClasses}>
              {ctaText}
            </Link>
          )}
          <p className="max-w-lg text-xs leading-relaxed text-stone-warm/60">{micro}</p>
        </div>
      </div>
    </article>
  );
}


function FeatureDrawerHost({
  card,
  isZh,
  facts,
  onClose,
}: {
  card: HomeGuideCard | null;
  isZh: boolean;
  facts: ReturnType<typeof useHomeFacts>;
  onClose: () => void;
}) {
  const open = !!card;
  const titleZh = card?.titleZh ?? "";
  const titleEn = card?.titleEn ?? "";
  const taglineZh = card?.taglineZh ?? "";
  const taglineEn = card?.taglineEn ?? "";
  const numberBadge = card?.number ?? "";

  return (
    <LibraryFeatureDrawer
      open={open}
      onOpenChange={(v) => (v ? undefined : onClose())}
      eyebrow={
        numberBadge
          ? isZh
            ? `导览牌 ${numberBadge}`
            : `Guide plate ${numberBadge}`
          : undefined
      }
      title={isZh ? titleZh : titleEn}
      description={isZh ? taglineZh : taglineEn}
    >
      {card ? <DrawerBody card={card} facts={facts} isZh={isZh} /> : null}
    </LibraryFeatureDrawer>
  );
}

function DrawerBody({
  card,
  facts,
  isZh,
}: {
  card: HomeGuideCard;
  facts: ReturnType<typeof useHomeFacts>;
  isZh: boolean;
}) {
  const [concernStep, setConcernStep] = useState<"question" | "books">("question");

  // Reset step whenever the drawer opens a different card.
  useEffect(() => {
    if (card.id === "concern") setConcernStep("question");
  }, [card.id]);

  switch (card.id) {
    case "concern":
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3 rounded-full border border-gold-dust/25 bg-obsidian/60 p-1">
            <StepChip
              active={concernStep === "question"}
              label={isZh ? "01 · 挑一个问题" : "01 · Pick a question"}
              onClick={() => setConcernStep("question")}
            />
            <StepChip
              active={concernStep === "books"}
              label={isZh ? "02 · 翻开六本书" : "02 · Open the six books"}
              onClick={() => setConcernStep("books")}
            />
          </div>
          {concernStep === "question" ? (
            <ConcernSelector
              hasPrimaryChart={facts.hasPrimaryChart}
              onGoToBook={() => setConcernStep("books")}
            />
          ) : (
            <FeatureLibraryShelf />
          )}
        </div>
      );
    case "commons":
      return <PlayfulLibrarySection />;
    case "rooms":
      return <PostRitualRoomsSection />;
    case "hall":
      return <HallHomeIntro />;
    case "desk":
      return <HomePersonalDeskTeaser />;
    default:
      return (
        <p className="text-sm text-stone-warm/70">
          {isZh ? "此卡片直接跳转,不在抽屉内显示。" : "This card navigates directly."}
        </p>
      );
  }
}

function StepChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-full px-4 py-2 text-[11px] uppercase tracking-[0.24em] transition ${
        active
          ? "bg-gold-dust/25 text-gold-light shadow-[inset_0_0_0_1px_rgba(220,180,90,0.4)]"
          : "text-stone-warm/60 hover:text-stone-warm/90"
      }`}
    >
      {label}
    </button>
  );
}

function HomeSideRail({
  cards,
  activeIndex,
  isZh,
}: {
  cards: readonly HomeGuideCard[];
  activeIndex: number;
  isZh: boolean;
}) {
  const items = cards.map((c) => (isZh ? c.titleZh : c.titleEn));
  const total = cards.length;
  const active = cards[activeIndex] ?? cards[0];

  const scrollToIndex = (i: number) => {
    const el = document.getElementById(cards[i].id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Rail visibility: hide by default, reveal while user is actively scrolling
  // (or hovering the right edge), then fade back out ~900ms after scroll stops.
  const [railVisible, setRailVisible] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let idleTimer: number | null = null;
    const show = () => {
      setRailVisible(true);
      if (idleTimer) window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => setRailVisible(false), 900);
    };
    const onScroll = () => show();
    const onMove = (e: MouseEvent) => {
      if (e.clientX > window.innerWidth - 120) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
      if (idleTimer) window.clearTimeout(idleTimer);
    };
  }, []);

  return (
    <>
      {/* Desktop rail: narrow edge ticks while scrolling; labels only expand
          on direct hover/focus so the card text remains unobstructed. */}
      <div
        className={`pointer-events-auto fixed right-1 top-1/2 z-40 hidden -translate-y-1/2 transition-opacity duration-300 2xl:right-3 xl:block ${
          railVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-label={isZh ? "馆藏索引" : "Card index"}
      >
        <LineSidebar
          items={items}
          activeIndex={activeIndex}
          onItemClick={(i) => scrollToIndex(i)}
          proximityRadius={140}
          maxShift={8}
          markerLength={30}
          itemGap={16}
          fontSize={0.68}
          ariaLabel={isZh ? "馆藏索引" : "Card index"}
        />
      </div>

      {/* Mobile pill: cycles to next card. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center xl:hidden">
        <button
          type="button"
          onClick={() => scrollToIndex((activeIndex + 1) % total)}
          className="pointer-events-auto flex max-w-[92vw] items-center gap-3 rounded-full border border-gold-dust/30 bg-obsidian/85 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-stone-warm/85 backdrop-blur-md"
        >
          <span className="text-gold-dust">
            {String(activeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="max-w-[55vw] truncate">
            {isZh ? active.titleZh : active.titleEn}
          </span>
          <span aria-hidden className="text-gold-dust/60">→</span>
        </button>
      </div>
    </>
  );
}
