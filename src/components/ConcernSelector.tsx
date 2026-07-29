/**
 * ConcernSelector — "带着我的问题开始阅读" homepage module.
 *
 * Role in the two-module funnel:
 *   A. ConcernSelector (this file) — identify the user's question,
 *      offer a warm response, and recommend ONE specific book on
 *      the shelf below.
 *   B. FeatureLibraryShelf — turn that recommendation into a real
 *      entrance to the ritual / report via a unified book dialog.
 *
 * This module no longer:
 *   - lists every report chapter / feature bullet
 *   - shows a sample AI excerpt (belongs to the book dialog)
 *   - opens a modal — the CTA scrolls to the shelf and highlights
 *     the recommended book instead
 *
 * State handoff:
 *   - `fate.concern.v1` (sessionStorage) — the picked concern
 *   - `fate:concern-changed` event — same-tab broadcast
 *   - `fate:focus-shelf` event — asks the shelf to pulse the
 *     recommended spine after the user scrolls down
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { useLang } from "@/lib/i18n";
import {
  CONCERNS,
  CONCERN_KEYS,
  SHELF_BOOKS,
  type ConcernKey,
  isConcernKey,
} from "@/lib/concern-guidance-v1";
import { setConcern as setConcernFn } from "@/lib/life-guidance.functions";
import { useSupabaseSession } from "@/lib/session";

const CONCERN_STORAGE_KEY = "fate.concern.v1";
export const CONCERN_EVENT = "fate:concern-changed";
export const FOCUS_SHELF_EVENT = "fate:focus-shelf";

type Props = {
  hasPrimaryChart?: boolean;
  existingReportId?: string | null;
};

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ConcernSelector(_props: Props = {}) {
  const { lang } = useLang();
  const session = useSupabaseSession();
  const isSignedIn = !!session?.user?.id;
  const saveConcern = useServerFn(setConcernFn);

  const [explicit, setExplicit] = useState<ConcernKey | null>(null);
  const responseRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(CONCERN_STORAGE_KEY);
      if (isConcernKey(stored)) setExplicit(stored);
    } catch {
      /* ignore */
    }
  }, []);

  const picked: ConcernKey = explicit ?? "overview";
  const rec = CONCERNS[picked];
  const recommendedBookKey = rec.featuredShelfBook;
  const recommendedBook = useMemo(
    () => SHELF_BOOKS.find((b) => b.key === recommendedBookKey) ?? SHELF_BOOKS[0],
    [recommendedBookKey],
  );

  const onPick = useCallback(
    (k: ConcernKey) => {
      const first = explicit !== k;
      setExplicit(k);
      try {
        window.sessionStorage.setItem(CONCERN_STORAGE_KEY, k);
      } catch {
        /* ignore */
      }
      try {
        window.dispatchEvent(new CustomEvent(CONCERN_EVENT, { detail: k }));
      } catch {
        /* ignore */
      }
      if (isSignedIn) {
        saveConcern({ data: { concern: k } }).catch(() => {
          /* keep local pick */
        });
      }
      if (first && typeof window !== "undefined" && window.innerWidth < 1024) {
        setTimeout(() => {
          responseRef.current?.scrollIntoView({
            behavior: prefersReducedMotion() ? "auto" : "smooth",
            block: "start",
          });
        }, 60);
      }
    },
    [explicit, isSignedIn, saveConcern],
  );

  const onGoToBook = useCallback(() => {
    if (typeof window === "undefined") return;
    const target = document.getElementById("feature-library");
    if (target) {
      target.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
    }
    try {
      window.dispatchEvent(
        new CustomEvent(FOCUS_SHELF_EVENT, { detail: recommendedBookKey }),
      );
    } catch {
      /* ignore */
    }
  }, [recommendedBookKey]);

  const H = {
    kicker: { zh: "带着你的问题，开始阅读", en: "Read with your question in mind" },
    heading: { zh: "今天你带着什么问题来到这里？", en: "What question brings you here today?" },
    sub: {
      zh: "选一个更靠近你此刻的问题，图书馆会先递给你一本适合的书；选完就到下方书架翻开它。",
      en: "Pick the question closest to you right now — the library will hand you one suitable book. Then open it on the shelf below.",
    },
    picked: { zh: "你选择了", en: "You picked" },
    default: { zh: "默认起点", en: "Default starting point" },
    recPrefix: { zh: "图书馆先为你递来：", en: "The library hands you first:" },
    goToBook: { zh: "去看看这本书 ↓", en: "Go see this book ↓" },
    signedOutNote: {
      zh: "本次访问已记住这个问题；登录后我们会保存到你的图书馆。",
      en: "This choice is remembered for this visit; sign in and we'll save it to your library.",
    },
    signedInNote: { zh: "已保存到你的图书馆。", en: "Saved to your library." },
    disclaimer: {
      zh: "选择只决定先翻哪一本，不会改变命盘计算结果。",
      en: "Your pick only decides which book opens first — it never changes the chart calculation.",
    },
  };

  const isDerivedDefault = explicit === null;

  return (
    <section
      id="concern"
      aria-labelledby="concern-heading"
      className="mx-auto w-full max-w-6xl px-5 py-16 sm:py-20"
    >
      <div className="mb-8 text-center">
        <p className="text-[10px] uppercase tracking-[0.36em] text-amber-300/70">
          {H.kicker[lang]}
        </p>
        <h2
          id="concern-heading"
          className="mt-3 font-serif text-2xl leading-tight text-amber-100/95 sm:text-3xl"
        >
          {H.heading[lang]}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-amber-100/60">
          {H.sub[lang]}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,340px)_1fr]">
        <div
          role="radiogroup"
          aria-label={H.heading[lang]}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1"
        >
          {CONCERN_KEYS.map((k) => {
            const active = picked === k;
            return (
              <button
                key={k}
                role="radio"
                aria-checked={active}
                type="button"
                onClick={() => onPick(k)}
                className={[
                  "min-h-[52px] rounded-lg border px-4 py-3 text-left text-sm transition",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60",
                  active
                    ? "border-amber-300/70 bg-amber-300/10 text-amber-50 shadow-[0_0_18px_rgba(251,191,36,0.18)]"
                    : "border-amber-100/10 bg-black/30 text-amber-100/75 hover:border-amber-200/40 hover:bg-amber-100/5",
                ].join(" ")}
              >
                <div className="font-serif text-[15px] leading-snug">{CONCERNS[k].chip[lang]}</div>
                <div className="mt-1 text-[12px] leading-snug text-amber-100/55">
                  {CONCERNS[k].question[lang]}
                </div>
              </button>
            );
          })}
        </div>

        <div ref={responseRef} className="min-h-[220px]">
          <article
            aria-live="polite"
            data-testid="concern-response"
            className="rounded-xl border border-amber-100/15 bg-gradient-to-b from-[#1a120a]/85 to-[#0e0a06]/85 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.55)] sm:p-8"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-[10px] uppercase tracking-[0.24em] text-amber-300/70">
                {isDerivedDefault ? H.default[lang] : H.picked[lang]}
              </span>
              <span className="font-serif text-base text-amber-100">{rec.chip[lang]}</span>
            </div>

            <p className="mt-4 font-serif text-base leading-relaxed text-amber-50/95 sm:text-lg">
              {rec.situationalResponse[lang]}
            </p>

            <div className="mt-6 flex flex-col gap-4 rounded-lg border border-amber-300/25 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70">
                  {H.recPrefix[lang]}
                </div>
                <div className="mt-1 font-serif text-lg text-amber-50">
                  《{recommendedBook.title[lang]}》
                </div>
                <div className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-amber-100/70">
                  {recommendedBook.oneLiner[lang]}
                </div>
              </div>
              <button
                type="button"
                onClick={onGoToBook}
                data-testid="concern-go-to-book"
                className="inline-flex min-h-[48px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-6 text-sm font-medium text-black shadow-[0_10px_30px_rgba(251,191,36,0.25)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                {H.goToBook[lang]}
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-2 text-[12px] leading-snug text-amber-100/55 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                {rec.nextStepHint[lang]}
                {!isDerivedDefault ? (
                  <div className="mt-1 text-amber-100/40">
                    {isSignedIn ? H.signedInNote[lang] : H.signedOutNote[lang]}
                  </div>
                ) : null}
              </div>
              <p className="text-amber-100/40">{H.disclaimer[lang]}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default ConcernSelector;
