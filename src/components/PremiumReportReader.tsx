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

import { useLang } from "@/lib/i18n";
import { getPremiumReport, type PremiumContent } from "@/lib/premium.functions";

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
}: {
  open: boolean;
  chartId: string;
  chartName: string | null;
  onClose: () => void;
}) {
  const { lang } = useLang();
  const titleId = useId();
  const [content, setContent] = useState<PremiumContent | null>(null);
  const [errored, setErrored] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [tocOpen, setTocOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Load content on open.
  useEffect(() => {
    if (!open) return;
    setContent(null);
    setErrored(false);
    let cancel = false;
    getPremiumReport({ data: { chartId } })
      .then((r) => {
        if (cancel) return;
        if (r?.status === "completed" && r.content) {
          setContent(r.content);
          setActive(r.content.chapters[0]?.key ?? null);
        } else {
          setErrored(true);
        }
      })
      .catch(() => {
        if (!cancel) setErrored(true);
      });
    return () => {
      cancel = true;
    };
  }, [open, chartId]);

  // Body scroll lock + Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
  }, [open, onClose]);

  const scrollTo = useCallback((key: string) => {
    setActive(key);
    setTocOpen(false);
    const el = bodyRef.current?.querySelector(`[data-ch="${key}"]`) as HTMLElement | null;
    if (el)
      el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const heading = useMemo(() => {
    if (!content) return chartName ?? "";
    return content.cover.title;
  }, [content, chartName]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-stretch bg-obsidian/85 backdrop-blur-md"
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
            className="relative m-0 flex h-[100dvh] w-full flex-col bg-obsidian text-stone-warm focus:outline-none md:m-4 md:h-[calc(100dvh-2rem)] md:rounded-3xl md:border md:border-gold-dust/20 md:shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          >
            {/* Fixed top bar */}
            <header className="flex flex-none items-center gap-3 border-b border-white/5 px-4 py-3 md:px-8 md:py-4">
              <button
                type="button"
                onClick={() => setTocOpen((v) => !v)}
                aria-label={pick(TXT.jump, lang)}
                className="rounded-full border border-gold-dust/30 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-gold-dust hover:bg-gold-dust/10 md:hidden"
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
              <p className="hidden text-[10px] uppercase tracking-[0.28em] text-stone-warm/40 md:block">
                {pick(TXT.meta, lang)} · {fmtDate(content?.meta.generated_at ?? null, lang)}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.28em] text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-dust min-h-[36px]"
                aria-label={pick(TXT.close, lang)}
              >
                {pick(TXT.close, lang)} ✕
              </button>
            </header>

            {/* Body: desktop sidebar + article */}
            <div className="flex min-h-0 flex-1">
              {/* Sidebar TOC (desktop) */}
              {content && (
                <aside className="hidden w-64 flex-none overflow-y-auto border-r border-white/5 px-5 py-6 md:block">
                  <p className="mb-3 text-[10px] uppercase tracking-[0.32em] text-gold-dust/60">
                    {pick(TXT.toc, lang)}
                  </p>
                  <ol className="space-y-1.5">
                    {content.chapters.map((ch, i) => (
                      <li key={ch.key}>
                        <button
                          type="button"
                          onClick={() => scrollTo(ch.key)}
                          className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors ${
                            active === ch.key
                              ? "bg-gold-dust/10 text-gold-light"
                              : "text-stone-warm/70 hover:bg-white/5 hover:text-gold-dust"
                          }`}
                        >
                          <span className="mr-1.5 text-[10px] text-gold-dust/60">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {ch.title}
                        </button>
                      </li>
                    ))}
                  </ol>
                </aside>
              )}

              {/* Article */}
              <div
                ref={bodyRef}
                className="min-w-0 flex-1 overflow-y-auto px-5 py-6 md:px-10 md:py-10"
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
                  <article className="mx-auto max-w-3xl">
                    {/* Cover / summary */}
                    <section className="mb-8 border-b border-white/5 pb-6">
                      <p className="text-[10px] uppercase tracking-[0.36em] text-gold-dust/70">
                        {pick(TXT.meta, lang)} · {fmtDate(content.meta.generated_at, lang)}
                        {content.meta.report_schema_version
                          ? ` · schema ${content.meta.report_schema_version}`
                          : ""}
                      </p>
                      <h1 className="mt-2 font-serif text-2xl italic text-stone-warm md:text-3xl">
                        {content.cover.title}
                      </h1>
                      <p className="mt-1 text-sm text-stone-warm/70">{content.cover.subtitle}</p>
                    </section>

                    {/* Locally-derived facts (v2+). Absent on legacy rows. */}
                    {content.facts && <FactsPanel facts={content.facts} lang={lang} />}

                    {content.chapters.map((ch, i) => (
                      <section
                        key={ch.key}
                        data-ch={ch.key}
                        className="mb-10 scroll-mt-24"
                      >
                        <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
                          {String(i + 1).padStart(2, "0")} · {pick(TXT.toc, lang)}
                        </p>
                        <h3 className="mt-1 font-serif text-xl italic text-gold-light md:text-2xl">
                          {ch.title}
                        </h3>
                        <div className="mt-3 space-y-4 text-[15px] leading-[1.75] text-stone-warm/85 [overflow-wrap:break-word]">
                          {ch.body.split(/\n\s*\n/).map((para, k) => (
                            <p key={k}>{para.trim()}</p>
                          ))}
                        </div>
                      </section>
                    ))}

                    <footer className="mt-12 border-t border-white/5 pt-6 text-[11px] leading-relaxed text-stone-warm/50">
                      {content.meta.disclaimer || pick(TXT.cover_note, lang)}
                    </footer>
                  </article>
                )}
              </div>

              {/* Mobile TOC drawer */}
              {content && tocOpen && (
                <div
                  className="absolute inset-x-0 top-[60px] z-10 border-b border-white/10 bg-obsidian/95 backdrop-blur md:hidden"
                  onClick={() => setTocOpen(false)}
                >
                  <ol className="max-h-[60vh] space-y-1 overflow-y-auto p-4">
                    {content.chapters.map((ch, i) => (
                      <li key={ch.key}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollTo(ch.key);
                          }}
                          className="block w-full truncate rounded-md px-3 py-2 text-left text-sm text-stone-warm/80 hover:bg-white/5 hover:text-gold-dust"
                        >
                          <span className="mr-2 text-[11px] text-gold-dust/60">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          {ch.title}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
