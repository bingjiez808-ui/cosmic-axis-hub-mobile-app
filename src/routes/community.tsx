import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { EntryNotesSection } from "@/experiences/community-hall/EntryNotes";
import {
  HallGate,
  HallHeader,
  HallMobileBar,
  HallNav,
  HallSection,
} from "@/experiences/community-hall/HallShell";
import { HallEmptyState, HallError, HallSkeleton } from "@/experiences/community-hall/HallStates";
import { EchoCard, ReceivedLetterCard } from "@/experiences/community-hall/LetterCards";
import { useCommunityMailbox, useCommunityProfile } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useSupabaseSession } from "@/lib/session";
import "@/experiences/community-hall/hall.css";

/**
 * /community — 同门 · 众生之厅.
 * The archive room itself: what this place is, the courier's three-step
 * journey, the four doors (write / mailbox / my letters / echoes), the newest
 * movement on your shelf, and the house rules. The legacy quest lives on as
 * an optional side room, 入馆问笺.
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
  const profile = useCommunityProfile(Boolean(user));

  const received = (mailbox.data?.received ?? []).filter((l) => l.status !== "archived");
  const echoes = mailbox.data?.echoes ?? [];
  const sent = mailbox.data?.sent ?? [];
  const unread = received.filter((l) => !l.readAt).length;
  const alias = profile.data?.profile?.alias ?? null;
  const band = profile.data?.ageBand ?? null;

  const doors = [
    {
      to: "/community/write" as const,
      title: c.cardWriteTitle,
      body: c.cardWriteBody,
      badge: null as string | null,
    },
    {
      to: "/community/inbox" as const,
      title: c.cardInboxTitle,
      body: c.cardInboxBody,
      badge: unread > 0 ? c.unreadCount(unread) : null,
    },
    {
      to: "/community/outbox" as const,
      title: c.cardOutboxTitle,
      body: c.cardOutboxBody,
      badge: sent.length > 0 ? `${sent.length}` : null,
    },
    {
      to: "/community/echoes" as const,
      title: c.cardEchoesTitle,
      body: c.cardEchoesBody,
      badge: echoes.length > 0 ? c.newEchoes(echoes.length) : null,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-12 sm:px-6 sm:pb-24">
      <HallHeader lines={[c.hallHeroLineOne, c.hallHeroLineTwo]} subtitle={c.hallHeroBody} />
      <p className="mx-auto mt-4 max-w-xl text-center text-xs leading-relaxed text-primary/75">
        {c.hallHeroNote}
      </p>

      <div className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-3">
        <Button asChild size="lg" className="hall-tap">
          <Link to="/community/write">{c.ctaWrite}</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="hall-tap">
          <Link to="/community/inbox">{c.ctaInbox}</Link>
        </Button>
      </div>

      <HallNav />

      {alias ? (
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
          {c.identityLine(alias, c.ageBand(band))} ·{" "}
          <Link to="/me/community" className="text-primary hover:underline">
            {c.identityEdit}
          </Link>
        </p>
      ) : null}

      {/* ── The courier's journey ─────────────────────────── */}
      <HallSection title={c.pathTitle}>
        <ol className="hall-path grid gap-4 md:grid-cols-3">
          {c.steps.map((step, i) => (
            <li key={step.title} className="hall-paper hall-rise relative p-5">
              <span className="hall-step-dot">0{i + 1}</span>
              <h3 className="mt-3 text-base font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </HallSection>

      {/* ── Four doors ────────────────────────────────────── */}
      <HallSection title={c.navHall}>
        <div className="grid gap-4 sm:grid-cols-2">
          {doors.map((door) => (
            <Link
              key={door.to}
              to={door.to}
              className="hall-paper hall-envelope hall-tap block p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">{door.title}</h3>
                {door.badge ? (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[0.68rem] text-primary">
                    {door.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{door.body}</p>
            </Link>
          ))}
        </div>
      </HallSection>

      <HallGate>
        <HallSection
          title={c.recentTitle}
          action={
            <Link to="/community/inbox" className="text-sm text-primary hover:underline">
              {c.ctaInbox} →
            </Link>
          }
        >
          {mailbox.isLoading ? (
            <HallSkeleton rows={2} />
          ) : mailbox.error ? (
            <HallError error={mailbox.error} onRetry={() => void mailbox.refetch()} />
          ) : received.length === 0 && echoes.length === 0 ? (
            <HallEmptyState
              text={c.emptyInbox}
              cta={
                <Button asChild variant="outline" className="hall-tap">
                  <Link to="/community/write">{c.ctaWrite}</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {received.slice(0, 2).map((letter) => (
                <ReceivedLetterCard key={letter.letterId} letter={letter} />
              ))}
              {echoes.slice(0, 2).map((echo) => (
                <EchoCard key={echo.replyId} echo={echo} />
              ))}
            </div>
          )}
        </HallSection>
      </HallGate>

      {/* ── House rules ───────────────────────────────────── */}
      <HallSection title={c.houseRules}>
        <ul className="hall-paper space-y-2 p-5 text-sm leading-relaxed text-muted-foreground">
          <li className="font-medium text-foreground">{c.privacyTitle}</li>
          {c.privacyPoints.map((point) => (
            <li key={point}>· {point}</li>
          ))}
        </ul>
      </HallSection>

      {/* ── Optional side room: the legacy quest ──────────── */}
      <HallSection title={c.entryNotes}>
        <p className="mb-4 text-sm text-muted-foreground">{c.entryNotesHint}</p>
        <details className="hall-paper p-4">
          <summary className="hall-tap cursor-pointer text-sm font-medium text-primary">
            {c.entryNotes}
          </summary>
          <div className="mt-4">
            <EntryNotesSection />
          </div>
        </details>
      </HallSection>

      <HallMobileBar />
    </main>
  );
}
