import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { EntryNotesSection } from "@/experiences/community-hall/EntryNotes";
import {
  HallEmpty,
  HallGate,
  HallHeader,
  HallNav,
  HallSection,
} from "@/experiences/community-hall/HallShell";
import { EchoCard, ReceivedLetterCard } from "@/experiences/community-hall/LetterCards";
import { useCommunityMailbox } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useSupabaseSession } from "@/lib/session";

/**
 * /community — 同门 · 众生之厅.
 * The hall itself: what this place is, the three-step ritual of sending a
 * letter, today's deliveries, the newest echoes, and the legacy Entry Notes
 * kept as an optional side room.
 */
export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "同门 · 众生之厅 — Hall of Beings | Library of Destiny" },
      {
        name: "description",
        content:
          "匿名跨年龄书信社区：写下此刻的困惑，寄给走过这段路的旅者，等待一封回音。An anonymous cross-generation letter hall — ask someone who has lived that chapter.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "同门 · 众生之厅 — Hall of Beings" },
      {
        property: "og:description",
        content: "把一个问题，寄给走过这段路的人。Send a question to someone who has been there.",
      },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CommunityHallPage,
});

function CommunityHallPage() {
  const c = useCommunityHall();
  const { user } = useSupabaseSession();
  const mailbox = useCommunityMailbox(Boolean(user));

  const received = (mailbox.data?.received ?? []).filter((l) => l.status !== "archived").slice(0, 3);
  const echoes = (mailbox.data?.echoes ?? []).slice(0, 2);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-24 pt-12 sm:px-6">
      <HallHeader title={c.hallTitle} subtitle={c.hallSubtitle} />

      <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link to="/community/write">{c.ctaWrite}</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link to="/community/inbox">{c.ctaInbox}</Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link to="/community/echoes">{c.ctaEchoes}</Link>
        </Button>
      </div>

      <HallNav />

      <HallSection title={c.ctaHow}>
        <ol className="grid gap-4 sm:grid-cols-3">
          {c.steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-2xl border border-primary/15 bg-background/50 p-5 backdrop-blur"
            >
              <span className="text-[0.7rem] uppercase tracking-[0.3em] text-primary/70">
                0{i + 1}
              </span>
              <h3 className="mt-2 text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
        <ul className="mt-5 space-y-2 rounded-2xl border border-primary/10 bg-background/40 p-5 text-sm leading-relaxed text-muted-foreground">
          <li className="font-medium text-foreground">{c.privacyTitle}</li>
          {c.privacyPoints.map((point) => (
            <li key={point}>· {point}</li>
          ))}
        </ul>
      </HallSection>

      <HallGate>
        <HallSection
          title={c.sectionToday}
          action={
            <Link to="/community/inbox" className="text-sm text-primary hover:underline">
              {c.ctaInbox} →
            </Link>
          }
        >
          {mailbox.isLoading ? (
            <p className="text-sm text-muted-foreground">{c.loading}</p>
          ) : received.length === 0 ? (
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
              {received.map((letter) => (
                <ReceivedLetterCard key={letter.letterId} letter={letter} />
              ))}
            </div>
          )}
        </HallSection>

        <HallSection
          title={c.sectionEchoes}
          action={
            <Link to="/community/echoes" className="text-sm text-primary hover:underline">
              {c.ctaEchoes} →
            </Link>
          }
        >
          {echoes.length === 0 ? (
            <HallEmpty text={c.emptyEchoes} />
          ) : (
            <div className="grid gap-4">
              {echoes.map((echo) => (
                <EchoCard key={echo.replyId} echo={echo} />
              ))}
            </div>
          )}
        </HallSection>
      </HallGate>

      <HallSection title={c.entryNotes}>
        <p className="mb-4 text-sm text-muted-foreground">{c.entryNotesHint}</p>
        <details className="rounded-2xl border border-primary/15 bg-background/40 p-4 backdrop-blur">
          <summary className="cursor-pointer text-sm font-medium text-primary">
            {c.entryNotes}
          </summary>
          <div className="mt-4">
            <EntryNotesSection />
          </div>
        </details>
      </HallSection>
    </main>
  );
}
