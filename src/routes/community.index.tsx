import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  HandHeart,
  Inbox,
  LibraryBig,
  ScrollText,
  Send,
  Sparkles,
  UsersRound,
  WalletCards,
} from "lucide-react";

import doorEchoes from "@/assets/community/door-echoes.jpg";
import doorInbox from "@/assets/community/door-inbox.jpg";
import doorOutbox from "@/assets/community/door-outbox.jpg";
import doorWrite from "@/assets/community/door-write.jpg";
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

  const mailboxData = mailbox.data;
  const receivedSource = Array.isArray(mailboxData?.received) ? mailboxData.received : [];
  const received = receivedSource.filter((l) => l.status !== "archived");
  const echoes = Array.isArray(mailboxData?.echoes) ? mailboxData.echoes : [];
  const sent = Array.isArray(mailboxData?.sent) ? mailboxData.sent : [];
  const unread = received.filter((l) => !l.readAt).length;
  const alias = profile.data?.profile?.alias ?? null;
  const band = profile.data?.ageBand ?? null;

  const featureGroups = [
    {
      title: c.lang === "en" ? "Send a question" : "我要寄出问题",
      body: c.lang === "en" ? "Write once, choose where it goes, then wait for a reply." : "写一封信，选择去向，再等待回应。",
      image: doorWrite,
      icon: Send,
      primary: { to: "/community/write", label: c.ctaWrite, badge: null },
      actions: [
        { to: "/community/write", label: c.lang === "en" ? "Writing desk" : "寄信台", icon: ScrollText },
        { to: "/community/sages", label: c.lang === "en" ? "Ask a sage" : "问先贤", icon: Sparkles },
      ],
    },
    {
      title: c.lang === "en" ? "My letters" : "我的信件",
      body: c.lang === "en" ? "Check replies, sent letters and echoes from the hall." : "收信、已寄出、回音都放在这里。",
      image: doorInbox,
      icon: Inbox,
      primary: { to: "/community/inbox", label: c.ctaInbox, badge: unread > 0 ? c.unreadCount(unread) : null },
      actions: [
        { to: "/community/inbox", label: c.lang === "en" ? "Inbox" : "收信箱", icon: Inbox },
        { to: "/community/outbox", label: c.lang === "en" ? "Outbox" : "行囊", icon: Send },
        { to: "/community/echoes", label: c.lang === "en" ? "Echoes" : "回音", icon: HandHeart },
      ],
    },
    {
      title: c.lang === "en" ? "Public hall" : "公共大厅",
      body: c.lang === "en" ? "Read shared letters and help with entrusted questions." : "阅读公开来信，也可以回应被托付的问题。",
      image: doorOutbox,
      icon: UsersRound,
      primary: { to: "/community/wall", label: c.lang === "en" ? "Open wall" : "打开信墙", badge: null },
      actions: [
        { to: "/community/wall", label: c.lang === "en" ? "Wall" : "信墙", icon: LibraryBig },
        { to: "/community/errands", label: c.lang === "en" ? "Entrusted" : "受托", icon: HandHeart },
      ],
    },
    {
      title: c.lang === "en" ? "Notices and rights" : "通知与权益",
      body: c.lang === "en" ? "Manage reply chances, notices and deeper response access." : "查看通知、回信权益和深层回应入口。",
      image: doorEchoes,
      icon: Bell,
      primary: { to: "/community/notices", label: c.lang === "en" ? "View notices" : "查看通知", badge: null },
      actions: [
        { to: "/community/notices", label: c.lang === "en" ? "Notices" : "通知", icon: Bell },
        { to: "/community/grants", label: c.lang === "en" ? "Reply rights" : "回信权益", icon: WalletCards },
      ],
    },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <div className="mb-5 flex items-center justify-between">
        <Link
          to="/"
          aria-label={c.lang === "en" ? "Back home" : "返回首页"}
          className="grid h-11 w-11 place-items-center rounded-full border border-primary/15 bg-background/40 text-foreground"
        >
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </Link>
        <span className="rounded-full border border-primary/15 px-3 py-1 text-[11px] text-muted-foreground">
          {c.lang === "en" ? "Hall of Beings" : "众生之厅"}
        </span>
      </div>

      <section className="overflow-hidden rounded-[32px] border border-primary/15 bg-card/55 shadow-[0_24px_80px_-48px_hsl(var(--primary)/0.7)]">
        <div className="relative h-56">
          <img src={doorWrite} alt="" className="h-full w-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-[10px] uppercase tracking-[0.28em] text-primary/75">
              {c.lang === "en" ? "Hall of Beings" : "众生之厅"}
            </p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight text-foreground">
              {c.lang === "en" ? "Write one letter. Wait for one reply." : "写一封信，等一封回音。"}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {c.lang === "en"
                ? "Pick one task: send, read, help or manage replies."
                : "先选一个任务：寄信、收信、看大厅，或管理通知权益。"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          <Link to="/community/write" className="hall-tap flex min-h-12 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground">
            {c.ctaWrite}
          </Link>
          <Link to="/community/inbox" className="hall-tap flex min-h-12 items-center justify-center rounded-2xl border border-primary/20 px-4 text-sm font-medium text-primary">
            {c.ctaInbox}
          </Link>
        </div>
      </section>

      <div className="mt-4">
        <TravelerIdentityCard />
      </div>

      {alias ? (
        <p className="mx-auto mt-3 max-w-3xl text-center text-xs text-muted-foreground">
          {c.identityLine(alias, c.ageBand(band))} ·{" "}
          <Link to="/me/community" className="text-primary hover:underline">
            {c.identityEdit}
          </Link>
        </p>
      ) : null}

      <section className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">{c.lang === "en" ? "Choose a task" : "选择一个任务"}</h2>
          <span className="text-[11px] text-muted-foreground">{c.lang === "en" ? "4 sections" : "4 个分区"}</span>
        </div>
        <div className="grid gap-3">
          {featureGroups.map((group, index) => (
            <section
              key={group.title}
              className="community-feature-card relative overflow-hidden rounded-[26px] border border-primary/15 bg-card/48 shadow-[0_20px_58px_-44px_hsl(var(--primary)/0.65)]"
              style={{ ["--community-delay" as string]: `${index * 80}ms` }}
            >
              <img src={group.image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-24" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/86 to-background/48" />
              <div className="relative p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                    <group.icon aria-hidden className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold leading-snug text-foreground">{group.title}</h3>
                      {group.primary.badge ? (
                        <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                          {group.primary.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{group.body}</p>
                  </div>
                </div>
                <Link
                  to={group.primary.to}
                  className="hall-tap mt-4 flex min-h-11 items-center justify-between rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  {group.primary.label}
                  <ChevronRight aria-hidden className="h-5 w-5" />
                </Link>
                <div className="mt-2 flex snap-x gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {group.actions.map((action) => (
                    <Link
                      key={action.to}
                      to={action.to}
                      className="hall-tap flex min-h-10 shrink-0 snap-start items-center gap-2 rounded-2xl border border-primary/15 bg-background/42 px-3 text-xs text-foreground"
                    >
                      <action.icon aria-hidden className="h-4 w-4 text-primary" />
                      {action.label}
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </section>
      <style>{`
        @media (prefers-reduced-motion: no-preference) {
          .community-feature-card {
            animation: community-feature-in 360ms ease both;
            animation-delay: var(--community-delay);
          }
          @keyframes community-feature-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        }
      `}</style>

    </main>
  );
}
