import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  HallGate,
  HallHeader,  HallSection,
} from "@/experiences/community-hall/HallShell";
import { HallEmptyState, HallError, HallSkeleton } from "@/experiences/community-hall/HallStates";
import { EchoRating } from "@/experiences/community-hall/EchoRating";
import { EchoCard } from "@/experiences/community-hall/LetterCards";
import { useCommunityMailbox, useSaveEcho } from "@/lib/community-hall-client";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import "@/experiences/community-hall/hall.css";

/**
 * /community/echoes — replies received on my letters (grouped under the
 * letter that caused them) and the replies I wrote for others.
 */
export const Route = createFileRoute("/community/echoes")({
  head: () => ({
    meta: [
      { title: "我的回音 · 众生之厅 — Echoes | Library of Destiny" },
      {
        name: "description",
        content: "别人写给你的回音，以及你写出的回音。Echoes written to you, and the ones you wrote.",
      },
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
  const saveEcho = useSaveEcho();
  const [tab, setTab] = useState<"received" | "mine">("received");

  const echoes = Array.isArray(mailbox.data?.echoes) ? mailbox.data.echoes : [];
  const mine = Array.isArray(mailbox.data?.myReplies) ? mailbox.data.myReplies : [];
  const sent = Array.isArray(mailbox.data?.sent) ? mailbox.data.sent : [];

  /** Group echoes under the letter that caused them. */
  const groups = sent
    .map((letter) => ({
      letter,
      items: echoes.filter((e) => e.letterId === letter.letterId),
    }))
    .filter((g) => g.items.length > 0 || g.letter.status === "approved");

  async function toggleSaved(replyId: string, saved: boolean) {
    try {
      await saveEcho.mutateAsync({ replyId, saved });
    } catch (err) {
      toast.error(hallErrorMessage(err, c.lang));
    }
  }

  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <HallHeader title={c.cardEchoesTitle} subtitle={c.cardEchoesBody} />
      <HallGate>
        <HallSection title={c.sectionEchoes}>
          <div className="mb-4 flex gap-2">
            {[
              { key: "received" as const, label: c.tabReceivedEchoes },
              { key: "mine" as const, label: c.tabMyEchoes },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                aria-pressed={tab === t.key}
                className={`hall-tap rounded-full border px-3.5 py-2 text-xs transition ${
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
            <HallSkeleton />
          ) : mailbox.error ? (
            <HallError error={mailbox.error} onRetry={() => void mailbox.refetch()} />
          ) : tab === "received" ? (
            groups.length === 0 ? (
              <HallEmptyState
                text={c.emptyEchoes}
                cta={
                  <Button asChild variant="outline" className="hall-tap">
                    <Link to="/community/write">{c.ctaWrite}</Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-8">
                {groups.map(({ letter, items }) => (
                  <section key={letter.letterId} className="space-y-3">
                    <header className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="hall-card-title">
                        {letter.subject ?? c.topic(letter.topic)}
                      </h3>
                      <span className="text-[0.7rem] text-muted-foreground">
                        {c.toChapter} {c.ageBand(letter.targetAgeBand)} ·{" "}
                        {c.letterStatus(letter.status)}
                      </span>
                    </header>
                    {items.length === 0 ? (
                      <p className="hall-empty p-5 text-sm text-muted-foreground">
                        {c.awaitingEcho}
                      </p>
                    ) : (
                      items.map((echo) => (
                        <div key={echo.replyId} className="space-y-2">
                          <EchoCard echo={echo} />
                          <EchoRating replyId={echo.replyId} />
                          <button
                            type="button"
                            disabled={saveEcho.isPending}
                            onClick={() => void toggleSaved(echo.replyId, !echo.savedAt)}
                            className="hall-tap text-xs text-muted-foreground hover:text-foreground"
                          >
                            {echo.savedAt ? c.savedEcho : c.saveEcho}
                          </button>
                        </div>
                      ))
                    )}
                  </section>
                ))}
              </div>
            )
          ) : mine.length === 0 ? (
            <HallEmptyState text={c.emptyEchoes} />
          ) : (
            <div className="grid gap-4">
              {mine.map((reply) => (
                <article key={reply.replyId} className="hall-paper p-5">
                  <p className="text-[0.7rem] text-muted-foreground">
                    {c.letterStatus(reply.status)} ·{" "}
                    {new Date(reply.createdAt).toLocaleDateString(c.isZh ? "zh-CN" : "en-US", {
                      month: "short",
                      day: "numeric",
                    })}
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
