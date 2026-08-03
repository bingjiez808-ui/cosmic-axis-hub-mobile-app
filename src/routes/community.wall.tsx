/**
 * /community/wall — 公共信墙 / the open wall.
 *
 * The counterpart to courier delivery: letters whose authors chose to pin them
 * up for the whole hall. Anyone eligible may read them and decide, on their
 * own, whether to answer — one echo per person, still fully anonymous.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  HallEmpty,
  HallGate,
  HallHeader,  HallSection,
} from "@/experiences/community-hall/HallShell";
import { HallError, HallSkeleton } from "@/experiences/community-hall/HallStates";
import { ReportButton } from "@/experiences/community-hall/ReportButton";
import {
  useCommunityPublicLetter,
  useCommunityPublicWall,
  useReplyToLetter,
} from "@/lib/community-hall-client";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { PrecheckWarning } from "@/experiences/community-hall/LetterRulesNotice";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import "@/experiences/community-hall/hall.css";

const ECHO_MIN = 20;
const ECHO_MAX = 800;

export const Route = createFileRoute("/community/wall")({
  head: () => ({
    meta: [
      { title: "公共信墙 · 众生之厅 — The open wall | Library of Destiny" },
      {
        name: "description",
        content:
          "读一读厅中公开张贴的匿名来信，选一封写下你的回音。Read the letters pinned openly in the hall and answer the one that moves you.",
      },
      { property: "og:title", content: "公共信墙 · 众生之厅" },
      { property: "og:description", content: "公开张贴的匿名来信，谁想回就回。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: WallPage,
});

function WallPage() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  return (
    <main className="mx-auto w-full max-w-[430px] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <HallHeader
        title={zh ? "公共信墙" : "The open wall"}
        subtitle={
          zh
            ? "这里的信不是信使送来的，而是作者自己贴上墙的。谁被哪一封打动，就回哪一封。"
            : "These letters were not delivered by the courier — their authors pinned them here. Answer whichever one moves you."
        }
      />
      <HallGate>
        <WallList />
      </HallGate>
    </main>
  );
}

function WallList() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const wall = useCommunityPublicWall();
  const [openId, setOpenId] = useState<string | null>(null);

  if (wall.isLoading) return <HallSkeleton />;
  if (wall.error) {
    return <HallError error={wall.error} onRetry={() => void wall.refetch()} />;
  }

  const letters = wall.data ?? [];
  if (letters.length === 0) {
    return (
      <HallSection title={zh ? "墙上的信" : "Letters on the wall"}>
        <HallEmpty
          text={
            zh
              ? "墙上还空着。你可以在寄信台选择「张贴到公共信墙」，成为第一封。"
              : "The wall is still bare. Choose “pin it on the public wall” at the writing desk and be the first."
          }
        />
      </HallSection>
    );
  }

  return (
    <HallSection title={zh ? "墙上的信" : "Letters on the wall"}>
      <ul className="space-y-4">
        {letters.map((letter) => {
          const open = openId === letter.letterId;
          return (
            <li key={letter.letterId} className="hall-paper p-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="text-gold-dust/85">{letter.author?.alias ?? (zh ? "无名旅者" : "A traveler")}</span>
                <span>{c.ageBand(letter.targetAgeBand as never)}</span>
                <span>{c.topic(letter.topic ?? "self")}</span>
                <span className="ml-auto">
                  {zh ? "回音" : "Echoes"} {letter.echoCount}
                </span>
              </div>
              <h3 className="hall-card-title mt-2">{letter.subject ?? c.topic(letter.topic ?? "self")}</h3>
              <p
                className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90 ${
                  open ? "" : "line-clamp-3"
                }`}
              >
                {letter.body}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button
                  size="sm"
                  variant={open ? "ghost" : "outline"}
                  className="hall-tap"
                  onClick={() => setOpenId(open ? null : letter.letterId)}
                >
                  {open ? (zh ? "收起" : "Collapse") : zh ? "展开并回信" : "Open and answer"}
                </Button>
                {letter.mine ? (
                  <span className="text-xs text-muted-foreground">{zh ? "这是你写的信" : "Your own letter"}</span>
                ) : letter.iReplied ? (
                  <span className="text-xs text-gold-light">{zh ? "你已回过这封信" : "You have answered"}</span>
                ) : null}
                {letter.mine ? null : (
                  <span className="ml-auto">
                    <ReportButton
                      targetType="letter"
                      targetId={letter.letterId}
                      label={zh ? "举报这封信" : "Report this letter"}
                    />
                  </span>
                )}
              </div>
              {open ? <WallLetterDetail letterId={letter.letterId} canReply={!letter.mine} /> : null}
            </li>
          );
        })}
      </ul>
    </HallSection>
  );
}

function WallLetterDetail({ letterId, canReply }: { letterId: string; canReply: boolean }) {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const detail = useCommunityPublicLetter(letterId);
  const reply = useReplyToLetter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (detail.isLoading) return <p className="mt-4 text-xs text-muted-foreground">{c.stateLoadingHall}</p>;
  if (detail.error) {
    return <p className="mt-4 text-sm text-destructive">{hallErrorMessage(detail.error, c.lang)}</p>;
  }

  const data = detail.data;
  const echoes = data?.echoes ?? [];
  const alreadyReplied = data?.iReplied ?? false;
  const length = body.trim().length;

  async function submit() {
    if (length < ECHO_MIN) {
      setError(c.bodyTooShort(ECHO_MIN));
      return;
    }
    try {
      await reply.mutateAsync({ letterId, body: body.trim() });
      setBody("");
      setError(null);
      setDone(true);
    } catch (err) {
      setError(hallErrorMessage(err, c.lang));
    }
  }

  return (
    <div className="mt-4 border-t border-border/50 pt-4">
      <p className="text-xs uppercase tracking-[0.2em] text-primary/70">
        {zh ? "已有的回音" : "Echoes so far"}
      </p>
      {echoes.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {zh ? "还没有人回音。也许就是你。" : "No echoes yet. Perhaps yours is the first."}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {echoes.map((echo) => (
            <li key={echo.replyId} className="hall-inset p-4">
              <p className="text-xs text-muted-foreground">
                {echo.author?.alias ?? (zh ? "无名旅者" : "A traveler")}
                {echo.mine ? (zh ? " · 你" : " · you") : ""}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{echo.body}</p>
              {echo.mine ? null : (
                <div className="mt-2">
                  <ReportButton
                    targetType="reply"
                    targetId={echo.replyId}
                    label={zh ? "举报这条回音" : "Report this echo"}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!canReply ? null : alreadyReplied || done ? (
        <p className="mt-4 text-sm text-gold-light">
          {zh ? "你已经为这封信写过回音了。" : "You have already written an echo for this letter."}
        </p>
      ) : (
        <div className="mt-5">
          <label className="block">
            <span className="text-sm font-medium text-foreground">{zh ? "写下你的回音" : "Write your echo"}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, ECHO_MAX))}
              rows={5}
              placeholder={c.echoPlaceholder}
              className="hall-field mt-2 resize-y text-base sm:text-sm"
            />
          </label>
          <span className="mt-1 block text-right text-xs text-muted-foreground">
            {c.bodyCounter(length, ECHO_MAX)}
          </span>
          <PrecheckWarning text={body} />
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {zh
              ? "回音同样受内容规范约束：不得涉政违规、违法、涉黄或辱骂，不得留联系方式。所有回音都会经过自动审查，也可被举报。"
              : "Echoes follow the same rules: nothing that breaks the law, nothing political, sexual or abusive, no contact details. Every echo is screened and can be reported."}
          </p>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
          <Button
            className="hall-tap mt-3"
            disabled={reply.isPending}
            onClick={() => void submit()}
          >
            {reply.isPending ? c.sending : zh ? "寄出回音" : "Send the echo"}
          </Button>
        </div>
      )}
    </div>
  );
}
