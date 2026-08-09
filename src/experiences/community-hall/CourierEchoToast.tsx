/**
 * 同门 · 众生之厅 — the courier's knock.
 *
 * Watches the shared mailbox query and, the moment one of my sent letters
 * flips from "等待回音" to "已有回音" (its reply count grows), slides a small
 * parchment note in from the corner: an envelope, a broken wax seal, one line
 * of text and a single "查看回音" link.
 *
 * Interaction rules — immersion first:
 * · never steals focus, never blocks the page (aria-live="polite", no overlay);
 * · auto-dismisses after ~14s, can be dismissed by hand at any time;
 * · a per-letter watermark lives in localStorage, so the same echo never
 *   knocks twice, and the first visit after signing in stays silent.
 */
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";

import { communityKeys } from "@/lib/community-hall-client";
import { getMyCommunityMailbox, type CommunityMailbox } from "@/lib/community-hall.functions";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useSupabaseSession } from "@/lib/session";
import "./hall.css";

const WATERMARK_KEY = "hall.echo.watermark.v1";

type Watermark = Record<string, number>;

function readWatermark(): Watermark | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WATERMARK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Watermark) : null;
  } catch {
    return null;
  }
}

function writeWatermark(next: Watermark) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WATERMARK_KEY, JSON.stringify(next));
  } catch {
    /* private mode — the toast simply becomes session-only */
  }
}

type Knock = { letterId: string; subject: string | null; newEchoes: number };

/**
 * Mount once per hall page. Polls the mailbox gently (60s, only while the tab
 * is visible) so an echo that lands while the traveler is reading elsewhere in
 * the hall still gets announced without a reload.
 */
export function CourierEchoToast() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const { user } = useSupabaseSession();
  const load = useServerFn(getMyCommunityMailbox);
  const [knock, setKnock] = useState<Knock | null>(null);
  const initialised = useRef(false);

  const mailbox = useQuery<CommunityMailbox>({
    queryKey: communityKeys.mailbox,
    queryFn: () => load(),
    enabled: Boolean(user),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  const sent = mailbox.data?.sent;

  useEffect(() => {
    if (!sent) return;
    const stored = readWatermark();
    const next: Watermark = {};
    let candidate: Knock | null = null;

    for (const letter of sent) {
      const count = letter.replyCount ?? 0;
      next[letter.letterId] = count;
      const before = stored?.[letter.letterId];
      // A knock only happens on a real transition we have already observed:
      // 0 (waiting) → >0 (answered), or more echoes on an answered letter.
      if (stored && typeof before === "number" && count > before) {
        candidate = {
          letterId: letter.letterId,
          subject: letter.subject,
          newEchoes: count - before,
        };
      }
    }

    writeWatermark(next);
    // The very first pass after mount only establishes the baseline.
    if (!initialised.current) {
      initialised.current = true;
      if (!stored) return;
    }
    if (candidate) setKnock(candidate);
  }, [sent]);

  const dismiss = useCallback(() => setKnock(null), []);

  useEffect(() => {
    if (!knock) return;
    const timer = window.setTimeout(dismiss, 14_000);
    return () => window.clearTimeout(timer);
  }, [knock, dismiss]);

  if (!user || !knock) return null;

  const title = zh ? "信使送回一封回音" : "The courier brought an echo";
  const detail = knock.subject
    ? `「${knock.subject}」`
    : zh
      ? "你寄出的那封信"
      : "the letter you sent";
  const more =
    knock.newEchoes > 1
      ? zh
        ? `${knock.newEchoes} 封新回音`
        : `${knock.newEchoes} new echoes`
      : zh
        ? "1 封新回音"
        : "1 new echo";

  return (
    <div
      role="status"
      aria-live="polite"
      className="hall-courier-knock fixed bottom-24 right-3 z-40 w-[min(20rem,calc(100vw-1.5rem))] sm:bottom-6 sm:right-6"
    >
      <div className="hall-paper relative flex items-start gap-3 p-4 pr-9 shadow-lg">
        <span aria-hidden className="hall-courier-seal mt-0.5 text-lg leading-none">
          ✉
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {detail} · <span className="text-gold-light">{more}</span>
          </p>
          <Link
            to="/community/letters/$letterId"
            params={{ letterId: knock.letterId }}
            onClick={dismiss}
            className="hall-tap mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline"
          >
            {zh ? "查看回音 →" : "Read the echo →"}
          </Link>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={zh ? "收起提示" : "Dismiss"}
          className="hall-tap absolute right-2 top-2 rounded-full px-1.5 text-muted-foreground transition hover:text-foreground"
        >
          ×
        </button>
      </div>
    </div>
  );
}
