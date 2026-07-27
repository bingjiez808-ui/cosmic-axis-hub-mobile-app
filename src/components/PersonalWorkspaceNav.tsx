import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { useLang } from "@/lib/i18n";

/**
 * PersonalWorkspaceNav — a shared secondary navigation for every
 * `/me/*` page. Renders as a sticky sub-nav on desktop and a
 * horizontally scrollable tab strip on mobile.
 *
 * Rules:
 * - Always shows a "back to My Home" affordance on the left.
 * - Marks the active item with `aria-current="page"` from
 *   `useRouterState().location.pathname` so refresh / back / forward
 *   restore the correct highlight without any local state.
 * - Never renders a duplicate copy of the global site nav. Sub-pages
 *   removed their ad-hoc pill rows in favour of this single component.
 * - 44px minimum tap targets and edge fade hints for mobile scrolling.
 */

type Item = {
  to:
    | "/me/home"
    | "/me/profile"
    | "/me/friends"
    | "/me/match"
    | "/me/oracle";
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
    to: "/me/oracle",
    labelZh: "神谕者",
    labelEn: "Oracle",
    testId: "pwn-oracle",
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
  const current = active ?? pathname;
  const isZh = lang === "zh";

  return (
    <div
      data-testid="personal-workspace-nav"
      className="sticky top-14 z-30 mb-6 -mx-4 border-b border-amber-400/10 bg-[#0a0a12]/85 px-4 py-3 backdrop-blur md:top-16 md:-mx-8 md:px-8"
    >
      <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3">
        <Link
          to="/me/home"
          data-testid="pwn-back-home"
          aria-label={isZh ? "回到我的主页" : "Back to My Home"}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-amber-400/25 px-3 py-2 text-[11px] uppercase tracking-[0.24em] text-amber-200/80 transition hover:border-amber-300/60 hover:text-amber-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">
            {isZh ? "我的主页" : "My Home"}
          </span>
          <span className="sm:hidden">{isZh ? "主页" : "Home"}</span>
        </Link>

        <div className="relative min-w-0 flex-1">
          <div
            role="navigation"
            aria-label={isZh ? "个人中心导航" : "Personal workspace"}
            className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scroll-smooth pr-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {ITEMS.map((it) => {
              const isActive = current === it.to;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  data-testid={it.testId}
                  aria-current={isActive ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-4 py-2 text-xs transition ${
                    isActive
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
