/**
 * /community/grants — 真人回复权益 / human-reply grants.
 *
 * One place for the three one-time gifts that come with 「贤者」membership:
 *   claim them, see how many remain, read the claim/spend ledger, and pick
 *   in one click which of your sage letters a real person should answer.
 */
import { useMemo, useState } from "react";
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
import { hallErrorMessage } from "@/lib/community-hall-errors";
import { useCommunityHall } from "@/lib/i18n-community-hall";
import { sageName } from "@/lib/sage-personas";
import {
  useClaimHumanReplyGrants,
  useDeskLetters,
  useHumanReplyGrantHistory,
  useRequestHumanReply,
  useSageEntitlement,
} from "@/lib/sage-council-client";
import "@/experiences/community-hall/hall.css";

export const Route = createFileRoute("/community/grants")({
  head: () => ({
    meta: [
      { title: "真人回复权益 · 众生之厅 — Human reply grants | Library of Destiny" },
      {
        name: "description",
        content:
          "开通「贤者」即赠三次真人回复（一次性，非每月）：在这里领取、查看剩余次数与使用记录，并一键决定用在哪封信上。",
      },
      { property: "og:title", content: "真人回复权益 · 众生之厅" },
      { property: "og:description", content: "领取、查看与分配开通即赠的三次真人回复。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: GrantsPage,
});

function GrantsPage() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-28 sm:px-6 sm:pb-24 sm:pt-32">
      <HallHeader
        title={zh ? "真人回复权益" : "Human reply grants"}
        subtitle={
          zh
            ? "开通「贤者」即赠 3 次真人回复（一次性赠送，用完为止）：由图书管理员本人、或他托付的旅者匿名执笔。领取后，你可以随时决定用在哪封信上。"
            : "Sage membership includes three human replies as a one-time gift, written anonymously by the librarian or a traveler they entrust. Claim them, then choose which letter each one goes to."
        }
      />
      <HallNav />
      <HallGate>
        <GrantsBody />
      </HallGate>
      <HallMobileBar />
    </main>
  );
}

function GrantsBody() {
  const c = useCommunityHall();
  const zh = c.lang !== "en";
  const lang = zh ? "zh" : "en";
  const entitlement = useSageEntitlement();
  const history = useHumanReplyGrantHistory();
  const desk = useDeskLetters("sage");
  const claim = useClaimHumanReplyGrants();
  const spend = useRequestHumanReply();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const credits = entitlement.data?.credits;
  const entitled = entitlement.data?.entitled ?? false;
  const remaining = credits?.remaining ?? 0;

  /** Sage letters that have not yet been escalated to a human. */
  const candidates = useMemo(
    () => (desk.data ?? []).filter((letter) => letter.route === "sage"),
    [desk.data],
  );

  async function onClaim() {
    setError(null);
    setNotice(null);
    try {
      await claim.mutateAsync();
      setNotice(zh ? "已领取赠送的 3 次真人回复。" : "Claimed your three gifted human replies.");
    } catch (err) {
      setError(hallErrorMessage(err, c.lang));
    }
  }

  async function onSpend(letterId: string) {
    setError(null);
    setNotice(null);
    try {
      await spend.mutateAsync({ letterId });
      setNotice(
        zh
          ? "已把这封信送上图书管理员的案头，真人回信会以匿名身份寄回。"
          : "This letter is now on the librarian's desk; the human reply comes back anonymously.",
      );
    } catch (err) {
      setError(hallErrorMessage(err, c.lang));
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {/* ---- Balance + claim ------------------------------------ */}
      <HallSection title={zh ? "赠送权益" : "Your gift"}>
        <div className="hall-paper p-6">
          {entitlement.isLoading ? (
            <p className="text-sm text-muted-foreground">{zh ? "读取中…" : "Loading…"}</p>
          ) : !entitled ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-foreground/85">
                {zh
                  ? "真人回复是「贤者」会员的权益。开通即一次性赠送 3 次，由真人匿名执笔回信。"
                  : "Human replies come with Sage membership: three as a one-time gift, written by a real person, anonymously."}
              </p>
              <Button asChild size="sm" className="hall-tap">
                <Link to="/me/membership">{zh ? "了解贤者会员" : "See Sage membership"}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-6">
                <Stat label={zh ? "剩余" : "Remaining"} value={remaining} strong />
                <Stat label={zh ? "已用" : "Used"} value={credits?.used ?? 0} />
                <Stat label={zh ? "累计发放" : "Granted"} value={credits?.granted ?? 0} />
              </div>
              <p className="text-xs text-muted-foreground">
                {zh ? "开通起始：" : "Since: "}
                {credits?.periodStart
                  ? new Date(credits.periodStart).toLocaleDateString()
                  : "—"}
                {credits?.claimedAt
                  ? ` · ${zh ? "已于" : "claimed "}${new Date(credits.claimedAt).toLocaleDateString()}${zh ? " 领取" : ""}`
                  : ""}
              </p>
              {credits?.claimable ? (
                <Button
                  size="sm"
                  className="hall-tap"
                  disabled={claim.isPending}
                  onClick={() => void onClaim()}
                >
                  {claim.isPending
                    ? zh
                      ? "领取中…"
                      : "Claiming…"
                    : zh
                      ? "领取赠送的 3 次真人回复"
                      : "Claim your 3 gifted replies"}
                </Button>
              ) : (
                <p className="text-sm text-foreground/80">
                  {zh
                    ? "赠送权益已到账。这 3 次为开通时一次性赠送，用完即止，不会每月重置。"
                    : "Your gift is in your account. These three are a one-time grant: they do not reset each month."}
                </p>
              )}
            </div>
          )}
        </div>
      </HallSection>

      {notice ? (
        <p className="rounded-xl border border-primary/20 bg-background/60 p-3 text-sm text-foreground/85">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* ---- Choose who receives a human reply ------------------ */}
      <HallSection title={zh ? "用在哪封信上" : "Where to spend it"}>
        <p className="mb-4 text-sm text-muted-foreground">
          {zh
            ? "选择一封已寄给先贤的信，一键升级为真人回信。信件依旧匿名，只带着你的旅者身份。"
            : "Pick a letter you sent to a sage and escalate it to a human reply. It stays anonymous under your traveler identity."}
        </p>
        {desk.isLoading ? (
          <HallEmpty text={zh ? "读取中…" : "Loading…"} />
        ) : candidates.length === 0 ? (
          <HallEmpty
            text={
              zh
                ? "还没有可以升级的信。先到先贤案头写一封，再回来选择。"
                : "No letters to escalate yet. Write to a sage first, then come back."
            }
            cta={
              <Button asChild size="sm" variant="ghost" className="hall-tap">
                <Link to="/community/sages">{zh ? "去先贤案头" : "To the sages"}</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            {candidates.map((letter) => (
              <article key={letter.letterId} className="hall-paper p-5">
                <p className="text-[0.7rem] text-primary/75">
                  {sageName(letter.personaId, lang)} ·{" "}
                  {new Date(letter.createdAt).toLocaleDateString()}
                </p>
                <h3 className="hall-card-title mt-2">
                  {letter.subject || (zh ? "无题" : "Untitled")}
                </h3>
                <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                  {letter.body}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    size="sm"
                    className="hall-tap"
                    disabled={spend.isPending || remaining <= 0 || !entitled}
                    onClick={() => void onSpend(letter.letterId)}
                  >
                    {zh ? "用一次真人回复" : "Spend one human reply"}
                  </Button>
                  <Button asChild size="sm" variant="ghost" className="hall-tap">
                    <Link to="/community/letters/$letterId" params={{ letterId: letter.letterId }}>
                      {zh ? "查看这封信" : "Open letter"}
                    </Link>
                  </Button>
                  {remaining <= 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {zh ? "赠送次数已用完" : "No gifted replies left"}
                    </span>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </HallSection>

      {/* ---- Ledger --------------------------------------------- */}
      <HallSection title={zh ? "使用记录" : "History"}>
        {(history.data ?? []).length === 0 ? (
          <HallEmpty text={zh ? "暂无领取或使用记录。" : "No claims or spends yet."} />
        ) : (
          <ul className="space-y-2">
            {(history.data ?? []).map((event) => (
              <li
                key={event.eventId}
                className="hall-paper flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground/85">
                    {event.kind === "grant"
                      ? zh
                        ? "领取本月赠送"
                        : "Claimed gifted replies"
                      : zh
                        ? `用于：${event.letterSubject || "无题"}`
                        : `Spent on: ${event.letterSubject || "Untitled"}`}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString()}
                    {event.kind === "spend" && event.letterPersonaId
                      ? ` · ${sageName(event.letterPersonaId, lang)}`
                      : ""}
                    {event.kind === "spend"
                      ? ` · ${
                          event.replyCount > 0
                            ? zh
                              ? "已有回音"
                              : "answered"
                            : zh
                              ? "等待回音"
                              : "awaiting reply"
                        }`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-sm font-semibold ${
                      event.delta > 0 ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {event.delta > 0 ? `+${event.delta}` : event.delta}
                  </span>
                  {event.letterId ? (
                    <Button asChild size="sm" variant="ghost" className="hall-tap">
                      <Link to="/community/letters/$letterId" params={{ letterId: event.letterId }}>
                        {zh ? "查看" : "Open"}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </HallSection>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div>
      <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p
        className={
          strong
            ? "mt-1 text-4xl font-semibold text-primary"
            : "mt-1 text-2xl font-medium text-foreground/80"
        }
      >
        {value}
      </p>
    </div>
  );
}
