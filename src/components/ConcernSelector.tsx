/**
 * ConcernSelector — "带着我的问题开始阅读" homepage module.
 *
 * Behaviour (Phase 1):
 * - Derives `overview` as the default selection when nothing is stored,
 *   so the response side is never empty on first paint.
 * - Only writes to sessionStorage / cloud when the user actually clicks.
 * - Broadcasts picks via a custom event so the shelf reacts instantly
 *   in the same tab without polling.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { useLang } from "@/lib/i18n";
import {
  CONCERNS,
  CONCERN_KEYS,
  type ConcernKey,
  isConcernKey,
  resolveConcernRoute,
} from "@/lib/concern-guidance-v1";
import { setConcern as setConcernFn } from "@/lib/life-guidance.functions";
import { useSupabaseSession } from "@/lib/session";

const CONCERN_STORAGE_KEY = "fate.concern.v1";
export const CONCERN_EVENT = "fate:concern-changed";

type Props = {
  hasPrimaryChart?: boolean;
  existingReportId?: string | null;
};

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function ConcernSelector({ hasPrimaryChart = false, existingReportId = null }: Props) {
  const { lang } = useLang();
  const session = useSupabaseSession();
  const isSignedIn = !!session?.user?.id;
  const saveConcern = useServerFn(setConcernFn);

  // `explicit` = user actually chose. `null` → fall back to overview.
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
      // Mobile: scroll response into view once per fresh pick.
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

  const rec = CONCERNS[picked];
  const ctaHref = useMemo(
    () =>
      resolveConcernRoute({
        concern: picked,
        isSignedIn,
        hasPrimaryChart,
        existingReportId,
      }),
    [picked, isSignedIn, hasPrimaryChart, existingReportId],
  );

  const H = {
    kicker: {
      zh: "带着你的问题，开始阅读",
      en: "Read with your question in mind",
    },
    heading: {
      zh: "今天你带着什么问题来到这里？",
      en: "What question brings you here today?",
    },
    sub: {
      zh: "选择一个更靠近你此刻的问题，右侧会立即出现图书馆的回应；如果暂时说不清，我们会先从认识自己开始。",
      en: "Pick the question closest to you right now — the library's response appears at the side. If you can't put it into words yet, we start by helping you meet yourself.",
    },
    picked: { zh: "你选择了", en: "You picked" },
    default: { zh: "默认起点", en: "Default starting point" },
    responseTitle: { zh: "命运图书馆可以陪你看：", en: "The library can read this with you:" },
    sampleTitle: { zh: "样例节选", en: "Sample excerpt" },
    journeyTitle: { zh: "接下来会经过", en: "Your journey from here" },
    signedOutNote: {
      zh: "本次访问已记住这个问题；登录后我们会保存到你的图书馆。",
      en: "This choice is remembered for this visit; sign in and we'll save it to your library.",
    },
    signedInNote: {
      zh: "已保存到你的图书馆。",
      en: "Saved to your library.",
    },
    boundary: {
      zh: "免费包含综合解读中的对应章节；¥79 高级 AI 深度报告解锁 24 章完整版本。",
      en: "Free includes the matching chapter in the panorama; the ¥79 premium report unlocks the full 24-chapter version.",
    },
  };

  const journeyStages = useMemo(
    () => [
      { zh: "你现在的问题", en: "Your question now" },
      { zh: "登记出生资料", en: "Register birth details" },
      { zh: `优先打开【${rec.chip.zh}】阅读`, en: `Open «${rec.chip.en}» first` },
      { zh: "可继续全景与年度报告", en: "Continue to panorama & yearly report" },
    ],
    [rec],
  );

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

            <div className="mt-6">
              <h3 className="font-serif text-sm uppercase tracking-[0.18em] text-amber-200/70">
                {H.responseTitle[lang]}
              </h3>
              <ul className="mt-3 space-y-2">
                {rec.featureBullets[lang].map((b, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-amber-100/85">
                    <span
                      aria-hidden
                      className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-300/70"
                    />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 rounded-lg border border-amber-100/10 bg-black/25 p-4">
              <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-amber-200/60">
                {H.sampleTitle[lang]}
              </div>
              <p className="text-[13.5px] italic leading-relaxed text-amber-100/80">
                {rec.sampleOutput[lang]}
              </p>
            </div>

            <div className="mt-6">
              <div className="text-[11px] uppercase tracking-[0.22em] text-amber-200/60">
                {H.journeyTitle[lang]}
              </div>
              <ol className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-amber-100/75">
                {journeyStages.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {i > 0 ? (
                      <span aria-hidden className="text-amber-300/50">
                        →
                      </span>
                    ) : null}
                    <span
                      className={
                        i === 0
                          ? "rounded-full border border-amber-300/60 bg-amber-500/10 px-2 py-0.5 text-amber-100"
                          : ""
                      }
                    >
                      {s[lang]}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-5 text-[11px] leading-snug text-amber-100/50">{H.boundary[lang]}</p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[12px] leading-snug text-amber-100/55">
                {rec.nextStepHint[lang]}
                {!isDerivedDefault ? (
                  <div className="mt-1 text-amber-100/40">
                    {isSignedIn ? H.signedInNote[lang] : H.signedOutNote[lang]}
                  </div>
                ) : null}
              </div>
              <Link
                to={ctaHref}
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-6 text-sm font-medium text-black shadow-[0_10px_30px_rgba(251,191,36,0.25)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                {rec.ctaLabel[lang]}
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default ConcernSelector;
