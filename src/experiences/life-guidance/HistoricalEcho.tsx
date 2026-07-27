import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";

import { useLang } from "@/lib/i18n";
import {
  echoCopy,
  echoCoverageBanner,
  echoReasonHeading,
  figureSourceLabel,
  normalizeLang,
  recommendFigures,
  type DomainKey,
  type DomainSignalBand,
  type FigureRecommendation,
  type HistoricalFigure,
  type LifeStage,
} from "@/lib/life-guidance-v1";
import {
  getLifeResponse,
  listLifeBookmarks,
  saveLifeResponse,
  toggleLifeBookmark,
} from "@/lib/life-guidance.functions";

export type HistoricalEchoProps = {
  stage: LifeStage | null;
  domain: DomainKey | null;
  /** Today's picked concern (from concern-guidance-v1). */
  concern?: string | null;
  /** Today's priority-domain signal band. */
  domainSignal?: DomainSignalBand | null;
  /** Localized label for today's priority domain (e.g. "事业"). */
  domainLabel?: string | null;
  /**
   * When set, expands the deck on first render — used by focus=peers
   * deep-links so the traveller doesn't have to guess which card holds
   * "same-age peers". Only fires once per mount.
   */
  initialExpanded?: boolean;
};

/**
 * "Historical Echoes" — collapsible biography deck. Matches by the
 * user's current chapter (stage) and today's priority domain. Every
 * card supports two persistent user actions: bookmark ("dog-ear the
 * page") and written response ("write in the margin"). Both save to
 * the signed-in user's private tables.
 */
