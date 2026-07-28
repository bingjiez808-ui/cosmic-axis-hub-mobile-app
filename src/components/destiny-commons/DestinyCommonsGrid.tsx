/**
 * DestinyCommonsGrid — 3×2 compact grid of the six thematic halls.
 *
 * Shared between the home preview and the standalone /life-studies
 * page. Clicking a card opens the HallDetailModal (never expands the
 * page height). Coming-soon halls do not navigate.
 */

import { useState } from "react";

import { HallDetailModal } from "@/components/destiny-commons/HallDetailModal";
import { HALL_IMAGE } from "@/components/destiny-commons/hall-images";
import {
  DESTINY_COMMONS_HALLS,
  type DestinyCommonsHall,
} from "@/lib/destiny-commons";
import { cn } from "@/lib/utils";

type Props = { isZh: boolean };

export function DestinyCommonsGrid({ isZh }: Props) {
  const [active, setActive] = useState<DestinyCommonsHall | null>(null);

  return (
    <div className="relative mx-auto max-w-[1280px]">
      {/* Decorative central compass — desktop only, non-interactive */}
      <svg
        aria-hidden
        viewBox="0 0 800 500"
        className="pointer-events-none absolute inset-0 hidden h-full w-full opacity-50 md:block"
      >
        <defs>
          <radialGradient id="dc-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(224,182,90,0.16)" />
            <stop offset="60%" stopColor="rgba(224,182,90,0.02)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <circle cx="400" cy="250" r="200" fill="url(#dc-glow)" />
        <circle cx="400" cy="250" r="60" fill="none" stroke="rgba(224,182,90,0.28)" strokeWidth="0.6" />
        <circle cx="400" cy="250" r="110" fill="none" stroke="rgba(224,182,90,0.15)" strokeWidth="0.5" strokeDasharray="2 4" />
        {/* Six fine curved lines to card centres */}
        {[
          [140, 130],
          [400, 90],
          [660, 130],
          [140, 370],
          [400, 410],
          [660, 370],
        ].map(([x, y], i) => (
          <path
            key={i}
            d={`M400,250 Q${(400 + x) / 2},${(250 + y) / 2 - 20} ${x},${y}`}
            fill="none"
            stroke="rgba(224,182,90,0.22)"
            strokeWidth="0.6"
          />
        ))}
        <text
          x="400"
          y="256"
          textAnchor="middle"
          fill="rgba(224,182,90,0.55)"
          fontSize="9"
          letterSpacing="4"
        >
          COMMONS
        </text>
      </svg>

      {/* Grid */}
      <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 lg:grid-cols-3">
        {DESTINY_COMMONS_HALLS.map((hall) => (
          <HallCard key={hall.id} hall={hall} isZh={isZh} onOpen={() => setActive(hall)} />
        ))}
      </div>

      <HallDetailModal
        hall={active}
        isZh={isZh}
        onOpenChange={(open) => {
          if (!open) setActive(null);
        }}
      />
    </div>
  );
}

function HallSymbol({ id }: { id: DestinyCommonsHall["id"] }) {
  const common = "h-6 w-6 text-gold-dust/75";
  switch (id) {
    case "mathematics":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 18 Q9 4 21 14" />
          <circle cx="9" cy="12" r="1.2" fill="currentColor" />
          <circle cx="16" cy="15" r="1.2" fill="currentColor" />
        </svg>
      );
    case "literature":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M4 5h7v14H4z" />
          <path d="M13 5h7v14h-7z" />
          <path d="M8 9h-1 M8 13h-1 M17 9h-1 M17 13h-1" />
        </svg>
      );
    case "geography":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.4">
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16 M12 4c3 3 3 13 0 16 M12 4c-3 3-3 13 0 16" />
        </svg>
      );
    case "physics":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.4">
          <ellipse cx="12" cy="12" rx="9" ry="4" />
          <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        </svg>
      );
    case "economics":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M12 3v6 M12 9 6 20 M12 9l6 11" />
          <circle cx="6" cy="20" r="1.2" fill="currentColor" />
          <circle cx="18" cy="20" r="1.2" fill="currentColor" />
        </svg>
      );
    case "biology":
      return (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 14 Q7 6 12 14 T21 14" />
          <path d="M3 18 Q7 12 12 18 T21 18" opacity="0.6" />
        </svg>
      );
  }
}

function HallCard({
  hall,
  isZh,
  onOpen,
}: {
  hall: DestinyCommonsHall;
  isZh: boolean;
  onOpen: () => void;
}) {
  const isOpen = hall.status === "open";
  const statusLabel = isOpen
    ? isZh
      ? "已开放"
      : "Open"
    : isZh
      ? "馆藏整理中"
      : "Collection in progress";
  const enterLabel = isOpen
    ? isZh
      ? "进入此馆 →"
      : "Enter this hall →"
    : isZh
      ? "查看馆藏预告"
      : "See preview";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={cn(
        "group relative flex min-h-[196px] flex-col overflow-hidden rounded-2xl border p-5 text-left transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-dust/60",
        isOpen
          ? "border-white/10 bg-obsidian/70 hover:border-gold-dust/45 hover:bg-obsidian/85 hover:shadow-[0_18px_44px_-24px_rgba(212,162,74,0.35)]"
          : "border-white/5 bg-obsidian/40 hover:border-white/15",
      )}
    >
      {/* Ambient hall image — sits behind content, subtly parallaxes on hover */}
      <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src={HALL_IMAGE[hall.id]}
          alt=""
          width={1280}
          height={720}
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition-all duration-700 ease-out",
            isOpen
              ? "opacity-25 group-hover:scale-[1.08] group-hover:opacity-40"
              : "opacity-10 grayscale group-hover:opacity-20",
          )}
        />
        <span className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/85 to-obsidian/40" />
      </span>

      {/* Accent side-strip */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-0 z-[1] h-full w-[3px] bg-gradient-to-b",
          hall.accent,
          !isOpen && "opacity-40",
        )}
      />

      <div className="relative z-[1] flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-gold-dust/30 bg-obsidian/70">
            <HallSymbol id={hall.id} />
          </span>
          <span className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/60">
            {hall.code}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.24em]",
            isOpen
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
              : "border-white/10 bg-white/5 text-stone-warm/50",
          )}
        >
          {statusLabel}
        </span>
      </div>

      <h3
        className={cn(
          "relative z-[1] mt-3 font-serif text-lg leading-snug",
          isOpen ? "text-stone-warm" : "text-stone-warm/75",
        )}
      >
        {isZh ? hall.nameZh : hall.nameEn}
      </h3>
      <p
        className={cn(
          "relative z-[1] mt-1 text-xs italic",
          isOpen ? "text-gold-light/80" : "text-stone-warm/45",
        )}
      >
        {isZh ? hall.subtitleZh : hall.subtitleEn}
      </p>
      <p
        className={cn(
          "relative z-[1] mt-2 flex-1 text-[13px] leading-relaxed",
          isOpen ? "text-stone-warm/70" : "text-stone-warm/50",
        )}
      >
        {isZh ? hall.summaryZh : hall.summaryEn}
      </p>

      <span
        className={cn(
          "relative z-[1] mt-4 text-[11px] uppercase tracking-[0.28em]",
          isOpen ? "text-gold-dust/85" : "text-stone-warm/45",
        )}
      >
        {enterLabel}
      </span>
    </button>
  );
}
