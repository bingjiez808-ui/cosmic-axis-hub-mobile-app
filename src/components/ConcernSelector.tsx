/**
 * ConcernSelector — "带着我的问题开始阅读" homepage module.
 *
 * Layout (2026-07 refactor):
 *   - Desktop (≥lg): true equal-height CSS Grid — left question list
 *     stretches, right response card fills the same row height via
 *     flex column + `mt-auto` action footer.
 *   - Mobile: single natural column, no forced equal height.
 *
 * The right panel is a 4-layer structure per selected concern:
 *   1. Selection confirmation + situational empathy line.
 *   2. Recommended book card with chapter mapping.
 *   3. "This reading will help you tell apart" — three index cards.
 *   4. Bottom action strip — pinned to card floor via `mt-auto`.
 *
 * All copy is deterministic. No new AI calls, no chart mutation,
 * no route changes.
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
import { CONCERN_READING_GUIDES } from "@/lib/concern-reading-guide";
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

export function ConcernSelector({ hasPrimaryChart = false }: Props = {}) {
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
  const guide = CONCERN_READING_GUIDES[picked];
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
      zh: "选一个更靠近你此刻的问题，图书馆会先递给你一本适合的书，并告诉你这次阅读会帮你分清什么。",
      en: "Pick the question closest to you right now. The library will hand you one suitable book and tell you what this reading will help you tell apart.",
    },
    picked: { zh: "你选择了", en: "You picked" },
    default: { zh: "默认起点", en: "Default starting point" },
    recPrefix: { zh: "图书馆先为你递来", en: "The library hands you first" },
    chapterMap: {
      zh: "这本书对应综合解读中的",
      en: "This book maps to the report chapter",
    },
    goToBook: { zh: "先看看这本书", en: "See the book" },
    indexTitle: { zh: "这次阅读会帮你分清", en: "This reading will help you tell apart" },
    indexHint: {
      zh: "这些是阅读方向，不是命理结论；生成命盘后会由真实事实填充。",
      en: "These are reading directions, not conclusions; real chart facts fill them after your chart is generated.",
    },
    ctaPrimaryOpen: { zh: "打开我的优先阅读", en: "Open my priority reading" },
    ctaPrimaryStart: { zh: "带着这个问题开启仪式", en: "Begin the ritual with this question" },
    nextStepPrefix: { zh: "下一步", en: "Next" },
    nextStepStart: {
      zh: "登记完整出生资料，生成后优先打开",
      en: "Register your birth details; the reader will open",
    },
    savedNoteSignedIn: {
      zh: "这个阅读起点已保存，下次回来仍会从这里继续。",
      en: "This starting point is saved — you'll return to it next time.",
    },
    savedNoteAnon: {
      zh: "本次访问已记住这个问题；登录后我们会保存到你的图书馆。",
      en: "Remembered for this visit; sign in and we'll save it to your library.",
    },
    disclaimer: {
      zh: "这次选择只决定阅读顺序，不改变命盘计算结果。",
      en: "Your pick only decides reading order — it never changes the chart calculation.",
    },
  };

  const isDerivedDefault = explicit === null;
  const chapterLabel = guide.reportSectionLabel[lang];

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

      {/* Equal-height CSS Grid on desktop; natural single column below lg. */}
      <div
        className="grid items-stretch gap-6 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,2.1fr)]"
        style={{ gap: "clamp(24px, 3vw, 48px)" }}
      >
        {/* ── Left: question list ─────────────────────────────── */}
        <div
          role="radiogroup"
          aria-label={H.heading[lang]}
          className="grid h-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1"
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

        {/* ── Right: response card (flex column so footer sits at floor). ── */}
        <div ref={responseRef} className="h-full">
          <article
            aria-live="polite"
            data-testid="concern-response"
            className="flex h-full min-h-full flex-col rounded-xl border border-amber-100/15 bg-gradient-to-b from-[#1a120a]/85 to-[#0e0a06]/85 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.55)] sm:p-8"
          >
            {/* Layer 1 · Selection confirmation + situational empathy */}
            <header>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[10px] uppercase tracking-[0.24em] text-amber-300/70">
                  {isDerivedDefault ? H.default[lang] : H.picked[lang]}
                </span>
                <span className="font-serif text-base text-amber-100">{rec.chip[lang]}</span>
              </div>
              <p className="mt-4 font-serif text-base leading-relaxed text-amber-50/95 sm:text-lg">
                {rec.situationalResponse[lang]}
              </p>
            </header>

            {/* Layer 2 · Recommended book card */}
            <section
              data-testid="concern-recommended-book"
              className="mt-6 rounded-lg border border-amber-300/30 bg-amber-500/[0.06] p-4 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-amber-300/75">
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
                  className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-amber-300/60 bg-amber-300/10 px-5 text-sm font-medium text-amber-100 transition hover:bg-amber-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                >
                  {H.goToBook[lang]}
                </button>
              </div>
              <div className="mt-3 border-t border-amber-100/10 pt-3 text-[12px] leading-relaxed text-amber-100/65">
                <span className="text-amber-100/45">{H.chapterMap[lang]}</span>
                <span className="ml-1 font-serif text-amber-100/85">「{chapterLabel}」</span>
                <span className="text-amber-100/45">
                  {lang === "zh" ? "章节。" : " chapter."}
                </span>
              </div>
            </section>

            {/* Layer 3 · Three index cards — the substance that fills height */}
            <section
              aria-label={H.indexTitle[lang]}
              data-testid="concern-reading-indexes"
              className="mt-6"
            >
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/70">
                {H.indexTitle[lang]}
              </p>
              <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                {guide.readingIndexes.map((card, i) => (
                  <li
                    key={card.id}
                    className="flex h-full flex-col rounded-lg border border-amber-100/10 bg-black/40 p-4"
                  >
                    <div className="flex items-baseline gap-2 text-[10px] uppercase tracking-[0.22em] text-amber-300/70">
                      <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <span aria-hidden className="h-px w-4 bg-amber-300/30" />
                    </div>
                    <div className="mt-2 font-serif text-[14px] leading-snug text-amber-50">
                      {card.title[lang]}
                    </div>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-amber-100/65">
                      {card.description[lang]}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-snug text-amber-100/40">{H.indexHint[lang]}</p>
            </section>

            {/* Layer 4 · Bottom action strip pinned to card floor */}
            <footer className="mt-auto pt-6">
              <div className="border-t border-amber-300/25 pt-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-[12px] leading-snug text-amber-100/65">
                    {hasPrimaryChart ? (
                      <span>
                        {isSignedIn
                          ? H.savedNoteSignedIn[lang]
                          : H.savedNoteAnon[lang]}
                      </span>
                    ) : (
                      <>
                        <span className="text-amber-300/75">{H.nextStepPrefix[lang]}：</span>
                        <span>{H.nextStepStart[lang]}</span>
                        <span className="ml-1 font-serif text-amber-100/85">「{chapterLabel}」</span>
                        {lang === "zh" ? "。" : "."}
                      </>
                    )}
                  </div>
                  <p className="shrink-0 text-[11px] leading-snug text-amber-100/40 sm:max-w-[220px] sm:text-right">
                    {H.disclaimer[lang]}
                  </p>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={onGoToBook}
                    data-testid="concern-secondary-see-book"
                    className="order-2 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-amber-100/20 px-5 text-sm text-amber-100/80 transition hover:border-amber-200/45 hover:text-amber-100 sm:order-1"
                  >
                    {H.goToBook[lang]}
                  </button>
                  <a
                    href={hasPrimaryChart ? "/me/home?focus=priority" : `/ritual?concern=${picked}`}
                    data-testid="concern-primary-cta"
                    className="order-1 inline-flex min-h-[48px] items-center justify-center rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-6 text-sm font-medium text-black shadow-[0_10px_30px_rgba(251,191,36,0.25)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 sm:order-2"
                  >
                    {hasPrimaryChart ? H.ctaPrimaryOpen[lang] : H.ctaPrimaryStart[lang]}
                  </a>
                </div>
              </div>
            </footer>
          </article>
        </div>
      </div>
    </section>
  );
}

export default ConcernSelector;
