import { createFileRoute, Link } from "@tanstack/react-router";

import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";
import { DailyRoomError } from "@/experiences/daily-room/fallback";
import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { useLang } from "@/lib/i18n";
import { useMembershipTier, hasSageAccess } from "@/lib/use-membership-tier";

/**
 * /me/sage — Sage Reading Room dashboard.
 *
 * This page is the unified entry point to real Sage capabilities that
 * already exist elsewhere in the app. It does not compute or duplicate
 * anything: each of the four tiles routes into an existing feature and
 * defers permission to that feature's own server checks.
 *
 * Access UI-gate: `profiles.membership_tier` (via `useMembershipTier`).
 * Oracle strictly inherits Sage. Downstream server functions remain the
 * fail-closed authority.
 */
export const Route = createFileRoute("/_authenticated/me/sage")({
  head: () => ({
    meta: [
      { title: "Sage Reading Room · Library of Destiny" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
  errorComponent: DailyRoomError,
  component: SagePage,
});

function SagePage() {
  const { lang } = useLang();
  const mem = useMembershipTier();
  const isZh = lang === "zh";
  const entitled = mem.kind === "ready" && hasSageAccess(mem.tier);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        <PersonalWorkspaceNav active="/me/sage" />
        <header className="mb-6">
          <div className="text-[11px] uppercase tracking-[0.24em] text-amber-300/70">
            {isZh ? "贤者阅览室" : "Sage Reading Room"}
          </div>
          <h1 className="mt-2 font-serif text-3xl tracking-wide md:text-4xl">
            {isZh ? "贤者阅览室 · 深度阅读" : "Sage Reading Room · Deep Reading"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-amber-100/70">
            {isZh
              ? "这里是贤者会员的深度阅读枢纽：完整生命时间轴、关系合盘、每月 10 次塔罗、以及你的会员使用状态。神谕者已包含贤者的全部权益。"
              : "The Sage member's deep-reading hub: full life timeline, synastry, 10 tarot readings per month, and your membership status. Oracle strictly includes every Sage benefit."}
          </p>
        </header>

        {mem.kind === "loading" && (
          <div className="text-sm text-amber-100/70">
            {isZh ? "读取权限中…" : "Checking your access…"}
          </div>
        )}

        {mem.kind === "ready" && !entitled && (
          <LockedPanel lang={lang} />
        )}

        {entitled && (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TileCard
                testId="sage-tile-timeline"
                to="/me/echoes"
                kicker={isZh ? "完整生命时间轴" : "Full life timeline"}
                title={
                  isZh
                    ? "阅读你所有十年阶段"
                    : "Read every decade of your life"
                }
                body={
                  isZh
                    ? "在历史回声中查看过去、当前与其他十年大运的对照，找到跨阶段的重复图案。"
                    : "In Historical Echoes, compare past, current and future decades to spot the pattern that repeats across your life."
                }
                lang={lang}
              />
              <TileCard
                testId="sage-tile-relationships"
                to="/me/friends"
                kicker={isZh ? "关系与合盘" : "Relationships & Synastry"}
                title={
                  isZh ? "两张命盘的诚实对话" : "Two charts, one honest reading"
                }
                body={
                  isZh
                    ? "对好友或伴侣做五维契合度分析：何处和声、何处噪音，以及命盘愿意为之背书的结论。"
                    : "Five-axis compatibility with a friend or partner — where you harmonize, where you generate noise, and the verdict the chart is willing to defend."
                }
                lang={lang}
              />
              <TileCard
                testId="sage-tile-tarot"
                to="/synthesis"
                kicker={isZh ? "塔罗阅览" : "Tarot readings"}
                title={
                  isZh
                    ? "每月 10 次塔罗 AI 解读"
                    : "10 tarot AI readings each month"
                }
                body={
                  isZh
                    ? "在综合解读中呼出塔罗牌阵，用当下的一张牌回应此刻的问题；每月配额以账户记录为准。"
                    : "Call up a spread inside the synthesis view and let the card answer this exact moment; monthly quota is tracked by your account."
                }
                lang={lang}
              />
              <TileCard
                testId="sage-tile-status"
                to="/me/membership"
                kicker={isZh ? "会员使用状态" : "Membership status"}
                title={
                  isZh ? "查看权益、到期与订单" : "Benefits, expiry & orders"
                }
                body={
                  isZh
                    ? "在会员与订单里查看当前贤者/神谕者到期时间；到期后自动降级，不会未经确认扣款。每月塔罗次数以账户记录为准。"
                    : "Review your Sage/Oracle expiry in Membership & Orders; the tier lapses automatically at expiry — no silent renewal. Monthly tarot count is tracked in your account."
                }
                lang={lang}
              />
            </div>

            {mem.tier === "sage" && (
              <div className="mt-6 rounded-2xl border border-nebula-purple/50 bg-nebula-purple/[0.08] p-5">
                <p className="text-[11px] uppercase tracking-[0.32em] text-amber-300/70">
                  {isZh ? "想更进一步？" : "Want to go further?"}
                </p>
                <p className="mt-2 text-sm text-amber-100/80">
                  {isZh
                    ? "神谕者阅览室在贤者的基础上增加：无限 AI 追问、无限塔罗、近 90 天状态与关键时间节点。"
                    : "The Oracle Reading Room adds unlimited AI follow-up, unlimited tarot, and 90-day state & keystone-window analysis on top of Sage."}
                </p>
                <Link
                  to="/report" hash="membership-plans"
                  className="mt-4 inline-flex min-h-11 items-center rounded-full border border-amber-300/50 px-4 py-2 text-xs text-amber-100 hover:bg-amber-500/10"
                >
                  {isZh ? "查看神谕者阅览室" : "See Oracle Reading Room"}
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TileCard({
  testId,
  to,
  kicker,
  title,
  body,
  lang,
}: {
  testId: string;
  to: "/me/echoes" | "/me/friends" | "/me/membership" | "/synthesis";
  kicker: string;
  title: string;
  body: string;
  lang: "en" | "zh";
}) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="flex flex-col rounded-2xl border border-amber-400/25 bg-black/25 p-5 transition-colors hover:border-amber-300/60 hover:bg-amber-500/[0.06]"
    >
      <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/70">{kicker}</p>
      <p className="mt-2 font-serif text-lg italic text-amber-100">{title}</p>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-amber-100/70">{body}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.24em] text-amber-300">
        {lang === "zh" ? "进入 →" : "Enter →"}
      </span>
    </Link>
  );
}

function LockedPanel({ lang }: { lang: "en" | "zh" }) {
  const isZh = lang === "zh";
  return (
    <section
      data-testid="sage-locked"
      className="rounded-2xl border border-amber-400/25 bg-black/30 p-6"
    >
      <p className="text-[11px] uppercase tracking-[0.28em] text-amber-300/70">
        {isZh ? "尚未开通贤者阅览室" : "Sage Reading Room is not active"}
      </p>
      <h2 className="mt-2 font-serif text-2xl text-amber-100">
        {isZh ? "解锁完整生命时间轴、合盘与塔罗" : "Unlock the full timeline, synastry and tarot"}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-amber-100/75">
        {isZh
          ? "贤者是月度会员（¥19.9/月），提供站内深度阅读、完整生命时间轴、合盘分析与每月 10 次塔罗。到期后自动降级，不会未经确认扣款。当前仍为模拟支付。"
          : "Sage is a monthly membership (¥19.9/mo) with deep in-app reading, the full life timeline, synastry, and 10 tarot readings per month. It lapses automatically at expiry — no silent renewal. Payments are still simulated."}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          to="/report" hash="membership-plans"
          className="min-h-11 inline-flex items-center rounded-full bg-amber-300 px-4 py-2 text-xs uppercase tracking-[0.28em] text-[#0a0a12] hover:bg-amber-200"
        >
          {isZh ? "进入贤者阅览室之门" : "Open the Sage door"}
        </Link>
        <Link
          to="/me/membership"
          className="min-h-11 inline-flex items-center rounded-full border border-amber-400/40 px-4 py-2 text-xs text-amber-100/80 hover:border-amber-300/60"
        >
          {isZh ? "查看会员与订单" : "Membership & Orders"}
        </Link>
      </div>
    </section>
  );
}