export function HistoricalEcho({
  stage,
  domain,
  concern,
  domainSignal,
  domainLabel,
  initialExpanded,
}: HistoricalEchoProps) {
  const { lang } = useLang();
  const nlang = normalizeLang(lang);
  const copy = echoCopy[nlang];
  const bannerCopy = echoCoverageBanner[nlang];
  const reasonHeading = echoReasonHeading[nlang];

  const recs: FigureRecommendation[] = useMemo(
    () =>
      stage
        ? recommendFigures({
            stage,
            concern: concern ?? null,
            domain: domain ?? null,
            domainSignal: domainSignal ?? null,
            domainLabel: domainLabel ?? null,
          })
        : [],
    [stage, concern, domain, domainSignal, domainLabel],
  );
  const list = useMemo(() => recs.map((r) => r.figure), [recs]);
  const stageOnly = recs.length > 0 && recs.every((r) => r.matchLevel === "stage_only");
  const [expanded, setExpanded] = useState<boolean>(Boolean(initialExpanded));

  const [idx, setIdx] = useState(0);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [response, setResponse] = useState<string>("");
  const [savedResp, setSavedResp] = useState<"idle" | "ok" | "err" | "too_long">(
    "idle",
  );
  const [editing, setEditing] = useState(false);

  const listBookmarksFn = useServerFn(listLifeBookmarks);
  const toggleBookmarkFn = useServerFn(toggleLifeBookmark);
  const getResponseFn = useServerFn(getLifeResponse);
  const saveResponseFn = useServerFn(saveLifeResponse);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    listBookmarksFn()
      .then((rows) => {
        if (cancelled) return;
        setBookmarks(new Set(rows.map((r) => r.figure_key)));
      })
      .catch(() => {
        /* keep empty; UI still usable */
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, listBookmarksFn]);

  // Reset carousel when list identity changes.
  useEffect(() => {
    setIdx(0);
  }, [stage, domain, concern, domainSignal]);

  const current = list[idx] ?? null;
  const currentRec = recs[idx] ?? null;

  useEffect(() => {
    if (!expanded || !current) return;
    let cancelled = false;
    setResponse("");
    setSavedResp("idle");
    setEditing(false);
    getResponseFn({ data: { figureKey: current.key } })
      .then((row) => {
        if (cancelled) return;
        setResponse(row?.body ?? "");
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, current, getResponseFn]);


  if (!stage || list.length === 0) {
    return null;
  }

  const isBookmarked = current ? bookmarks.has(current.key) : false;

  const onBookmark = async () => {
    if (!current) return;
    const on = !isBookmarked;
    // optimistic
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (on) next.add(current.key);
      else next.delete(current.key);
      return next;
    });
    try {
      await toggleBookmarkFn({
        data: {
          figureKey: current.key,
          stage: stage ?? undefined,
          domain: domain ?? undefined,
          on,
        },
      });
    } catch {
      // revert
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (on) next.delete(current.key);
        else next.add(current.key);
        return next;
      });
    }
  };

  const onSaveResponse = async () => {
    if (!current) return;
    const body = response.trim();
    if (!body) return;
    if (body.length > 1200) {
      setSavedResp("too_long");
      return;
    }
    try {
      await saveResponseFn({
        data: {
          figureKey: current.key,
          stage: stage ?? undefined,
          domain: domain ?? undefined,
          body,
        },
      });
      setSavedResp("ok");
      setEditing(false);
    } catch {
      setSavedResp("err");
    }
  };

  return (
    <section
      id="historical-echo"
      aria-label={copy.title}
      className="relative mb-8 overflow-hidden rounded-xl border border-amber-500/25 bg-black/60 p-6 md:p-7 scroll-mt-24"
      data-testid="historical-echo"
    >

      {/* Gallery of arched niches — sits behind text with a soft scrim */}
      <picture aria-hidden="true">
        <source
          type="image/webp"
          media="(min-width: 720px)"
          srcSet="/assets/life-guidance/historical-echo-gallery.webp"
        />
        <source
          type="image/webp"
          srcSet="/assets/life-guidance/historical-echo-gallery-mobile.webp"
        />
        <img
          src="/assets/life-guidance/historical-echo-gallery.png"
          alt=""
          loading="lazy"
          decoding="async"
          width={1774}
          height={887}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center opacity-70"
        />
      </picture>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.65)_0%,rgba(0,0,0,0.5)_45%,rgba(0,0,0,0.85)_100%)]"
      />

      <div className="relative z-10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="historical-echo-body"
        className="flex w-full items-baseline justify-between text-left"
      >
        <div>
          <div className="text-[11px] uppercase tracking-widest text-amber-200/80">
            {copy.title}
          </div>
          <div className="mt-1 font-serif text-lg italic text-amber-50 md:text-xl">
            {copy.intro}
          </div>
        </div>
        <span
          className={`ml-4 inline-block text-amber-300/80 transition-transform duration-500 ${
            expanded ? "rotate-90" : ""
          }`}
          aria-hidden
        >
          →
        </span>
      </button>


      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id="historical-echo-body"
            key="body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <p className="mt-4 text-xs leading-relaxed text-amber-100/70">
              {copy.disclaimer}
            </p>

            {stageOnly ? (
              <div
                className="mt-4 rounded-md border border-amber-400/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-100/80"
                data-testid="historical-echo-coverage-banner"
              >
                <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
                  {bannerCopy.title}
                </div>
                <p className="mt-1">{bannerCopy.body}</p>
              </div>
            ) : null}


            <div className="mt-5 flex items-center justify-between text-xs text-amber-200/70">
              <button
                type="button"
                onClick={() =>
                  setIdx((i) =>
                    list.length > 0 ? (i - 1 + list.length) % list.length : 0,
                  )
                }
                className="min-h-9 rounded-full border border-amber-400/30 px-3 py-1 hover:border-amber-300"
              >
                ← {copy.prev}
              </button>
              <div>
                {list.length > 0 ? idx + 1 : 0} / {list.length}
              </div>
              <button
                type="button"
                onClick={() =>
                  setIdx((i) => (list.length > 0 ? (i + 1) % list.length : 0))
                }
                className="min-h-9 rounded-full border border-amber-400/30 px-3 py-1 hover:border-amber-300"
              >
                {copy.next} →
              </button>
            </div>

            {current ? (
              <FigureCard
                key={current.key}
                figure={current}
                recommendation={currentRec}
                lang={nlang}
                copy={copy}
                reasonHeading={reasonHeading}
                sourceLabel={figureSourceLabel[nlang]}
                bookmarked={isBookmarked}
                onBookmark={onBookmark}
                response={response}
                onResponseChange={(v) => {
                  setResponse(v);
                  setSavedResp("idle");
                }}
                editing={editing}
                onStartEdit={() => setEditing(true)}
                onCancelEdit={() => setEditing(false)}
                onSaveResponse={onSaveResponse}
                savedResp={savedResp}
              />
            ) : (
              <p className="mt-6 text-sm text-amber-100/70">{copy.empty}</p>
            )}


            <div className="mt-8 border-t border-amber-400/10 pt-4 text-xs leading-relaxed text-amber-100/70">
              <p>{copy.closeQuote1}</p>
              <p className="mt-2 font-serif italic text-amber-200/90">{copy.closeQuote2}</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      </div>
    </section>
  );
}


