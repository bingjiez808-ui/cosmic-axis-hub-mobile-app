/**
 * /community/errands — 受托的信 / letters the librarian handed to me.
 * Accept or decline first; replying reuses the ordinary echo path.
 */
import { createFileRoute, Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  HallEmpty,
  HallGate,
  HallHeader,
  HallMobileBar,
  HallNav,
  HallSection,
} from "@/experiences/community-hall/HallShell";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { useMyAssignments, useRespondToAssignment } from "@/lib/sage-council-client";
import "@/experiences/community-hall/hall.css";

export const Route = createFileRoute("/community/errands")({
  head: () => ({
    meta: [
      { title: "受托的信 · 众生之厅 — Entrusted letters | Library of Destiny" },
      {
        name: "description",
        content:
          "图书管理员亲手交到你手上的信：你可以接下，也可以婉拒。Letters the librarian entrusted to you — accept or decline.",
      },
      { property: "og:title", content: "受托的信 · 众生之厅" },
      { property: "og:description", content: "被托付的一封信，接与不接都由你决定。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ErrandsPage,
});

function ErrandsPage() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
      <HallHeader
        title={zh ? "受托的信" : "Entrusted letters"}
        subtitle={
          zh
            ? "图书管理员会把一些来信亲手托付给愿意接信的旅者。接与不接，永远由你决定。"
            : "The librarian hands some letters to travelers who opted in. Accepting is always your choice."
        }
      />
      <HallNav />
      <HallGate>
        <Errands />
      </HallGate>
      <HallMobileBar />
    </main>
  );
}

function Errands() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const list = useMyAssignments();
  const respond = useRespondToAssignment();

  return (
    <div className="mt-8">
      <HallSection title={zh ? "托付给你的信" : "Handed to you"}>
        {(list.data ?? []).length === 0 ? (
          <HallEmpty
            text={
              zh
                ? "目前没有托付给你的信。在旅者身份中开启「愿意接受管理员分派」，管理员便可能把信交给你。"
                : "Nothing entrusted right now. Turn on librarian assignments in your traveler identity to be considered."
            }
          />
        ) : (
          <div className="space-y-4">
            {(list.data ?? []).map((item) => (
              <article key={item.assignmentId} className="hall-paper p-5">
                <p className="text-[0.7rem] text-primary/75">
                  {item.author.alias ?? (zh ? "一位旅者" : "A traveler")} ·{" "}
                  {new Date(item.createdAt).toLocaleDateString()} · {item.status}
                </p>
                <h3 className="hall-card-title mt-2">{item.subject || (zh ? "无题" : "Untitled")}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">
                  {item.body}
                </p>
                {item.note ? (
                  <p className="mt-3 rounded-xl border border-primary/15 bg-background/50 p-3 text-xs text-muted-foreground">
                    {zh ? "管理员留言：" : "Librarian's note: "}
                    {item.note}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  {item.status === "pending" ? (
                    <>
                      <Button
                        size="sm"
                        className="hall-tap"
                        disabled={respond.isPending}
                        onClick={() =>
                          void respond
                            .mutateAsync({ assignmentId: item.assignmentId, accept: true })
                            .catch(() => {})
                        }
                      >
                        {zh ? "接下这封信" : "Accept"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="hall-tap"
                        disabled={respond.isPending}
                        onClick={() =>
                          void respond
                            .mutateAsync({ assignmentId: item.assignmentId, accept: false })
                            .catch(() => {})
                        }
                      >
                        {zh ? "婉拒" : "Decline"}
                      </Button>
                    </>
                  ) : item.status === "accepted" && !item.iReplied ? (
                    <Button asChild size="sm" variant="outline" className="hall-tap">
                      <Link to="/community/inbox">{zh ? "去信箱写回音" : "Write the echo"}</Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {item.iReplied ? (zh ? "你已回信" : "You replied") : zh ? "已处理" : "Handled"}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </HallSection>
    </div>
  );
}
