/**
 * /community/notices — 我的来信通知中心 / My letter notice centre.
 *
 * One place that answers "what happened to my letters?": a four-count ledger
 * (sent · waiting · answered · new notices), a filterable list of everything
 * I posted with its delivery state, and the courier's notification feed with
 * one-tap mark-as-read. Reads the same mailbox query as the rest of the hall,
 * so opening it costs no extra request.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { CourierProgressStrip } from "@/experiences/community-hall/CourierProgressStrip";
import {
  HallGate,
  HallHeader,  HallSection,
} from "@/experiences/community-hall/HallShell";
import { HallEmptyState, HallError, HallSkeleton } from "@/experiences/community-hall/HallStates";
import { SentLetterCard } from "@/experiences/community-hall/LetterCards";
import { LetterWaveStatus } from "@/experiences/community-hall/LetterWaveStatus";
import { NotificationCenter } from "@/experiences/community-hall/NotificationCenter";
import { useCommunityMailbox } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import "@/experiences/community-hall/hall.css";

export const Route = createFileRoute("/community/notices")({
  head: () => ({
    meta: [
      { title: "来信通知中心 · 众生之厅 — Notice centre | Library of Destiny" },
      {
        name: "description",
        content:
          "集中查看你寄出的信、等待中的回音与新的信使通报。All your sent letters, pending echoes and courier notices in one place.",
      },
      { property: "og:title", content: "来信通知中心 · 众生之厅" },
      { property: "og:description", content: "寄出、等待、已回信与新提醒，一处看全。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: NoticeCentrePage,
});

type Filter = "all" | "waiting" | "answered" | "closed";

function NoticeCentrePage() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const mailbox = useCommunityMailbox();
  const [filter, setFilter] = useState<Filter>("all");

  const sent = useMemo(
    () => (Array.isArray(mailbox.data?.sent) ? mailbox.data.sent : []),
    [mailbox.data],
  );
  const notifications = Array.isArray(mailbox.data?.notifications) ? mailbox.data.notifications : [];
  const unread = notifications.filter((n) => !n.readAt).length;

  const waiting = sent.filter((l) => l.replyCount === 0 && l.status !== "closed");
  const answered = sent.filter((l) => l.replyCount > 0);
  const closed = sent.filter((l) => l.status === "closed");

  const tiles = [
    { key: "all" as const, label: zh ? "已寄出" : "Sent", value: sent.length, tone: "text-foreground" },
    { key: "waiting" as const, label: zh ? "等待回音" : "Waiting", value: waiting.length, tone: "text-foreground" },
    { key: "answered" as const, label: zh ? "已有回音" : "Answered", value: answered.length, tone: "text-gold-light" },
    { key: "closed" as const, label: zh ? "已停止收信" : "Closed", value: closed.length, tone: "text-muted-foreground" },
  ];

  const list =
    filter === "waiting" ? waiting : filter === "answered" ? answered : filter === "closed" ? closed : sent;

  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <HallHeader
        title={zh ? "来信通知中心" : "Notice centre"}
        subtitle={
          zh
            ? "你寄出的每一封信走到了哪里，谁已经回音，以及信使刚刚捎来的消息——都在这一页。"
            : "Where each of your letters travelled, who answered, and whatever the courier just brought in — all on one page."
        }
      />

      <CourierProgressStrip />

      <HallGate>
        <HallSection
          title={zh ? "信件概览" : "At a glance"}
          action={
            unread > 0 ? (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">
                {zh ? `${unread} 条新提醒` : `${unread} new`}
              </span>
            ) : undefined
          }
        >
          {mailbox.isLoading ? (
            <HallSkeleton />
          ) : mailbox.error ? (
            <HallError error={mailbox.error} onRetry={() => void mailbox.refetch()} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {tiles.map((t) => {
                  const active = filter === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(t.key)}
                      className={`hall-paper hall-tap rounded-xl px-4 py-3 text-left transition ${
                        active ? "ring-1 ring-primary/45" : "hover:ring-1 hover:ring-primary/20"
                      }`}
                    >
                      <span className={`block font-serif text-2xl ${t.tone}`}>{t.value}</span>
                      <span className="mt-0.5 block text-[0.7rem] tracking-wide text-muted-foreground">
                        {t.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 space-y-4">
                {list.length === 0 ? (
                  <HallEmptyState
                    text={
                      sent.length === 0
                        ? c.emptyOutbox
                        : zh
                          ? "这一类暂时没有信件。"
                          : "No letters in this state yet."
                    }
                    cta={
                      <Button asChild className="hall-tap">
                        <Link to="/community/write">{c.ctaWrite}</Link>
                      </Button>
                    }
                  />
                ) : (
                  list.map((letter) => (
                    <div key={letter.letterId} className="space-y-2">
                      <SentLetterCard letter={letter} />
                      <LetterWaveStatus
                        letterId={letter.letterId}
                        closed={letter.status === "closed"}
                      />
                      {letter.replyCount > 0 ? (
                        <Link
                          to="/community/echoes"
                          className="hall-tap inline-block text-xs text-primary underline-offset-4 hover:underline"
                        >
                          {zh
                            ? `读 ${letter.replyCount} 条回音 →`
                            : `Read ${letter.replyCount} echo${letter.replyCount > 1 ? "es" : ""} →`}
                        </Link>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              {sent.length > 0 ? (
                <p className="mt-5 text-xs text-muted-foreground">
                  {zh ? (
                    <>
                      需要停止收信或整理书札，请前往{" "}
                      <Link to="/community/outbox" className="text-primary hover:underline">
                        我的书札
                      </Link>
                      。
                    </>
                  ) : (
                    <>
                      To stop collecting echoes or tidy your archive, visit{" "}
                      <Link to="/community/outbox" className="text-primary hover:underline">
                        my letters
                      </Link>
                      .
                    </>
                  )}
                </p>
              ) : null}
            </>
          )}
        </HallSection>

        <NotificationCenter />
      </HallGate>
    </main>
  );
}
