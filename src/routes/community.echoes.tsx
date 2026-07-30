import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
  HallEmpty,
  HallGate,
  HallHeader,
  HallNav,
  HallSection,
} from "@/experiences/community-hall/HallShell";
import { EchoCard } from "@/experiences/community-hall/LetterCards";
import { useCommunityMailbox } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";

/** /community/echoes — replies received on my letters, and replies I wrote. */
export const Route = createFileRoute("/community/echoes")({
  head: () => ({
    meta: [
      { title: "我的回音 · 众生之厅 — Echoes | Library of Destiny" },
      { name: "description", content: "别人写给你的回音，以及你写出的回音。Echoes written to you, and the ones you wrote." },
      { property: "og:title", content: "我的回音 · 众生之厅" },
      { property: "og:description", content: "别人写给你的回音，以及你写出的回音。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EchoesPage,
});

function EchoesPage() {
  const c = useCommunityHall();
  const mailbox = useCommunityMailbox();
  const [tab, setTab] = useState<"received" | "mine">("received");

  const echoes = mailbox.data?.echoes ?? [];
  const mine = mailbox.data?.myReplies ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 sm:px-6">
      <HallHeader title={c.sectionEchoes} />
      <HallNav />
      <HallGate>
        <HallSection title={c.sectionEchoes}>
          <div className="mb-4 flex gap-2">
            {(
              [
                { key: "received" as const, label: c.tabReceivedEchoes },
                { key: "mine" as const, label: c.tabMyEchoes },
              ]
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  tab === t.key
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-primary/15 text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {mailbox.isLoading ? (
            <p className="text-sm text-muted-foreground">{c.loading}</p>
          ) : tab === "received" ? (
            echoes.length === 0 ? (
              <HallEmpty text={c.emptyEchoes} />
            ) : (
              <div className="grid gap-4">
                {echoes.map((echo) => (
                  <EchoCard key={echo.replyId} echo={echo} />
                ))}
              </div>
            )
          ) : mine.length === 0 ? (
            <HallEmpty text={c.emptyEchoes} />
          ) : (
            <div className="grid gap-4">
              {mine.map((reply) => (
                <article
                  key={reply.replyId}
                  className="rounded-2xl border border-primary/15 bg-background/50 p-5 backdrop-blur"
                >
                  <p className="text-[0.7rem] text-muted-foreground">
                    {c.letterStatus(reply.status)} ·{" "}
                    {new Date(reply.createdAt).toLocaleDateString(
                      c.isZh ? "zh-CN" : "en-US",
                      { month: "short", day: "numeric" },
                    )}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {reply.body}
                  </p>
                </article>
              ))}
            </div>
          )}
        </HallSection>
      </HallGate>
    </main>
  );
}
