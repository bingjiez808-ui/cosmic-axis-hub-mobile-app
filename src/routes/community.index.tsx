import { createFileRoute, Link } from "@tanstack/react-router";

import doorEchoes from "@/assets/community/door-echoes.jpg";
import doorInbox from "@/assets/community/door-inbox.jpg";
import doorOutbox from "@/assets/community/door-outbox.jpg";
import doorWrite from "@/assets/community/door-write.jpg";
import { Button } from "@/components/ui/button";
import { HallDoorCard, type HallDoor } from "@/experiences/community-hall/HallDoorCard";
import { CourierProgressStrip } from "@/experiences/community-hall/CourierProgressStrip";
import {
  HallGate,
  HallHeader,
  HallMobileBar,
  HallNav,
  HallSection,
} from "@/experiences/community-hall/HallShell";
import { HallEmptyState, HallError, HallSkeleton } from "@/experiences/community-hall/HallStates";
import { EchoCard, ReceivedLetterCard } from "@/experiences/community-hall/LetterCards";
import { HallOnboarding } from "@/experiences/community-hall/HallOnboarding";
import { LibrarySamplesSection } from "@/experiences/community-hall/LibrarySamples";
import { NotificationCenter } from "@/experiences/community-hall/NotificationCenter";
import { TravelerIdentityCard } from "@/experiences/community-hall/TravelerIdentityCard";
import { useCommunityMailbox, useCommunityProfile } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useSupabaseSession } from "@/lib/session";
import "@/experiences/community-hall/hall.css";

/**
 * /community — 同门 · 众生之厅.
 * The archive room itself: what this place is, the courier's three-step
 * journey, the four doors (write / mailbox / my letters / echoes), the newest
 * movement on your shelf, and the house rules.
 */
export const Route = createFileRoute("/community/")({
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

  const doors: HallDoor[] = [
    {
      to: "/community/write",
      title: c.cardWriteTitle,
      body: c.cardWriteBody,
      badge: null,
      image: doorWrite,
      caption: c.lang === "en" ? "The writing desk" : "寄信台",
    },
    {
      to: "/community/inbox",
      title: c.cardInboxTitle,
      body: c.cardInboxBody,
      badge: unread > 0 ? c.unreadCount(unread) : null,
      image: doorInbox,
      caption: c.lang === "en" ? "The mail wall" : "信格墙",
    },
    {
      to: "/community/outbox",
      title: c.cardOutboxTitle,
      body: c.cardOutboxBody,
      badge: sent.length > 0 ? `${sent.length}` : null,
      image: doorOutbox,
      caption: c.lang === "en" ? "The courier's bundle" : "信使行囊",
    },
    {
      to: "/community/echoes",
      title: c.cardEchoesTitle,
      body: c.cardEchoesBody,
      badge: echoes.length > 0 ? c.newEchoes(echoes.length) : null,
      image: doorEchoes,
      caption: c.lang === "en" ? "The echo bowl" : "回音之盂",
    },
    {
      to: "/community/wall",
      title: c.lang === "en" ? "The public wall" : "公共信墙",
      body:
        c.lang === "en"
          ? "Letters pinned for the whole hall. Read them, and answer any that speak to you — free, and still anonymous."
          : "张贴给全厅的信。读一读，遇上想回的就回一封——免费，依然匿名。",
      badge: null,
      image: doorInbox,
      caption: c.lang === "en" ? "The open board" : "众目之墙",
    },
    {
      to: "/community/sages",
      title: c.lang === "en" ? "The sages' desk" : "先贤案前",
      body:
        c.lang === "en"
          ? "Twelve long-dead thinkers, and the librarian in person. A Sage membership opens both; the librarian's reply spends one of three gifted human replies."
          : "十二位已故思想者，以及图书管理员本人。「贤者」会员开启两者；管理员亲自回信为开通即赠的三次机会。",
      badge: null,
      image: doorEchoes,
      caption: c.lang === "en" ? "Where answers are written" : "回信之处",
    },
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
      <HallHeader lines={[c.hallHeroLineOne, c.hallHeroLineTwo]} subtitle={c.hallHeroBody} />

      <TravelerIdentityCard />
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

      <CourierProgressStrip />

      <HallOnboarding />

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
              <h3 className="hall-card-title mt-3">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </HallSection>

      {/* ── Four doors ────────────────────────────────────── */}
      <HallSection title={c.navHall}>
        <div className="grid gap-4 sm:grid-cols-2">
          {doors.map((door, i) => (
            <HallDoorCard key={door.to} door={door} index={i} />
          ))}
        </div>
      </HallSection>


      <HallGate>
        <NotificationCenter />
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

      <LibrarySamplesSection />

      {/* ── House rules ───────────────────────────────────── */}
      <HallSection title={c.houseRules}>
        <ul className="hall-paper space-y-2 p-5 text-sm leading-relaxed text-muted-foreground">
          <li className="font-medium text-foreground">{c.privacyTitle}</li>
          {c.privacyPoints.map((point) => (
            <li key={point}>· {point}</li>
          ))}
        </ul>
      </HallSection>

      <HallMobileBar />
    </main>
  );
}
