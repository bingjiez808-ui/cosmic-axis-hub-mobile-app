import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  HallGate,
  HallHeader,
  HallMobileBar,
  HallNav,
  HallSection,
} from "@/experiences/community-hall/HallShell";
import { HallEmptyState, HallError, HallSkeleton } from "@/experiences/community-hall/HallStates";
import { SentLetterCard } from "@/experiences/community-hall/LetterCards";
import { LetterWaveStatus } from "@/experiences/community-hall/LetterWaveStatus";
import { useCloseLetter, useCommunityMailbox } from "@/lib/community-hall-client";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import "@/experiences/community-hall/hall.css";

/** /community/outbox — letters this traveler has sent, with delivery counts. */
export const Route = createFileRoute("/community/outbox")({
  head: () => ({
    meta: [
      { title: "我的书札 · 众生之厅 — My letters | Library of Destiny" },
      {
        name: "description",
        content:
          "你寄出的匿名书札与投递情况。The letters you have sent and how far they travelled.",
      },
      { property: "og:title", content: "我的书札 · 众生之厅" },
      { property: "og:description", content: "你寄出的匿名书札与投递情况。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OutboxPage,
});

function OutboxPage() {
  const c = useCommunityHall();
  const mailbox = useCommunityMailbox();
  const close = useCloseLetter();
  const [confirming, setConfirming] = useState<string | null>(null);
  const sent = mailbox.data?.sent ?? [];

  async function closeLetter(letterId: string) {
    try {
      await close.mutateAsync({ letterId });
      setConfirming(null);
      toast.success(c.closedCollecting);
    } catch (err) {
      toast.error(hallErrorMessage(err, c.lang));
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24">
      <HallHeader title={c.cardOutboxTitle} subtitle={c.cardOutboxBody} />
      <HallNav />
      <HallGate>
        <HallSection title={c.sectionOutbox}>
          {mailbox.isLoading ? (
            <HallSkeleton />
          ) : mailbox.error ? (
            <HallError error={mailbox.error} onRetry={() => void mailbox.refetch()} />
          ) : sent.length === 0 ? (
            <HallEmptyState
              text={c.emptyOutbox}
              cta={
                <Button asChild className="hall-tap">
                  <Link to="/community/write">{c.ctaWrite}</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {sent.map((letter) => (
                <div key={letter.letterId} className="space-y-2">
                  <SentLetterCard letter={letter} />
                  <LetterWaveStatus letterId={letter.letterId} closed={letter.status === "closed"} />
                  {letter.status === "closed" ? (
                    <p className="text-xs text-muted-foreground">{c.closedCollecting}</p>
                  ) : confirming === letter.letterId ? (
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{c.closeConfirm}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="hall-tap"
                        disabled={close.isPending}
                        onClick={() => void closeLetter(letter.letterId)}
                      >
                        {c.confirm}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="hall-tap"
                        onClick={() => setConfirming(null)}
                      >
                        {c.cancel}
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirming(letter.letterId)}
                      className="hall-tap text-xs text-muted-foreground hover:text-foreground"
                    >
                      {c.closeCollecting}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </HallSection>
      </HallGate>
      <HallMobileBar />
    </main>
  );
}
