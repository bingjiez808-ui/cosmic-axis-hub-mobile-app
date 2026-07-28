/**
 * ReportToc — single-source-of-truth table of contents for /report.
 *
 * Desktop (≥ md): sticky top bar rendered below the global nav, using
 * `--site-nav-height` so the report title is never covered on scroll.
 * Mobile: a compact "Reading table of contents / 阅读目录" trigger that
 * opens a bottom drawer listing every section with its short purpose.
 *
 * The `items` prop is the ONLY source of truth: the parent builds it
 * from the same data that renders the sections, so nothing can drift.
 * Each item's `id` must match the DOM `id` of its section/article.
 */
import { useEffect, useState } from "react";

export type TocItem = {
  id: string;
  label: string;
  hint: string;
};

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const nav = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--site-nav-height") || "96",
    10,
  );
  const y = el.getBoundingClientRect().top + window.scrollY - (nav + 16);
  window.scrollTo({ top: y, behavior: "smooth" });
}

function useActiveSection(items: TocItem[]): string | null {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  useEffect(() => {
    if (items.length === 0) return;
    const nav = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue("--site-nav-height") || "96",
      10,
    );
    const update = () => {
      const probe = nav + 32;
      let current: string | null = items[0]?.id ?? null;
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - probe <= 0) current = it.id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);
  return active;
}

export function ReportToc({ items, lang }: { items: TocItem[]; lang: "en" | "zh" }) {
  const active = useActiveSection(items);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  if (items.length === 0) return null;
  const tocLabel = lang === "zh" ? "阅读目录" : "Reading contents";
  const closeLabel = lang === "zh" ? "关闭" : "Close";

  return (
    <>
      {/* Desktop sticky rail */}
      <nav
        aria-label={tocLabel}
        style={{ top: "calc(var(--site-nav-height, 96px) + 8px)" }}
        className="sticky z-30 mx-auto mb-8 hidden max-w-6xl px-4 sm:px-6 md:block"
        data-testid="report-toc-desktop"
      >
        <div className="glass-card flex items-center gap-2 overflow-x-auto rounded-full border border-gold-dust/25 bg-obsidian/80 px-3 py-2 backdrop-blur [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="shrink-0 pl-1 pr-2 text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
            {tocLabel}
          </span>
          {items.map((it) => {
            const isActive = it.id === active;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => scrollToId(it.id)}
                aria-current={isActive ? "true" : undefined}
                title={it.hint}
                className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-[11px] transition ${
                  isActive
                    ? "bg-gold-dust/15 text-gold-light ring-1 ring-gold-dust/40"
                    : "text-stone-warm/70 hover:text-gold-light"
                }`}
              >
                {it.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile floating trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed bottom-5 right-4 z-40 flex min-h-11 items-center gap-2 rounded-full border border-gold-dust/40 bg-obsidian/85 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-gold-dust shadow-[0_6px_24px_rgba(0,0,0,0.6)] backdrop-blur md:hidden"
        data-testid="report-toc-trigger"
      >
        <span aria-hidden>☰</span>
        {tocLabel}
      </button>

      {/* Mobile drawer */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tocLabel}
          className="fixed inset-0 z-50 md:hidden"
          data-testid="report-toc-drawer"
        >
          <button
            type="button"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-obsidian/70 backdrop-blur-sm"
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-3xl border-t border-gold-dust/25 bg-obsidian/95 p-4 pb-8">
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-white/20" />
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                {tocLabel}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-stone-warm/70"
              >
                {closeLabel}
              </button>
            </div>
            <ul className="space-y-1">
              {items.map((it) => {
                const isActive = it.id === active;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => {
                        scrollToId(it.id);
                        setOpen(false);
                      }}
                      aria-current={isActive ? "true" : undefined}
                      className={`block w-full rounded-xl border px-3 py-3 text-left transition ${
                        isActive
                          ? "border-gold-dust/50 bg-gold-dust/10"
                          : "border-white/10 bg-white/[0.02] hover:border-gold-dust/30"
                      }`}
                    >
                      <div
                        className={`text-sm ${isActive ? "text-gold-light" : "text-stone-warm"}`}
                      >
                        {it.label}
                      </div>
                      <div className="mt-0.5 text-[11px] text-stone-warm/55">{it.hint}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
