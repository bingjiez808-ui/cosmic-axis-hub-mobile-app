import { useEffect, useMemo, useState } from "react";

import { MATH_BOOKMARKS } from "./bookmarks";
import type { LifeMathPoint, MathBookmark } from "./types";

const STORAGE_KEY = "fate.math.bookmark.v1";

export function useSelectedBookmark(): [string, (id: string) => void] {
  const [id, setId] = useState<string>(MATH_BOOKMARKS[0].id);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw && MATH_BOOKMARKS.some((b) => b.id === raw)) setId(raw);
      const url = new URL(window.location.href);
      const q = url.searchParams.get("bookmark");
      if (q && MATH_BOOKMARKS.some((b) => b.id === q)) setId(q);
    } catch { /* ignore */ }
  }, []);
  const update = (next: string) => {
    setId(next);
    try {
      if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
    } catch { /* ignore */ }
  };
  return [id, update];
}

export function BookmarkStrip({
  points,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  lang,
}: {
  points: LifeMathPoint[];
  selectedId: string;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  lang: "zh" | "en";
}) {
  const isZh = lang === "zh";
  const selected: MathBookmark = useMemo(
    () => MATH_BOOKMARKS.find((b) => b.id === selectedId) ?? MATH_BOOKMARKS[0],
    [selectedId],
  );

  return (
    <section className="rounded-2xl border border-amber-400/15 bg-[#0b0b14]/70 p-4 md:p-5" data-testid="math-bookmarks">
      <div className="text-[11px] uppercase tracking-[0.28em] text-amber-200/60">
        {isZh ? "人生数学书签" : "Life-Math Bookmarks"}
      </div>
      <h3 className="mt-1 font-serif text-lg text-amber-50">
        {isZh ? "换一种理解人生的方式" : "Another way to read the curve"}
      </h3>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-amber-100/80">
        {isZh
          ? "这些定律不是给人生下结论, 而是帮助你在复杂时刻换一种理解方式。点击一张书签, 它会在曲线上指出与它最相关的阶段。"
          : "These heuristics don't conclude your life — they offer another reading in complex moments. Tap a bookmark to spotlight the phase it relates to."}
      </p>

      <div className="mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:overflow-visible">
        {MATH_BOOKMARKS.map((b) => {
          const on = b.id === selectedId;
          const hovered = b.id === hoveredId;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelect(b.id)}
              onMouseEnter={() => onHover(b.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(b.id)}
              onBlur={() => onHover(null)}
              aria-pressed={on}
              data-testid={`bookmark-${b.id}`}
              className={`min-h-[88px] min-w-[210px] shrink-0 snap-start rounded-xl border p-3 text-left text-[12px] transition ${
                on
                  ? "border-amber-300/70 bg-[#111a2e] text-amber-50 shadow-[0_0_0_1px_rgba(252,211,77,0.35)]"
                  : hovered
                    ? "border-blue-300/40 bg-[#0f172a] text-amber-50"
                    : "border-amber-400/15 bg-[#0f0f1a]/60 text-amber-100 hover:border-amber-400/30"
              } md:min-w-0`}
            >
              <div className="text-[13px] font-medium">{b.title[lang]}</div>
              <p className="mt-1 line-clamp-2 text-[11px] text-amber-200/75">{b.summary[lang]}</p>
              {on && (
                <div className="mt-1 text-[10px] uppercase tracking-[0.24em] text-amber-300/70">
                  {isZh ? "已选中" : "Selected"}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 完整解释卡 */}
      <div className="mt-4 rounded-xl border border-blue-300/25 bg-[#0b1428]/80 p-4 text-[12px] text-amber-50" data-testid="bookmark-detail">
        <div className="font-serif text-base text-amber-50">{selected.title[lang]}</div>
        <p className="mt-1 text-[13px] text-amber-100/90">{selected.summary[lang]}</p>
        <p className="mt-2 leading-relaxed text-amber-100/80">{selected.explanation[lang]}</p>
        <div className="mt-3 rounded-md border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-100/90">
          {isZh ? "试着这样做: " : "Try this: "}{selected.actionPrompt[lang]}
        </div>
      </div>
    </section>
  );
}
