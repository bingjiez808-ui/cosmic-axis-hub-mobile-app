/**
 * ConcernSelector — "带着我的问题开始阅读" homepage module.
 *
 * Renders seven concern chips. After a pick, expands an in-place
 * "response book page" with situational text, feature bullets, a
 * sample paragraph, and a CTA whose href is resolved by
 * `resolveConcernRoute` (safe against unsigned users and users
 * without a primary chart).
 *
 * 0 AI. Every string is a deterministic literal from
 * `src/lib/concern-guidance-v1.ts`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
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

type Props = {
  /**
   * Whether the current session has a primary chart. Provided by the
   * landing page after querying `charts`. Optional; defaults to false
   * so unauthenticated visitors go through /ritual.
   */
  hasPrimaryChart?: boolean;
  /**
   * Optional existing report id for signed-in users who already have
   * a completed premium report. When present the CTA jumps directly
   * to /report?id=…&focus=<section>.
   */
  existingReportId?: string | null;
};

export function ConcernSelector({
  hasPrimaryChart = false,
  existingReportId = null,
}: Props) {
  const { lang } = useLang();
  const session = useSupabaseSession();
  const isSignedIn = !!session?.user?.id;
  const saveConcern = useServerFn(setConcernFn);

  const [picked, setPicked] = useState<ConcernKey | null>(null);

  // On mount, restore any locally remembered choice so that the response
  // stays visible after a soft refresh. We do NOT auto-scroll into view.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(CONCERN_STORAGE_KEY);
      if (isConcernKey(stored)) setPicked(stored);
    } catch {
      /* private mode etc */
    }
  }, []);

  const onPick = useCallback(
    (k: ConcernKey) => {
      setPicked(k);
      try {
        window.sessionStorage.setItem(CONCERN_STORAGE_KEY, k);
      } catch {
        /* ignore */
      }
      // Persist to cloud when signed in — silent, optimistic.
      if (isSignedIn) {
        saveConcern({ data: { concern: k } }).catch(() => {
          /* keep local pick */
        });
      }
    },
    [isSignedIn, saveConcern],
  );

  const rec = picked ? CONCERNS[picked] : null;
  const ctaHref = useMemo(() => {
    if (!picked) return null;
    return resolveConcernRoute({
      concern: picked,
      isSignedIn,
      hasPrimaryChart,
      existingReportId,
    });
  }, [picked, isSignedIn, hasPrimaryChart, existingReportId]);

  const H = {
    heading: {
      zh: "今天你带着什么问题来到这里？",
      en: "What question brings you here today?",
    },
    sub: {
      zh: "选一个更靠近你此刻的问题；你可以随时更换。这个选择只影响阅读入口和文案，不改变命盘计算。",
      en: "Pick the one closest to you right now — you can change it any time. This only shapes the reading entry point, never the chart calculation.",
    },
    responseTitle: { zh: "命运图书馆可以陪你看：", en: "The library can read this with you:" },
    sampleTitle: { zh: "样例节选", en: "Sample excerpt" },
    signedOutNote: {
      zh: "本次访问已记住这个问题；登录后我们会保存到你的图书馆。",
      en: "This choice is remembered for this visit; sign in and we'll save it to your library.",
    },
    signedInNote: {
      zh: "已保存到你的图书馆。",
      en: "Saved to your library.",
    },
  };

  return (
    <section
      aria-labelledby="concern-heading"
      className="mx-auto w-full max-w-5xl px-5 py-16 sm:py-20"
    >
      <div className="mb-8 text-center">
        <h2
          id="concern-heading"
          className="font-serif text-2xl leading-tight text-amber-100/95 sm:text-3xl"
        >
          {H.heading[lang]}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-amber-100/60 sm:text-base">
          {H.sub[lang]}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label={H.heading[lang]}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
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
              <div className="font-serif text-[15px] leading-snug">
                {CONCERNS[k].chip[lang]}
              </div>
              <div className="mt-1 text-[12px] leading-snug text-amber-100/55">
                {CONCERNS[k].question[lang]}
              </div>
            </button>
          );
        })}
      </div>

      {rec && ctaHref && (
        <article
          aria-live="polite"
          className="mt-8 rounded-xl border border-amber-100/15 bg-gradient-to-b from-[#1a120a]/85 to-[#0e0a06]/85 p-6 shadow-[0_18px_60px_rgba(0,0,0,0.55)] sm:p-8"
        >
          <p className="font-serif text-base leading-relaxed text-amber-50/95 sm:text-lg">
            {rec.situationalResponse[lang]}
          </p>

          <div className="mt-6">
            <h3 className="font-serif text-sm uppercase tracking-[0.18em] text-amber-200/70">
              {H.responseTitle[lang]}
            </h3>
            <ul className="mt-3 space-y-2">
              {rec.featureBullets[lang].map((b, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-sm leading-relaxed text-amber-100/85"
                >
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-300/70" />
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

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[12px] leading-snug text-amber-100/55">
              {rec.nextStepHint[lang]}
              <div className="mt-1 text-amber-100/40">
                {isSignedIn ? H.signedInNote[lang] : H.signedOutNote[lang]}
              </div>
            </div>
            <Link
              to={ctaHref}
              className="inline-flex min-h-[48px] items-center justify-center rounded-lg bg-gradient-to-r from-amber-300 to-amber-500 px-6 text-sm font-medium text-black shadow-[0_10px_30px_rgba(251,191,36,0.25)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              {rec.ctaLabel[lang]}
            </Link>
          </div>
        </article>
      )}
    </section>
  );
}

export default ConcernSelector;
