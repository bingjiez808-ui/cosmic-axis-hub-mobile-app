/**
 * HomeScrollStack — the seven-card guide-desk experience shown after
 * the entrance overlay dismisses. Composes:
 *
 *   LibraryInteriorBackdrop (fixed video)
 *   ├── Guide Desk hero          (welcome text + curator-desk feel)
 *   ├── ScrollStack (7 cards)    (see HOME_GUIDE_CARDS for data)
 *   └── StackProgress            (right rail on desktop, bottom pill on mobile)
 *
 * Every card CTA runs through resolveCta so the five signed-out / no
 * primary chart / ready / locked_sage / locked_oracle / coming_soon
 * paths are consistent. Card 01 (Concern) is the only card that opens
 * a dialog rather than navigating.
 */
import { useCallback, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLang } from "@/lib/i18n";
import { resolveCta, ctaMicroCopy, accessTagLabel, type AccessTag } from "@/lib/home-cta";
import { HOME_GUIDE_CARDS, type HomeGuideCard } from "@/lib/home-guide-cards";
import { useHomeFacts } from "@/lib/use-home-facts";
import { ConcernSelector } from "@/components/ConcernSelector";
import { LibraryInteriorBackdrop } from "./LibraryInteriorBackdrop";
import { ScrollStack, ScrollStackItem } from "./ScrollStack";
import { StackProgress } from "./StackProgress";
import { HomeCardVisual } from "./HomeCardVisual";

export function HomeScrollStack() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const facts = useHomeFacts();
  const [activeIndex, setActiveIndex] = useState(0);
  const [concernOpen, setConcernOpen] = useState(false);

  const onActiveChange = useCallback((_id: string, index: number) => {
    setActiveIndex(index);
  }, []);

  return (
    <div className="relative">
      <LibraryInteriorBackdrop />

      <GuideDeskHero isZh={isZh} />

      <ScrollStack onActiveChange={onActiveChange}>
        {HOME_GUIDE_CARDS.map((card) => (
          <ScrollStackItem
            key={card.id}
            id={`stack-${card.id}`}
            index={0}
            total={HOME_GUIDE_CARDS.length}
          >
            <HomeCard
              card={card}
              isZh={isZh}
              facts={facts}
              onConcernOpen={() => setConcernOpen(true)}
            />
          </ScrollStackItem>
        ))}
      </ScrollStack>

      <StackProgress cards={HOME_GUIDE_CARDS} activeIndex={activeIndex} isZh={isZh} />

      <Dialog open={concernOpen} onOpenChange={setConcernOpen}>
        <DialogContent className="max-h-[92vh] w-[min(96vw,1180px)] max-w-none overflow-y-auto border-gold-dust/25 bg-obsidian/95 p-4 sm:p-6">
          <DialogTitle className="sr-only">
            {isZh ? "今天你带着什么问题来到这里" : "What question brings you today?"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isZh
              ? "选择今天最想理解的问题，图书馆据此为你安排阅读顺序。"
              : "Pick today's real question; the library orders your reading around it."}
          </DialogDescription>
          <ConcernSelector />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GuideDeskHero({ isZh }: { isZh: boolean }) {
  return (
    <header className="relative mx-auto flex min-h-[62vh] max-w-4xl flex-col items-center justify-center px-6 pb-14 pt-24 text-center sm:min-h-[70vh]">
      <p className="text-[10px] uppercase tracking-[0.5em] text-gold-dust/70 sm:text-xs">
        {isZh ? "命运图书馆 · 导览室" : "Destiny Library · Guide Desk"}
      </p>
      <h1 className="mt-6 font-serif text-3xl leading-tight text-stone-warm sm:text-5xl md:text-6xl">
        {isZh ? (
          <>
            走进图书馆，
            <br className="hidden sm:block" />
            馆员正在为你摆好今天的书。
          </>
        ) : (
          <>
            Step inside the library.
            <br className="hidden sm:block" />
            The curator is laying out today's books for you.
          </>
        )}
      </h1>
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-stone-warm/75 sm:text-base">
        {isZh
          ? "顺着下面七块导览牌，从「今天的问题」一路走到「两间阅览室」，每一步都会告诉你现在能读什么、需要先做什么。"
          : "Follow the seven guide plates below, from today's question to the two reading rooms. Each one tells you what you can read now and what needs to happen first."}
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
  onConcernOpen,
}: {
  card: HomeGuideCard;
  isZh: boolean;
  facts: ReturnType<typeof useHomeFacts>;
  onConcernOpen: () => void;
}) {
  const plan = resolveCta({
    target: card.target,
    requiresAuth: card.id !== "concern" && card.id !== "commons",
    requiresPrimaryChart: !!card.requiresPrimaryChart,
    requiresTier: card.requiresTier,
    isSignedIn: facts.isSignedIn,
    hasPrimaryChart: facts.hasPrimaryChart,
    tier: facts.tier,
  });

  const targetLabel = { zh: card.titleZh, en: card.titleEn };
  const micro = ctaMicroCopy(plan.state, targetLabel, isZh);
  const accessTag = card.access as AccessTag;

  const ctaText =
    card.id === "concern"
      ? isZh
        ? "选择我的问题"
        : "Pick my question"
      : plan.state === "signed_out"
      ? isZh
        ? "先登录再进入"
        : "Sign in to enter"
      : plan.state === "no_primary"
      ? isZh
        ? "先建立命盘"
        : "Build the chart first"
      : plan.state === "locked_oracle"
      ? isZh
        ? "预览神谕者阅览室"
        : "Preview the Oracle room"
      : plan.state === "locked_sage"
      ? isZh
        ? "预览贤者阅览室"
        : "Preview the Sage room"
      : isZh
      ? `进入 · ${card.titleZh}`
      : `Enter · ${card.titleEn}`;

  const ctaClasses =
    "inline-flex min-h-[46px] items-center justify-center rounded-full border border-gold-dust/50 bg-gold-dust/15 px-6 py-2.5 text-xs uppercase tracking-[0.28em] text-gold-light transition hover:bg-gold-dust/25 focus:outline-none focus:ring-2 focus:ring-gold-dust/40";

  return (
    <article
      className="relative overflow-hidden rounded-3xl border border-gold-dust/20 bg-obsidian/70 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] backdrop-blur-xl"
      data-testid={`home-card-${card.id}`}
    >
      {/* Card sheen */}
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
            {card.id === "concern" ? (
              <button type="button" className={ctaClasses} onClick={onConcernOpen}>
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
