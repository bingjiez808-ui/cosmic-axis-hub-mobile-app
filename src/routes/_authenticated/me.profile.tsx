import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PersonalWorkspaceNav } from "@/components/PersonalWorkspaceNav";

import { PersonalBookshelf } from "@/experiences/profile/PersonalBookshelf";
import { MembershipCard } from "@/components/MembershipCard";
import { MyTicketsCard } from "@/components/MyTicketsCard";
import { DailyRoomError } from "@/experiences/daily-room/fallback";
import { PersonalShellPending } from "@/experiences/daily-room/personal-shell-pending";
import { supabase } from "@/integrations/supabase/client";
import { listUserCharts, type ChartRow } from "@/lib/reports-store.functions";
import { useDaily } from "@/lib/i18n-daily";
import { useLang } from "@/lib/i18n";


/**
 * /me/profile — the user's Personal Library Card.
 *
 * This is the single home for chart management (primary chart, other
 * charts, relationship shelf) and — in a follow-up turn — the friends
 * inbox and privacy controls. `/me/home` no longer carries any of
 * this; today's reading room only shows a lightweight context bar.
 */
export const Route = createFileRoute("/_authenticated/me/profile")({
  head: () => ({ meta: [{ name: "robots", content: "noindex,nofollow" }] }),
  pendingMs: 0,
  pendingComponent: PersonalShellPending,
  errorComponent: DailyRoomError,
  component: MyProfilePage,
});

type LoadState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "error"; message: string }
  | { kind: "ready"; charts: ChartRow[]; email: string | null };

function MyProfilePage() {
  const d = useDaily();
  const { lang } = useLang();
  const [state, setState] = useState<LoadState>({ kind: "loading" });


  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          if (!cancelled) setState({ kind: "anonymous" });
          return;
        }
        const charts = await listUserCharts();
        if (cancelled) return;
        setState({
          kind: "ready",
          charts,
          email: data.session.user?.email ?? null,
        });
      } catch (err) {
        if (!cancelled)
          setState({
            kind: "error",
            message: err instanceof Error ? err.message : "unknown",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a12]/55 text-amber-50">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 md:px-8 md:py-12">
        <PersonalWorkspaceNav active="/me/profile" />
        <header className="mb-8">
          <div className="text-xs uppercase tracking-[0.24em] text-amber-300/60">
            {d.profile_kicker}
          </div>
          <h1 className="mt-2 text-3xl font-serif tracking-wide md:text-4xl">
            {lang === "zh" ? "命盘与报告" : "Charts & Reports"}
          </h1>


          {state.kind === "ready" && state.email && (
            <div className="mt-2 text-sm text-amber-100/70">{state.email}</div>
          )}
          <p className="mt-3 max-w-2xl text-sm text-amber-100/70" data-testid="profile-purpose-hint">
            {lang === "zh"
              ? "这里管理你的主命盘、其他命盘、关系书架、会员与工单。今日阅读和好友、匹配请从上方的次级导航进入。"
              : "This page manages your primary chart, other charts, relationship shelf, membership and tickets. Use the sub-nav above to reach today's reading, friends or match."}
          </p>
        </header>

        {/* Membership & orders — anchor target for the sub-nav "Membership" tab */}
        <div id="membership-orders" style={{ scrollMarginTop: "calc(var(--site-nav-height, 96px) + 72px)" }} className="mb-8 space-y-4">
          <MembershipCard />
          <TicketsBlock />
        </div>

        {/* Bookshelf */}
        <section
          className="mb-8 rounded-xl border border-amber-400/15 bg-black/20 p-4 md:p-6"
          data-testid="profile-bookshelf"
        >
          {state.kind === "loading" && (
            <div className="text-sm text-amber-200/70">{d.my_charts_loading}</div>
          )}
          {state.kind === "anonymous" && (
            <div className="text-sm text-amber-200/70">{d.my_charts_anonymous}</div>
          )}
          {state.kind === "error" && (
            <div className="text-sm text-rose-300/80">{d.my_charts_error(state.message)}</div>
          )}
          {state.kind === "ready" && (
            <PersonalBookshelf
              charts={state.charts}
              onChanged={(charts) => setState({ ...state, charts })}
            />
          )}
        </section>

        {/* Friends & letters — real state ships in the next turn */}
        <section className="mb-8 rounded-xl border border-amber-400/15 bg-black/20 p-4 md:p-6">
          <div className="mb-3 text-[11px] uppercase tracking-widest text-amber-200/70">
            {d.profile_section_friends}
          </div>
          <p className="text-sm text-amber-100/70">{d.profile_friends_empty}</p>
          <div className="mt-3">
            <Link
              to="/me/friends"
              className="min-h-11 inline-flex items-center rounded-full border border-amber-400/40 px-4 py-2 text-xs text-amber-200 hover:bg-amber-500/10"
            >
              {d.home_secondary_nav_friends}
            </Link>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-16 rounded-xl border border-amber-400/15 bg-black/20 p-4 md:p-6">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-amber-200/70">
            {d.profile_privacy_title}
          </div>
          <p className="text-sm text-amber-100/70">{d.profile_privacy_body}</p>
        </section>
      </div>
    </div>
  );
}

function TicketsBlock() {
  const { lang } = useLang();
  return <MyTicketsCard lang={lang} />;
}
