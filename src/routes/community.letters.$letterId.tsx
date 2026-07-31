import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  HallGate,
  HallHeader,
  HallMobileBar,
  HallNav,
} from "@/experiences/community-hall/HallShell";
import { HallError, HallSkeleton } from "@/experiences/community-hall/HallStates";
import {
  useBlockLetterAuthor,
  useCommunityMailbox,
  useDeliveryState,
  useReplyToLetter,
  useReportContent,
} from "@/lib/community-hall-client";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import "@/experiences/community-hall/hall.css";

const ECHO_MIN = 20;
const ECHO_MAX = 800;

/**
 * /community/letters/$letterId — open one delivered letter and write an echo.
 * Opening the page marks the delivery as read. The reply box and the safety
 * tools (report / block) both live here, so a recipient never has to hunt for
 * them; on phones the actions sit in a sticky bar within thumb reach.
 */
export const Route = createFileRoute("/community/letters/$letterId")({
  head: () => ({
    meta: [
      { title: "拆信 · 众生之厅 — Read a letter | Library of Destiny" },
      {
        name: "description",
        content: "拆开一封匿名来信，写下你的回音。Open an anonymous letter and write your echo.",
      },
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
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
      <HallHeader title={c.navInbox} />
      <HallNav />
      <HallGate>
        <LetterDetail />
      </HallGate>
      <HallMobileBar />
    </main>
  );
}

/** Emoji / punctuation only — not an answer anyone can read. */
function isWordless(text: string) {
  return !/[\p{L}\p{N}]/u.test(text);
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
  const [showSafety, setShowSafety] = useState(false);
  const [reason, setReason] = useState(c.reportReasons[0]?.key ?? "other");
  const [details, setDetails] = useState("");
  const [confirmBlock, setConfirmBlock] = useState(false);
  const lastSent = useRef<string | null>(null);

  const letter = mailbox.data?.received.find((l) => l.letterId === letterId);
  const echoes = useMemo(
    () => (mailbox.data?.echoes ?? []).filter((e) => e.letterId === letterId),
    [mailbox.data?.echoes, letterId],
  );
  const alreadyReplied = Boolean(letter?.repliedAt);
  const length = body.trim().length;

  // Mark as read once, the first time the letter renders.
  useEffect(() => {
    if (letter && !letter.readAt && !delivery.isPending) {
      delivery.mutate({ letterId, state: "read" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter?.letterId, letter?.readAt]);

  if (mailbox.isLoading) return <div className="mt-8"><HallSkeleton rows={1} /></div>;
  if (mailbox.error) {
    return (
      <div className="mt-8">
        <HallError error={mailbox.error} onRetry={() => void mailbox.refetch()} />
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="hall-paper mt-10 p-8 text-center">
        <p className="text-sm text-muted-foreground">{c.emptyInbox}</p>
        <Button asChild className="hall-tap mt-5" variant="outline">
          <Link to="/community/inbox">{c.backToInbox}</Link>
        </Button>
      </div>
    );
  }

  async function submitEcho() {
    const text = body.trim();
    if (text.length < ECHO_MIN) return setError(c.echoTooShort);
    if (text.length > ECHO_MAX) return setError(c.echoTooLong);
    if (isWordless(text)) return setError(c.echoNoEmojiOnly);
    if (lastSent.current === text) return setError(c.echoDuplicate);
    try {
      await reply.mutateAsync({ letterId, body: text });
      lastSent.current = text;
      setBody("");
      setError(null);
      toast.success(c.echoSent);
    } catch (err) {
      setError(hallErrorMessage(err, c.lang));
    }
  }

  async function submitReport() {
    try {
      await report.mutateAsync({
        targetType: "letter",
        targetId: letterId,
        reason,
        details: details.trim() || null,
      });
      setShowSafety(false);
      setDetails("");
      toast.success(c.reportSent);
    } catch (err) {
      toast.error(hallErrorMessage(err, c.lang));
    }
  }

  async function submitBlock() {
    try {
      await block.mutateAsync({ letterId });
      setShowSafety(false);
      setConfirmBlock(false);
      toast.success(c.blocked);
      void navigate({ to: "/community/inbox" });
    } catch (err) {
      toast.error(hallErrorMessage(err, c.lang));
    }
  }

  return (
    <section className="mt-8 space-y-6">
      <article className="hall-paper hall-open-in p-6">
        <p className="text-[0.7rem] uppercase tracking-[0.3em] text-primary/70">
          {c.letterFromChapter} {c.ageBand(letter.author.ageBand)}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground">
          <span>
            {c.fromTraveler} · {letter.author.alias ?? c.hallEyebrow}
          </span>
          <span>{c.topic(letter.topic)}</span>
          <span>{c.deliveryStatus(letter.status)}</span>
        </div>
        <h2 className="mt-3 text-xl font-semibold text-foreground">
          {letter.subject ?? c.topic(letter.topic)}
        </h2>
        <p className="mt-4 whitespace-pre-wrap text-[0.95rem] leading-[1.9] text-foreground/90">
          {letter.body}
        </p>
      </article>

      {echoes.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{c.echoesForLetter}</h3>
          {echoes.map((echo) => (
            <p
              key={echo.replyId}
              className="hall-paper whitespace-pre-wrap p-5 text-sm leading-relaxed text-foreground/90"
            >
              {echo.body}
            </p>
          ))}
        </div>
      ) : null}

      {alreadyReplied ? (
        <p className="hall-paper p-5 text-sm text-muted-foreground">{c.echoOnce}</p>
      ) : (
        <div className="hall-paper p-5">
          <h3 className="text-sm font-semibold text-foreground">{c.writeEcho}</h3>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, ECHO_MAX))}
            rows={7}
            placeholder={c.echoPlaceholder}
            className="mt-3 w-full resize-y rounded-xl border border-primary/20 bg-background/70 px-4 py-3 text-base leading-relaxed outline-none focus:border-primary/50 sm:text-sm"
          />
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>{c.echoRange}</span>
            <span>{c.bodyCounter(length, ECHO_MAX)}</span>
          </div>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          <Button
            className="hall-tap mt-4 w-full sm:w-auto"
            disabled={reply.isPending}
            onClick={() => void submitEcho()}
          >
            {reply.isPending ? c.sending : c.sendEcho}
          </Button>
        </div>
      )}

      {/* ── Safety tools ──────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="hall-tap"
          onClick={() => setShowSafety((v) => !v)}
        >
          {c.safetyTools}
        </Button>
        <Link to="/community/inbox" className="text-sm text-muted-foreground hover:text-foreground">
          {c.backToInbox}
        </Link>
      </div>

      {showSafety ? (
        <div className="hall-paper hall-rise p-5">
          <h3 className="text-sm font-semibold text-foreground">{c.safetySheetTitle}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.reportReasons.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setReason(r.key)}
                className={`hall-tap rounded-full border px-3 py-1.5 text-xs transition ${
                  reason === r.key
                    ? "border-primary/50 bg-primary/15 text-primary"
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
            className="mt-3 w-full resize-y rounded-xl border border-primary/20 bg-background/70 px-4 py-3 text-sm outline-none focus:border-primary/50"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              size="sm"
              className="hall-tap"
              disabled={report.isPending}
              onClick={() => void submitReport()}
            >
              {c.reportThis}
            </Button>
            {confirmBlock ? (
              <>
                <span className="self-center text-xs text-muted-foreground">{c.confirmBlock}</span>
                <Button
                  size="sm"
                  variant="destructive"
                  className="hall-tap"
                  disabled={block.isPending}
                  onClick={() => void submitBlock()}
                >
                  {c.confirm}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="hall-tap"
                  onClick={() => setConfirmBlock(false)}
                >
                  {c.cancel}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="hall-tap"
                onClick={() => setConfirmBlock(true)}
              >
                {c.blockThis}
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
