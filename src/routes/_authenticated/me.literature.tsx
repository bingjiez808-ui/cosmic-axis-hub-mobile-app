import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";
import { DailyRoomError } from "@/experiences/daily-room/fallback";
import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import {
  listUserCharts,
  type ChartRow,
} from "@/lib/reports-store.functions";
import {
  computeAge,
  defaultStageForAge,
  type LifeStage,
} from "@/lib/life-guidance-v1";
import { useLang } from "@/lib/i18n";
import {
  CONCERNS,
  TONES,
  stageToTag,
  stageLabel as stageLabelFor,
  type ConcernKey,
  type ToneKey,
} from "@/lib/literature-constants";
import {
  getLiteraturePreferences,
  saveLiteraturePreferences,
  recommendLiteraturePassage,
  toggleLiteratureBookmark,
  saveLiteratureAnnotation,
  type RecommendationRow,
} from "@/lib/literature.functions";
import {
  LiteratureShareCard,
  type ShareCardFormat,
  type ShareCardRatio,
} from "@/components/literature/LiteratureShareCard";

/**
 * /me/literature — 命运通识馆 · 语文馆 (Literature Hall).
 *
 * Flow:
 *  1. Auth-gated by _authenticated layout; if no primary chart, show
 *     onboarding CTA back to /ritual instead of an empty state.
 *  2. Step "concern" → user picks what they want to read about today
 *     (including "I can't say — just something").
 *  3. Step "tone" → reading temperament; auto-saved to preferences on
 *     first pick, editable later via the top-bar drawer.
 *  4. Step "bookmark" → the library "turns a page": deterministic
 *     DB-side ranking picks a passage, AI is never invoked to fabricate
 *     works or authors. "Turn another page" re-samples top-K from the
 *     same pool with a novelty penalty on the last 30 seen.
 */
