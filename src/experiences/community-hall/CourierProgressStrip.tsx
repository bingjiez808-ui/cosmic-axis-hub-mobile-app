/**
 * 同门 · 众生之厅 — the courier's quiet progress strip.
 *
 * A single parchment line that tells the traveler two things without ever
 * interrupting the room: (1) an unsent draft is still waiting on the writing
 * desk, and (2) how far the letters already handed to the courier have gone.
 *
 * Sync rules — immersion first:
 * · draft state mirrors localStorage live (same tab via custom event, other
 *   tabs via `storage`), so nothing needs polling or a reload;
 * · delivery counts reuse the shared mailbox query — no extra request, no
 *   spinner, no layout jump: the strip simply stays hidden until it has
 *   something true to say, then fades in.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

import { DraftPeekDialog } from "./DraftPeekDialog";
import { useCommunityMailbox } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { loadLetterDraft, subscribeLetterDraft, type LetterDraft } from "@/lib/letter-draft";
import { useSupabaseSession } from "@/lib/session";

function useLiveDraft(): LetterDraft | null {
  // Read after mount only: localStorage is not available during SSR and a
  // hydration mismatch would flash the strip in and out.
  const [draft, setDraft] = useState<LetterDraft | null>(null);
  useEffect(() => {
    const sync = () => setDraft(loadLetterDraft());
    sync();
    return subscribeLetterDraft(sync);
  }, []);
  return draft;
}

function relativeTime(ts: number, lang: "zh" | "en") {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return lang === "zh" ? "刚刚" : "just now";
  if (mins < 60) return lang === "zh" ? `${mins} 分钟前` : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return lang === "zh" ? `${hours} 小时前` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return lang === "zh" ? `${days} 天前` : `${days} d ago`;
}

export function CourierProgressStrip() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const { user } = useSupabaseSession();
  const draft = useLiveDraft();
  const [peeking, setPeeking] = useState(false);
  const mailbox = useCommunityMailbox(Boolean(user));

  const sent = mailbox.data?.sent ?? [];
  const waiting = sent.filter((l) => l.replyCount === 0 && l.status !== "closed").length;
  const answered = sent.filter((l) => l.replyCount > 0).length;
  const unreadEchoes = (mailbox.data?.echoes ?? []).length;

  const draftPreview = draft?.body?.trim().slice(0, 28) ?? "";
  const hasDraft = Boolean(draftPreview);
  const hasProgress = sent.length > 0;
  if (!hasDraft && !hasProgress) return null;

  return (
    <section
      className="hall-inset hall-fade-in mx-auto mt-6 flex w-full max-w-3xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 text-xs"
      aria-live="polite"
    >
      {hasDraft ? (
        <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1 text-muted-foreground">
          <span className="text-gold-dust/85">{zh ? "未寄出的草稿" : "Unsent draft"}</span>
          <span className="truncate font-serif italic text-foreground/85">「{draftPreview}…」</span>
          <span className="text-muted-foreground/70">
            {zh ? "保存于 " : "saved "}
            {relativeTime(draft!.savedAt, zh ? "zh" : "en")}
          </span>
          <span className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPeeking(true)}
              className="hall-tap text-primary underline-offset-4 hover:underline"
            >
              {zh ? "打开草稿" : "Open draft"}
            </button>
            <Link
              to="/community/write"
              className="hall-tap text-primary underline-offset-4 hover:underline"
            >
              {zh ? "继续写完 →" : "Continue →"}
            </Link>
          </span>
        </p>
      ) : (
        <p className="text-muted-foreground/80">
          {zh ? "信使正在路上。" : "The courier is on the road."}
        </p>
      )}

      {hasProgress ? (
        <dl className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-muted-foreground">
          <div className="flex items-baseline gap-1.5">
            <dt>{zh ? "已寄出" : "Sent"}</dt>
            <dd className="text-foreground">{sent.length}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>{zh ? "等待回音" : "Awaiting echo"}</dt>
            <dd className="text-foreground">{waiting}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt>{zh ? "已有回音" : "Answered"}</dt>
            <dd className="text-gold-light">{answered || unreadEchoes}</dd>
          </div>
          <Link
            to="/community/outbox"
            className="hall-tap text-primary underline-offset-4 hover:underline"
          >
            {zh ? "查看进度 →" : "View progress →"}
          </Link>
        </dl>
      ) : null}

      <DraftPeekDialog
        draft={draft}
        open={peeking && hasDraft}
        onOpenChange={setPeeking}
      />
    </section>
  );
}
