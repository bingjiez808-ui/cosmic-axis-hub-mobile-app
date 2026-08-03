import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  HallGate,
  HallHeader,  HallSection,
} from "@/experiences/community-hall/HallShell";
import { HallEmptyState, HallError, HallSkeleton } from "@/experiences/community-hall/HallStates";
import { ReceivedLetterCard } from "@/experiences/community-hall/LetterCards";
import { useCommunityMailbox, useDeliveryState } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import "@/experiences/community-hall/hall.css";

/** /community/inbox — letters delivered to this traveler, with status filters. */
export const Route = createFileRoute("/community/inbox")({
  head: () => ({
    meta: [
      { title: "收信匣 · 众生之厅 — Mailbox | Library of Destiny" },
      { name: "description", content: "别人寄给你的匿名来信。Anonymous letters delivered to you." },
      { property: "og:title", content: "收信匣 · 众生之厅" },
      { property: "og:description", content: "别人寄给你的匿名来信。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InboxPage,
});

type Filter = "all" | "delivered" | "read" | "replied" | "archived";

function InboxPage() {
  const c = useCommunityHall();
  const mailbox = useCommunityMailbox();
  const delivery = useDeliveryState();
  const [filter, setFilter] = useState<Filter>("all");

  const all = mailbox.data?.received ?? [];
  const letters = all.filter((l) =>
    filter === "all" ? l.status !== "archived" : l.status === filter,
  );

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: c.filterAll },
    { key: "delivered", label: c.filterUnread },
    { key: "read", label: c.filterRead },
    { key: "replied", label: c.filterReplied },
    { key: "archived", label: c.filterArchived },
  ];

  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <HallHeader title={c.cardInboxTitle} subtitle={c.cardInboxBody} />
      <HallGate>
        <HallSection title={c.navInbox}>
          <div className="mb-4 flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                aria-pressed={filter === f.key}
                className={`hall-tap rounded-full border px-3.5 py-2 text-xs transition ${
                  filter === f.key
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-primary/15 text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {mailbox.isLoading ? (
            <HallSkeleton />
          ) : mailbox.error ? (
            <HallError error={mailbox.error} onRetry={() => void mailbox.refetch()} />
          ) : letters.length === 0 ? (
            <HallEmptyState
              text={filter === "all" ? c.emptyInbox : c.stateEmptyHint}
              cta={
                <Button asChild variant="outline" className="hall-tap">
                  <Link to="/community/write">{c.ctaWrite}</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {letters.map((letter) => (
                <div key={letter.letterId} className="space-y-2">
                  <ReceivedLetterCard letter={letter} />
                  <button
                    type="button"
                    disabled={delivery.isPending}
                    onClick={() =>
                      delivery.mutate({
                        letterId: letter.letterId,
                        state: letter.status === "archived" ? "restore" : "archived",
                      })
                    }
                    className="hall-tap text-xs text-muted-foreground hover:text-foreground"
                  >
                    {letter.status === "archived" ? c.unarchive : c.archive}
                  </button>
                </div>
              ))}
            </div>
          )}
        </HallSection>
      </HallGate>
    </main>
  );
}
