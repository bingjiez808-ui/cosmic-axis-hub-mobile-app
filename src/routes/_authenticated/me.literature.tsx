import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CommonsHallNav } from "@/components/CommonsHallNav";
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
  listSavedLiterature,
  type RecommendationRow,
  type SavedBookmarkRow,
} from "@/lib/literature.functions";
import {
  LiteratureShareCard,
  type ShareCardFormat,
  type ShareCardRatio,
} from "@/components/literature/LiteratureShareCard";

/**
 * /me/literature — 命运通识馆 · 语文馆 (Literature Hall).
 *
 * Unified flipbook reading interface: theme + tone pickers stay pinned as
 * chips at the top of the reading desk, so users can re-choose without
 * leaving the page. The centre stage is a book-page card that runs a
 * short page-turn animation each time a new passage is opened. A visible
 * bookmark ribbon anchors saved pages, and annotations live inline on the
 * page footer. The right rail (or bottom drawer on mobile) is the user's
 * personal bookshelf of saved bookmarks — tap any card to re-open it.
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

type BootStatus = "loading" | "no-chart" | "ready";

function LiteratureHallPage() {
  const { lang } = useLang();
  const isZh = lang === "zh";

  const loadCharts = useServerFn(listUserCharts);
  const loadPrefs = useServerFn(getLiteraturePreferences);
  const savePrefs = useServerFn(saveLiteraturePreferences);
  const recommend = useServerFn(recommendLiteraturePassage);
  const toggleBookmark = useServerFn(toggleLiteratureBookmark);
  const saveAnnotation = useServerFn(saveLiteratureAnnotation);
  const loadSaved = useServerFn(listSavedLiterature);

  const [status, setStatus] = useState<BootStatus>("loading");
  const [primary, setPrimary] = useState<ChartRow | null>(null);
  const [lifeStage, setLifeStage] = useState<LifeStage | null>(null);
  const [concern, setConcern] = useState<ConcernKey | null>(null);
  const [tone, setTone] = useState<ToneKey | null>(null);
  const [rec, setRec] = useState<RecommendationRow | null>(null);
  const [flipKey, setFlipKey] = useState(0); // remounts book page on turn
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState("");
  const [savedAnnotation, setSavedAnnotation] = useState<string | null>(null);
  const [showAnnotate, setShowAnnotate] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shelf, setShelf] = useState<SavedBookmarkRow[]>([]);
  const [shelfOpenMobile, setShelfOpenMobile] = useState(false);
  const excludedRef = useRef<Set<string>>(new Set());
  const clickLockRef = useRef(false);

  /* ── bootstrap: chart + prefs ─────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [charts, prefs, saved] = await Promise.all([
          loadCharts(),
          loadPrefs(),
          loadSaved().catch(() => [] as SavedBookmarkRow[]),
        ]);
        if (cancelled) return;
        const p = charts.find((c) => c.is_primary && c.chart_role === "self") ?? null;
        setPrimary(p);
        setShelf(saved);
        if (!p?.birth_date) {
          setStatus("no-chart");
          return;
        }
        const stage = defaultStageForAge(
          computeAge(p.birth_date, new Date().toISOString().slice(0, 10)),
        );
        setLifeStage(stage);
        if (prefs?.preferred_tones?.[0]) {
          setTone(prefs.preferred_tones[0] as ToneKey);
        }
        setStatus("ready");
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "load_failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadCharts, loadPrefs, loadSaved]);

  const refreshShelf = useCallback(async () => {
    try {
      const rows = await loadSaved();
      setShelf(rows);
    } catch {
      /* non-fatal */
    }
  }, [loadSaved]);

  /* ── selection changes ────────────────────────────────────────── */
  const pickConcern = useCallback((c: ConcernKey) => {
    setConcern(c);
    setRec(null); // clear old page so book re-opens for new theme
  }, []);

  const pickTone = useCallback(
    (t: ToneKey) => {
      setTone(t);
      setRec(null);
      // Persist tone as first preferred (best-effort, silent)
      void savePrefs({
        data: {
          preferred_tones: [t],
          preferred_regions: [],
          prefers_classical: true,
          prefers_modern: true,
          show_age_on_share: true,
        },
      }).catch(() => {});
    },
    [savePrefs],
  );

  /* ── open / turn a page ───────────────────────────────────────── */
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
        setFlipKey((k) => k + 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "recommend_failed");
    } finally {
      setBusy(false);
    }
  }, [concern, tone, lifeStage, primary?.id, recommend, isZh]);

  /* ── actions ──────────────────────────────────────────────────── */
  const onBookmark = useCallback(async () => {
    if (!rec) return;
    const nextSaved = !rec.saved;
    setRec({ ...rec, saved: nextSaved });
    try {
      await toggleBookmark({ data: { recommendation_id: rec.id, saved: nextSaved } });
      void refreshShelf();
    } catch {
      setRec({ ...rec, saved: !nextSaved });
    }
  }, [rec, toggleBookmark, refreshShelf]);

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
      void refreshShelf();
    } catch (e) {
      setError(e instanceof Error ? e.message : "annotation_failed");
    }
  }, [rec, annotationDraft, saveAnnotation, refreshShelf]);

  /** Reopen a saved bookmark from the shelf. */
  const reopenSaved = useCallback((row: SavedBookmarkRow) => {
    // Build a RecommendationRow-shaped object from the saved row.
    setRec({
      id: row.id,
      passage: row.passage,
      saved: true,
      annotation: row.annotation,
      ranking_reasons: {},
      life_stage: null,
      concern: null,
      reading_tone: null,
      content_version: "v1",
    });
    setSavedAnnotation(row.annotation);
    setAnnotationDraft(row.annotation ?? "");
    setShowAnnotate(false);
    setFlipKey((k) => k + 1);
    setShelfOpenMobile(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const ready = status === "ready";
  const canOpen = ready && concern != null && tone != null;

  /* ── render ───────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#0a0a12]/10 text-amber-50">
      <div style={{ paddingTop: "var(--site-nav-height, 96px)" }}>
        <CommonsHallNav active="/me/literature" />
      </div>
      <div className="mx-auto w-full max-w-[1240px] px-4 pb-12 pt-6 md:px-8 md:pb-16">
        <HeaderBlock isZh={isZh} />

        {status === "loading" && <LoadingBox isZh={isZh} />}
        {status === "no-chart" && <NoChartBlock isZh={isZh} />}

        {ready && (
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* ── Reading desk ─────────────────────────────────── */}
            <div>
              <SelectionBar
                isZh={isZh}
                lifeStage={lifeStage}
                concern={concern}
                tone={tone}
                onPickConcern={pickConcern}
                onPickTone={pickTone}
              />

              {error && (
                <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-950/20 p-4 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {!canOpen && !rec && (
                <EmptyBookInvite
                  isZh={isZh}
                  needsConcern={concern == null}
                  needsTone={tone == null}
                />
              )}

              {canOpen && !rec && !busy && (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={fetchNext}
                    className="group relative inline-flex items-center gap-3 rounded-full bg-amber-400 px-6 py-3 text-sm font-medium text-[#0a0a12] shadow-[0_0_40px_-10px_rgba(251,191,36,0.7)] transition hover:bg-amber-300"
                  >
                    <span aria-hidden className="text-lg">📖</span>
                    {isZh ? "翻开一页" : "Open a page"}
                  </button>
                </div>
              )}

              {busy && !rec && <LoadingBox isZh={isZh} />}

              {rec && (
                <BookPage
                  key={flipKey}
                  isZh={isZh}
                  rec={rec}
                  lifeStage={lifeStage}
                  annotation={savedAnnotation}
                  showAnnotate={showAnnotate}
                  annotationDraft={annotationDraft}
                  onAnnotationDraft={setAnnotationDraft}
                  onOpenAnnotate={() => setShowAnnotate(true)}
                  onSaveAnnotation={onSaveAnnotation}
                  onCancelAnnotate={() => setShowAnnotate(false)}
                  onBookmark={onBookmark}
                  onNext={fetchNext}
                  onShare={() => setShareOpen(true)}
                  busy={busy}
                />
              )}
            </div>

            {/* ── Personal bookshelf ───────────────────────────── */}
            <BookshelfRail
              isZh={isZh}
              shelf={shelf}
              currentId={rec?.id ?? null}
              onReopen={reopenSaved}
              openMobile={shelfOpenMobile}
              setOpenMobile={setShelfOpenMobile}
            />
          </div>
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

      {/* Global keyframes for the page-turn */}
      <style>{`
        @keyframes lit-page-turn {
          0%   { transform: perspective(1400px) rotateY(-72deg) translateX(-6%); opacity: 0; }
          55%  { opacity: 1; }
          100% { transform: perspective(1400px) rotateY(0deg) translateX(0); opacity: 1; }
        }
        @keyframes lit-ribbon-drop {
          from { transform: translateY(-18px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
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

/* ─── unified selection bar ───────────────────────────────────────── */

function SelectionBar({
  isZh,
  lifeStage,
  concern,
  tone,
  onPickConcern,
  onPickTone,
}: {
  isZh: boolean;
  lifeStage: LifeStage | null;
  concern: ConcernKey | null;
  tone: ToneKey | null;
  onPickConcern: (c: ConcernKey) => void;
  onPickTone: (t: ToneKey) => void;
}) {
  return (
    <section
      aria-label={isZh ? "阅读设定" : "Reading setup"}
      className="rounded-2xl border border-amber-400/20 bg-black/30 p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-amber-300/70">
        <span className="rounded-full border border-amber-400/25 px-3 py-1">
          {stageLabelFor(lifeStage, isZh)}
        </span>
        <span className="text-amber-300/40">·</span>
        <span>{isZh ? "为此刻的你翻开一页" : "Turn a page for this moment"}</span>
      </div>

      <ChipRow
        label={isZh ? "想读什么" : "What to read"}
        options={CONCERNS.map((c) => ({ key: c.key, label: isZh ? c.zh : c.en }))}
        value={concern}
        onPick={(k) => onPickConcern(k as ConcernKey)}
      />
      <ChipRow
        label={isZh ? "阅读气质" : "Reading tone"}
        options={TONES.map((t) => ({ key: t.key, label: isZh ? t.zh : t.en }))}
        value={tone}
        onPick={(k) => onPickTone(k as ToneKey)}
      />
    </section>
  );
}

function ChipRow({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string | null;
  onPick: (k: string) => void;
}) {
  return (
    <div className="mt-4">
      <div className="mb-2 text-[10px] uppercase tracking-[0.24em] text-amber-300/55">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => onPick(o.key)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                active
                  ? "border-amber-300 bg-amber-400/15 text-amber-100 shadow-[0_0_16px_-6px_rgba(251,191,36,0.7)]"
                  : "border-amber-400/20 bg-black/30 text-amber-100/80 hover:border-amber-300/60"
              }`}
              aria-pressed={active}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyBookInvite({
  isZh,
  needsConcern,
  needsTone,
}: {
  isZh: boolean;
  needsConcern: boolean;
  needsTone: boolean;
}) {
  const hint = needsConcern && needsTone
    ? isZh ? "先选一个主题，再挑一种阅读气质。" : "Pick a theme, then a reading tone."
    : needsConcern
      ? isZh ? "再选一个主题，图书馆就为你翻开一页。" : "Pick a theme and the library will open a page."
      : isZh ? "再挑一种阅读气质，图书馆就为你翻开一页。" : "Pick a tone and the library will open a page.";
  return (
    <div className="mt-6 rounded-2xl border border-amber-400/15 bg-black/20 p-8 text-center">
      <div aria-hidden className="mx-auto mb-4 text-4xl opacity-50">📖</div>
      <p className="text-sm text-amber-200/70">{hint}</p>
    </div>
  );
}

/* ─── book page ──────────────────────────────────────────────────── */

function BookPage({
  isZh,
  rec,
  lifeStage,
  annotation,
  showAnnotate,
  annotationDraft,
  onAnnotationDraft,
  onOpenAnnotate,
  onSaveAnnotation,
  onCancelAnnotate,
  onBookmark,
  onNext,
  onShare,
  busy,
}: {
  isZh: boolean;
  rec: RecommendationRow;
  lifeStage: LifeStage | null;
  annotation: string | null;
  showAnnotate: boolean;
  annotationDraft: string;
  onAnnotationDraft: (v: string) => void;
  onOpenAnnotate: () => void;
  onSaveAnnotation: () => void;
  onCancelAnnotate: () => void;
  onBookmark: () => void;
  onNext: () => void;
  onShare: () => void;
  busy: boolean;
}) {
  const authorLine = isZh
    ? `${rec.passage.work.author_zh ?? rec.passage.work.author_original ?? ""} · 《${rec.passage.work.title_zh ?? rec.passage.work.title_original ?? ""}》`
    : `${rec.passage.work.author_original ?? rec.passage.work.author_zh ?? ""} · ${rec.passage.work.title_original ?? rec.passage.work.title_zh ?? ""}`;

  return (
    <article
      className="relative mt-6 overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[#141018] via-[#0f0d16] to-[#0b0913] shadow-[0_20px_60px_-30px_rgba(251,191,36,0.35)]"
      style={{
        animation: "lit-page-turn 720ms cubic-bezier(.2,.7,.2,1) both",
        transformOrigin: "left center",
      }}
    >
      {/* Book spine gutter */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 hidden h-full w-8 bg-gradient-to-r from-black/70 via-black/30 to-transparent md:block"
      />
      {/* Dog-eared corner */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 top-0 h-0 w-0 border-l-[36px] border-t-[36px] border-l-transparent border-t-amber-400/25"
      />

      {/* Bookmark ribbon — only when saved */}
      {rec.saved && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-8 top-0 z-[2] h-24 w-8 bg-gradient-to-b from-amber-400 to-amber-600 shadow-[0_6px_12px_rgba(0,0,0,0.35)]"
          style={{
            clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%)",
            animation: "lit-ribbon-drop 400ms ease-out both",
          }}
        />
      )}

      <div className="relative p-6 md:pl-12 md:pr-10 md:py-10">
        {/* Header — page metadata */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-amber-300/60">
          <span>{isZh ? "此刻为你翻到的一页" : "The page turned for you"}</span>
          {rec.passage.citation_label && (
            <>
              <span className="text-amber-300/30">·</span>
              <span className="normal-case tracking-normal text-amber-200/60">
                {rec.passage.citation_label}
              </span>
            </>
          )}
        </div>

        {/* Passage */}
        <blockquote className="mt-5 font-serif text-2xl leading-relaxed text-amber-50 md:text-3xl">
          &ldquo;{isZh
            ? rec.passage.display_text_zh ?? rec.passage.original_text
            : rec.passage.display_text_en ?? rec.passage.original_text}&rdquo;
        </blockquote>
        <div className="mt-5 text-sm text-amber-200/80">{authorLine}</div>

        <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
          <div>
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
          </div>

          {/* Right rail — quick actions */}
          <aside className="flex flex-col gap-2">
            <ActionBtn onClick={onBookmark} primary={rec.saved}>
              <span aria-hidden className="mr-2">{rec.saved ? "🔖" : "📑"}</span>
              {rec.saved
                ? isZh ? "已收藏 · 取消" : "Saved · Unsave"
                : isZh ? "收藏这一页" : "Save this page"}
            </ActionBtn>
            <ActionBtn onClick={onOpenAnnotate}>
              <span aria-hidden className="mr-2">✎</span>
              {annotation
                ? isZh ? "修改我的注解" : "Edit annotation"
                : isZh ? "写下我的注解" : "Write annotation"}
            </ActionBtn>
            <ActionBtn onClick={onNext} disabled={busy}>
              <span aria-hidden className="mr-2">➜</span>
              {isZh ? "换一页" : "Turn another page"}
            </ActionBtn>
            <ActionBtn onClick={onShare}>
              <span aria-hidden className="mr-2">◈</span>
              {isZh ? "生成分享卡" : "Create share card"}
            </ActionBtn>
          </aside>
        </div>

        {/* Annotation area — inline at page footer */}
        <div className="mt-6 border-t border-amber-400/15 pt-5">
          {showAnnotate ? (
            <div className="rounded-xl border border-amber-400/25 bg-black/40 p-4">
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
                autoFocus
                className="mt-2 w-full resize-none rounded-lg border border-amber-400/20 bg-black/60 p-3 text-sm text-amber-50 outline-none focus:border-amber-300"
                placeholder={isZh ? "写下你想留在这一页的话…" : "Write the note you want to keep with this page…"}
              />
              <div className="mt-3 flex items-center justify-between text-xs text-amber-300/50">
                <span>{annotationDraft.length}/2000</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onCancelAnnotate}
                    className="rounded-full border border-amber-400/30 px-3 py-1 text-amber-200/80 hover:border-amber-300"
                  >
                    {isZh ? "取消" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={onSaveAnnotation}
                    className="rounded-full bg-amber-400 px-3 py-1 font-medium text-[#0a0a12] hover:bg-amber-300"
                  >
                    {isZh ? "保存注解" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          ) : annotation ? (
            <button
              type="button"
              onClick={onOpenAnnotate}
              className="block w-full rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-4 text-left transition hover:border-amber-300/60"
            >
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-amber-300/60">
                <span aria-hidden>✎</span>
                {isZh ? "我的注解" : "My annotation"}
              </div>
              <p className="mt-2 whitespace-pre-wrap font-serif text-sm text-amber-100">
                {annotation}
              </p>
            </button>
          ) : (
            <p className="text-xs italic text-amber-200/40">
              {isZh
                ? "这一页还没有你的注解。图书馆读给你，注解由你自己写下。"
                : "No annotation yet. The library reads it to you — the annotation is yours to write."}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-amber-400/15 pt-4 first:mt-0 first:border-0 first:pt-0">
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
      className={`rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-40 ${
        primary
          ? "border-amber-300 bg-amber-400/20 text-amber-100"
          : "border-amber-400/25 bg-black/40 text-amber-100 hover:border-amber-300/70"
      }`}
    >
      {children}
    </button>
  );
}

/* ─── personal bookshelf rail ─────────────────────────────────────── */

function BookshelfRail({
  isZh,
  shelf,
  currentId,
  onReopen,
  openMobile,
  setOpenMobile,
}: {
  isZh: boolean;
  shelf: SavedBookmarkRow[];
  currentId: string | null;
  onReopen: (row: SavedBookmarkRow) => void;
  openMobile: boolean;
  setOpenMobile: (v: boolean) => void;
}) {
  const count = shelf.length;
  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setOpenMobile(!openMobile)}
        className="flex items-center justify-between rounded-xl border border-amber-400/20 bg-black/40 px-4 py-3 text-sm text-amber-100 lg:hidden"
        aria-expanded={openMobile}
      >
        <span className="flex items-center gap-2">
          <span aria-hidden>🔖</span>
          {isZh ? `我的书签架 · ${count}` : `My bookshelf · ${count}`}
        </span>
        <span aria-hidden>{openMobile ? "▲" : "▼"}</span>
      </button>

      <aside
        className={`${openMobile ? "block" : "hidden"} lg:block lg:sticky lg:top-24 lg:self-start`}
      >
        <div className="rounded-2xl border border-amber-400/20 bg-black/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.24em] text-amber-300/60">
              {isZh ? "我的书签架" : "My bookshelf"}
            </div>
            <span className="text-xs text-amber-200/60">{count}</span>
          </div>

          {count === 0 ? (
            <p className="text-xs italic leading-relaxed text-amber-200/45">
              {isZh
                ? "还没有收藏的页面。看到打动你的一页，点“收藏这一页”，它就会出现在这里。"
                : "No saved pages yet. When a page moves you, tap Save this page and it will appear here."}
            </p>
          ) : (
            <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {shelf.map((row) => {
                const isActive = row.id === currentId;
                const text = isZh
                  ? row.passage.display_text_zh ?? row.passage.original_text
                  : row.passage.display_text_en ?? row.passage.original_text;
                const author = isZh
                  ? row.passage.work.author_zh ?? row.passage.work.author_original
                  : row.passage.work.author_original ?? row.passage.work.author_zh;
                const title = isZh
                  ? row.passage.work.title_zh ?? row.passage.work.title_original
                  : row.passage.work.title_original ?? row.passage.work.title_zh;
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => onReopen(row)}
                      className={`group relative w-full rounded-xl border p-3 text-left transition ${
                        isActive
                          ? "border-amber-300 bg-amber-400/10"
                          : "border-amber-400/15 bg-black/40 hover:border-amber-300/60 hover:bg-black/60"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="absolute right-2 top-0 h-6 w-1.5 bg-gradient-to-b from-amber-400 to-amber-600"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)" }}
                      />
                      <p className="line-clamp-3 pr-3 font-serif text-sm leading-snug text-amber-100">
                        &ldquo;{text}&rdquo;
                      </p>
                      <p className="mt-1.5 text-[11px] text-amber-300/60">
                        {author ?? ""}
                        {title ? ` · ${title}` : ""}
                      </p>
                      {row.annotation && (
                        <p className="mt-1 line-clamp-2 text-[11px] italic text-amber-100/60">
                          ✎ {row.annotation}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
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
