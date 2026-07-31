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
        title={zh ? "回信权益" : "Reply grants"}
        subtitle={
          zh
            ? "开通「贤者」即赠 2 次「先贤回信」与 1 次「管理员授权」（可由图书管理员亲自回信，或由他委托的旅者定向回信）。用完之后可单独加购：3 元 1 次，10 元 4 次。"
            : "Sage membership gifts two sage replies and one librarian-authorised human reply (answered by the librarian, or by a traveler they entrust). Need more? ¥3 for one, ¥10 for four."
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
  const purchase = usePurchaseReplyCredits();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const credits = entitlement.data?.credits;
  const entitled = entitlement.data?.entitled ?? false;
  const remaining = credits?.remaining ?? 0;
  const sageRemaining = credits?.sageRemaining ?? 0;

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
      setNotice(
        zh
          ? "已领取：2 次先贤回信 + 1 次管理员授权。"
          : "Claimed: 2 sage replies + 1 librarian-authorised reply.",
      );
    } catch (err) {
      setError(hallErrorMessage(err, c.lang));
    }
  }

  async function onBuy(bucket: "sage" | "human", pack: "single" | "quad") {
    setError(null);
    setNotice(null);
    try {
      await purchase.mutateAsync({
        bucket,
        pack,
        idempotencyKey: `${bucket}-${pack}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      setNotice(
        zh
          ? `加购成功：${pack === "single" ? "1" : "4"} 次${bucket === "sage" ? "先贤回信" : "管理员授权"}已到账（模拟支付，不会真实扣款）。`
          : `Added ${pack === "single" ? "1" : "4"} ${bucket === "sage" ? "sage" : "librarian"} reply chance(s). Simulated payment — no real charge.`,
      );
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
                  ? "开通「贤者」即赠 2 次先贤回信 + 1 次管理员授权（管理员亲自回信，或由他委托旅者定向回信）。用完可加购：3 元 1 次，10 元 4 次。"
                  : "Sage membership gifts 2 sage replies + 1 librarian-authorised human reply. Extras: ¥3 for one, ¥10 for four."}
              </p>
              <Button asChild size="sm" className="hall-tap">
                <Link to="/me/membership">{zh ? "了解贤者会员" : "See Sage membership"}</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="rounded-xl border border-primary/15 bg-background/40 p-4">
                  <p className="text-xs text-primary/80">{zh ? "先贤回信" : "Sage replies"}</p>
                  <div className="mt-2 flex flex-wrap items-end gap-5">
                    <Stat label={zh ? "剩余" : "Remaining"} value={sageRemaining} strong />
                    <Stat label={zh ? "已用" : "Used"} value={credits?.sageUsed ?? 0} />
                  </div>
                </div>
                <div className="rounded-xl border border-primary/15 bg-background/40 p-4">
                  <p className="text-xs text-primary/80">
                    {zh ? "管理员授权（真人回信）" : "Librarian-authorised reply"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-5">
                    <Stat label={zh ? "剩余" : "Remaining"} value={remaining} strong />
                    <Stat label={zh ? "已用" : "Used"} value={credits?.used ?? 0} />
                  </div>
                </div>
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
                      ? "领取赠送：2 次先贤回信 + 1 次管理员授权"
                      : "Claim 2 sage replies + 1 librarian reply"}
                </Button>
              ) : (
                <p className="text-sm text-foreground/80">
                  {zh
                    ? "赠送权益已到账。这是开通「贤者」时的一次性赠送，用完可单独加购，不会每月重置。"
                    : "Your gift is in your account. It is a one-time grant with Sage membership — top up if you need more."}
                </p>
              )}
            </div>
          )}
        </div>
      </HallSection>

      {/* ---- Top-up packs --------------------------------------- */}
      <HallSection title={zh ? "加购次数" : "Buy more chances"}>
        <p className="mb-4 text-sm text-muted-foreground">
          {zh
            ? "赠送次数用完后，可以按需加购：3 元 1 次，10 元 4 次（约合 2.5 元 / 次）。当前为模拟支付，不会真实扣款。"
            : "Once the gift is used up, top up as needed: ¥3 for one, ¥10 for four (about ¥2.5 each). Payment is simulated for now."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["sage", "human"] as const).map((bucket) => (
            <div key={bucket} className="hall-paper p-5">
              <h3 className="hall-card-title">
                {bucket === "sage"
                  ? zh
                    ? "先贤回信"
                    : "Sage reply"
                  : zh
                    ? "管理员授权（真人回信）"
                    : "Librarian-authorised reply"}
              </h3>
              <p className="mt-2 text-sm text-foreground/75">
                {bucket === "sage"
                  ? zh
                    ? "由一位蒸馏出的历代先贤，以其本领与语气回信。"
                    : "A distilled historical sage answers in their own voice."
                  : zh
                    ? "图书管理员亲自回信，或由他委托的旅者定向匿名回信。"
                    : "The librarian replies in person, or entrusts a traveler to answer you anonymously."}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  size="sm"
                  className="hall-tap"
                  disabled={purchase.isPending}
                  onClick={() => void onBuy(bucket, "single")}
                >
                  {zh ? "3 元 · 1 次" : "¥3 · 1"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="hall-tap"
                  disabled={purchase.isPending}
                  onClick={() => void onBuy(bucket, "quad")}
                >
                  {zh ? "10 元 · 4 次" : "¥10 · 4"}
                </Button>
              </div>
            </div>
          ))}
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
