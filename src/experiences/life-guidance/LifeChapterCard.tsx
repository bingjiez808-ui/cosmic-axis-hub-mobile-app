import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import {
  LIFE_STAGES,
  chapterCopy,
  computeAge,
  defaultStageForAge,
  domainAction,
  pickPriorityDomain,
  stageCopy,
  type DomainKey,
  type LifeStage,
} from "@/lib/life-guidance-v1";
import { useLang } from "@/lib/i18n";
import {
  getLifeGuidancePrefs,
  setLifeStage as setLifeStageFn,
} from "@/lib/life-guidance.functions";

export type LifeChapterCardProps = {
  /** Primary chart birth date, ISO `YYYY-MM-DD`. When missing, we render an empty state. */
  primaryBirthDate: string | null | undefined;
  /** Today's ISO date in the viewer's timezone (e.g. `2026-07-27`). */
  todayISO: string;
  /**
   * Domain scores from daily-domain-score-v2 (with `domain` and `score`).
   * Used to pick the "priority domain" for today's tailored action.
   */
  domainScores: ReadonlyArray<{ domain: string; score: number }>;
  /** Optional label overrides for the 5 domain names. */
  domainLabels?: Partial<Record<DomainKey, string>>;
};

/**
 * Deterministic, 0-AI life-chapter card. Age is computed from the primary
 * chart's birth date, then mapped to a default stage. Users can override
 * the stage and the choice persists to public.user_preferences. All copy
 * comes from the pure life-guidance-v1 module.
 */
export function LifeChapterCard({
  primaryBirthDate,
  todayISO,
  domainScores,
  domainLabels,
}: LifeChapterCardProps) {
  const { lang } = useLang();
  const copy = chapterCopy[lang];

  const age = computeAge(primaryBirthDate ?? null, todayISO);
  const defaultStage = defaultStageForAge(age);
  const priority = pickPriorityDomain(domainScores);

  const [stage, setStage] = useState<LifeStage | null>(defaultStage);
  const [source, setSource] = useState<"auto" | "user">("auto");
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<null | "ok" | "err">(null);
  const [busy, setBusy] = useState(false);

  const getPrefs = useServerFn(getLifeGuidancePrefs);
  const savePref = useServerFn(setLifeStageFn);

  // Load persisted preference. If none, the age-derived default stands.
  useEffect(() => {
    let cancelled = false;
    getPrefs()
      .then((row) => {
        if (cancelled) return;
        if (
          row?.life_stage &&
          (LIFE_STAGES as readonly string[]).includes(row.life_stage)
        ) {
          setStage(row.life_stage as LifeStage);
          setSource(row.life_stage_source ?? "user");
        }
      })
      .catch(() => {
        /* keep default */
      });
    return () => {
      cancelled = true;
    };
  }, [getPrefs]);

  // If user hasn't overridden and birth-date-derived default changes, follow it.
  useEffect(() => {
    if (source === "user") return;
    if (defaultStage && stage !== defaultStage) setStage(defaultStage);
  }, [defaultStage, source, stage]);

  if (!primaryBirthDate) {
    return (
      <section
        aria-label={copy.kicker}
        className="mb-8 rounded-xl border border-amber-400/25 bg-gradient-to-br from-black/50 via-black/40 to-purple-950/20 p-6"
        data-testid="life-chapter-card-empty"
      >
        <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
          {copy.kicker}
        </div>
        <h3 className="mt-2 font-serif text-2xl text-amber-100">{copy.emptyTitle}</h3>
        <p className="mt-2 text-sm text-amber-100/70">{copy.emptyBody}</p>
        <Link
          to="/ritual"
          search={{ returnTo: "/me/home" }}
          className="mt-4 inline-flex min-h-11 rounded-full border border-amber-300/60 bg-amber-500/10 px-4 py-2 text-sm text-amber-100 hover:bg-amber-500/20"
        >
          {copy.emptyCta}
        </Link>
      </section>
    );
  }

  if (!stage) return null;

  const sc = stageCopy(stage, lang);
  const act = domainAction(stage, priority, lang);
  const priorityLabel = priority
    ? domainLabels?.[priority] ?? priority
    : null;

  const onSaveStage = async (next: LifeStage) => {
    setBusy(true);
    setSaved(null);
    try {
      await savePref({ data: { stage: next, source: "user" } });
      setStage(next);
      setSource("user");
      setEditing(false);
      setSaved("ok");
    } catch {
      setSaved("err");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label={copy.kicker}
      className="mb-8 rounded-xl border border-amber-400/25 bg-gradient-to-br from-black/60 via-black/45 to-purple-950/25 p-6 md:p-7"
      data-testid="life-chapter-card"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
            {copy.kicker}
          </div>
          <h3 className="mt-1 font-serif text-2xl text-amber-100 md:text-3xl">
            {sc.label}
          </h3>
          <div className="mt-1 text-xs text-amber-200/60">
            {age != null ? copy.ageLine(age) : copy.ageUnknown} · {sc.ageHint}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="min-h-9 rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-200/80 transition hover:border-amber-300 hover:text-amber-100"
        >
          {editing ? copy.cancel : copy.changeStage}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {editing ? (
          <motion.div
            key="edit"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-4 overflow-hidden"
          >
            <div className="mb-2 text-xs text-amber-200/70">{copy.chooseStage}</div>
            <div className="flex flex-wrap gap-2">
              {LIFE_STAGES.map((s) => {
                const label = stageCopy(s, lang).label;
                const isActive = s === stage;
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() => onSaveStage(s)}
                    aria-pressed={isActive}
                    className={`min-h-11 rounded-full border px-4 py-2 text-xs transition disabled:opacity-50 ${
                      isActive
                        ? "border-amber-300 bg-amber-300/10 text-amber-100"
                        : "border-amber-400/30 text-amber-200/80 hover:border-amber-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {saved === "ok" ? (
              <div className="mt-2 text-[11px] text-emerald-300/80">{copy.saved}</div>
            ) : null}
            {saved === "err" ? (
              <div className="mt-2 text-[11px] text-rose-300/80">{copy.savedLocal}</div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <p className="mt-5 font-serif text-lg italic leading-relaxed text-amber-50/90 md:text-xl">
        {sc.resonance}
      </p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-amber-400/15 bg-black/25 p-4">
          <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
            {copy.lessonLabel}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/85">{sc.lesson}</p>
        </div>
        <div className="rounded-lg border border-amber-400/15 bg-black/25 p-4">
          <div className="text-[11px] uppercase tracking-widest text-amber-200/70">
            {copy.peerLabel}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-amber-100/85">{sc.peerReframe}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/5 p-4">
          <div className="text-[11px] uppercase tracking-widest text-emerald-200/80">
            {copy.actionLabel}
            {priorityLabel ? (
              <span className="ml-2 text-emerald-100/60">· {priorityLabel}</span>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-emerald-50/90">{act.action}</p>
        </div>
        <div className="rounded-lg border border-amber-400/25 bg-amber-500/5 p-4">
          <div className="text-[11px] uppercase tracking-widest text-amber-200/80">
            {copy.cautionLabel}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-amber-50/90">{act.caution}</p>
        </div>
      </div>
    </section>
  );
}
