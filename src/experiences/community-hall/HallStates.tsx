/**
 * 同门 · 众生之厅 — shared loading / error / empty states.
 *
 * Every hall surface uses these three, so a slow shelf, a dropped connection
 * and an empty mailbox never look the same as one another, and never leak a
 * raw error string.
 */
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useCommunityHall } from "@/lib/i18n-community-hall";

/** Envelope-shaped placeholders while the mailbox RPC is in flight. */
export function HallSkeleton({ rows = 3 }: { rows?: number }) {
  const c = useCommunityHall();
  return (
    <div role="status" aria-live="polite" aria-busy="true" className="space-y-3">
      <span className="sr-only">{c.stateLoadingHall}</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="hall-paper p-5">
          <div className="hall-skeleton h-3 w-24" />
          <div className="hall-skeleton mt-4 h-4 w-2/3" />
          <div className="hall-skeleton mt-3 h-3 w-full" />
          <div className="hall-skeleton mt-2 h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/** Any failed read: bilingual copy, never the transport message. */
export function HallError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const c = useCommunityHall();
  return (
    <div role="alert" className="hall-paper p-7 text-center">
      <p className="text-sm leading-relaxed text-muted-foreground">
        {hallErrorMessage(error, c.lang)}
      </p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="hall-tap mt-5" onClick={onRetry}>
          {c.stateRetry}
        </Button>
      ) : null}
    </div>
  );
}

/** Empty shelf: always paired with one thing the traveler can do next. */
export function HallEmptyState({ text, cta }: { text: string; cta?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-primary/20 bg-background/40 p-8 text-center">
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{text}</p>
      {cta ? <div className="mt-5 flex justify-center">{cta}</div> : null}
    </div>
  );
}
