import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { MembershipCheckoutModal } from "@/components/MembershipCheckoutModal";
import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";
import { MembershipCard } from "@/components/MembershipCard";
import { MyTicketsCard } from "@/components/MyTicketsCard";
import { DailyRoomError } from "@/experiences/daily-room/fallback";
import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "@/lib/i18n";
import type { MembershipTierId } from "@/lib/membership-plans";
import { listMyRedemptionUses, type MyRedemptionUse } from "@/lib/redemption.functions";

/**
 * /me/membership — split cleanly into two entitlement kinds:
 *   1. 月度阅读室会员 (Monthly Reading-Room Membership) — Sage / Oracle
 *      subscription that lapses at `membership_expires_at`.
 *   2. ¥79 一次性综合报告 (One-time Premium Report) — permanent, per-chart
 *      entitlement drawn from `premium_pdf_reports` (RLS-scoped).
 *
 * Orders & support tickets live in the third section below.
 * This page never fabricates upgrade state — real writes happen through
 * the existing admin / (future) payment webhook.
 */
export const Route = createFileRoute("/_authenticated/me/membership")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
  errorComponent: DailyRoomError,
  component: MembershipPage,
});

type PremiumRow = {
  id: string;
  chart_id: string;
  status: string;
  generated_at: string | null;
  created_at: string;
};

