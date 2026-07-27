import { useCallback, useEffect, useId, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { useLang } from "@/lib/i18n";
import {
  ONBOARDING_INTENTS,
  curatorLetter,
  isOnboardingIntent,
  type OnboardingIntent,
} from "@/lib/life-guidance-v1";
import {
  getLifeGuidancePrefs,
  setOnboardingIntent as setOnboardingIntentFn,
} from "@/lib/life-guidance.functions";
import { supabase } from "@/integrations/supabase/client";

// Assets live under `public/assets/life-guidance/` and are served at the
// same URL path in dev and prod. See docs/assets.md.
const heroPng = "/assets/life-guidance/destiny-library-hero.png";
const heroWebp = "/assets/life-guidance/destiny-library-hero.webp";
const heroMobileWebp = "/assets/life-guidance/destiny-library-hero-mobile.webp";


/**
 * CuratorLetter — an immersive multi-page opening ritual for the landing
 * page. Replaces the earlier text-in-a-card. Four short pages, wax-seal
 * open, intent picker on page 3, twin doors on page 4. Fully skippable.
 *
 * Interaction state machine (see curator-letter.test.ts):
 *   sealed → page(1..4) → done
 *   any state → skipped (via "跳过序言")
 *
 * Persistence:
 *   - Signed-in: intent persists to public.user_preferences via server fn.
 *   - Signed-out: intent kept in sessionStorage (this visit only).
 *   - Return visitors: default to folded "book spine" (revisit) — one tap
 *     re-opens the ritual.
 */

const LOCAL_INTENT_KEY = "dl.curator.intent.v1";
const LOCAL_SEEN_KEY = "dl.curator.seen.v1";
const TOTAL_PAGES = 4;

type Stage =
  | { kind: "folded" }
  | { kind: "sealed" }
  | { kind: "page"; index: 1 | 2 | 3 | 4 }
  | { kind: "done" };

type Action =
  | { type: "open" }
  | { type: "next" }
  | { type: "prev" }
  | { type: "skip" }
  | { type: "fold" }
  | { type: "reopen" };

function reducer(state: Stage, action: Action): Stage {
  switch (action.type) {
    case "open":
      return { kind: "sealed" };
    case "reopen":
      return { kind: "sealed" };
    case "next": {
      if (state.kind === "sealed") return { kind: "page", index: 1 };
      if (state.kind === "page") {
        const nx = state.index + 1;
        if (nx > TOTAL_PAGES) return { kind: "done" };
        return { kind: "page", index: nx as 1 | 2 | 3 | 4 };
      }
      return state;
    }
    case "prev": {
      if (state.kind === "page" && state.index > 1) {
        return { kind: "page", index: (state.index - 1) as 1 | 2 | 3 | 4 };
      }
      if (state.kind === "done") return { kind: "page", index: 4 };
      return state;
    }
    case "skip":
      return { kind: "done" };
    case "fold":
      return { kind: "folded" };
  }
}

function useHasSession() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setSignedIn(Boolean(data.session));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSignedIn(Boolean(s));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return signedIn;
}

function readLocalIntent(): OnboardingIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.sessionStorage.getItem(LOCAL_INTENT_KEY);
    return isOnboardingIntent(v) ? v : null;
  } catch {
    return null;
  }
}

function writeLocalIntent(intent: OnboardingIntent) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(LOCAL_INTENT_KEY, intent);
  } catch {
    /* ignore quota */
  }
}

function readSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(LOCAL_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function CuratorLetter() {
  const { lang } = useLang();
  const copy = curatorLetter[lang];
  const reduceMotion = useReducedMotion();

  // Initial stage is ALWAYS "sealed" so SSR and the very first client
  // render agree on a fully-renderable stage (folded also renders safely
  // but was previously gated on `hydrated`, which caused pre-hydration
  // renders to fall through to the ritual body with pageIndex=0 and
  // crash on `copy.pages[-1].title`). On hydration, returning viewers
  // fold the letter and first-time viewers stay on the sealed cover.
  const [stage, dispatch] = useReducer(reducer, { kind: "sealed" as const });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (readSeen()) dispatch({ type: "fold" });
  }, []);

  useEffect(() => {
    if (stage.kind === "done") writeSeen();
  }, [stage.kind]);

  const isSignedIn = useHasSession();

  const [intent, setIntent] = useState<OnboardingIntent | null>(null);
  const [intentSaved, setIntentSaved] = useState<"idle" | "cloud" | "local">(
    "idle",
  );

  const getPrefsFn = useServerFn(getLifeGuidancePrefs);
  const saveIntentFn = useServerFn(setOnboardingIntentFn);

  // Load persisted intent when signed in; else local fallback.
  useEffect(() => {
    if (isSignedIn === null) return;
    if (!isSignedIn) {
      const local = readLocalIntent();
      if (local) {
        setIntent(local);
        setIntentSaved("local");
      }
      return;
    }
    let cancelled = false;
    getPrefsFn()
      .then((row) => {
        if (cancelled) return;
        const v = row?.onboarding_intent;
        if (isOnboardingIntent(v)) {
          setIntent(v);
          setIntentSaved("cloud");
        } else {
          const local = readLocalIntent();
          if (local) {
            // migrate local → cloud on first login, best-effort.
            setIntent(local);
            saveIntentFn({ data: { intent: local } })
              .then(() => setIntentSaved("cloud"))
              .catch(() => setIntentSaved("local"));
          }
        }
      })
      .catch(() => {
        const local = readLocalIntent();
        if (local) {
          setIntent(local);
          setIntentSaved("local");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, getPrefsFn, saveIntentFn]);

  const chooseIntent = useCallback(
    async (next: OnboardingIntent) => {
      setIntent(next);
      writeLocalIntent(next);
      if (isSignedIn) {
        try {
          await saveIntentFn({ data: { intent: next } });
          setIntentSaved("cloud");
          return;
        } catch {
          /* fall through */
        }
      }
      setIntentSaved("local");
    },
    [isSignedIn, saveIntentFn],
  );

  // Keyboard: Enter/Space advances a page when the region is focused,
  // Esc skips. Focus is managed on the container.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (stage.kind === "folded" || stage.kind === "done") return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      dispatch({ type: "next" });
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      dispatch({ type: "prev" });
    } else if (e.key === "Escape") {
      e.preventDefault();
      dispatch({ type: "skip" });
    }
  };

  const headingId = useId();

  // Folded "book spine" state — one line + revisit button. Rendered once
  // the ritual has been finished or on returning sessions.
  if (stage.kind === "folded") {
    return (
      <section
        id="curator-letter"
        aria-labelledby={headingId}
        className="relative z-10 mx-auto max-w-4xl px-6 py-16 md:px-12"
      >
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-500/20 bg-black/40 p-5 md:flex-row md:items-center md:justify-between md:p-6">
          <div>
            <div
              id={headingId}
              className="text-[10px] uppercase tracking-[0.38em] text-amber-300/70"
            >
              {copy.kicker}
            </div>
            <p className="mt-2 text-sm text-amber-100/70">{copy.revisitHint}</p>
          </div>
          <button
            type="button"
            onClick={() => dispatch({ type: "reopen" })}
            className="min-h-11 rounded-full border border-amber-400/40 px-5 py-2 text-[11px] uppercase tracking-[0.28em] text-amber-200 hover:border-amber-300 hover:bg-amber-500/10"
          >
            {copy.revisitOpen}
          </button>
        </div>
      </section>
    );
  }

  // Done state — inline twin doors + safety, no further ritual chrome.
  if (stage.kind === "done") {
    return (
      <section
        id="curator-letter"
        aria-labelledby={headingId}
        className="relative z-10 mx-auto max-w-4xl px-6 py-16 md:px-12"
      >
        <div className="rounded-2xl border border-amber-500/25 bg-black/45 p-6 md:p-8">
          <div
            id={headingId}
            className="text-[10px] uppercase tracking-[0.38em] text-amber-300/70"
          >
            {copy.seal}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/ritual"
              className="min-h-11 rounded-full bg-amber-400 px-6 py-3 text-xs font-medium uppercase tracking-[0.3em] text-black hover:bg-amber-300"
            >
              {copy.doorSelf}
            </Link>
            <a
              href="#traditions"
              className="min-h-11 rounded-full border border-amber-400/40 px-6 py-3 text-xs uppercase tracking-[0.28em] text-amber-200 hover:border-amber-300 hover:bg-amber-500/10"
            >
              {copy.doorPeers}
            </a>
            <button
              type="button"
              onClick={() => dispatch({ type: "fold" })}
              className="min-h-11 rounded-full border border-amber-400/20 px-4 py-3 text-[11px] uppercase tracking-[0.28em] text-amber-200/70 hover:border-amber-300"
            >
              {copy.closeCta}
            </button>
          </div>
          <p className="mt-6 text-[10px] uppercase tracking-[0.28em] text-amber-100/40">
            {copy.safety}
          </p>
        </div>
      </section>
    );
  }

  // Active ritual — sealed or page 1..4.
  const pageIndex =
    stage.kind === "page" ? stage.index : stage.kind === "sealed" ? 0 : 0;

  return (
    <section
      id="curator-letter"
      aria-labelledby={headingId}
      className="relative z-10 mx-auto max-w-6xl px-4 py-16 md:px-8 md:py-24"
    >
      <div
        ref={rootRef}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        role="region"
        aria-roledescription="Curator's opening letter"
        className="relative overflow-hidden rounded-[1.75rem] border border-amber-400/25 shadow-[0_30px_120px_-40px_rgba(0,0,0,0.8)] focus:outline-none"
      >
        {/* Library scene — responsive background with dark scrim */}
        <picture>
          <source
            media="(max-width: 720px)"
            type="image/webp"
            srcSet={heroMobileWebp}
          />
          <source type="image/webp" srcSet={heroWebp} />
          <img
            src={heroPng}
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            decoding="async"
            width={1823}
            height={863}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[center_35%] md:object-center"
          />
        </picture>
        {/* readability scrim — charcoal / walnut / never wide purple */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.35)_0%,rgba(6,4,2,0.72)_55%,rgba(0,0,0,0.9)_100%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70"
        />

        {/* content */}
        <div className="relative z-10 flex min-h-[560px] flex-col justify-between px-5 py-10 sm:px-8 md:min-h-[640px] md:px-16 md:py-16">
          {/* header row */}
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div
              id={headingId}
              className="text-[10px] uppercase tracking-[0.42em] text-amber-300/80"
            >
              {copy.kicker}
            </div>
            <button
              type="button"
              onClick={() => dispatch({ type: "skip" })}
              className="min-h-11 rounded-full border border-amber-400/25 px-4 py-2 text-[11px] uppercase tracking-[0.26em] text-amber-200/70 hover:border-amber-300 hover:text-amber-100"
              data-testid="curator-skip"
            >
              {copy.skipCta}
            </button>
          </div>

          {/* stage body */}
          <div className="my-8 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              {stage.kind === "sealed" ? (
                <SealedStage
                  key="sealed"
                  copy={copy}
                  reduceMotion={!!reduceMotion}
                  onOpen={() => dispatch({ type: "next" })}
                />
              ) : (
                <PageStage
                  key={`page-${pageIndex}`}
                  index={pageIndex as 1 | 2 | 3 | 4}
                  copy={copy}
                  reduceMotion={!!reduceMotion}
                  intent={intent}
                  intentSaved={intentSaved}
                  onChooseIntent={chooseIntent}
                  onNext={() => dispatch({ type: "next" })}
                  onPrev={() => dispatch({ type: "prev" })}
                />
              )}
            </AnimatePresence>
          </div>

          {/* footer — safety, always visible */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.28em] text-amber-100/50">
            <span>{copy.safety}</span>
            {stage.kind === "page" ? (
              <span data-testid="curator-page-of">
                {copy.pageOf(stage.index, TOTAL_PAGES)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function SealedStage({
  copy,
  reduceMotion,
  onOpen,
}: {
  copy: (typeof curatorLetter)["en"];
  reduceMotion: boolean;
  onOpen: () => void;
}) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
      transition={{ duration: reduceMotion ? 0.15 : 0.7, ease: [0.32, 0.72, 0, 1] }}
      className="flex h-full flex-col items-center justify-center text-center"
    >
      <div className="mx-auto max-w-2xl">
        <p className="mb-4 text-[11px] uppercase tracking-[0.4em] text-amber-200/70">
          {copy.intro[1]}
        </p>
        <h2 className="font-serif text-3xl italic leading-tight text-amber-50 md:text-5xl">
          {copy.intro[0]}
        </h2>
      </div>

      {/* wax-sealed letter button */}
      <motion.button
        type="button"
        onClick={onOpen}
        aria-label={copy.openCta}
        whileHover={reduceMotion ? undefined : { scale: 1.03 }}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        className="group relative mt-10 inline-flex items-center gap-4 rounded-full border border-amber-400/50 bg-black/50 px-8 py-4 text-[11px] uppercase tracking-[0.3em] text-amber-200 shadow-[0_10px_40px_-10px_rgba(212,175,55,0.35)] hover:border-amber-300 hover:text-amber-100"
        data-testid="curator-open"
      >
        <span
          aria-hidden
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-700 via-red-800 to-red-950 text-[10px] font-serif italic text-amber-100 shadow-[inset_0_0_6px_rgba(0,0,0,0.55)] ring-1 ring-red-950/80"
        >
          ✦
        </span>
        <span>{copy.openCta}</span>
      </motion.button>
      <p className="mt-4 text-[10px] uppercase tracking-[0.28em] text-amber-100/40">
        {copy.seal}
      </p>
    </motion.div>
  );
}

function PageStage({
  index,
  copy,
  reduceMotion,
  intent,
  intentSaved,
  onChooseIntent,
  onNext,
  onPrev,
}: {
  index: 1 | 2 | 3 | 4;
  copy: (typeof curatorLetter)["en"];
  reduceMotion: boolean;
  intent: OnboardingIntent | null;
  intentSaved: "idle" | "cloud" | "local";
  onChooseIntent: (v: OnboardingIntent) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const page = copy.pages[index - 1];
  return (
    <motion.article
      initial={
        reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: 12, y: 10 }
      }
      animate={{ opacity: 1, rotateY: 0, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, rotateY: -12, y: -10 }}
      transition={{ duration: reduceMotion ? 0.15 : 0.55, ease: [0.32, 0.72, 0, 1] }}
      className="mx-auto max-w-[58ch]"
      data-testid={`curator-page-${index}`}
      style={{ perspective: 1400 }}
    >
      <div className="rounded-2xl border border-amber-300/15 bg-[rgba(28,20,10,0.55)] p-6 backdrop-blur-[2px] md:p-10">
        <p className="text-[10px] uppercase tracking-[0.4em] text-amber-200/60">
          {copy.pageOf(index, TOTAL_PAGES)}
        </p>
        <h3 className="mt-3 font-serif text-2xl italic leading-snug text-amber-50 md:text-4xl">
          {page.title}
        </h3>
        <div className="mt-5 space-y-4 font-serif text-[17px] leading-[1.75] text-amber-50/85 md:text-lg">
          {page.body.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>

        {index === 3 ? (
          <IntentPicker
            copy={copy}
            intent={intent}
            intentSaved={intentSaved}
            onChoose={onChooseIntent}
          />
        ) : null}

        {index === 4 ? (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              to="/ritual"
              className="min-h-11 rounded-full bg-amber-400 px-6 py-3 text-center text-xs font-medium uppercase tracking-[0.3em] text-black hover:bg-amber-300"
            >
              {copy.doorSelf}
            </Link>
            <a
              href="#traditions"
              className="min-h-11 rounded-full border border-amber-400/50 px-6 py-3 text-center text-xs uppercase tracking-[0.28em] text-amber-200 hover:border-amber-300 hover:bg-amber-500/10"
            >
              {copy.doorPeers}
            </a>
          </div>
        ) : null}
      </div>

      {/* nav */}
      <div className="mt-6 flex items-center justify-between text-xs text-amber-200/75">
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 1}
          className="min-h-11 rounded-full border border-amber-400/25 px-4 py-2 text-[11px] uppercase tracking-[0.26em] disabled:opacity-30"
        >
          ←
        </button>
        {index < 4 ? (
          <button
            type="button"
            onClick={onNext}
            className="min-h-11 rounded-full border border-amber-300/60 bg-amber-500/10 px-6 py-2 text-[11px] uppercase tracking-[0.3em] text-amber-100 hover:bg-amber-500/20"
            data-testid="curator-next"
          >
            {copy.continueCta} →
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="min-h-11 rounded-full bg-amber-400 px-6 py-2 text-[11px] uppercase tracking-[0.3em] text-black hover:bg-amber-300"
            data-testid="curator-finish"
          >
            {copy.closeCta}
          </button>
        )}
      </div>
    </motion.article>
  );
}

function IntentPicker({
  copy,
  intent,
  intentSaved,
  onChoose,
}: {
  copy: (typeof curatorLetter)["en"];
  intent: OnboardingIntent | null;
  intentSaved: "idle" | "cloud" | "local";
  onChoose: (v: OnboardingIntent) => void;
}) {
  return (
    <div
      className="mt-8 rounded-xl border border-amber-300/20 bg-black/35 p-5"
      data-testid="curator-intent"
    >
      <div className="text-[10px] uppercase tracking-[0.32em] text-amber-200/70">
        {copy.intentKicker}
      </div>
      <p className="mt-2 font-serif text-lg italic text-amber-50">
        {copy.intentPrompt}
      </p>
      <div
        role="radiogroup"
        aria-label={copy.intentPrompt}
        className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {ONBOARDING_INTENTS.map((k) => {
          const active = intent === k;
          const o = copy.intentOptions[k];
          return (
            <button
              key={k}
              role="radio"
              type="button"
              aria-checked={active}
              onClick={() => onChoose(k)}
              data-testid={`curator-intent-${k}`}
              className={`min-h-11 rounded-lg border px-4 py-3 text-left transition ${
                active
                  ? "border-amber-300 bg-amber-400/15 text-amber-100"
                  : "border-amber-400/25 text-amber-200/85 hover:border-amber-300 hover:bg-amber-500/5"
              }`}
            >
              <div className="text-sm font-semibold">{o.label}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-amber-100/70">
                {o.hint}
              </div>
            </button>
          );
        })}
      </div>
      {intent ? (
        <p
          className="mt-3 text-[11px] text-amber-200/70"
          data-testid="curator-intent-saved"
        >
          {intentSaved === "cloud" ? copy.intentSavedCloud : copy.intentSavedLocal}
        </p>
      ) : null}
    </div>
  );
}