function FigureCard({
  figure,
  recommendation,
  lang,
  copy,
  reasonHeading,
  sourceLabel,
  bookmarked,
  onBookmark,
  response,
  onResponseChange,
  editing,
  onStartEdit,
  onCancelEdit,
  onSaveResponse,
  savedResp,
}: {
  figure: HistoricalFigure;
  recommendation: FigureRecommendation | null;
  lang: "en" | "zh";
  copy: (typeof echoCopy)["en"];
  reasonHeading: string;
  sourceLabel: string;
  bookmarked: boolean;
  onBookmark: () => void;
  response: string;
  onResponseChange: (v: string) => void;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveResponse: () => void;
  savedResp: "idle" | "ok" | "err" | "too_long";
}) {
  return (
    <article
      aria-label={copy.ariaGroup}
      className="mt-4 rounded-xl border border-amber-400/20 bg-black/35 p-5"
      data-testid={`figure-${figure.key}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h4 className="font-serif text-xl text-amber-100 md:text-2xl">
            {figure.name[lang]}
          </h4>
          <div className="mt-1 text-xs text-amber-200/60">{figure.era[lang]}</div>
        </div>
        <button
          type="button"
          onClick={onBookmark}
          aria-pressed={bookmarked}
          className={`min-h-9 rounded-full border px-3 py-1 text-xs transition ${
            bookmarked
              ? "border-amber-300 bg-amber-300/10 text-amber-100"
              : "border-amber-400/30 text-amber-200/80 hover:border-amber-300"
          }`}
        >
          {bookmarked ? copy.bookmarked : copy.bookmark}
        </button>
      </div>

      {recommendation && recommendation.reasons.length > 0 ? (
        <div
          className="mt-3"
          aria-label={reasonHeading}
          data-testid={`figure-reasons-${figure.key}`}
        >
          <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
            {reasonHeading}
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recommendation.reasons.map((r) => (
              <li
                key={r.key}
                className="rounded-full border border-amber-400/25 bg-amber-500/5 px-3 py-1 text-[11px] text-amber-100/85"
                data-reason-key={r.key}
              >
                {r.label[lang]}
              </li>
            ))}
          </ul>
        </div>
      ) : null}


      <dl className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label={copy.situationLabel} value={figure.situation[lang]} />
        <Field label={copy.tensionLabel} value={figure.tension[lang]} />
        <Field label={copy.choiceLabel} value={figure.choice[lang]} />
        <Field
          label={copy.borrowLabel}
          value={figure.borrow[lang]}
          tone="borrow"
        />
        <Field
          label={copy.dontCopyLabel}
          value={figure.dontCopy[lang]}
          tone="warn"
        />
      </dl>

      <div className="mt-5 border-t border-amber-400/10 pt-4">
        {!editing && !response ? (
          <button
            type="button"
            onClick={onStartEdit}
            className="min-h-9 rounded-full border border-purple-300/40 bg-purple-500/10 px-4 py-2 text-xs text-purple-100 hover:bg-purple-500/20"
          >
            {copy.respond}
          </button>
        ) : null}
        {!editing && response ? (
          <div>
            <div className="text-[11px] uppercase tracking-widest text-purple-200/70">
              {copy.respond}
            </div>
            <p className="mt-2 whitespace-pre-wrap rounded-md border border-purple-400/15 bg-black/30 p-3 text-sm text-amber-100/85">
              {response}
            </p>
            <button
              type="button"
              onClick={onStartEdit}
              className="mt-3 min-h-9 rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-200/80 hover:border-amber-300"
            >
              {copy.respond}
            </button>
          </div>
        ) : null}
        {editing ? (
          <div>
            <textarea
              value={response}
              onChange={(e) => onResponseChange(e.target.value)}
              maxLength={1400}
              placeholder={copy.respondPlaceholder}
              rows={5}
              className="w-full rounded-md border border-purple-400/25 bg-black/40 p-3 text-sm text-amber-100 outline-none focus:border-purple-300"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onSaveResponse}
                className="min-h-9 rounded-full bg-amber-400 px-4 py-2 text-xs font-medium text-black hover:bg-amber-300"
              >
                {copy.respondSave}
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="min-h-9 rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-200/80 hover:border-amber-300"
              >
                {copy.respondCancel}
              </button>
              <span className="text-[11px] text-amber-200/60">
                {response.length}/1200
              </span>
              {savedResp === "too_long" ? (
                <span className="text-[11px] text-rose-300/80">
                  {copy.respondTooLong}
                </span>
              ) : null}
              {savedResp === "err" ? (
                <span className="text-[11px] text-rose-300/80">{copy.savedLocal}</span>
              ) : null}
            </div>
          </div>
        ) : null}
        {savedResp === "ok" && !editing ? (
          <div className="mt-2 text-[11px] text-emerald-300/80">{copy.respondSaved}</div>
        ) : null}
      </div>
    </article>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "borrow" | "warn";
}) {
  const border =
    tone === "borrow"
      ? "border-emerald-400/25 bg-emerald-500/5"
      : tone === "warn"
      ? "border-rose-400/20 bg-rose-500/5"
      : "border-amber-400/15 bg-black/25";
  const labelClr =
    tone === "borrow"
      ? "text-emerald-200/80"
      : tone === "warn"
      ? "text-rose-200/80"
      : "text-amber-200/70";
  return (
    <div className={`rounded-md border ${border} p-3`}>
      <dt className={`text-[11px] uppercase tracking-widest ${labelClr}`}>{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-amber-100/85">{value}</dd>
    </div>
  );
}
