import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { useLang } from "@/lib/i18n";

/**
 * PersonalWorkspaceNav — shared secondary navigation for every
 * `/me/*` page. Six tabs of the Personal Library.
 *
 * - Marks the active item with `aria-current="page"` from the live
 *   router pathname so refresh / back / forward restore the correct
 *   highlight without any local state.
 * - "Back to Personal Library" affordance is HIDDEN on `/me/home`
 *   itself (it *is* the home) and shown on every sub-page.
 * - Echoes and Membership don't have dedicated routes yet; they
 *   deep-link to well-known anchor IDs on `/me/home` and
 *   `/me/profile` respectively. Those anchors are guaranteed to
 *   exist on the target pages.
 * - 44px minimum tap targets, edge fade hints for mobile scrolling.
 */

type Item = {
  to:
    | "/me/home"
    | "/me/profile"
    | "/me/friends"
    | "/me/match"
    | "/me/oracle";
  hash?: string;
  matchHash?: string;
  labelZh: string;
  labelEn: string;
  testId: string;
};

const ITEMS: Item[] = [
  {
    to: "/me/home",
    labelZh: "今日命运",
    labelEn: "Today's Fate",
    testId: "pwn-home",
  },
  {
    to: "/me/profile",
    labelZh: "命盘与报告",
    labelEn: "Charts & Reports",
    testId: "pwn-profile",
  },
  {
    to: "/me/friends",
    labelZh: "好友",
    labelEn: "Friends",
    testId: "pwn-friends",
  },
  {
    to: "/me/match",
    labelZh: "适配分析",
    labelEn: "Match",
    testId: "pwn-match",
  },
  {
    to: "/me/home",
    hash: "echoes",
    matchHash: "echoes",
    labelZh: "历史回声",
    labelEn: "Echoes",
    testId: "pwn-echoes",
  },
  {
    to: "/me/profile",
    hash: "membership-orders",
    matchHash: "membership-orders",
    labelZh: "会员与订单",
    labelEn: "Membership",
    testId: "pwn-membership",
  },
];

export function PersonalWorkspaceNav({
  active,
}: {
  /**
   * Explicit override for the active pathname. Falls back to the
   * router's live pathname so refresh / history navigation always
   * highlight the correct item.
   */
  active?: string;
}) {
  const { lang } = useLang();
  const pathname = useRouterState({
    select: (s) => s.location.pathname,
  });
  const hash = useRouterState({
    select: (s) => s.location.hash,
  });
  const current = active ?? pathname;
  const isZh = lang === "zh";
  const isOnHome = current === "/me/home";

  return (
    <div
      data-testid="personal-workspace-nav"
      style={{ top: "calc(var(--site-nav-height, 96px) + 8px)" }}
      className="sticky z-40 mb-6 -mx-4 border-b border-amber-400/10 bg-[#0a0a12]/85 px-4 py-3 backdrop-blur md:-mx-8 md:px-8"
    >
      <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3">
        {!isOnHome && (
          <Link
            to="/me/home"
            data-testid="pwn-back-home"
            aria-label={isZh ? "回到个人书架" : "Back to Personal Library"}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-amber-400/25 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-amber-200/80 transition hover:border-amber-300/60 hover:text-amber-100"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">
              {isZh ? "个人书架" : "My Library"}
            </span>
            <span className="sm:hidden">{isZh ? "书架" : "Library"}</span>
          </Link>
        )}

        <div className="relative min-w-0 flex-1">
          <div
            role="navigation"
            aria-label={isZh ? "个人书架导航" : "Personal Library"}
            className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scroll-smooth pr-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {ITEMS.map((it) => {
              const activePath =
                it.hash != null
                  ? current === it.to && hash === it.hash
                  : current === it.to && !hash;
              // Use plain <a> for hash-anchored items so the browser handles
              // in-page scroll + history without any router preventDefault.
              if (it.hash) {
                return (
                  <a
                    key={`${it.to}#${it.hash}`}
                    href={`${it.to}#${it.hash}`}
                    data-testid={it.testId}
                    aria-current={activePath ? "page" : undefined}
                    className={`inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-4 py-2 text-xs transition ${
                      activePath
                        ? "border border-amber-300 bg-amber-300/10 text-amber-100"
                        : "border border-amber-400/25 text-amber-200/80 hover:border-amber-300/60 hover:text-amber-100"
                    }`}
                  >
                    {isZh ? it.labelZh : it.labelEn}
                  </a>
                );
              }
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  data-testid={it.testId}
                  aria-current={activePath ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-4 py-2 text-xs transition ${
                    activePath
                      ? "border border-amber-300 bg-amber-300/10 text-amber-100"
                      : "border border-amber-400/25 text-amber-200/80 hover:border-amber-300/60 hover:text-amber-100"
                  }`}
                >
                  {isZh ? it.labelZh : it.labelEn}
                </Link>
              );
            })}
          </div>
          {/* edge fades hint scroll on mobile */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#0a0a12] to-transparent md:hidden"
          />
        </div>
      </div>
    </div>
  );
}