export const Route = createFileRoute("/_authenticated/me/literature")({
  head: () => ({
    meta: [
      { title: "语文馆 · Personal Library" },
      { name: "description", content: "命运通识馆 · 语文馆：为你此刻的人生章节翻开一页。" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
  errorComponent: DailyRoomError,
  component: LiteratureHallPage,
});

type Step = "loading" | "no-chart" | "concern" | "tone" | "bookmark";

function LiteratureHallPage() {
  const { lang } = useLang();
  const isZh = lang === "zh";

  const loadCharts = useServerFn(listUserCharts);
  const loadPrefs = useServerFn(getLiteraturePreferences);
  const savePrefs = useServerFn(saveLiteraturePreferences);
  const recommend = useServerFn(recommendLiteraturePassage);
  const toggleBookmark = useServerFn(toggleLiteratureBookmark);
  const saveAnnotation = useServerFn(saveLiteratureAnnotation);

  const [step, setStep] = useState<Step>("loading");
  const [primary, setPrimary] = useState<ChartRow | null>(null);
  const [lifeStage, setLifeStage] = useState<LifeStage | null>(null);
  const [concern, setConcern] = useState<ConcernKey | null>(null);
  const [tone, setTone] = useState<ToneKey | null>(null);
  const [rec, setRec] = useState<RecommendationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [savedAnnotation, setSavedAnnotation] = useState<string | null>(null);
  const [showAnnotate, setShowAnnotate] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const excludedRef = useRef<Set<string>>(new Set());
  const clickLockRef = useRef(false);

  /* ── bootstrap: chart + prefs ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [charts, prefs] = await Promise.all([loadCharts(), loadPrefs()]);
        if (cancelled) return;
        const p = charts.find((c) => c.is_primary && c.chart_role === "self") ?? null;
        setPrimary(p);
        if (!p?.birth_date) {
          setStep("no-chart");
          return;
        }
        const stage = defaultStageForAge(
          computeAge(p.birth_date, new Date().toISOString().slice(0, 10)),
        );
        setLifeStage(stage);
        if (prefs?.preferred_tones?.[0]) {
          setTone(prefs.preferred_tones[0] as ToneKey);
        }
        setStep("concern");
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "load_failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCharts, loadPrefs]);

  /* ── advance: concern → tone or bookmark ──────────────────────── */
  const chooseConcern = useCallback((c: ConcernKey) => {
    setConcern(c);
    setStep(tone ? "bookmark" : "tone");
  }, [tone]);

  const chooseTone = useCallback(
    async (t: ToneKey) => {
      setTone(t);
      // Persist as first preferred tone (best-effort, silent on failure)
      try {
        await savePrefs({
          data: {
            preferred_tones: [t],
            preferred_regions: [],
            prefers_classical: true,
            prefers_modern: true,
            show_age_on_share: true,
          },
        });
      } catch {
        /* non-fatal */
      }
      setStep("bookmark");
    },
    [savePrefs],
  );

  /* ── fetch recommendation whenever we enter bookmark step ─────── */
  const fetchNext = useCallback(async () => {
    if (clickLockRef.current) return;
    clickLockRef.current = true;
    setTimeout(() => (clickLockRef.current = false), 400);
    if (!concern || !tone) return;
    setBusy(true);
    setError(null);
    try {
      const next = await recommend({
        data: {
          life_stage: stageToTag(lifeStage),
          concern,
          reading_tone: tone,
          chart_id: primary?.id ?? null,
          exclude_passage_ids: Array.from(excludedRef.current),
        },
      });
      if (!next) {
        setError(
          isZh
            ? "这个主题的候选暂时读完了，试试换一个主题或阅读气质。"
            : "You've read every page for this theme. Try a new theme or tone.",
        );
        setRec(null);
      } else {
        excludedRef.current.add(next.passage.id);
        setRec(next);
        setSavedAnnotation(next.annotation);
        setAnnotationDraft(next.annotation ?? "");
        setShowAnnotate(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "recommend_failed");
    } finally {
      setBusy(false);
    }
  }, [concern, tone, lifeStage, primary?.id, recommend, isZh]);

  useEffect(() => {
    if (step === "bookmark" && !rec && !busy) void fetchNext();
  }, [step, rec, busy, fetchNext]);

  /* ── actions ──────────────────────────────────────────────────── */
  const onBookmark = useCallback(async () => {
    if (!rec) return;
    const nextSaved = !rec.saved;
    setRec({ ...rec, saved: nextSaved });
    try {
      await toggleBookmark({ data: { recommendation_id: rec.id, saved: nextSaved } });
    } catch {
      setRec({ ...rec, saved: !nextSaved });
    }
  }, [rec, toggleBookmark]);

  const onSaveAnnotation = useCallback(async () => {
    if (!rec) return;
    try {
      await saveAnnotation({
        data: {
          recommendation_id: rec.id,
          annotation: annotationDraft.trim(),
          visibility: "private",
        },
      });
      setSavedAnnotation(annotationDraft.trim());
      setShowAnnotate(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "annotation_failed");
    }
  }, [rec, annotationDraft, saveAnnotation]);

  const changeConcern = () => {
    setStep("concern");
    setRec(null);
    excludedRef.current.clear();
  };
  const changeTone = () => setStep("tone");

  /* ── render ───────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-8 md:px-8 md:py-12">
        <PersonalWorkspaceNav active={"/me/echoes" as never} />
        <HeaderBlock isZh={isZh} />

        {step === "loading" && <LoadingBox isZh={isZh} />}
        {step === "no-chart" && <NoChartBlock isZh={isZh} />}
        {error && step !== "no-chart" && (
          <div className="mt-6 rounded-xl border border-rose-400/30 bg-rose-950/20 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}
        {step === "concern" && (
          <ConcernStep isZh={isZh} value={concern} onPick={chooseConcern} />
        )}
        {step === "tone" && (
          <ToneStep isZh={isZh} value={tone} onPick={chooseTone} />
        )}
        {step === "bookmark" && (
          <BookmarkStep
            isZh={isZh}
            busy={busy}
            rec={rec}
            lifeStage={lifeStage}
            concern={concern}
            tone={tone}
            annotation={savedAnnotation}
            showAnnotate={showAnnotate}
            annotationDraft={annotationDraft}
            onAnnotationDraft={setAnnotationDraft}
            onOpenAnnotate={() => setShowAnnotate(true)}
            onSaveAnnotation={onSaveAnnotation}
            onCancelAnnotate={() => setShowAnnotate(false)}
            onBookmark={onBookmark}
            onNext={fetchNext}
            onChangeConcern={changeConcern}
            onChangeTone={changeTone}
            onShare={() => setShareOpen(true)}
          />
        )}
      </div>

      {shareOpen && rec && (
        <ShareModal
          isZh={isZh}
          onClose={() => setShareOpen(false)}
          rec={rec}
          lifeStage={lifeStage}
          annotation={savedAnnotation}
        />
      )}
    </div>
  );
}

/* ─── header / gating blocks ─────────────────────────────────────── */

function HeaderBlock({ isZh }: { isZh: boolean }) {
  return (
    <header className="mb-8">
      <div className="text-xs uppercase tracking-[0.24em] text-amber-300/60">
        {isZh ? "命运通识馆 · 语文馆" : "Destiny Commons · Literature Hall"}
      </div>
      <h1 className="mt-3 font-serif text-3xl leading-tight tracking-wide md:text-4xl">
        {isZh ? (
          <>有些句子不是曾经没读懂，<br />而是那时的人生，还没有走到它面前。</>
        ) : (
          <>Some words were not beyond your understanding.<br />Your life simply had not reached them yet.</>
        )}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-amber-100/70 md:text-base">
        {isZh
          ? "图书馆会根据你正在经历的章节，为你翻开一页；但最后的注解，仍由你自己写下。"
          : "The library may open a page for the chapter you are living, but the final annotation remains yours to write."}
      </p>
    </header>
  );
}

function LoadingBox({ isZh }: { isZh: boolean }) {
  return (
    <div className="mt-6 rounded-xl border border-amber-400/15 bg-black/20 p-6 text-sm text-amber-200/70">
      {isZh ? "馆员正在查阅…" : "The librarian is checking the shelves…"}
    </div>
  );
}

function NoChartBlock({ isZh }: { isZh: boolean }) {
  return (
    <div className="mt-6 rounded-xl border border-amber-400/30 bg-black/40 p-6">
      <h2 className="font-serif text-xl text-amber-100">
        {isZh ? "先确定哪张命盘代表你" : "Choose which chart represents you"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-amber-100/80">
        {isZh
          ? "个人化的阅读推荐需要一张主命盘作为起点。这不是判断，只是让图书馆知道该为你翻到哪一章。"
          : "Personal reading needs one primary chart as the starting point. It is not a verdict — only how the library knows which chapter to open."}
      </p>
      <Link
        to="/ritual"
        className="mt-5 inline-flex items-center rounded-full bg-amber-400 px-5 py-2 text-sm font-medium text-[#0a0a12] transition hover:bg-amber-300"
      >
        {isZh ? "前往开启仪式" : "Open the ritual"}
      </Link>
    </div>
  );
}

/* ─── concern step ───────────────────────────────────────────────── */

function ConcernStep({
  isZh,
  value,
  onPick,
}: {
  isZh: boolean;
  value: ConcernKey | null;
  onPick: (c: ConcernKey) => void;
}) {
  return (
    <section aria-labelledby="lit-concern" className="mt-6">
      <h2 id="lit-concern" className="mb-4 font-serif text-lg text-amber-100">
        {isZh ? "今天想读什么？" : "What would you like to read today?"}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CONCERNS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onPick(c.key)}
            className={`rounded-xl border p-4 text-left transition ${
              value === c.key
                ? "border-amber-300 bg-amber-400/10"
                : "border-amber-400/20 bg-black/30 hover:border-amber-300/60 hover:bg-black/40"
            }`}
          >
            <div className="font-serif text-base text-amber-100">
              {isZh ? c.zh : c.en}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ─── tone step ──────────────────────────────────────────────────── */

function ToneStep({
  isZh,
  value,
  onPick,
}: {
  isZh: boolean;
  value: ToneKey | null;
  onPick: (t: ToneKey) => void;
}) {
  return (
    <section aria-labelledby="lit-tone" className="mt-6">
      <h2 id="lit-tone" className="mb-4 font-serif text-lg text-amber-100">
        {isZh ? "选择今天的阅读气质" : "Choose today's reading tone"}
      </h2>
      <p className="mb-4 text-sm text-amber-100/60">
        {isZh
          ? "会保存为你的偏好，之后可以随时更换。"
          : "Saved as your preference — change it any time."}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TONES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onPick(t.key)}
            className={`rounded-xl border p-3 text-left transition ${
              value === t.key
                ? "border-amber-300 bg-amber-400/10"
                : "border-amber-400/20 bg-black/30 hover:border-amber-300/60"
            }`}
          >
            <div className="text-sm text-amber-100">{isZh ? t.zh : t.en}</div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ─── bookmark step ──────────────────────────────────────────────── */

function BookmarkStep({
  isZh,
  busy,
  rec,
  lifeStage,
  concern,
  tone,
  annotation,
  showAnnotate,
  annotationDraft,
  onAnnotationDraft,
  onOpenAnnotate,
  onSaveAnnotation,
  onCancelAnnotate,
  onBookmark,
  onNext,
  onChangeConcern,
  onChangeTone,
  onShare,
}: {
  isZh: boolean;
  busy: boolean;
  rec: RecommendationRow | null;
  lifeStage: LifeStage | null;
  concern: ConcernKey | null;
  tone: ToneKey | null;
  annotation: string | null;
  showAnnotate: boolean;
  annotationDraft: string;
  onAnnotationDraft: (v: string) => void;
  onOpenAnnotate: () => void;
  onSaveAnnotation: () => void;
  onCancelAnnotate: () => void;
  onBookmark: () => void;
  onNext: () => void;
  onChangeConcern: () => void;
  onChangeTone: () => void;
  onShare: () => void;
}) {
  const concernCopy = CONCERNS.find((c) => c.key === concern);
  const toneCopy = TONES.find((t) => t.key === tone);

  return (
    <section aria-labelledby="lit-bookmark" className="mt-6">
      {/* Path chip bar */}
      <div className="mb-6 flex flex-wrap items-center gap-2 text-xs text-amber-300/70">
        <span className="rounded-full border border-amber-400/25 px-3 py-1">
          {stageLabelFor(lifeStage, isZh)}
        </span>
        <button
          type="button"
          onClick={onChangeConcern}
          className="rounded-full border border-amber-400/25 px-3 py-1 hover:border-amber-300"
        >
          {(isZh ? concernCopy?.zh : concernCopy?.en) ?? "…"}
        </button>
        <button
          type="button"
          onClick={onChangeTone}
          className="rounded-full border border-amber-400/25 px-3 py-1 hover:border-amber-300"
        >
          {(isZh ? toneCopy?.zh : toneCopy?.en) ?? "…"}
        </button>
      </div>

      {busy && !rec && <LoadingBox isZh={isZh} />}

      {rec && (
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          {/* Left column — the bookmark */}
          <article className="rounded-2xl border border-amber-400/20 bg-black/40 p-6 md:p-8">
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-300/60">
              {isZh ? "此刻为你翻到的一页" : "The page turned for you"}
            </div>
            <blockquote className="mt-5 font-serif text-2xl leading-relaxed text-amber-50 md:text-3xl">
              "{isZh
                ? rec.passage.display_text_zh ?? rec.passage.original_text
                : rec.passage.display_text_en ?? rec.passage.original_text}"
            </blockquote>
            <div className="mt-5 text-sm text-amber-200/80">
              {isZh
                ? `${rec.passage.work.author_zh ?? rec.passage.work.author_original ?? ""} · 《${rec.passage.work.title_zh ?? rec.passage.work.title_original ?? ""}》`
                : `${rec.passage.work.author_original ?? rec.passage.work.author_zh ?? ""} · ${rec.passage.work.title_original ?? rec.passage.work.title_zh ?? ""}`}
            </div>

            <Section title={isZh ? "原文发生的处境" : "Where these words were written"}>
              {(isZh ? rec.passage.context_zh : rec.passage.context_en) ?? "—"}
            </Section>
            <Section title={isZh ? "此刻为什么推荐给你" : "Why this page, right now"}>
              {(isZh
                ? rec.passage.default_interpretation_zh
                : rec.passage.default_interpretation_en) ?? "—"}
            </Section>
            <Section title={isZh ? "一个带回现实的问题" : "A question to bring back with you"}>
              {(isZh ? rec.passage.question_zh : rec.passage.question_en) ?? "—"}
            </Section>
            <Section title={isZh ? "一个轻量行动建议" : "One small action"}>
              {(isZh ? rec.passage.action_prompt_zh : rec.passage.action_prompt_en) ?? "—"}
            </Section>
          </article>

          {/* Right column — actions */}
          <aside className="flex flex-col gap-3">
            <ActionBtn onClick={onBookmark} primary={rec.saved}>
              {rec.saved
                ? isZh
                  ? "已收藏 · 取消收藏"
                  : "Saved · Unsave"
                : isZh
                  ? "收藏这一页"
                  : "Save this page"}
            </ActionBtn>
            <ActionBtn onClick={onOpenAnnotate}>
              {annotation
                ? isZh ? "修改我的注解" : "Edit my annotation"
                : isZh ? "写下我的注解" : "Write my annotation"}
            </ActionBtn>
            <ActionBtn onClick={onNext} disabled={busy}>
              {isZh ? "换一页" : "Turn another page"}
            </ActionBtn>
            <ActionBtn onClick={onShare}>
              {isZh ? "生成分享卡" : "Create share card"}
            </ActionBtn>

            {showAnnotate && (
              <div className="mt-2 rounded-xl border border-amber-400/25 bg-black/50 p-4">
                <label
                  htmlFor="lit-ann"
                  className="text-[11px] uppercase tracking-[0.2em] text-amber-300/60"
                >
                  {isZh ? "我的注解（仅自己可见）" : "My annotation (private)"}
                </label>
                <textarea
                  id="lit-ann"
                  value={annotationDraft}
                  onChange={(e) => onAnnotationDraft(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  className="mt-2 w-full resize-none rounded-lg border border-amber-400/20 bg-black/60 p-3 text-sm text-amber-50 outline-none focus:border-amber-300"
                  placeholder={isZh ? "写下你想留在这一页的话…" : "Write the note you want to keep with this page…"}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onCancelAnnotate}
                    className="rounded-full border border-amber-400/30 px-3 py-1 text-xs text-amber-200/80 hover:border-amber-300"
                  >
                    {isZh ? "取消" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={onSaveAnnotation}
                    className="rounded-full bg-amber-400 px-3 py-1 text-xs font-medium text-[#0a0a12] hover:bg-amber-300"
                  >
                    {isZh ? "保存" : "Save"}
                  </button>
                </div>
              </div>
            )}

            {annotation && !showAnnotate && (
              <div className="mt-2 rounded-xl border border-amber-400/20 bg-black/40 p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/60">
                  {isZh ? "我的注解" : "My annotation"}
                </div>
                <p className="mt-2 whitespace-pre-wrap font-serif text-sm text-amber-100">
                  {annotation}
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-amber-400/15 pt-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300/60">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-amber-100/85">{children}</p>
    </div>
  );
}

function ActionBtn({
  onClick,
  disabled,
  primary,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border px-4 py-3 text-left text-sm transition disabled:opacity-40 ${
        primary
          ? "border-amber-300 bg-amber-400/20 text-amber-100"
          : "border-amber-400/25 bg-black/40 text-amber-100 hover:border-amber-300/70"
      }`}
    >
      {children}
    </button>
  );
}

/* ─── share modal ─────────────────────────────────────────────────── */

function ShareModal({
  isZh,
  onClose,
  rec,
  lifeStage,
  annotation,
}: {
  isZh: boolean;
  onClose: () => void;
  rec: RecommendationRow;
  lifeStage: LifeStage | null;
  annotation: string | null;
}) {
  const [format, setFormat] = useState<ShareCardFormat>("quote");
  const [ratio, setRatio] = useState<ShareCardRatio>("1:1");
  const [confirmedAnnotation, setConfirmedAnnotation] = useState(false);
  const shelfCode = useMemo(
    () => rec.passage.slug.split("-").pop()?.toUpperCase().slice(0, 6) ?? null,
    [rec.passage.slug],
  );
  const stageStr = stageLabelFor(lifeStage, isZh);

  const canShow = format !== "annotation" || (annotation && confirmedAnnotation);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-2xl border border-amber-400/25 bg-[#0a0a12] p-6 text-amber-50"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg">{isZh ? "生成分享卡" : "Create share card"}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-amber-300/70 hover:text-amber-200"
            aria-label="close"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          {(
            [
              { k: "quote", zh: "一句话书签", en: "Quote" },
              { k: "age-reread", zh: "年龄重读卡", en: "Age reread" },
              { k: "annotation", zh: "我的注解卡", en: "My annotation" },
            ] as { k: ShareCardFormat; zh: string; en: string }[]
          ).map((opt) => (
            <button
              key={opt.k}
              type="button"
              onClick={() => setFormat(opt.k)}
              className={`rounded-full px-3 py-1 ${
                format === opt.k
                  ? "bg-amber-400 text-[#0a0a12]"
                  : "border border-amber-400/25 text-amber-200/80"
              }`}
            >
              {isZh ? opt.zh : opt.en}
            </button>
          ))}
          <span className="mx-2 h-4 w-px bg-amber-400/20" />
          {(["9:16", "1:1", "4:5"] as ShareCardRatio[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRatio(r)}
              className={`rounded-full px-3 py-1 ${
                ratio === r
                  ? "bg-amber-400 text-[#0a0a12]"
                  : "border border-amber-400/25 text-amber-200/80"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {format === "annotation" && !annotation && (
          <p className="mb-3 rounded-lg border border-rose-400/30 bg-rose-950/20 p-3 text-xs text-rose-200">
            {isZh
              ? "先写下你的注解才能生成注解卡。"
              : "Write an annotation first to create this card."}
          </p>
        )}
        {format === "annotation" && annotation && !confirmedAnnotation && (
          <label className="mb-3 flex items-center gap-2 text-xs text-amber-200/80">
            <input
              type="checkbox"
              checked={confirmedAnnotation}
              onChange={(e) => setConfirmedAnnotation(e.target.checked)}
            />
            {isZh
              ? "我确认愿意在分享卡中展示这段注解。"
              : "I confirm I want my annotation shown on the share card."}
          </label>
        )}

        <div className="flex justify-center overflow-auto rounded-xl border border-amber-400/15 bg-black/30 p-4">
          {canShow ? (
            <LiteratureShareCard
              format={format}
              ratio={ratio}
              passage={rec.passage}
              isZh={isZh}
              stageLabel={stageStr}
              annotation={annotation}
              shelfCode={shelfCode}
            />
          ) : (
            <div className="p-10 text-sm text-amber-200/60">
              {isZh ? "请先勾选确认。" : "Please confirm above first."}
            </div>
          )}
        </div>
        <p className="mt-3 text-center text-[11px] text-amber-300/50">
          {isZh
            ? "分享内容不包含你的出生数据、命盘或图书馆推荐依据。"
            : "Share cards do not include your birth data, chart, or recommendation logic."}
        </p>
      </div>
    </div>
  );
}
