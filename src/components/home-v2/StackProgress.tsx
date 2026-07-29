/**
 * StackProgress — right-side bookmark rail on desktop, bottom pill on
 * mobile. Shows "NN / total" plus the current card title, and lets the
 * reader jump between the seven Scroll Stack cards.
 */
import { useState } from "react";
import type { HomeGuideCard } from "@/lib/home-guide-cards";

export type StackProgressProps = {
  cards: readonly HomeGuideCard[];
  activeIndex: number;
  isZh: boolean;
};

function scrollToCard(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function StackProgress({ cards, activeIndex, isZh }: StackProgressProps) {
  const [expanded, setExpanded] = useState(false);
  const active = cards[activeIndex] ?? cards[0];
  const total = cards.length;

  return (
    <>
      {/* Desktop rail */}
      <nav
        aria-label={isZh ? "馆藏索引" : "Card index"}
        className="pointer-events-auto fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={() => setExpanded(false)}
      >
        <div className="rounded-2xl border border-gold-dust/20 bg-obsidian/70 px-3 py-4 backdrop-blur-md">
          <p className="mb-3 text-center text-[9px] uppercase tracking-[0.28em] text-gold-dust/60">
            {String(activeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
          <ul className="flex flex-col gap-2">
            {cards.map((c, i) => {
              const isActive = i === activeIndex;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => scrollToCard(c.id)}
                    aria-current={isActive ? "true" : undefined}
                    className="group flex w-full items-center gap-3 rounded-lg px-2 py-1 text-left transition hover:bg-gold-dust/10 focus:bg-gold-dust/10 focus:outline-none"
                  >
                    <span
                      aria-hidden
                      className={`h-2 w-2 shrink-0 rounded-full transition ${
                        isActive
                          ? "bg-gold-dust shadow-[0_0_10px_rgba(220,180,90,0.7)]"
                          : "bg-stone-warm/30 group-hover:bg-gold-dust/60"
                      }`}
                    />
                    <span
                      className={`whitespace-nowrap text-[11px] uppercase tracking-[0.22em] transition-all ${
                        expanded || isActive ? "opacity-100" : "w-0 overflow-hidden opacity-0"
                      } ${isActive ? "text-gold-light" : "text-stone-warm/60"}`}
                    >
                      {String(i + 1).padStart(2, "0")} · {isZh ? c.titleZh : c.titleEn}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* Mobile pill */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center lg:hidden">
        <button
          type="button"
          onClick={() => {
            const next = (activeIndex + 1) % total;
            scrollToCard(cards[next].id);
          }}
          className="pointer-events-auto flex items-center gap-3 rounded-full border border-gold-dust/30 bg-obsidian/85 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-stone-warm/85 backdrop-blur-md"
        >
          <span className="text-gold-dust">
            {String(activeIndex + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <span className="max-w-[55vw] truncate">
            {isZh ? active.titleZh : active.titleEn}
          </span>
          <span aria-hidden className="text-gold-dust/60">→</span>
        </button>
      </div>
    </>
  );
}
