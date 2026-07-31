/**
 * /community/librarian — 图书管理员案头 (admin only).
 *
 * The workbench where the librarian reads letters addressed to them and either
 * answers personally (in the letter thread) or entrusts a letter to a traveler
 * who has switched on "willing to receive letters". Non-admins see nothing but
 * a closed door; the server RPCs re-check the admin role regardless.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  HallGate,
  HallHeader,
  HallMobileBar,
  HallNav,
  HallSection,
} from "@/experiences/community-hall/HallShell";
import { HallError, HallSkeleton } from "@/experiences/community-hall/HallStates";
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useAssignLetter, useLibrarianDesk } from "@/lib/sage-council-client";
import { useSupabaseSession } from "@/lib/session";
import "@/experiences/community-hall/hall.css";

export const Route = createFileRoute("/community/librarian")({
  head: () => ({
    meta: [
      { title: "图书管理员案头 · 众生之厅 — Librarian's desk | Library of Destiny" },
      {
        name: "description",
        content:
          "图书管理员的分派工作台：亲自回信，或把一封信托付给愿意接信的旅者。The librarian's desk for answering and entrusting letters.",
      },
      { property: "og:title", content: "图书管理员案头 · 众生之厅" },
      { property: "og:description", content: "读信、回信、托付。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: LibrarianDeskPage,
});

function LibrarianDeskPage() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
      <HallHeader
        title={zh ? "图书管理员案头" : "The librarian's desk"}
        subtitle={
          zh
            ? "寄给图书管理员的信都堆在这里。你可以亲自回信，也可以把一封信托付给一位愿意接信的旅者——对方仍有权拒绝。"
            : "Every letter addressed to the librarian lands here. Answer it yourself, or entrust it to a traveler who offered to help — they may still decline."
        }
      />
      <HallNav />
      <HallGate>
        <Desk />
      </HallGate>
      <HallMobileBar />
    </main>
  );
}

function Desk() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const { isAdmin } = useSupabaseSession();
  const desk = useLibrarianDesk(isAdmin);
  const assign = useAssignLetter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <div className="hall-paper mx-auto mt-10 max-w-xl p-7 text-center">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {zh
            ? "这扇门只为图书管理员开启。若你想帮忙回信，可在旅者身份中打开「愿意接信」。"
            : "This door opens only for the librarian. If you would like to help answer letters, switch on “willing to receive letters” in your traveler settings."}
        </p>
        <div className="mt-5 flex justify-center">
          <Button asChild variant="outline" className="hall-tap">
            <Link to="/me/community">{zh ? "旅者设置" : "Traveler settings"}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (desk.isLoading) return <HallSkeleton rows={3} />;
  if (desk.error) {
    return <HallError error={desk.error} onRetry={() => void desk.refetch()} />;
  }

  const letters = desk.data?.letters ?? [];
  const helpers = desk.data?.helpers ?? [];

  return (
    <div className="mt-8 space-y-8">
      <HallSection
        title={zh ? `案头来信（${letters.length}）` : `Letters on the desk (${letters.length})`}
      >
        {letters.length === 0 ? (
          <div className="hall-empty p-8 text-center text-sm text-muted-foreground">
            {zh ? "案头空着。" : "The desk is clear."}
          </div>
        ) : (
          <ul className="space-y-4">
            {letters.map((letter) => {
              const open = openId === letter.letterId;
              return (
                <li key={letter.letterId} className="hall-paper p-5">
                  <p className="text-xs text-muted-foreground">
                    {letter.author.alias ?? (zh ? "匿名旅者" : "Anonymous traveler")} ·{" "}
                    {c.ageBand(letter.author.ageBand as never)} ·{" "}
                    {new Date(letter.createdAt).toLocaleDateString()} ·{" "}
                    <span className="text-primary/80">{letter.status}</span>
                  </p>
                  <h3 className="hall-card-title mt-2">
                    {letter.subject?.trim() || c.topic(letter.topic ?? "self")}
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {letter.body}
                  </p>

                  {letter.assignments.length > 0 ? (
                    <ul className="hall-inset mt-4 space-y-1 px-4 py-3 text-xs text-muted-foreground">
                      {letter.assignments.map((a) => (
                        <li key={a.assignmentId}>
                          {zh ? "已托付给 " : "Entrusted to "}
                          <span className="text-foreground/90">
                            {a.alias ?? (zh ? "旅者" : "traveler")}
                          </span>{" "}
                          · {a.status}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button asChild size="sm" variant="outline" className="hall-tap">
                      <Link to="/community/letters/$letterId" params={{ letterId: letter.letterId }}>
                        {zh ? "亲自回信" : "Answer it myself"}
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hall-tap"
                      onClick={() => {
                        setOpenId(open ? null : letter.letterId);
                        setAssignee("");
                        setNote("");
                        setError(null);
                      }}
                    >
                      {open
                        ? zh
                          ? "收起"
                          : "Close"
                        : zh
                          ? "托付给旅者"
                          : "Entrust to a traveler"}
                    </Button>
                  </div>

                  {open ? (
                    helpers.length === 0 ? (
                      <p className="hall-inset mt-4 px-4 py-4 text-xs text-muted-foreground">
                        {zh
                          ? "目前没有旅者打开「愿意接信」。"
                          : "No traveler has switched on “willing to receive letters” yet."}
                      </p>
                    ) : (
                      <EntrustPanel
                        helpers={helpers}
                        topicLabel={letter.subject?.trim() || c.topic(letter.topic ?? "self")}
                        pending={assign.isPending}
                        error={error}
                        onAssign={async (assigneeId, noteText) => {
                          try {
                            await assign.mutateAsync({
                              letterId: letter.letterId,
                              assigneeId,
                              note: noteText,
                            });
                            setOpenId(null);
                            setError(null);
                          } catch (err) {
                            setError(hallErrorMessage(err, c.lang));
                          }
                        }}
                      />
                    )
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </HallSection>

      <HallSection
        title={zh ? `愿意接信的旅者（${helpers.length}）` : `Travelers willing to help (${helpers.length})`}
      >
        {helpers.length === 0 ? (
          <div className="hall-empty p-8 text-center text-sm text-muted-foreground">
            {zh ? "暂时还没有人举手。" : "Nobody has raised a hand yet."}
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {helpers.map((h) => (
              <li key={h.userId} className="hall-paper p-4">
                <p className="text-sm font-semibold text-foreground">
                  {h.alias ?? (zh ? "匿名旅者" : "Anonymous traveler")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.ageBand(h.ageBand as never)}
                  {h.academy ? ` · ${h.academy}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </HallSection>
    </div>
  );
}
