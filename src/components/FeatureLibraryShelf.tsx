/**
 * FeatureLibraryShelf — six illustrated "books" on a shelf.
 *
 * Phase 1 visual upgrade:
 * - Real illustrated covers imported from src/assets/shelf-books/*.webp
 *   (sliced from the 3×2 cover atlas at build time). No CSS
 *   background-position on the atlas at runtime.
 * - Desktop: grid of book spines that lift and glow on hover / focus /
 *   selected.
 * - Mobile: horizontal snap scroll showing ~1.3 books at a time so the
 *   user can tell the shelf continues off-screen.
 * - Detail drawer renders in normal flow (after the tapped card on
 *   mobile) so nothing gets clipped.
 * - Same-tab picks propagate through a CustomEvent instead of polling.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { useLang } from "@/lib/i18n";
import { useSupabaseSession } from "@/lib/session";
import {
  CONCERNS,
  SHELF_BOOKS,
  isConcernKey,
  resolveConcernRoute,
  type ConcernKey,
  type ShelfBook,
  type ShelfBookKey,
} from "@/lib/concern-guidance-v1";
import { CONCERN_EVENT } from "@/components/ConcernSelector";

import coverSelf from "@/assets/shelf-books/self_knowledge.webp";
import coverStudy from "@/assets/shelf-books/study_growth.webp";
import coverCareer from "@/assets/shelf-books/career_path.webp";
import coverLove from "@/assets/shelf-books/love_bonds.webp";
import coverWealth from "@/assets/shelf-books/wealth_path.webp";
import coverTimeline from "@/assets/shelf-books/life_timeline.webp";

const CONCERN_STORAGE_KEY = "fate.concern.v1";

const COVERS: Record<ShelfBookKey, string> = {
  self_knowledge: coverSelf,
  study_growth: coverStudy,
  career_path: coverCareer,
  love_bonds: coverLove,
  wealth_path: coverWealth,
  life_timeline: coverTimeline,
};

export function FeatureLibraryShelf() {
  const { lang } = useLang();
  const session = useSupabaseSession();
  const isSignedIn = !!session?.user?.id;

  const [pickedConcern, setPickedConcern] = useState<ConcernKey | null>(null);
  const [openBook, setOpenBook] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const read = () => {
      try {
        const v = window.sessionStorage.getItem(CONCERN_STORAGE_KEY);
        setPickedConcern(isConcernKey(v) ? v : null);
      } catch {
        /* ignore */
      }
    };
    read();
    const onEvent = (e: Event) => {
      const detail = (e as CustomEvent<unknown>).detail;
      if (isConcernKey(detail)) setPickedConcern(detail);
      else read();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONCERN_STORAGE_KEY) read();
    };
    window.addEventListener(CONCERN_EVENT, onEvent as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONCERN_EVENT, onEvent as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const orderedBooks = useMemo<ShelfBook[]>(() => {
    if (!pickedConcern) return SHELF_BOOKS;
    const featured = CONCERNS[pickedConcern].featuredShelfBook;
    const featuredBook = SHELF_BOOKS.find((b) => b.key === featured);
    if (!featuredBook) return SHELF_BOOKS;
    return [featuredBook, ...SHELF_BOOKS.filter((b) => b.key !== featured)];
  }, [pickedConcern]);

  const H = {
    kicker: {
      zh: "图书馆的六本书",
      en: "Six books on the shelf",
    },
    heading: {
      zh: pickedConcern ? "根据你刚才的问题，建议先从这里读起" : "选一本你想先翻开的书",
      en: pickedConcern
        ? "Based on your question, start with the highlighted spine first"
        : "Pick the book you'd like to open first",
    },
    hintScroll: {
      zh: "← 横向滑动书架 →",
      en: "← swipe the shelf →",
    },
    sample: { zh: "格式样例", en: "Sample excerpt" },
    answers: { zh: "这本书能回答", en: "This book answers" },
    free: { zh: "免费包含", en: "Free includes" },
    freeBody: {
      zh: "综合解读中的对应章节 · 60 秒可读版本",
      en: "Corresponding chapter in the free panorama · a 60-second read",
    },
    premium: { zh: "¥79 高级 AI 深度报告扩展", en: "¥79 Premium report deep dive" },
    premiumBody: {
      zh: "24 章完整版本，加入四体系交叉比对与年度窗口。",
      en: "Full 24 chapters with cross-tradition comparison and yearly windows.",
    },
    cta: { zh: "带着这本书阅读我的命盘", en: "Read my chart with this book" },
    closed: { zh: "点击书脊翻开这本书", en: "Tap a spine to open the book" },
    litForYou: { zh: "为你亮起", en: "Lit for you" },
    volume: { zh: "第 卷", en: "Vol." },
  };

  return (
    <section
      id="feature-library"
      aria-labelledby="feature-library-heading"
      className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20"
    >
      <div className="mb-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.36em] text-amber-300/70">{H.kicker[lang]}</p>
        <h2
          id="feature-library-heading"
          className="mt-3 font-serif text-2xl leading-tight text-amber-100/95 sm:text-3xl"
        >
          {H.heading[lang]}
        </h2>
        <p className="mt-3 text-[11px] uppercase tracking-[0.28em] text-amber-200/50 sm:hidden">
          {H.hintScroll[lang]}
        </p>
      </div>

      {/* Shelf plank */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-md bg-gradient-to-b from-amber-950/40 to-black/70"
        />
        <ul
          role="list"
          className={[
            // Mobile: horizontal snap scroller, ~1.3 books visible.
            "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pl-1 pr-6 -mx-1",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            // Desktop: real grid — no scroller, wraps to 3/6 columns.
            "sm:grid sm:snap-none sm:overflow-visible sm:grid-cols-3 sm:gap-4 sm:px-0 sm:pb-0",
            "lg:grid-cols-6",
          ].join(" ")}
        >
          {orderedBooks.map((b, idx) => {
            const isFeatured =
              !!pickedConcern && CONCERNS[pickedConcern].featuredShelfBook === b.key;
            const isOpen = openBook === b.key;
            const cover = COVERS[b.key];
            return (
              <li
                key={b.key}
                className={[
                  // Mobile card width → ~1.3 per screen at 393px.
                  "shrink-0 basis-[72%] snap-start",
                  "sm:basis-auto sm:shrink",
                  "relative",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => setOpenBook((v) => (v === b.key ? null : b.key))}
                  aria-expanded={isOpen}
                  aria-controls={`shelf-book-${b.key}`}
                  className={[
                    "group relative flex w-full flex-col overflow-hidden rounded-md border text-left",
                    "transition-transform duration-300 ease-out will-change-transform",
                    "motion-reduce:transition-none motion-reduce:transform-none",
                    "hover:-translate-y-1 focus-visible:-translate-y-1 motion-reduce:hover:transform-none",
                    isFeatured
                      ? "border-amber-300/80 shadow-[0_0_28px_rgba(251,191,36,0.35)]"
                      : "border-amber-100/15 hover:border-amber-300/40 focus-visible:border-amber-300/60",
                    isOpen ? "ring-2 ring-amber-300/60" : "",
                    "focus:outline-none",
                  ].join(" ")}
                  style={{ aspectRatio: "3 / 4" }}
                >
                  {/* Cover image */}
                  <img
                    src={cover}
                    alt=""
                    aria-hidden
                    loading={idx === 0 ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  {/* Bottom gradient for legible caption */}
                  <div
                    aria-hidden
                    className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/55 to-transparent"
                  />
                  {/* Gilt spine light */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-2 top-2 bottom-2 w-[2px] bg-gradient-to-b from-amber-200/80 via-amber-500/40 to-transparent"
                  />
                  {/* Hover / focus gilt outline */}
                  <span
                    aria-hidden
                    className={[
                      "pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset transition-opacity",
                      isFeatured
                        ? "ring-amber-300/60 opacity-100"
                        : "ring-amber-200/30 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
                    ].join(" ")}
                  />

                  {/* Text overlay */}
                  <div className="relative z-10 mt-auto p-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200/80">
                      {isFeatured ? H.litForYou[lang] : H.volume[lang]}
                    </div>
                    <div className="mt-1 font-serif text-base leading-tight text-amber-50 drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] sm:text-lg">
                      {b.title[lang]}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-amber-100/80">
                      {b.oneLiner[lang]}
                    </div>
                  </div>
                </button>

                {isOpen ? (
                  <div
                    id={`shelf-book-${b.key}`}
                    className="mt-3 rounded-lg border border-amber-100/15 bg-black/70 p-4 text-sm shadow-[0_18px_60px_rgba(0,0,0,0.65)] backdrop-blur"
                  >
                    <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200/70">
                      {H.answers[lang]}
                    </div>
                    <ul className="mt-2 space-y-1.5 text-amber-100/85">
                      {b.answers[lang].map((a, i) => (
                        <li key={i} className="flex gap-2">
                          <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-300/70" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 rounded-md border border-amber-100/10 bg-black/40 p-3 text-[13px] italic leading-relaxed text-amber-100/80">
                      <div className="mb-1 text-[10px] not-italic uppercase tracking-[0.22em] text-amber-200/60">
                        {H.sample[lang]}
                      </div>
                      {CONCERNS[b.ctaTarget].sampleOutput[lang]}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-emerald-400/25 bg-emerald-500/5 p-3 text-xs">
                        <div className="text-emerald-200">{H.free[lang]}</div>
                        <div className="mt-1 text-emerald-50/80">{H.freeBody[lang]}</div>
                      </div>
                      <div className="rounded-md border border-amber-400/30 bg-amber-500/5 p-3 text-xs">
                        <div className="text-amber-200">{H.premium[lang]}</div>
                        <div className="mt-1 text-amber-100/75">{H.premiumBody[lang]}</div>
                      </div>
                    </div>

                    <Link
                      to={resolveConcernRoute({
                        concern: b.ctaTarget,
                        isSignedIn,
                        hasPrimaryChart: false,
                      })}
                      className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-5 text-sm font-medium text-black transition hover:brightness-110"
                    >
                      {H.cta[lang]}
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {!openBook ? (
        <p className="mt-6 text-center text-xs text-amber-200/50">{H.closed[lang]}</p>
      ) : null}
    </section>
  );
}

export default FeatureLibraryShelf;
