/**
 * 同门 · 众生之厅 — cold-start reading shelf.
 *
 * Curated letters written by the library itself, always labelled as samples
 * so no visitor mistakes them for a real member's letter. They are never
 * delivered and cannot be answered.
 */
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { HallEmptyState, HallError, HallSkeleton } from "@/experiences/community-hall/HallStates";
import { HallSection } from "@/experiences/community-hall/HallShell";
import { useCommunityLibrarySamples } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";

export function LibrarySamplesSection() {
  const c = useCommunityHall();
  const samples = useCommunityLibrarySamples(c.lang === "en" ? "en" : "zh");
  const [openId, setOpenId] = useState<string | null>(null);
  const list = samples.data ?? [];

  return (
    <HallSection
      title={c.samplesTitle}
      action={
        <Link to="/community/write" className="text-sm text-primary hover:underline">
          {c.samplesWriteCta} →
        </Link>
      }
    >
      <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{c.samplesIntro}</p>

      {samples.isLoading ? (
        <HallSkeleton rows={2} />
      ) : samples.error ? (
        <HallError error={samples.error} onRetry={() => void samples.refetch()} />
      ) : list.length === 0 ? (
        <HallEmptyState text={c.samplesEmpty} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((sample) => {
            const open = openId === sample.letterId;
            return (
              <article key={sample.letterId} className="hall-paper p-5">
                <span className="inline-block rounded-full border border-primary/25 bg-primary/5 px-2.5 py-0.5 text-[0.66rem] text-primary/80">
                  {c.samplesBadge}
                </span>
                <h3 className="mt-3 text-base font-semibold text-foreground">
                  {sample.subject ?? c.samplesTitle}
                </h3>
                <p className="mt-1 text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">
                  {c.ageBand(sample.targetAgeBand)}
                  {sample.topic ? ` · ${c.topic(sample.topic)}` : ""}
                </p>
                <p
                  className={`mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground ${
                    open ? "" : "line-clamp-4"
                  }`}
                >
                  {sample.body}
                </p>

                {open && sample.echoes.length > 0 ? (
                  <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
                    <p className="text-xs font-medium text-primary/80">{c.samplesEchoes}</p>
                    {sample.echoes.map((echo) => (
                      <blockquote
                        key={echo.id}
                        className="rounded-md border-l-2 border-primary/30 bg-background/40 px-3 py-2 text-sm leading-relaxed text-muted-foreground"
                      >
                        <span className="mr-2 text-[0.68rem] text-primary/70">
                          {c.ageBand(echo.ageBand)}
                        </span>
                        <span className="whitespace-pre-line">{echo.body}</span>
                      </blockquote>
                    ))}
                  </div>
                ) : null}

                <Button
                  size="sm"
                  variant="ghost"
                  className="hall-tap mt-3 px-0 text-xs text-primary"
                  onClick={() => setOpenId(open ? null : sample.letterId)}
                >
                  {open ? c.cancel : c.samplesEchoes}
                </Button>
              </article>
            );
          })}
        </div>
      )}
    </HallSection>
  );
}
