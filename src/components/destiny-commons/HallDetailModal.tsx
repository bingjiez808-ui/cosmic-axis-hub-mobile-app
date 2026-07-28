/**
 * HallDetailModal — shared 命运通识馆 detail dialog.
 *
 * Consumed by both the home preview section and the standalone
 * /life-studies page. Uses shadcn Dialog (Radix underneath) so we get
 * focus trap, ESC close, overlay click close, focus return to trigger,
 * and body scroll lock for free — matches the accessibility contract.
 */

import { Link } from "@tanstack/react-router";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HALL_IMAGE } from "@/components/destiny-commons/hall-images";
import { HallGallery } from "@/components/destiny-commons/HallGallery";
import type { DestinyCommonsHall } from "@/lib/destiny-commons";


type Props = {
  hall: DestinyCommonsHall | null;
  isZh: boolean;
  onOpenChange: (open: boolean) => void;
};

export function HallDetailModal({ hall, isZh, onOpenChange }: Props) {
  const open = !!hall;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[780px] overflow-hidden border-gold-dust/25 bg-obsidian/95 p-0 text-stone-warm">
        {hall && <HallBody hall={hall} isZh={isZh} />}
      </DialogContent>
    </Dialog>
  );
}

function HallHero({ hall, isZh }: { hall: DestinyCommonsHall; isZh: boolean }) {
  const isOpen = hall.status === "open";
  return (
    <div className="relative h-40 w-full overflow-hidden sm:h-52">
      <img
        src={HALL_IMAGE[hall.id]}
        alt={isZh ? hall.nameZh : hall.nameEn}
        width={1280}
        height={720}
        loading="lazy"
        className={`h-full w-full object-cover transition-transform duration-[8000ms] ease-out ${
          isOpen ? "scale-105 animate-[hall-drift_18s_ease-in-out_infinite]" : "scale-100 grayscale-[0.35]"
        }`}
      />
      {/* Vignette + top gradient for text legibility of header below */}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-obsidian/40 via-obsidian/20 to-obsidian/95" />
      {/* Per-hall dynamic gallery overlay — cross-fades on hall switch via key */}
      <HallGallery hallId={hall.id} dim={!isOpen} />
      {/* Golden particle shimmer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen"
        style={{
          background:
            "radial-gradient(circle at 20% 30%, rgba(224,182,90,0.18), transparent 40%), radial-gradient(circle at 80% 70%, rgba(180,120,255,0.14), transparent 45%)",
        }}
      />
      <style>{`@keyframes hall-drift {
        0%,100% { transform: scale(1.05) translate3d(0,0,0); }
        50% { transform: scale(1.08) translate3d(-1.5%, -1%, 0); }
      }`}</style>
    </div>
  );
}


function HallBody({ hall, isZh }: { hall: DestinyCommonsHall; isZh: boolean }) {
  const isOpen = hall.status === "open";
  const statusLabel = isOpen
    ? isZh
      ? "已开放"
      : "Open"
    : isZh
      ? "馆藏整理中"
      : "Collection in progress";

  return (
    <div className="flex max-h-[85vh] flex-col">
      <HallHero hall={hall} isZh={isZh} />
      <DialogHeader className="shrink-0 border-b border-white/5 px-6 pb-4 pt-5 text-left sm:px-8">
        <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.32em]">
          <span className="text-gold-dust/70">
            {isZh ? "命运通识馆" : "General Knowledge Hall"} · {hall.code}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              isOpen
                ? "border-emerald-400/45 bg-emerald-400/10 text-emerald-200"
                : "border-amber-200/30 bg-amber-100/[0.05] text-amber-100/80"
            }`}
          >
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                isOpen
                  ? "bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.9)] animate-pulse"
                  : "bg-amber-200/80 animate-pulse"
              }`}
            />
            {statusLabel}
          </span>

        </div>
        <DialogTitle className="mt-3 font-serif text-2xl leading-tight text-stone-warm">
          {isZh ? hall.nameZh : hall.nameEn} ·{" "}
          <span className="italic gold-gradient-text">
            {isZh ? hall.subtitleZh : hall.subtitleEn}
          </span>
        </DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-relaxed text-stone-warm/65">
          {isZh ? hall.summaryZh : hall.summaryEn}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 sm:px-8">
        <section>
          <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/60">
            {isZh ? "这座馆会帮助你看到什么" : "What this hall helps you see"}
          </p>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-stone-warm/75">
            {hall.capabilities.map((c, i) => (
              <li key={i} className="flex gap-3">
                <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-dust/70" />
                <span>{isZh ? c.zh : c.en}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[10px] uppercase tracking-[0.32em] text-stone-warm/50">
            {isZh ? "读取的既有命盘证据" : "Existing chart evidence it reads"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-warm/70">
            {isZh ? hall.evidenceSources.zh : hall.evidenceSources.en}
          </p>
        </section>

        <section className="mt-4 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <p className="text-[10px] uppercase tracking-[0.32em] text-stone-warm/50">
            {isZh ? "这座馆不会做什么" : "What this hall will not do"}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-stone-warm/70">
            {isZh ? hall.disclaimer.zh : hall.disclaimer.en}
          </p>
        </section>

        {!isOpen && (
          <p className="mt-5 text-[12px] leading-relaxed text-stone-warm/50">
            {isZh
              ? "开放后，这里的馆灯会亮起。你可以先探索已经开放的馆室。"
              : "When this hall opens its lamp will light. In the meantime you can explore the halls that are already open."}
          </p>
        )}
      </div>

      <footer className="shrink-0 border-t border-white/5 bg-obsidian/80 px-6 py-4 sm:px-8">
        {isOpen && hall.route ? (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link
              to={hall.route}
              className="inline-flex min-h-[44px] items-center rounded-full border border-gold-dust/50 bg-obsidian/80 px-6 py-2.5 text-[11px] uppercase tracking-[0.28em] text-gold-dust transition hover:bg-gold-dust/10"
            >
              {isZh ? `进入${hall.nameZh}` : `Enter the ${hall.nameEn}`}
            </Link>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[11px] uppercase tracking-[0.28em] text-stone-warm/45">
              {isZh ? "馆藏整理中" : "Collection in progress"}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/life-studies/math"
                className="inline-flex min-h-[40px] items-center rounded-full border border-white/15 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-dust"
              >
                {isZh ? "先去数学馆" : "Try Mathematics"}
              </Link>
              <Link
                to="/me/echoes"
                className="inline-flex min-h-[40px] items-center rounded-full border border-white/15 px-4 py-2 text-[11px] uppercase tracking-[0.24em] text-stone-warm/70 hover:border-gold-dust/40 hover:text-gold-dust"
              >
                {isZh ? "先去语文馆" : "Try Literature"}
              </Link>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}
