/**
 * 同门 · 众生之厅 — the four doors.
 *
 * Each door is a lit alcove in the archive: a candlelit photograph behind a
 * parchment scrim, a cursor-tracked warm spotlight, and a slow shine that
 * sweeps the frame on hover. All motion is CSS-driven so it degrades cleanly
 * under `prefers-reduced-motion` and `[data-perf="lite"]`.
 */
import { Link } from "@tanstack/react-router";
import type { MouseEvent } from "react";

import { useInView } from "@/lib/use-in-view";

export type HallDoor = {
  to: "/community/write" | "/community/inbox" | "/community/outbox" | "/community/echoes";
  title: string;
  body: string;
  badge: string | null;
  image: string;
  /** Short atmospheric caption printed over the image. */
  caption: string;
};

export function HallDoorCard({ door, index }: { door: HallDoor; index: number }) {
  const { ref, inView } = useInView<HTMLAnchorElement>();

  function trackPointer(e: MouseEvent<HTMLAnchorElement>) {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--hall-mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty("--hall-my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
  }

  return (
    <Link
      ref={ref}
      to={door.to}
      onMouseMove={trackPointer}
      data-visible={inView ? "true" : "false"}
      style={{ ["--hall-delay" as string]: `${index * 90}ms` }}
      className="hall-paper hall-envelope hall-tap hall-door hall-reveal group block overflow-hidden rounded-2xl"
    >
      <span className="hall-door-media" aria-hidden="true">
        <img src={door.image} alt="" loading="lazy" width={768} height={512} draggable={false} />
        <span className="hall-door-veil" />
        <span className="hall-door-shine" />
        <span className="hall-door-caption">{door.caption}</span>
      </span>

      <span className="hall-door-spot" aria-hidden="true" />

      <span className="relative block p-5">
        <span className="flex items-start justify-between gap-3">
          <span className="text-base font-semibold text-foreground">{door.title}</span>
          {door.badge ? (
            <span className="hall-door-badge rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[0.68rem] text-primary">
              {door.badge}
            </span>
          ) : null}
        </span>
        <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">{door.body}</span>
        <span className="hall-door-arrow mt-3 inline-flex items-center gap-1 text-xs text-primary">
          {door.title} <span aria-hidden>→</span>
        </span>
      </span>
    </Link>
  );
}
