import { createFileRoute } from "@tanstack/react-router";

import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";
import { MembershipCard } from "@/components/MembershipCard";
import { MyTicketsCard } from "@/components/MyTicketsCard";
import { DailyRoomError } from "@/experiences/daily-room/fallback";
import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { useLang } from "@/lib/i18n";

/**
 * /me/membership — the direct-linkable Membership & Orders page.
 * Reuses the two components that previously lived inside
 * /me/profile#membership-orders, so old anchor links keep working
 * while the shelf nav now points at a real route instead of a hash.
 */
export const Route = createFileRoute("/_authenticated/me/membership")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
  errorComponent: DailyRoomError,
  component: MembershipPage,
});

function MembershipPage() {
  const { lang } = useLang();
  const isZh = lang === "zh";
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
              ? "在这里查看当前会员状态、月度智者 / 神谕者权益、一次性 ¥79 综合报告、订单与工单。"
              : "Review your current membership, monthly Sage / Oracle benefits, the one-time ¥79 comprehensive report, orders and support tickets."}
          </p>
        </header>
        <div className="space-y-4">
          <MembershipCard />
          <MyTicketsCard lang={lang} />
        </div>
      </div>
    </div>
  );
}
