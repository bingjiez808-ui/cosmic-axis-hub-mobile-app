import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  HallEmpty,
  HallGate,
  HallHeader,
  HallNav,
  HallSection,
} from "@/experiences/community-hall/HallShell";
import { ReceivedLetterCard } from "@/experiences/community-hall/LetterCards";
import { useCommunityMailbox, useDeliveryState } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";

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
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 sm:px-6">
      <HallHeader title={c.sectionToday} subtitle={c.ctaReceived} />
      <HallNav />
      <HallGate>
        <HallSection title={c.navInbox}>
          <div className="mb-4 flex flex-wrap gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
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
            <p className="text-sm text-muted-foreground">{c.loading}</p>
          ) : letters.length === 0 ? (
            <HallEmpty
              text={c.emptyInbox}
              cta={
                <Button asChild variant="outline">
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
                    className="text-xs text-muted-foreground hover:text-foreground"
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
