/**
 * ReportToc — the single, canonical table of contents for /report.
 *
 * Layout policy:
 *   - Desktop (lg ≥ 1024): a fixed vertical dot rail pinned to the
 *     left edge below the global nav. Hover / focus-within / click
 *     expands a labelled panel with per-section hints. Users can pin
 *     the panel open. The old horizontal sticky top bar is hidden
 *     at this breakpoint so nothing is duplicated.
 *   - md (≥ 768, < 1024): keeps the compact horizontal sticky bar so
 *     tablets still get in-page chapter jumps without eating vertical
 *     space.
 *   - < 768 (mobile): a floating "Reading contents" trigger that opens
 *     a bottom drawer with the same items.
 *
 * The `items` prop is the ONLY source of truth: the parent builds it
 * from the same data that renders the sections, so nothing drifts.
 * Each item's `id` must match the DOM `id` of its section/article.
 */
import { useEffect, useRef, useState } from "react";

export type TocItem = {
  id: string;
  label: string;
  hint: string;
};

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const nav = parseInt(
    getComputedStyle(document.documentElement).getPropertyValue("--site-nav-height") || "96",
    10,
  );
  const y = el.getBoundingClientRect().top + window.scrollY - (nav + 16);
  window.scrollTo({ top: y, behavior: "smooth" });
  if (typeof window !== "undefined" && window.history.replaceState) {
    window.history.replaceState(null, "", `#${id}`);
  }
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

// On mount, if the URL has a #hash matching one of our items,
// scroll it into view with the correct nav offset. Runs once.
function useHashJump(items: TocItem[]) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = window.location.hash.replace(/^#/, "");
    if (!id) return;
    if (!items.some((i) => i.id === id)) return;
    // Wait a frame for layout to settle.
    const t = window.setTimeout(() => scrollToId(id), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function ReportToc({ items, lang }: { items: TocItem[]; lang: "en" | "zh" }) {
  const active = useActiveSection(items);
  useHashJump(items);
  const [open, setOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const [pinned, setPinned] = useState(false);
  const collapseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        if (!pinned) setRailExpanded(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned]);

  if (items.length === 0) return null;
  const tocLabel = lang === "zh" ? "阅读目录" : "Reading contents";
  const closeLabel = lang === "zh" ? "关闭" : "Close";
  const pinLabel = pinned
    ? lang === "zh" ? "取消固定" : "Unpin"
    : lang === "zh" ? "固定" : "Pin";

  const scheduleCollapse = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (pinned) return;
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    collapseTimer.current = setTimeout(() => setRailExpanded(false), 200);
  };
  /** Hover-intent: only expand after the pointer rests on the rail itself. */
  const scheduleExpand = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (railExpanded) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => setRailExpanded(true), 260);
  };
  const cancelCollapse = () => {
    if (collapseTimer.current) clearTimeout(collapseTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
    setRailExpanded(true);
  };

  const showPanel = railExpanded || pinned;
  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.id === active),
  );

  return (
    <>
      {/* Desktop LEFT DOT RAIL — lg and above */}
      <aside
        aria-label={tocLabel}
        style={{ top: "calc(var(--site-nav-height, 96px) + 80px)" }}
        className="pointer-events-none fixed left-3 z-30 hidden max-h-[calc(100dvh-var(--site-nav-height,96px)-120px)] lg:flex xl:left-5"
        data-testid="report-toc-rail"
      >
        <div
          className="pointer-events-auto flex items-start gap-2"
          onMouseLeave={scheduleCollapse}
          onFocusCapture={cancelCollapse}
          onBlurCapture={scheduleCollapse}
        >
          {/* Dots column — hovering here (with intent delay) opens the panel */}
          <div
            onMouseEnter={scheduleExpand}
            onMouseMove={scheduleExpand}
            className="flex flex-col items-center gap-2 rounded-full border border-gold-dust/25 bg-obsidian/70 px-2 py-3 backdrop-blur"
          >
            {items.map((it, idx) => {
              const isActive = it.id === active;
              const isRead = idx < activeIndex;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => scrollToId(it.id)}
                  onFocus={cancelCollapse}
                  aria-label={it.label}
                  aria-current={isActive ? "true" : undefined}
                  title={it.label}
                  className={`grid h-4 w-4 place-items-center transition ${
                    isActive
                      ? "scale-125"
                      : isRead
                        ? "opacity-70"
                        : "opacity-45 hover:opacity-100"
                  }`}
                >
                  <span
                    className={`block h-2 w-2 rounded-full transition ${
                      isActive
                        ? "bg-gold-light shadow-[0_0_10px_2px_rgba(232,204,140,0.55)]"
                        : isRead
                          ? "bg-gold-dust/70"
                          : "bg-stone-warm/40"
                    }`}
                  />
                </button>
              );
            })}
          </div>
          {/* Expandable panel */}
          <div
            className={`w-72 max-w-[min(20rem,calc(100vw-6rem))] overflow-hidden rounded-2xl border border-gold-dust/25 bg-obsidian/95 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-200 ${
              showPanel
                ? "translate-x-0 opacity-100"
                : "pointer-events-none -translate-x-3 opacity-0"
            }`}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/80">
                {tocLabel} · {activeIndex + 1}/{items.length}
              </span>
              <button
                type="button"
                onClick={() => setPinned((v) => !v)}
                className="rounded-full border border-white/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.24em] text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-light"
              >
                {pinLabel}
              </button>
            </div>
            <ul className="max-h-[60dvh] space-y-0.5 overflow-y-auto p-2">
              {items.map((it) => {
                const isActive = it.id === active;
                return (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => scrollToId(it.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`block w-full rounded-lg px-3 py-2 text-left transition ${
                        isActive
                          ? "bg-gold-dust/10 text-gold-light"
                          : "text-stone-warm/85 hover:bg-gold-dust/10 hover:text-gold-light"
                      }`}
                    >
                      <div className="text-sm">{it.label}</div>
                      <div className="mt-0.5 text-[11px] text-stone-warm/55">{it.hint}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </aside>

      {/* Tablet compact top bar — md to lg only */}
      <nav
        aria-label={tocLabel}
        style={{ top: "calc(var(--site-nav-height, 96px) + 8px)" }}
        className="sticky z-30 mx-auto mb-8 hidden max-w-6xl px-4 sm:px-6 md:block lg:hidden"
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

      {/* Mobile floating trigger — < md */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        className="fixed left-4 z-40 flex min-h-11 items-center gap-2 rounded-full border border-gold-dust/40 bg-obsidian/85 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-gold-dust shadow-[0_6px_24px_rgba(0,0,0,0.6)] backdrop-blur md:hidden"
        data-testid="report-toc-trigger"
      >
        <span aria-hidden>☰</span>
        {tocLabel} · {activeIndex + 1}/{items.length}
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