function MembershipPage() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const [premium, setPremium] = useState<PremiumRow[] | null>(null);
  const [redemptions, setRedemptions] = useState<MyRedemptionUse[] | null>(null);
  const [checkoutTarget, setCheckoutTarget] = useState<MembershipTierId | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        if (!cancelled) setPremium([]);
        return;
      }
      const { data } = await supabase
        .from("premium_pdf_reports")
        .select("id, chart_id, status, generated_at, created_at")
        .eq("user_id", sess.session.user.id)
        .order("created_at", { ascending: false });
      if (!cancelled) setPremium((data ?? []) as PremiumRow[]);
      try {
        const rows = await listMyRedemptionUses();
        if (!cancelled) setRedemptions(rows);
      } catch {
        if (!cancelled) setRedemptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-amber-50">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        <PersonalWorkspaceNav active="/me/membership" />
        <header className="mb-6">
          <div className="text-xs uppercase tracking-[0.24em] text-amber-300/60">
            {isZh ? "会员与订单" : "Membership & Orders"}
          </div>
          <h1 className="mt-2 text-3xl font-serif tracking-wide md:text-4xl">
            {isZh ? "会员与订单" : "Membership & Orders"}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-amber-100/70">
            {isZh
              ? "在这里分开查看月度阅读室会员（贤者 / 神谕者）与一次性 ¥79 综合报告，以及订单和工单。"
              : "Review your monthly reading-room membership (Sage / Oracle) and your one-time ¥79 premium reports separately, along with orders and support tickets."}
          </p>
        </header>

        {/* Section 1 — Monthly reading-room membership */}
        <section aria-labelledby="mem-monthly" className="mb-8">
          <div className="mb-3 flex items-baseline gap-3">
            <h2
              id="mem-monthly"
              className="text-[11px] uppercase tracking-[0.28em] text-amber-300/70"
            >
              {isZh ? "① 月度阅读室会员" : "① Monthly reading-room membership"}
            </h2>
            <p className="text-xs text-amber-100/50">
              {isZh ? "到期自动降级 · 不会未经确认扣款" : "Auto-lapses at expiry · no silent renewal"}
            </p>
          </div>
          <MembershipCard />

          {/* Three-tier plan comparison — kept as a selector, not replaced by doors */}
          <div
            data-testid="membership-plans-compare"
            className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            {[
              {
                id: "free",
                name: isZh ? "求索者" : "Seeker",
                price: isZh ? "¥0" : "$0",
                desc: isZh
                  ? "永久免费的综合解读与当前十年大运。"
                  : "The unified reading and current decade — free forever.",
              },
              {
                id: "sage",
                name: isZh ? "贤者" : "Sage",
                price: isZh ? "¥19.9 / 月" : "$2.99 / mo",
                desc: isZh
                  ? "完整生命时间轴 · 合盘关系分析 · 每月 10 次塔罗 AI。"
                  : "Full life timeline · synastry · 10 tarot AI readings / month.",
              },
              {
                id: "oracle",
                name: isZh ? "神谕者" : "Oracle",
                price: isZh ? "¥39.9 / 月" : "$5.99 / mo",
                desc: isZh
                  ? "包含贤者全部权益 · 无限追问 · 无限塔罗 · 90 天窗口。"
                  : "Includes Sage · unlimited follow-up · unlimited tarot · 90-day windows.",
              },
            ].map((p) => (
              <div
                key={p.id}
                data-testid={`me-membership-plan-${p.id}`}
                className="flex flex-col rounded-xl border border-amber-400/20 bg-black/25 p-4"
              >
                <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300/70">
                  {p.name}
                </p>
                <p className="mt-1 font-serif text-lg text-amber-100">{p.price}</p>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-amber-100/70">
                  {p.desc}
                </p>
                {p.id !== "free" && (
                  <button
                    type="button"
                    onClick={() => setCheckoutTarget(p.id as MembershipTierId)}
                    data-testid={`me-membership-plan-cta-${p.id}`}
                    className="mt-3 inline-flex min-h-9 items-center justify-center rounded-full border border-amber-300/40 px-3 py-1.5 text-[11px] text-amber-100 hover:bg-amber-500/10"
                  >
                    {isZh ? "开通 / 续订" : "Activate / renew"}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Reading-room shortcuts — direct entry only, no cross-links back to /report */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/me/sage"
              className="min-h-9 inline-flex items-center rounded-full border border-amber-400/30 px-3 py-1.5 text-[11px] text-amber-100/85 hover:border-amber-300/60"
            >
              {isZh ? "进入贤者阅览室" : "Enter Sage Room"}
            </Link>
            <Link
              to="/me/oracle"
              search={{ source: "membership" } as never}
              className="min-h-9 inline-flex items-center rounded-full border border-amber-400/30 px-3 py-1.5 text-[11px] text-amber-100/85 hover:border-amber-300/60"
            >
              {isZh ? "进入神谕者阅览室" : "Enter Oracle Room"}
            </Link>
          </div>



        </section>

        {/* Section 2 — One-time ¥79 premium report */}
        <section aria-labelledby="mem-premium" className="mb-8">
          <div className="mb-3 flex items-baseline gap-3">
            <h2
              id="mem-premium"
              className="text-[11px] uppercase tracking-[0.28em] text-amber-300/70"
            >
              {isZh ? "② ¥79 单次综合报告" : "② ¥79 one-time premium report"}
            </h2>
            <p className="text-xs text-amber-100/50">
              {isZh ? "一次购买 · 永久保存" : "One purchase · kept forever"}
            </p>
          </div>
          <div
            data-testid="premium-orders-panel"
            className="rounded-xl border border-amber-400/20 bg-black/25 p-5"
          >
            {premium === null && (
              <p className="text-sm text-amber-100/60">
                {isZh ? "读取中…" : "Loading…"}
              </p>
            )}
            {premium && premium.length === 0 && (
              <div>
                <p className="text-sm text-amber-100/75">
                  {isZh
                    ? "你还没有购买过 ¥79 综合报告。"
                    : "You haven't purchased a ¥79 premium report yet."}
                </p>
                <Link
                  to="/report" hash="membership-plans"
                  className="mt-3 inline-flex min-h-11 items-center rounded-full border border-amber-300/50 px-4 py-2 text-xs text-amber-100 hover:bg-amber-500/10"
                >
                  {isZh ? "了解并购买 ¥79 报告" : "Learn & purchase the ¥79 report"}
                </Link>
              </div>
            )}
            {premium && premium.length > 0 && (
              <ul className="space-y-2">
                {premium.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/15 bg-black/25 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="text-amber-100">
                        {isZh ? "命盘" : "Chart"} · {r.chart_id.slice(0, 8)}…
                      </p>
                      <p className="text-[11px] text-amber-100/55">
                        {isZh ? "状态" : "Status"}: {r.status}
                        {r.generated_at
                          ? ` · ${new Date(r.generated_at).toLocaleDateString(
                              lang === "zh" ? "zh-CN" : "en-US",
                            )}`
                          : ""}
                      </p>
                    </div>
                    <Link
                      to="/report" hash="membership-plans"
                      className="min-h-9 inline-flex items-center rounded-full border border-amber-300/40 px-3 py-1.5 text-[11px] text-amber-100 hover:bg-amber-500/10"
                    >
                      {r.status === "completed"
                        ? isZh ? "打开报告" : "Open report"
                        : isZh ? "查看进度" : "View progress"}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Section 2.5 — Redemption history */}
        <section aria-labelledby="mem-redemptions" className="mb-8">
          <div className="mb-3 flex items-baseline gap-3">
            <h2
              id="mem-redemptions"
              className="text-[11px] uppercase tracking-[0.28em] text-amber-300/70"
            >
              {isZh ? "③ 兑换码记录" : "③ Redemption history"}
            </h2>
            <p className="text-xs text-amber-100/50">
              {isZh ? "仅显示脱敏摘要" : "Only masked summaries are shown"}
            </p>
          </div>
          <div
            data-testid="redemption-history-panel"
            className="rounded-xl border border-amber-400/20 bg-black/25 p-5"
          >
            {redemptions === null && (
              <p className="text-sm text-amber-100/60">{isZh ? "读取中…" : "Loading…"}</p>
            )}
            {redemptions && redemptions.length === 0 && (
              <p className="text-sm text-amber-100/70">
                {isZh ? "你还没有使用过兑换码。" : "You haven't redeemed any codes yet."}
              </p>
            )}
            {redemptions && redemptions.length > 0 && (
              <ul className="space-y-2">
                {redemptions.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-400/15 bg-black/25 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-mono text-amber-100">
                        {r.code_prefix}-•••• {r.code_last4}
                      </p>
                      <p className="text-[11px] text-amber-100/55">
                        {r.benefit_type}
                        {r.duration_days ? ` · ${r.duration_days}${isZh ? "天" : "d"}` : ""}
                        {" · "}
                        {new Date(r.redeemed_at).toLocaleDateString(isZh ? "zh-CN" : "en-US")}
                        {" · "}
                        {r.status}
                      </p>
                    </div>
                    {r.campaign_name && (
                      <span className="text-[11px] text-amber-100/55">{r.campaign_name}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* Section 3 — Orders / tickets */}
        <section aria-labelledby="mem-tickets">
          <div className="mb-3 flex items-baseline gap-3">
            <h2
              id="mem-tickets"
              className="text-[11px] uppercase tracking-[0.28em] text-amber-300/70"
            >
              {isZh ? "④ 订单与工单" : "④ Orders & support tickets"}
            </h2>
          </div>
          <MyTicketsCard lang={lang} />
        </section>
      </div>
      <MembershipCheckoutModal
        open={checkoutTarget !== null}
        targetTier={checkoutTarget ?? "sage"}
        source="membership"
        lang={lang}
        onClose={() => setCheckoutTarget(null)}
      />
    </div>
  );
}
