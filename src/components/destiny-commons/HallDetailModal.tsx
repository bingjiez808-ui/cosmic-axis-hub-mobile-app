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
      <DialogContent className="max-h-[80vh] max-w-[780px] overflow-hidden border-gold-dust/25 bg-obsidian/95 p-0 text-stone-warm">
        {hall && <HallBody hall={hall} isZh={isZh} />}
      </DialogContent>
    </Dialog>
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
    <div className="flex max-h-[80vh] flex-col">
      <DialogHeader className="shrink-0 border-b border-white/5 px-6 pb-4 pt-6 text-left sm:px-8">
        <div className="flex flex-wrap items-center gap-3 text-[10px] uppercase tracking-[0.32em]">
          <span className="text-gold-dust/70">
            {isZh ? "命运通识馆" : "General Knowledge Hall"} · {hall.code}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
              isOpen
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : "border-white/15 bg-white/5 text-stone-warm/55"
            }`}
          >
            <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
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
