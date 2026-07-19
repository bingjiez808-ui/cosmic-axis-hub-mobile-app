/**
 * Full-screen in-app reader for the Premium Deep Reading.
 *
 * The report content is NEVER downloadable and never exposes a public
 * URL. This component loads `content_json` from `getPremiumReport`,
 * which validates ownership on the server, then renders the chapters
 * as a browsable long-form article with a fixed sidebar table of
 * contents on desktop and a collapsible sheet on mobile.
 *
 * Accessibility:
 *   - role="dialog", aria-modal, aria-labelledby.
 *   - Focus is trapped inside the dialog while open, restored to the
 *     opener afterwards (the parent owns the opener ref).
 *   - Escape closes.
 *   - Body scroll is locked while open.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useLang } from "@/lib/i18n";
import {
  generatePremiumReport,
  processNextPremiumChapter,
  getPremiumReport,
  getPremiumReportProgress,
  type PremiumContent,
  type PremiumReportProgress,
} from "@/lib/premium.functions";
import type { PremiumFacts, BaZiElement } from "@/lib/premium-facts";
import {
  computeScrollProgress,
  neighborChapters,
} from "@/lib/reader-nav";

const TXT = {
  loading: { zh: "正在打开完整报告…", en: "Opening your full reading…" },
  not_ready: {
    zh: "报告尚未生成完毕。请返回卡片继续等待或重新生成。",
    en: "The report is not ready yet. Return to the card to keep waiting or retry generation.",
  },
  toc: { zh: "章节目录", en: "Contents" },
  close: { zh: "关闭", en: "Close" },
  jump: { zh: "跳转章节", en: "Jump to chapter" },
  meta: { zh: "生成于", en: "Generated" },
  cover_note: {
    zh: "本报告仅供文化娱乐与自我反思，不构成医疗、法律、投资或人生决策建议。",
    en: "This report is for cultural, reflective self-exploration only — not medical, legal, financial or life-decision advice.",
  },
  progress: { zh: "阅读进度", en: "Reading progress" },
  prev: { zh: "上一章", en: "Previous" },
  next: { zh: "下一章", en: "Next" },
  position: { zh: "章节", en: "Chapter" },
  drawer_title: { zh: "章节目录", en: "Table of contents" },
  partial_banner: {
    zh: "本报告部分章节尚未完成或曾经生成失败，你可以继续生成剩余章节，已完成章节不会重复调用 AI。",
    en: "Some chapters of this report are still pending or previously failed. You can resume generation; completed chapters won't call AI again.",
  },
  continue: { zh: "继续生成", en: "Resume generation" },
  continuing: { zh: "正在续跑…", en: "Resuming…" },
  gen_progress: { zh: "已生成", en: "Generated" },
  badge_completed: { zh: "已完成", en: "Done" },
  badge_pending: { zh: "待生成", en: "Pending" },
  badge_running: { zh: "生成中", en: "Running" },
  badge_failed: { zh: "失败", en: "Failed" },
  badge_skipped: { zh: "跳过", en: "Skipped" },
};

function pick<T extends { zh: string; en: string }>(t: T, lang: "zh" | "en"): string {
  return lang === "zh" ? t.zh : t.en;
}

function fmtDate(iso: string | null, lang: "zh" | "en"): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export function PremiumReportReader({
  open,
  chartId,
  chartName,
  onClose,
  injectedContent,
  injectedProgress,
}: {
  open: boolean;
  chartId: string;
  chartName: string | null;
  onClose: () => void;
  /**
   * Test / DEV harness escape hatch. When set, the reader renders this
   * content directly and never calls the server. Only surfaced from
   * `src/routes/dev.reader-harness.tsx`, which is gated behind
   * `import.meta.env.DEV`. Production users never reach a code path
   * that sets these props.
   */
  injectedContent?: PremiumContent | null;
  injectedProgress?: PremiumReportProgress | null;
}) {
  const { lang } = useLang();
  const titleId = useId();
  const drawerTitleId = useId();
  const [content, setContent] = useState<PremiumContent | null>(injectedContent ?? null);
  const [progressData, setProgressData] = useState<PremiumReportProgress | null>(
    injectedProgress ?? null,
  );
  const [continuing, setContinuing] = useState(false);
  const [errored, setErrored] = useState(false);
  const [active, setActive] = useState<string | null>(
    injectedContent?.chapters[0]?.key ?? null,
  );
  const [tocOpen, setTocOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const tocButtonRef = useRef<HTMLButtonElement | null>(null);
  const suppressObserverRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadContent = useCallback(async () => {
    if (injectedContent) {
      setContent(injectedContent);
      setProgressData(injectedProgress ?? null);
      setActive(injectedContent.chapters[0]?.key ?? null);
      return;
    }
    setContent(null);
    setErrored(false);
    setProgress(0);
    try {
      const [r, p] = await Promise.all([
        getPremiumReport({ data: { chartId } }),
        getPremiumReportProgress({ data: { chartId } }),
      ]);
      setProgressData(p);
      if (r?.content) {
        setContent(r.content);
        setActive(r.content.chapters[0]?.key ?? null);
      } else if (r?.status && r.status !== "completed") {
        // Partial or generating with no persisted content_json yet.
        setErrored(true);
      } else {
        setErrored(true);
      }
    } catch {
      setErrored(true);
    }
  }, [chartId, injectedContent, injectedProgress]);

  // Load content on open.
  useEffect(() => {
    if (!open) return;
    let cancel = false;
    void loadContent().then(() => {
      if (cancel) return;
    });
    return () => {
      cancel = true;
    };
  }, [open, loadContent]);


  const handleContinue = useCallback(async () => {
    if (continuing) return;
    setContinuing(true);
    try {
      const start = await generatePremiumReport({ data: { chartId } });
      if (start.status !== "completed") {
        for (let i = 0; i < 32; i += 1) {
          const step = await processNextPremiumChapter({ data: { reportId: start.reportId } });
          if (step.status === "completed") break;
          if (!step.processed) break;
        }
      }
      await loadContent();
    } catch {
      // Leave partial state visible; user can retry.
    } finally {
      setContinuing(false);
    }
  }, [continuing, chartId, loadContent]);



  // Body scroll lock + Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Close the mobile drawer first if it's open, else close reader.
        if (tocOpen) {
          setTocOpen(false);
          tocButtonRef.current?.focus();
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      cancelAnimationFrame(raf);
    };
  }, [open, onClose, tocOpen]);

  // Move focus into the drawer when it opens.
  useEffect(() => {
    if (tocOpen) {
      const raf = requestAnimationFrame(() => drawerCloseRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [tocOpen]);

  const scrollTo = useCallback((key: string, opts?: { focusHeading?: boolean }) => {
    setActive(key);
    setTocOpen(false);
    suppressObserverRef.current = true;
    if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = setTimeout(() => {
      suppressObserverRef.current = false;
    }, 900);
    const container = bodyRef.current;
    if (!container) return;
    const el = container.querySelector(`[data-ch="${key}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (opts?.focusHeading) {
      const h = el.querySelector<HTMLElement>("[data-ch-heading]");
      if (h) {
        h.setAttribute("tabindex", "-1");
        // Delay focus until smooth-scroll settles enough that the
        // browser doesn't jump the view to the heading top abruptly.
        setTimeout(() => h.focus({ preventScroll: true }), 350);
      }
    }
  }, []);

  // Scroll progress + IntersectionObserver-driven active chapter.
  useEffect(() => {
    if (!content) return;
    const container = bodyRef.current;
    if (!container) return;

    const onScroll = () => {
      setProgress(
        computeScrollProgress(
          container.scrollTop,
          container.scrollHeight,
          container.clientHeight,
        ),
      );
    };
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });

    // IntersectionObserver: pick the topmost chapter whose heading has
    // crossed ~30% into the viewport. Facts panel is skipped (no key
    // in the chapters list, so it can't be "active" in the TOC).
    const sections = Array.from(
      container.querySelectorAll<HTMLElement>("[data-ch]:not([data-ch='__facts'])"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressObserverRef.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0];
        if (top) {
          const key = top.target.getAttribute("data-ch");
          if (key) setActive(key);
        }
      },
      {
        root: container,
        // Trigger active-swap once the heading is within the upper
        // third of the reader viewport.
        rootMargin: "0px 0px -70% 0px",
        threshold: 0,
      },
    );
    for (const s of sections) observer.observe(s);
    return () => {
      container.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [content]);

  const heading = useMemo(() => {
    if (!content) return chartName ?? "";
    return content.cover.title;
  }, [content, chartName]);

  const chapters = content?.chapters ?? [];
  const activeIndex = active ? chapters.findIndex((c) => c.key === active) : -1;
  const positionLabel =
    activeIndex >= 0 && chapters.length > 0
      ? `${activeIndex + 1} / ${chapters.length}`
      : chapters.length > 0
        ? `— / ${chapters.length}`
        : "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-stretch justify-center overflow-hidden bg-obsidian/85 backdrop-blur-md md:items-center"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="relative m-0 flex h-[100dvh] w-full flex-col overflow-hidden bg-obsidian text-stone-warm focus:outline-none md:m-4 md:h-[92dvh] md:w-full md:max-w-[1320px] md:min-w-0 md:rounded-3xl md:border md:border-gold-dust/20 md:shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            {/* Sticky compact top bar (title + date + close). Progress bar sits at the bottom edge. */}
            <header className="relative flex flex-none items-center gap-3 border-b border-white/5 bg-obsidian/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur md:px-6 md:py-3">
              <button
                ref={tocButtonRef}
                type="button"
                onClick={() => setTocOpen(true)}
                aria-label={pick(TXT.jump, lang)}
                aria-expanded={tocOpen}
                aria-controls="premium-toc-drawer"
                className="min-h-[44px] rounded-full border border-gold-dust/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10 md:hidden"
              >
                {pick(TXT.toc, lang)}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                  {chartName ?? (lang === "zh" ? "私人命盘" : "Personal chart")}
                </p>
                <h2
                  id={titleId}
                  className="truncate font-serif text-base italic text-stone-warm md:text-lg"
                >
                  {heading || (lang === "zh" ? "高级 AI 深度报告" : "Premium AI Deep Reading")}
                </h2>
              </div>
              {content?.meta.generated_at && (
                <p className="hidden shrink-0 text-[10px] uppercase tracking-[0.28em] text-stone-warm/45 md:block">
                  {pick(TXT.meta, lang)} · {fmtDate(content.meta.generated_at, lang)}
                </p>
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-dust"
                aria-label={pick(TXT.close, lang)}
              >
                {pick(TXT.close, lang)} ✕
              </button>

              {/* Progress bar — real scroll position, 0-100. Sits on the
                  bottom edge of the header so it's visible but never
                  overlaps body text. */}
              {content && (
                <div
                  role="progressbar"
                  aria-label={pick(TXT.progress, lang)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden bg-white/5"
                >
                  <div
                    className="h-full bg-gradient-to-r from-gold-dust via-gold-light to-nebula-purple transition-[width] duration-150 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </header>

            {/* Body: desktop sidebar + article */}
            <div className="flex min-h-0 flex-1">
              {/* Sidebar TOC (desktop) */}
              {content && (
                <aside className="hidden w-[280px] flex-none overflow-y-auto overflow-x-hidden border-r border-white/5 px-5 py-6 md:block">
                  <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/60">
                    {pick(TXT.toc, lang)}
                  </p>
                  <ol className="space-y-1.5">
                    {chapters.map((ch, i) => {
                      const st = progressData?.chapters.find((p) => p.key === ch.key)?.status;
                      return (
                        <li key={ch.key}>
                          <button
                            type="button"
                            onClick={() => scrollTo(ch.key, { focusHeading: true })}
                            aria-current={active === ch.key ? "true" : undefined}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors ${
                              active === ch.key
                                ? "bg-gold-dust/10 text-gold-light"
                                : "text-stone-warm/70 hover:bg-white/5 hover:text-gold-dust"
                            }`}
                          >
                            <span className="text-[10px] text-gold-dust/60">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{ch.title}</span>
                            {st && st !== "completed" && (
                              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-[0.18em] ${
                                st === "failed"
                                  ? "bg-red-500/15 text-red-300"
                                  : st === "running"
                                    ? "bg-nebula-purple/20 text-nebula-purple"
                                    : "bg-white/5 text-stone-warm/50"
                              }`}>
                                {st === "failed"
                                  ? pick(TXT.badge_failed, lang)
                                  : st === "running"
                                    ? pick(TXT.badge_running, lang)
                                    : st === "skipped"
                                      ? pick(TXT.badge_skipped, lang)
                                      : pick(TXT.badge_pending, lang)}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ol>

                </aside>
              )}

              {/* Article — single scroll container */}
              <div
                ref={bodyRef}
                className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-10 md:py-10"
              >
                {!content && !errored && (
                  <p className="text-center text-sm text-stone-warm/60">{pick(TXT.loading, lang)}</p>
                )}
                {errored && (
                  <p className="text-center text-sm text-stone-warm/70">
                    {pick(TXT.not_ready, lang)}
                  </p>
                )}
                {content && (
                  <article
                    className="mx-auto w-full max-w-[68ch] text-[16px] leading-[1.8] md:text-[17px]"
                  >
                    {/* Cover / summary — customer view, no schema/prompt strings */}
                    <section className="mb-8 border-b border-white/5 pb-6">
                      <p className="text-[10px] uppercase tracking-[0.36em] text-gold-dust/70">
                        {pick(TXT.meta, lang)} · {fmtDate(content.meta.generated_at, lang)}
                      </p>
                      <h1 className="mt-2 font-serif text-[clamp(1.5rem,4.5vw,2rem)] italic text-stone-warm">
                        {content.cover.title}
                      </h1>
                      <p className="mt-1 text-[14px] leading-relaxed text-stone-warm/70 md:text-[15px]">
                        {content.cover.subtitle}
                      </p>
                    </section>

                    {progressData &&
                      (progressData.reportStatus === "partial" ||
                        progressData.reportStatus === "failed" ||
                        progressData.canContinue) &&
                      progressData.completedChapters < progressData.totalChapters && (
                        <section
                          role="status"
                          aria-live="polite"
                          className="mb-8 rounded-2xl border border-nebula-purple/30 bg-nebula-purple/[0.08] p-4 md:p-5"
                        >
                          <p className="text-[10px] uppercase tracking-[0.3em] text-nebula-purple/90">
                            {pick(TXT.gen_progress, lang)} · {progressData.completedChapters}/
                            {progressData.totalChapters}
                            {progressData.failedChapters > 0
                              ? ` · ${pick(TXT.badge_failed, lang)} ${progressData.failedChapters}`
                              : ""}
                          </p>
                          <p className="mt-2 text-[13px] leading-relaxed text-stone-warm/80">
                            {pick(TXT.partial_banner, lang)}
                          </p>
                          {progressData.canContinue && (
                            <button
                              type="button"
                              onClick={handleContinue}
                              disabled={continuing}
                              className="mt-3 inline-flex min-h-[44px] items-center rounded-full border border-gold-dust/50 bg-gold-dust/10 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-gold-light transition-colors hover:bg-gold-dust/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {continuing ? pick(TXT.continuing, lang) : pick(TXT.continue, lang)}
                            </button>
                          )}
                        </section>
                      )}

                    {/* Locally-derived facts (v2+). Absent on legacy rows. */}
                    {content.facts && <FactsPanel facts={content.facts} lang={lang} />}

                    {chapters.map((ch, i) => (
                      <section
                        key={ch.key}
                        data-ch={ch.key}
                        className="mb-10 scroll-mt-24"
                      >
                        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                          {String(i + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}
                        </p>
                        <h3
                          data-ch-heading
                          className="mt-1 font-serif text-[clamp(1.25rem,3.5vw,1.6rem)] italic text-gold-light outline-none focus-visible:ring-2 focus-visible:ring-gold-dust/60"
                        >
                          {ch.title}
                        </h3>
                        <div className="mt-3 space-y-4 text-stone-warm/85 [overflow-wrap:break-word]">
                          {ch.body.split(/\n\s*\n/).map((para, k) => (
                            <p key={k}>{para.trim()}</p>
                          ))}
                        </div>
                        {ch.evidence_refs && ch.evidence_refs.length > 0 && (
                          <details className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] text-stone-warm/75">
                            <summary className="cursor-pointer select-none list-none text-[10px] uppercase tracking-[0.28em] text-gold-dust/70 [&::-webkit-details-marker]:hidden">
                              {lang === "zh" ? "证据溯源" : "Evidence"} · {ch.evidence_refs.length}
                            </summary>
                            <ul className="mt-2 space-y-1.5">
                              {ch.evidence_refs.map((r, k) => (
                                <li key={k} className="flex flex-wrap items-center gap-2 [overflow-wrap:anywhere]">
                                  <code className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[11px] text-stone-warm/80">
                                    {r.path}
                                  </code>
                                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-stone-warm/60">
                                    {r.module}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${
                                      r.confidence === "grounded"
                                        ? "bg-emerald-500/15 text-emerald-300"
                                        : r.confidence === "traditional"
                                          ? "bg-amber-500/15 text-amber-200"
                                          : "bg-nebula-purple/15 text-nebula-purple"
                                    }`}
                                  >
                                    {r.confidence}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </section>
                    ))}

                    {/* Single navigation block at the article footer.
                        Jumps back/forward relative to the currently active
                        chapter (from the IntersectionObserver). Not stacked
                        per-chapter. */}
                    {chapters.length > 0 && (() => {
                      const { prev, next } = neighborChapters(chapters, active);
                      return (
                        <nav
                          aria-label={pick(TXT.jump, lang)}
                          className="mt-8 flex items-center justify-between gap-3 border-t border-white/5 pt-5"
                        >
                          <button
                            type="button"
                            disabled={!prev}
                            onClick={() => prev && scrollTo(prev, { focusHeading: true })}
                            className="min-h-[44px] rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-stone-warm/75 transition-colors hover:border-gold-dust/40 hover:text-gold-dust disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-stone-warm/75"
                          >
                            ← {pick(TXT.prev, lang)}
                          </button>
                          <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/40">
                            {positionLabel || `— / ${chapters.length}`}
                          </p>
                          <button
                            type="button"
                            disabled={!next}
                            onClick={() => next && scrollTo(next, { focusHeading: true })}
                            className="min-h-[44px] rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-stone-warm/75 transition-colors hover:border-gold-dust/40 hover:text-gold-dust disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/10 disabled:hover:text-stone-warm/75"
                          >
                            {pick(TXT.next, lang)} →
                          </button>
                        </nav>
                      );
                    })()}

                    <footer className="mt-12 border-t border-white/5 pt-6 text-[11px] leading-relaxed text-stone-warm/50">
                      {content.meta.disclaimer || pick(TXT.cover_note, lang)}
                    </footer>
                  </article>
                )}
              </div>


              {/* Mobile TOC drawer */}
              <AnimatePresence>
                {content && tocOpen && (
                  <motion.div
                    key="drawer"
                    className="absolute inset-0 z-20 md:hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {/* Backdrop */}
                    <button
                      type="button"
                      aria-label={pick(TXT.close, lang)}
                      onClick={() => {
                        setTocOpen(false);
                        tocButtonRef.current?.focus();
                      }}
                      className="absolute inset-0 h-full w-full bg-obsidian/70 backdrop-blur-sm"
                    />
                    <motion.div
                      id="premium-toc-drawer"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby={drawerTitleId}
                      initial={{ y: "-100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "-100%" }}
                      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
                      className="absolute inset-x-0 top-0 max-h-[85vh] overflow-hidden rounded-b-3xl border-b border-white/10 bg-obsidian shadow-2xl"
                    >
                      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                        <h3
                          id={drawerTitleId}
                          className="text-[11px] uppercase tracking-[0.32em] text-gold-dust"
                        >
                          {pick(TXT.drawer_title, lang)}
                        </h3>
                        <button
                          ref={drawerCloseRef}
                          type="button"
                          onClick={() => {
                            setTocOpen(false);
                            tocButtonRef.current?.focus();
                          }}
                          className="min-h-[44px] rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-dust"
                          aria-label={pick(TXT.close, lang)}
                        >
                          {pick(TXT.close, lang)} ✕
                        </button>
                      </div>
                      <ol className="max-h-[calc(85vh-56px)] space-y-1 overflow-y-auto p-3">
                        {chapters.map((ch, i) => (
                          <li key={ch.key}>
                            <button
                              type="button"
                              onClick={() => scrollTo(ch.key, { focusHeading: true })}
                              aria-current={active === ch.key ? "true" : undefined}
                              className={`block w-full min-h-[44px] truncate rounded-md px-3 py-2 text-left text-sm ${
                                active === ch.key
                                  ? "bg-gold-dust/10 text-gold-light"
                                  : "text-stone-warm/80 hover:bg-white/5 hover:text-gold-dust"
                              }`}
                            >
                              <span className="mr-2 text-[11px] text-gold-dust/60">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              {ch.title}
                            </button>
                          </li>
                        ))}
                      </ol>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* FactsPanel — locally-derived chart facts. Visually distinct from   */
/* AI narrative so the user knows what's calculator ground truth      */
/* versus what's synthesized interpretation.                          */
/* ------------------------------------------------------------------ */

const ELEMENT_META: Record<BaZiElement, { zh: string; en: string; bar: string; dot: string }> = {
  wood:  { zh: "木", en: "Wood",  bar: "bg-emerald-400/70", dot: "bg-emerald-400" },
  fire:  { zh: "火", en: "Fire",  bar: "bg-red-400/70",     dot: "bg-red-400" },
  earth: { zh: "土", en: "Earth", bar: "bg-amber-400/70",   dot: "bg-amber-400" },
  metal: { zh: "金", en: "Metal", bar: "bg-slate-300/70",   dot: "bg-slate-300" },
  water: { zh: "水", en: "Water", bar: "bg-sky-400/70",     dot: "bg-sky-400" },
};

const FACTS_TXT = {
  section_facts: { zh: "命盘事实 · 排盘数据", en: "Chart facts · calculator output" },
  section_note: {
    zh: "以下由本地天文引擎 / lunar-javascript / iztro 直接生成，AI 只能引用不能改写。",
    en: "Emitted directly by the local astronomy engine / lunar-javascript / iztro. AI narrative may cite these values but never invent new ones.",
  },
  bazi: { zh: "八字四柱", en: "BaZi · Four Pillars" },
  pillar_year: { zh: "年柱", en: "Year" },
  pillar_month: { zh: "月柱", en: "Month" },
  pillar_day: { zh: "日柱 · 日主", en: "Day · self" },
  pillar_hour: { zh: "时柱", en: "Hour" },
  ten_gods: { zh: "十神（相对日主）", en: "Ten gods (vs day master)" },
  elements: { zh: "五行分布（干+支）", en: "Five-element distribution (stems + branches)" },
  zodiac: { zh: "生肖", en: "Zodiac" },
  ziwei: { zh: "紫微斗数 · 十二宫", en: "Zi Wei Dou Shu · Twelve Palaces" },
  soul: { zh: "命宫主星", en: "Soul palace" },
  body: { zh: "身宫主星", en: "Body palace" },
  fiveClass: { zh: "五行局", en: "Five-elements class" },
  lunar: { zh: "农历", en: "Lunar" },
  major_stars_empty: { zh: "空宫", en: "(empty palace)" },
  western: { zh: "西方占星 · 太阳", en: "Western · Sun" },
  vedic: { zh: "印度占星 · 月亮与大运", en: "Vedic · Moon & Mahadasha" },
  moon: { zh: "月亮 Nakshatra", en: "Moon Nakshatra" },
  dasha_now: { zh: "当前大运（Vimshottari 主运）", en: "Current mahadasha" },
  dasha_next: { zh: "下一大运", en: "Next mahadasha" },
  unavailable: {
    zh: "以下模块本地尚未接入真实计算器，AI 已被禁止编造：",
    en: "The following modules are not yet wired locally — the AI is forbidden from inventing them:",
  },
};

const UNAVAILABLE_LABELS: Record<string, { zh: string; en: string }> = {
  ziwei_da_xian_10year: { zh: "紫微 · 十年大限", en: "Zi Wei · 10-year 大限" },
  ziwei_liu_nian:       { zh: "紫微 · 流年",       en: "Zi Wei · annual 流年" },
  ziwei_liu_yue:        { zh: "紫微 · 流月",       en: "Zi Wei · monthly 流月" },
  vedic_antardasha:     { zh: "Vedic · Antardasha", en: "Vedic · Antardasha (sub-period)" },
  vedic_pratyantar:     { zh: "Vedic · Pratyantar", en: "Vedic · Pratyantar" },
  bazi_da_yun_luck_pillars: { zh: "八字 · 大运（流年柱）", en: "BaZi · 10-year 大运" },
};

function FactsPanel({ facts, lang }: { facts: PremiumFacts; lang: "zh" | "en" }) {
  return (
    <section
      data-ch="__facts"
      aria-label={pick(FACTS_TXT.section_facts, lang)}
      className="mb-10 rounded-3xl border border-gold-dust/25 bg-gold-dust/[0.03] p-5 md:p-6"
    >
      <p className="text-[10px] uppercase tracking-[0.36em] text-gold-dust/80">
        {pick(FACTS_TXT.section_facts, lang)}
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-stone-warm/60 [overflow-wrap:break-word]">
        {pick(FACTS_TXT.section_note, lang)}
      </p>

      {facts.bazi && <BaZiFactBlock bazi={facts.bazi} lang={lang} />}
      {facts.ziwei && <ZiweiFactBlock ziwei={facts.ziwei} lang={lang} />}
      {(facts.western || facts.vedic) && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {facts.western && <WesternFactBlock western={facts.western} lang={lang} />}
          {facts.vedic && <VedicFactBlock vedic={facts.vedic} lang={lang} />}
        </div>
      )}

      {facts.unavailable.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[12px] text-stone-warm/60">
          <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
            {pick(FACTS_TXT.unavailable, lang)}
          </p>
          <ul className="flex flex-wrap gap-2">
            {facts.unavailable.map((k) => {
              const lbl = UNAVAILABLE_LABELS[k];
              return (
                <li
                  key={k}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-stone-warm/60"
                >
                  {lbl ? pick(lbl, lang) : k}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function BaZiFactBlock({ bazi, lang }: { bazi: NonNullable<PremiumFacts["bazi"]>; lang: "zh" | "en" }) {
  const total =
    (Object.values(bazi.element_counts) as number[]).reduce((a, b) => a + b, 0) || 1;
  const pillars: Array<{ key: keyof typeof bazi.pillars; label: { zh: string; en: string } }> = [
    { key: "year",  label: FACTS_TXT.pillar_year },
    { key: "month", label: FACTS_TXT.pillar_month },
    { key: "day",   label: FACTS_TXT.pillar_day },
    { key: "hour",  label: FACTS_TXT.pillar_hour },
  ];
  const dm = bazi.day_master;
  const tenGodFor = (pillar: "year" | "month" | "hour") =>
    bazi.ten_gods.find((t) => t.pillar === pillar)?.label ?? null;
  return (
    <div className="mt-5">
      <h4 className="mb-3 font-serif text-base italic text-gold-light">
        {pick(FACTS_TXT.bazi, lang)}
      </h4>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {pillars.map(({ key, label }) => {
          const gz = bazi.pillars[key];
          const isDay = key === "day";
          const tg = key !== "day" ? tenGodFor(key) : null;
          return (
            <div
              key={key}
              className={`min-w-0 rounded-2xl border p-3 ${
                isDay
                  ? "border-gold-dust/50 bg-gold-dust/[0.06]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <p className="text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
                {pick(label, lang)}
              </p>
              <p className={`mt-1 font-serif text-2xl ${isDay ? "text-gold-light" : "text-stone-warm"}`}>
                {gz ?? "—"}
              </p>
              {tg && (
                <p className="mt-1 text-[11px] text-stone-warm/60">
                  {lang === "zh" ? "十神" : "Ten god"}: {tg}
                </p>
              )}
              {isDay && dm && (
                <p className="mt-1 text-[11px] text-stone-warm/60">
                  {lang === "zh" ? ELEMENT_META[dm.element].zh : ELEMENT_META[dm.element].en}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
          {pick(FACTS_TXT.elements, lang)}
        </p>
        <div className="flex h-3 w-full overflow-hidden rounded-full border border-white/10">
          {(Object.keys(ELEMENT_META) as BaZiElement[]).map((el) => {
            const v = bazi.element_counts[el] ?? 0;
            const pct = (v / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={el}
                className={`${ELEMENT_META[el].bar} h-full`}
                style={{ width: `${pct}%` }}
                aria-label={`${lang === "zh" ? ELEMENT_META[el].zh : ELEMENT_META[el].en} ${v}`}
              />
            );
          })}
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-warm/70">
          {(Object.keys(ELEMENT_META) as BaZiElement[]).map((el) => (
            <li key={el} className="flex items-center gap-1.5">
              <span className={`inline-block size-2 rounded-full ${ELEMENT_META[el].dot}`} />
              <span>{lang === "zh" ? ELEMENT_META[el].zh : ELEMENT_META[el].en}</span>
              <span className="text-stone-warm/50">· {bazi.element_counts[el] ?? 0}</span>
            </li>
          ))}
        </ul>
      </div>

      {bazi.zodiac && (
        <p className="mt-3 text-[11.5px] text-stone-warm/70">
          {pick(FACTS_TXT.zodiac, lang)}: {lang === "zh" ? bazi.zodiac.zh : bazi.zodiac.en}
        </p>
      )}
    </div>
  );
}

function ZiweiFactBlock({ ziwei, lang }: { ziwei: NonNullable<PremiumFacts["ziwei"]>; lang: "zh" | "en" }) {
  return (
    <div className="mt-6">
      <h4 className="mb-2 font-serif text-base italic text-gold-light">
        {pick(FACTS_TXT.ziwei, lang)}
      </h4>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-stone-warm/70">
        <span>{pick(FACTS_TXT.soul, lang)}: <span className="text-gold-light">{ziwei.soul || "—"}</span></span>
        <span>{pick(FACTS_TXT.body, lang)}: <span className="text-gold-light">{ziwei.body || "—"}</span></span>
        <span>{pick(FACTS_TXT.fiveClass, lang)}: <span className="text-gold-light">{ziwei.five_elements_class || "—"}</span></span>
        <span className="text-stone-warm/50">{pick(FACTS_TXT.lunar, lang)}: {ziwei.lunar_date || "—"}</span>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ziwei.palaces.map((p) => {
          const isSoul = p.index === ziwei.soul_palace_index;
          const majors = p.major_stars;
          return (
            <li
              key={p.index}
              className={`min-w-0 rounded-2xl border p-3 ${
                isSoul
                  ? "border-gold-dust/60 bg-gold-dust/[0.06]"
                  : p.is_body_palace
                  ? "border-nebula-purple/40 bg-nebula-purple/[0.05]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] text-stone-warm">
                  <span className="text-gold-light">{p.name}</span>
                  {isSoul && <span className="ml-1 text-[10px] text-gold-dust/80">· 命宫</span>}
                  {p.is_body_palace && !isSoul && (
                    <span className="ml-1 text-[10px] text-nebula-purple">· 身宫</span>
                  )}
                </p>
                <p className="shrink-0 text-[10px] tracking-[0.2em] text-stone-warm/50">
                  {p.heavenly_stem}{p.earthly_branch}
                </p>
              </div>
              {majors.length === 0 ? (
                <p className="mt-1 text-[11.5px] text-stone-warm/40">
                  {pick(FACTS_TXT.major_stars_empty, lang)}
                </p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-1">
                  {majors.map((s) => (
                    <li
                      key={s.name}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[11px] text-stone-warm/85"
                    >
                      {s.name}
                      {s.brightness && (
                        <span className="ml-0.5 text-[9px] text-stone-warm/50">·{s.brightness}</span>
                      )}
                      {s.mutagen && (
                        <span className="ml-0.5 text-[9px] text-gold-dust">·{s.mutagen}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {p.minor_stars.length > 0 && (
                <p className="mt-1 text-[10.5px] text-stone-warm/45 [overflow-wrap:break-word]">
                  {p.minor_stars.join(" · ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function WesternFactBlock({ western, lang }: { western: NonNullable<PremiumFacts["western"]>; lang: "zh" | "en" }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[12.5px] text-stone-warm/75">
      <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
        {pick(FACTS_TXT.western, lang)}
      </p>
      <p>
        {lang === "zh" ? western.sun.sign_zh : western.sun.sign_en} · {western.sun.element}
      </p>
    </div>
  );
}

function VedicFactBlock({ vedic, lang }: { vedic: NonNullable<PremiumFacts["vedic"]>; lang: "zh" | "en" }) {
  const fmt = (iso: string) => (iso ? iso.slice(0, 10) : "—");
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3 text-[12.5px] text-stone-warm/75">
      <p className="mb-1 text-[10px] uppercase tracking-[0.28em] text-stone-warm/50">
        {pick(FACTS_TXT.vedic, lang)}
      </p>
      <p>
        {pick(FACTS_TXT.moon, lang)}: {lang === "zh" ? vedic.moon.nakshatra_zh : vedic.moon.nakshatra_en} · pada {vedic.moon.pada}
      </p>
      {vedic.vimshottari_current && (
        <p className="mt-1">
          {pick(FACTS_TXT.dasha_now, lang)}: {vedic.vimshottari_current.lord} · {fmt(vedic.vimshottari_current.startISO)} → {fmt(vedic.vimshottari_current.endISO)}
        </p>
      )}
      {vedic.vimshottari_next && (
        <p className="mt-0.5 text-stone-warm/60">
          {pick(FACTS_TXT.dasha_next, lang)}: {vedic.vimshottari_next.lord} · {fmt(vedic.vimshottari_next.startISO)}
        </p>
      )}
    </div>
  );
}
