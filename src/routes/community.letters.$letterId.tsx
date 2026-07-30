import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { HallGate, HallHeader, HallNav } from "@/experiences/community-hall/HallShell";
import {
  useBlockLetterAuthor,
  useCommunityMailbox,
  useDeliveryState,
  useReplyToLetter,
  useReportContent,
} from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";

/**
 * /community/letters/$letterId — read one delivered letter and write an echo.
 * Opening the page marks the delivery as read; the reply box, the report form
 * and the block action all live on this single page so a recipient never has
 * to hunt for safety tools.
 */
export const Route = createFileRoute("/community/letters/$letterId")({
  head: () => ({
    meta: [
      { title: "拆信 · 众生之厅 — Read a letter | Library of Destiny" },
      { name: "description", content: "拆开一封匿名来信，写下你的回音。Open an anonymous letter and write your echo." },
      { property: "og:title", content: "拆信 · 众生之厅" },
      { property: "og:description", content: "拆开一封匿名来信，写下你的回音。" },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LetterDetailPage,
});

function LetterDetailPage() {
  const c = useCommunityHall();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-12 sm:px-6">
      <HallHeader title={c.navInbox} />
      <HallNav />
      <HallGate>
        <LetterDetail />
      </HallGate>
    </main>
  );
}

function LetterDetail() {
  const c = useCommunityHall();
  const { letterId } = Route.useParams();
  const navigate = useNavigate();
  const mailbox = useCommunityMailbox();
  const delivery = useDeliveryState();
  const reply = useReplyToLetter();
  const report = useReportContent();
  const block = useBlockLetterAuthor();

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reason, setReason] = useState(c.reportReasons[0]?.key ?? "other");
  const [details, setDetails] = useState("");

  const letter = mailbox.data?.received.find((l) => l.letterId === letterId);
  const echoes = (mailbox.data?.echoes ?? []).filter((e) => e.letterId === letterId);
  const alreadyReplied = Boolean(letter?.repliedAt);

  // Mark as read once, the first time the letter renders.
  useEffect(() => {
    if (letter && !letter.readAt && !delivery.isPending) {
      delivery.mutate({ letterId, state: "read" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter?.letterId, letter?.readAt]);

  if (mailbox.isLoading) {
    return <p className="mt-10 text-sm text-muted-foreground">{c.loading}</p>;
  }

  if (!letter) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-primary/20 p-8 text-center">
        <p className="text-sm text-muted-foreground">{c.emptyInbox}</p>
        <Button asChild className="mt-5" variant="outline">
          <Link to="/community/inbox">{c.backToInbox}</Link>
        </Button>
      </div>
    );
  }

  async function submitEcho() {
    if (body.trim().length < 10) {
      setError(c.tooShort);
      return;
    }
    try {
      await reply.mutateAsync({ letterId, body: body.trim() });
      setBody("");
      setError(null);
      toast.success(c.echoSent);
    } catch (err) {
      setError(err instanceof Error ? err.message : c.required);
    }
  }

  return (
    <section className="mt-8 space-y-6">
      <article className="rounded-2xl border border-primary/25 bg-background/60 p-6 backdrop-blur">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground">
          <span>
            {c.fromTraveler} · {letter.author.alias ?? c.hallEyebrow}
          </span>
          <span>{c.ageBand(letter.author.ageBand)}</span>
          <span>{c.topic(letter.topic)}</span>
          <span>{c.deliveryStatus(letter.status)}</span>
        </div>
        <h2 className="mt-3 text-xl font-semibold text-foreground">
          {letter.subject ?? c.topic(letter.topic)}
        </h2>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {letter.body}
        </p>
      </article>

      {echoes.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{c.sectionEchoes}</h3>
          {echoes.map((echo) => (
            <p
              key={echo.replyId}
              className="whitespace-pre-wrap rounded-2xl border border-primary/15 bg-background/50 p-5 text-sm leading-relaxed text-foreground/90"
            >
              {echo.body}
            </p>
          ))}
        </div>
      ) : null}

      {alreadyReplied ? (
        <p className="rounded-2xl border border-primary/15 bg-primary/[0.06] p-5 text-sm text-muted-foreground">
          {c.echoSent}
        </p>
      ) : (
        <div className="rounded-2xl border border-primary/15 bg-background/50 p-5">
          <h3 className="text-sm font-semibold text-foreground">{c.writeEcho}</h3>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 3000))}
            rows={7}
            placeholder={c.echoPlaceholder}
            className="mt-3 w-full resize-y rounded-xl border border-primary/20 bg-background/70 px-4 py-3 text-sm leading-relaxed outline-none focus:border-primary/50"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{c.echoHint}</span>
            <span>{body.trim().length} / 3000</span>
          </div>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          <Button className="mt-4" disabled={reply.isPending} onClick={() => void submitEcho()}>
            {reply.isPending ? c.sending : c.sendEcho}
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <button type="button" onClick={() => setShowReport((v) => !v)} className="hover:text-foreground">
          {c.reportThis}
        </button>
        <button
          type="button"
          disabled={block.isPending}
          onClick={async () => {
            await block.mutateAsync({ letterId });
            toast.success(c.blocked);
            void navigate({ to: "/community/inbox" });
          }}
          className="hover:text-foreground"
        >
          {c.blockThis}
        </button>
        <Link to="/community/inbox" className="hover:text-foreground">
          {c.backToInbox}
        </Link>
      </div>

      {showReport ? (
        <div className="rounded-2xl border border-destructive/25 bg-destructive/[0.04] p-5">
          <div className="flex flex-wrap gap-2">
            {c.reportReasons.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setReason(r.key)}
                className={`rounded-full border px-3 py-1.5 text-xs transition ${
                  reason === r.key
                    ? "border-destructive/50 bg-destructive/10 text-destructive"
                    : "border-primary/15 text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
            rows={3}
            className="mt-3 w-full resize-y rounded-xl border border-primary/20 bg-background/70 px-4 py-2 text-sm outline-none focus:border-primary/50"
          />
          <Button
            variant="outline"
            className="mt-3"
            disabled={report.isPending}
            onClick={async () => {
              await report.mutateAsync({
                targetType: "letter",
                targetId: letterId,
                reason,
                details: details.trim() || null,
              });
              setShowReport(false);
              setDetails("");
              toast.success(c.reportSent);
            }}
          >
            {c.reportThis}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
