/**
 * 同门 · 众生之厅 — letter cards.
 *
 * A single visual language for the three lists (received / sent / echoes):
 * a sealed-envelope card that never reveals identity beyond the anonymous
 * alias and the broad age chapter.
 */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useInView } from "@/lib/use-in-view";
import "./hall.css";
import type { EchoReply, ReceivedLetter, SentLetter } from "@/lib/community-hall.server";

function formatDate(iso: string, lang: string) {
  try {
    return new Date(iso).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function Shell({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  const { ref, inView } = useInView<HTMLElement>();
  return (
    <article
      ref={ref}
      data-visible={inView ? "true" : "false"}
      className="hall-paper hall-envelope hall-reveal p-5"
      data-unread={accent ? "true" : "false"}
    >
      {children}
    </article>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-muted-foreground">
      {children}
    </div>
  );
}

export function ReceivedLetterCard({ letter }: { letter: ReceivedLetter }) {
  const c = useCommunityHall();
  const unread = !letter.readAt;
  return (
    <Shell accent={unread}>
      <Meta>
        <span>
          {c.fromTraveler} · {letter.author.alias ?? c.hallEyebrow}
        </span>
        <span>{c.ageBand(letter.author.ageBand)}</span>
        <span>{c.topic(letter.topic)}</span>
        <span>
          {c.deliveredAt} {formatDate(letter.deliveredAt, c.lang)}
        </span>
        <span className={unread ? "inline-flex items-center gap-1.5 text-primary" : undefined}>
          {unread ? <span className="hall-seal" aria-hidden /> : null}
          {c.deliveryStatus(letter.status)}
        </span>
      </Meta>
      <h3 className="mt-3 text-base font-semibold text-foreground">
        {letter.subject ?? c.topic(letter.topic)}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {letter.body}
      </p>
      <Link
        to="/community/letters/$letterId"
        params={{ letterId: letter.letterId }}
        className="hall-tap mt-4 inline-flex items-center text-sm font-medium text-primary hover:underline"
      >
        {c.open} →
      </Link>
    </Shell>
  );
}

export function SentLetterCard({ letter }: { letter: SentLetter }) {
  const c = useCommunityHall();
  return (
    <Shell>
      <Meta>
        <span>
          {c.toChapter} {c.ageBand(letter.targetAgeBand)}
        </span>
        <span>{c.topic(letter.topic)}</span>
        <span>{c.letterStatus(letter.status)}</span>
        <span>
          {c.expiresAt} {formatDate(letter.expiresAt, c.lang)}
        </span>
      </Meta>
      <h3 className="mt-3 text-base font-semibold text-foreground">
        {letter.subject ?? c.topic(letter.topic)}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {letter.body}
      </p>
      <Meta>
        <span className="mt-3">
          {c.deliveredCount} {letter.deliveredCount} {c.people}
        </span>
        <span className="mt-3">
          {c.replyCount} {letter.replyCount}
        </span>
      </Meta>
    </Shell>
  );
}

export function EchoCard({ echo }: { echo: EchoReply }) {
  const c = useCommunityHall();
  return (
    <Shell>
      <Meta>
        <span>
          {c.fromTraveler} · {echo.author.alias ?? c.hallEyebrow}
        </span>
        <span>{c.ageBand(echo.author.ageBand)}</span>
        <span>{formatDate(echo.createdAt, c.lang)}</span>
      </Meta>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {echo.body}
      </p>
    </Shell>
  );
}
