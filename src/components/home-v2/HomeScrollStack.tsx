/**
 * HomeScrollStack — the seven-card guide-desk experience shown after
 * the entrance overlay dismisses.
 *
 * Layout:
 *   LibraryInteriorBackdrop (fixed video)
 *   ├── GuideDeskHero              (welcome + brand copy)
 *   ├── ScrollStack (7 index cards)  — React Bits ScrollStack + Lenis
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
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { useLang } from "@/lib/i18n";
import { resolveCta, ctaMicroCopy, accessTagLabel, type AccessTag } from "@/lib/home-cta";
import { HOME_GUIDE_CARDS, type HomeGuideCard, type HomeCardId } from "@/lib/home-guide-cards";
import { useHomeFacts } from "@/lib/use-home-facts";

import ScrollStack, { ScrollStackItem } from "@/components/react-bits/ScrollStack/ScrollStack";
import SplitText from "@/components/react-bits/SplitText/SplitText";
import LineSidebar from "@/components/react-bits/LineSidebar/LineSidebar";
import { LibraryInteriorBackdrop } from "./LibraryInteriorBackdrop";
import { HomeCardVisual } from "./HomeCardVisual";
import { LibraryFeatureDrawer } from "./LibraryFeatureDrawer";

import { ConcernSelector } from "@/components/ConcernSelector";
import { FeatureLibraryShelf } from "@/components/FeatureLibraryShelf";
import { PlayfulLibrarySection } from "@/components/PlayfulLibrarySection";
import { PostRitualRoomsSection } from "@/components/PostRitualRoomsSection";
import { HomePersonalDeskTeaser } from "@/components/HomePersonalDeskTeaser";
import { ReaderPassCard } from "@/components/reader-pass/ReaderPassCard";

const DRAWER_IDS = new Set<HomeCardId>(["concern", "commons", "rooms", "desk"]);

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

      <ScrollStack
        itemDistance={80}
        itemStackDistance={26}
        stackPosition="18%"
        scaleEndPosition="8%"
        baseScale={0.88}
        itemScale={0.02}
      >
        {HOME_GUIDE_CARDS.map((card) => (
          <ScrollStackItem key={card.id}>
            <div id={card.id}>
              <HomeCard
                card={card}
                isZh={isZh}
                facts={facts}
                onOpenDrawer={() => openCard(card.id)}
              />
            </div>
          </ScrollStackItem>
        ))}
      </ScrollStack>

      <HomeSideRail
        cards={HOME_GUIDE_CARDS}
        activeIndex={activeIndex}
        isZh={isZh}
      />

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
  return (
    <header className="relative mx-auto flex min-h-[62vh] max-w-4xl flex-col items-center justify-center px-6 pb-14 pt-24 text-center sm:min-h-[70vh]">
      <ReaderPassCard />
      <p className="text-[10px] uppercase tracking-[0.5em] text-gold-dust/70 sm:text-xs">
        {isZh ? "命运图书馆 · 导览室" : "Destiny Library · Guide Desk"}
      </p>
      <h1 className="mt-6 font-serif text-3xl leading-tight text-stone-warm sm:text-5xl md:text-6xl">
        {isZh ? (
          <>
            每一个文明,
            <br className="hidden sm:block" />
            都在问同一个问题。
          </>
        ) : (
          <>
            Every civilization has been
            <br className="hidden sm:block" />
            asking the same question.
          </>
        )}
      </h1>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-stone-warm/75 sm:text-base">
        {isZh
          ? "跟着下面七块导览牌一路向下:从今天的问题、命盘与综合解读,到六本书、通识馆、四间藏室,最后回到你的个人书架。每一张卡片都会告诉你现在能读什么、需要先做什么。"
          : "Follow the seven guide plates below: from today's question, primary chart and panorama, to six books, the commons, four special rooms, and finally your Personal Library. Each plate tells you what you can read now and what needs to happen first."}
      </p>
      <div className="mt-8 flex items-center gap-3 text-[10px] uppercase tracking-[0.42em] text-gold-dust/50">
        <span aria-hidden>↓</span>
        <span>{isZh ? "向下走进书架" : "Scroll into the shelves"}</span>
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

function HomeCard({
  card,
  isZh,
  facts,
  onOpenDrawer,
}: {
  card: HomeGuideCard;
  isZh: boolean;
  facts: ReturnType<typeof useHomeFacts>;
  onOpenDrawer: () => void;
}) {
  const isDrawer = card.mode === "drawer";
  const routeTarget = card.target ?? "/";

  const plan = resolveCta({
    target: routeTarget,
    requiresAuth: !(card.id === "concern" || card.id === "commons"),
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
    "inline-flex min-h-[46px] items-center justify-center rounded-full border border-gold-dust/50 bg-gold-dust/15 px-6 py-2.5 text-xs uppercase tracking-[0.28em] text-gold-light transition hover:bg-gold-dust/25 focus:outline-none focus:ring-2 focus:ring-gold-dust/40";

  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-gold-dust/20 bg-obsidian/70 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl"
      data-testid={`home-card-${card.id}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(120% 60% at 50% -10%, rgba(220,180,90,0.14), transparent 55%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(0,0,0,0.05))",
        }}
      />
      <div className="relative grid gap-8 p-6 sm:p-10 md:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)] md:gap-12 md:p-14">
        <div className="flex min-w-0 flex-col justify-between gap-8">
          <div className="min-w-0">
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
            <h2 className="mt-5 font-serif text-2xl leading-tight text-stone-warm sm:text-3xl md:text-4xl">
              {isZh ? card.titleZh : card.titleEn}
            </h2>
            <p className="mt-3 text-[11px] uppercase tracking-[0.24em] text-gold-dust/70">
              {isZh ? card.taglineZh : card.taglineEn}
            </p>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-stone-warm/80 sm:text-base">
              {isZh ? card.descriptionZh : card.descriptionEn}
            </p>
          </div>
          <div className="space-y-3">
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
        <div className="relative flex min-h-[180px] items-center justify-center">
          <div className="absolute inset-0 rounded-2xl border border-gold-dust/10 bg-black/35" />
          <div className="relative h-full max-h-[260px] w-full max-w-[320px] p-4">
            <HomeCardVisual kind={card.visual} />
          </div>
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

  return (
    <>
      {/* Desktop rail: fixed narrow width, proximity-driven labels. */}
      <div
        className="pointer-events-auto fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 xl:block"
        aria-label={isZh ? "馆藏索引" : "Card index"}
      >
        <LineSidebar
          items={items}
          activeIndex={activeIndex}
          onItemClick={(i) => scrollToIndex(i)}
          proximityRadius={140}
          maxShift={22}
          markerLength={34}
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
