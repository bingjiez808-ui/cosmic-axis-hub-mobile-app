import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  HallEmpty,
  HallGate,
  HallHeader,
  HallNav,
  HallSection,
} from "@/experiences/community-hall/HallShell";
import { SentLetterCard } from "@/experiences/community-hall/LetterCards";
import { useCommunityMailbox } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";

/** /community/outbox — letters this traveler has sent, with delivery counts. */
export const Route = createFileRoute("/community/outbox")({
  head: () => ({
    meta: [
      { title: "我的书札 · 众生之厅 — My letters | Library of Destiny" },
      { name: "description", content: "你寄出的匿名书札与投递情况。The letters you have sent and how far they travelled." },
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
  const sent = mailbox.data?.sent ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 sm:px-6">
      <HallHeader title={c.sectionOutbox} />
      <HallNav />
      <HallGate>
        <HallSection title={c.sectionOutbox}>
          {mailbox.isLoading ? (
            <p className="text-sm text-muted-foreground">{c.loading}</p>
          ) : sent.length === 0 ? (
            <HallEmpty
              text={c.emptyOutbox}
              cta={
                <Button asChild>
                  <Link to="/community/write">{c.ctaWrite}</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {sent.map((letter) => (
                <SentLetterCard key={letter.letterId} letter={letter} />
              ))}
            </div>
          )}
        </HallSection>
      </HallGate>
    </main>
  );
}
