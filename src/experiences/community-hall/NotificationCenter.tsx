/**
 * 同门 · 众生之厅 — courier notifications.
 *
 * A single unified feed for "a letter arrived", "your letter received an
 * echo" and moderation outcomes, read from the same mailbox query the rest of
 * the hall uses.
 */
import { Link } from "@tanstack/react-router";

import { HallSection } from "@/experiences/community-hall/HallShell";
import { useCommunityMailbox, useMarkNotificationsRead } from "@/lib/community-hall-client";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useSupabaseSession } from "@/lib/session";

const TARGETS: Record<string, "/community/inbox" | "/community/echoes" | "/community/outbox"> = {
  letter_received: "/community/inbox",
  reply_received: "/community/echoes",
  letter_reviewed: "/community/outbox",
  reply_reviewed: "/community/echoes",
};

export function NotificationCenter() {
  const c = useCommunityHall();
  const { user } = useSupabaseSession();
  const mailbox = useCommunityMailbox(Boolean(user));
  const markRead = useMarkNotificationsRead();

  if (!user) return null;
  const source = Array.isArray(mailbox.data?.notifications) ? mailbox.data.notifications : [];
  const items = source.slice(0, 8);
  const unread = items.filter((n) => !n.readAt);

  return (
    <HallSection
      title={c.notificationsTitle}
      action={
        unread.length > 0 ? (
          <button
            type="button"
            className="hall-tap text-sm text-primary hover:underline"
            disabled={markRead.isPending}
            onClick={() => markRead.mutate(unread.map((n) => n.id))}
          >
            {c.notificationsMarkRead}
          </button>
        ) : undefined
      }
    >
      {items.length === 0 ? (
        <p className="hall-paper p-5 text-sm text-muted-foreground">{c.notificationsEmpty}</p>
      ) : (
        <ul className="hall-paper divide-y divide-border/50 p-1">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                to={TARGETS[n.type] ?? "/community/inbox"}
                className="hall-tap flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-primary/5"
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-primary"}`}
                />
                <span className={n.readAt ? "text-muted-foreground" : "text-foreground"}>
                  {c.notificationLabel(n.type)}
                </span>
                <time className="ml-auto shrink-0 text-[0.7rem] text-muted-foreground">
                  {new Date(n.createdAt).toLocaleDateString(c.lang === "en" ? "en-US" : "zh-CN", {
                    month: "short",
                    day: "numeric",
                  })}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </HallSection>
  );
}
