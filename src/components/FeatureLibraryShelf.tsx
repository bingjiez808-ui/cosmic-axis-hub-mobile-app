/**
 * FeatureLibraryShelf — six "books" on a shelf, each answering a
 * different flavour of question. Deterministic content sourced from
 * `SHELF_BOOKS` in concern-guidance-v1. No AI.
 *
 * Behaviour:
 * - Reads the currently picked concern from sessionStorage (same key
 *   as ConcernSelector) so the matching book glows and sorts first.
 * - Click a spine to open a drawer showing three questions + a sample
 *   excerpt + free/premium boundary + CTA.
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
} from "@/lib/concern-guidance-v1";

const CONCERN_STORAGE_KEY = "fate.concern.v1";

const SPINE_HUES: Record<string, string> = {
  self_knowledge: "from-purple-900 via-purple-800 to-purple-950",
  study_growth: "from-emerald-900 via-emerald-800 to-emerald-950",
  career_path: "from-amber-900 via-amber-800 to-amber-950",
  love_bonds: "from-rose-900 via-rose-800 to-rose-950",
  wealth_path: "from-yellow-900 via-yellow-800 to-yellow-950",
  life_timeline: "from-indigo-900 via-indigo-800 to-indigo-950",
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
        if (isConcernKey(v)) setPickedConcern(v);
        else setPickedConcern(null);
      } catch {
        /* ignore */
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === CONCERN_STORAGE_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    // Poll once shortly after mount so a same-tab pick shows up.
    const t = window.setInterval(read, 1200);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.clearInterval(t);
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
      </div>

      {/* Shelf plank */}
      <div className="relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-4 rounded-b-md bg-gradient-to-b from-amber-950/40 to-black/70"
        />
        <ul
          role="list"
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
        >
          {orderedBooks.map((b) => {
            const isFeatured =
              !!pickedConcern && CONCERNS[pickedConcern].featuredShelfBook === b.key;
            const isOpen = openBook === b.key;
            return (
              <li key={b.key} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenBook((v) => (v === b.key ? null : b.key))}
                  aria-expanded={isOpen}
                  aria-controls={`shelf-book-${b.key}`}
                  className={[
                    "group relative flex h-56 w-full flex-col justify-between overflow-hidden rounded-md border p-3 text-left transition sm:h-64",
                    "bg-gradient-to-b",
                    SPINE_HUES[b.key] ?? "from-stone-800 via-stone-900 to-black",
                    isFeatured
                      ? "border-amber-300 shadow-[0_0_28px_rgba(251,191,36,0.35)]"
                      : "border-amber-100/15 hover:border-amber-300/40",
                    isOpen ? "ring-2 ring-amber-300/60" : "",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className="absolute left-2 top-2 h-full w-[2px] bg-gradient-to-b from-amber-200/80 via-amber-500/40 to-transparent"
                  />
                  <div className="pl-3">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-amber-200/60">
                      {isFeatured ? (lang === "zh" ? "为你亮起" : "Lit for you") : "Vol."}
                    </div>
                    <div className="mt-2 font-serif text-lg leading-tight text-amber-50">
                      {b.title[lang]}
                    </div>
                  </div>
                  <div className="pl-3 text-[11px] leading-snug text-amber-100/65">
                    {b.oneLiner[lang]}
                  </div>
                </button>

                {isOpen ? (
                  <div
                    id={`shelf-book-${b.key}`}
                    className="mt-3 rounded-lg border border-amber-100/15 bg-black/40 p-4 text-sm sm:absolute sm:left-0 sm:right-0 sm:top-full sm:z-10 sm:mt-2 sm:w-[min(560px,90vw)] sm:shadow-[0_18px_60px_rgba(0,0,0,0.65)]"
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
