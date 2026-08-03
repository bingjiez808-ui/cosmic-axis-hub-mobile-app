/**
 * 同门 · 众生之厅 — sample letter reader.
 *
 * Opening a shelf sample no longer pushes the page around: the letter is
 * lifted into a modal that unfolds like a sheet of paper being opened, with
 * the wax seal breaking first and the echoes drifting in afterwards.
 */
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useCommunityHall } from "@/lib/i18n-community-hall";

type SampleEcho = { id: string; ageBand: string; body: string };

export type SampleLetter = {
  letterId: string;
  subject: string | null;
  body: string;
  topic: string | null;
  targetAgeBand: string;
  echoes: SampleEcho[];
};

export function SampleLetterDialog({
  sample,
  onOpenChange,
}: {
  sample: SampleLetter | null;
  onOpenChange: (open: boolean) => void;
}) {
  const c = useCommunityHall();
  // The seal breaks a beat after the sheet lands, then the echoes drift in.
  const [unsealed, setUnsealed] = useState(false);

  useEffect(() => {
    if (!sample) {
      setUnsealed(false);
      return;
    }
    const t = window.setTimeout(() => setUnsealed(true), 420);
    return () => window.clearTimeout(t);
  }, [sample]);

  return (
    <Dialog open={Boolean(sample)} onOpenChange={onOpenChange}>
      <DialogContent className="hall-letter-modal max-h-[86vh] w-[min(38rem,92vw)] max-w-none gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none">
        {sample ? (
          <div className="hall-letter-sheet" data-unsealed={unsealed ? "true" : "false"}>
            <span className="hall-letter-wax" aria-hidden="true">
              <span className="hall-letter-wax-mark">✦</span>
            </span>

            <div className="hall-letter-scroll max-h-[86vh] overflow-y-auto px-6 pb-6 pt-10 sm:px-9 sm:pb-9">
              <span className="hall-letter-badge">{c.samplesBadge}</span>

              <DialogTitle className="hall-letter-title mt-4">
                {sample.subject ?? c.samplesTitle}
              </DialogTitle>

              <p className="mt-1.5 text-[0.7rem] uppercase tracking-[0.24em] text-muted-foreground">
                {c.ageBand(sample.targetAgeBand)}
                {sample.topic ? ` · ${c.topic(sample.topic)}` : ""}
              </p>

              <span className="hall-letter-rule mt-5" aria-hidden="true" />

              <p className="hall-letter-body mt-5 whitespace-pre-line">{sample.body}</p>

              {sample.echoes.length > 0 ? (
                <div className="hall-letter-echoes mt-8">
                  <p className="flex items-center gap-3 text-xs font-medium tracking-[0.2em] text-primary/80">
                    {c.samplesEchoes}
                    <span className="hall-letter-rule flex-1" aria-hidden="true" />
                  </p>
                  <div className="mt-4 space-y-3">
                    {sample.echoes.map((echo, i) => (
                      <blockquote
                        key={echo.id}
                        className="hall-letter-echo"
                        style={{ ["--echo-delay" as string]: `${420 + i * 140}ms` }}
                      >
                        <span className="mr-2 text-[0.68rem] tracking-[0.16em] text-primary/70">
                          {c.ageBand(echo.ageBand)}
                        </span>
                        <span className="whitespace-pre-line">{echo.body}</span>
                      </blockquote>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-8 flex justify-end">
                <DialogClose asChild>
                  <Button size="sm" variant="ghost" className="hall-tap text-xs text-primary">
                    {c.cancel}
                  </Button>
                </DialogClose>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
