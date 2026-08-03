import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, CircleUserRound, Handshake, Home, Landmark, Sparkles } from "lucide-react";
import type { ComponentType, SVGProps } from "react";


import { useLang } from "@/lib/i18n";
import "@/components/personal-library.css";

/**
 * PersonalWorkspaceNav — the unified secondary nav for every `/me/*`
 * page. Five first-class functions: Home / Charts & Reports /
 * Relationships (friends + match subtabs) / Historical Echoes /
 * Membership & Orders. Every entry is a real, direct-linkable route,
 * so the shelf never depends on fragile home-page hash anchors.
 *
 * Sticky offset uses --site-nav-height (published by the global nav)
 * so the strip lands below the top bar without being covered on any
 * viewport. z-40 so the global z-50 nav wins on overlap.
 */

type Item = {
  to: "/me/home" | "/me/profile" | "/me/friends" | "/me/echoes" | "/me/membership" | "/me/community";
  /**
   * Extra pathnames whose "active" state should light up this tab —
   * used so /me/friends AND /me/match both highlight the
   * "Relationships" entry, and old direct links stay coherent.
   */
  alsoActiveFor?: string[];
  labelZh: string;
  labelEn: string;
  appLabelZh: string;
  appLabelEn: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  testId: string;
};

const ITEMS: Item[] = [
  {
    to: "/me/home",
    labelZh: "书架主页",
    labelEn: "Library Home",
    appLabelZh: "书架",
    appLabelEn: "Home",
    icon: Home,
    testId: "pwn-home",
  },
  {
    to: "/me/profile",
    labelZh: "命盘与报告",
    labelEn: "Charts & Reports",
    appLabelZh: "命盘",
    appLabelEn: "Chart",
    icon: CircleUserRound,
    testId: "pwn-profile",
  },
  {
    to: "/me/friends",
    alsoActiveFor: ["/me/match", "/me/relationships"],
    labelZh: "关系与适配",
    labelEn: "Relationships",
    appLabelZh: "关系",
    appLabelEn: "Bonds",
    icon: Handshake,
    testId: "pwn-relationships",
  },
  {
    to: "/me/echoes",
    labelZh: "历史回声",
    labelEn: "Echoes",
    appLabelZh: "回声",
    appLabelEn: "Echoes",
    icon: Sparkles,
    testId: "pwn-echoes",
  },
  {
    to: "/me/community",
    labelZh: "同门设置",
    labelEn: "Fellowship",
    appLabelZh: "同门",
    appLabelEn: "Circle",
    icon: Landmark,
    testId: "pwn-community",
  },
  {
    to: "/me/membership",
    alsoActiveFor: ["/me/sage", "/me/oracle"],
    labelZh: "会员与订单",
    labelEn: "Membership",
    appLabelZh: "会员",
    appLabelEn: "Pass",
    icon: BookOpen,
    testId: "pwn-membership",
  },
];

export function PersonalWorkspaceNav({ active }: { active?: string }) {
  const { lang } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = active ?? pathname;
  const isZh = lang === "zh";

  const isItemActive = (it: Item) =>
    current === it.to || (it.alsoActiveFor?.some((p) => current === p) ?? false);

  return (
    <>
      <div
        data-testid="personal-workspace-nav"
        style={{ top: "calc(var(--site-nav-height, 96px) + 8px)" }}
        className="hidden"
      >
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <nav
              role="navigation"
              aria-label={isZh ? "个人书架导航" : "Personal Library"}
              className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto scroll-smooth pr-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {ITEMS.map((it) => {
                const activeItem = isItemActive(it);
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    data-testid={it.testId}
                    aria-current={activeItem ? "page" : undefined}
                    data-active={activeItem ? "true" : "false"}
                    className={`pl-pill inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 py-2 text-xs ${
                      activeItem
                        ? "border border-amber-300/80 bg-amber-300/12 text-amber-100 shadow-[0_0_18px_-6px_rgba(252,211,77,0.55)]"
                        : "border border-amber-400/25 text-amber-200/80 hover:border-amber-300/60 hover:bg-amber-300/5 hover:text-amber-100"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                        activeItem
                          ? "scale-100 bg-amber-300 shadow-[0_0_8px_2px_rgba(252,211,77,0.55)]"
                          : "scale-0 bg-amber-300/40"
                      }`}
                    />
                    {isZh ? it.labelZh : it.labelEn}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </div>
      <nav
        data-testid="personal-app-tabbar"
        aria-label={isZh ? "命运书房 App 导航" : "Fate Nexus app navigation"}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] border-t border-amber-300/15 bg-[#090910]/92 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-[0_-18px_42px_-28px_rgba(0,0,0,0.95)] backdrop-blur-xl"
      >
        <div className="mx-auto grid max-w-[520px] grid-cols-6 gap-1">
          {ITEMS.map((it) => {
            const Icon = it.icon;
            const activeItem = isItemActive(it);
            return (
              <Link
                key={it.to}
                to={it.to}
                aria-current={activeItem ? "page" : undefined}
                data-active={activeItem ? "true" : "false"}
                className={`pl-app-tab flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] leading-none ${
                  activeItem
                    ? "bg-amber-300/12 text-amber-100 ring-1 ring-amber-300/35"
                    : "text-amber-200/62 hover:bg-amber-300/8 hover:text-amber-100"
                }`}
              >
                <Icon aria-hidden className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                <span className="max-w-full truncate">{isZh ? it.appLabelZh : it.appLabelEn}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/**
 * RelationshipsSubtabs — inline sub-tab strip rendered inside
 * /me/friends and /me/match so the two views feel like one merged
 * "Relationships" space, matching the shelf's single entry point.
 */
export function RelationshipsSubtabs({ current }: { current: "friends" | "match" }) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const items = [
    { key: "friends" as const, to: "/me/friends" as const, zh: "好友", en: "Friends" },
    { key: "match" as const, to: "/me/match" as const, zh: "适配分析", en: "Match" },
  ];
  return (
    <div
      data-testid="relationships-subtabs"
      className="mb-5 inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-black/30 p-1 backdrop-blur"
      role="tablist"
      aria-label={isZh ? "关系与适配子标签" : "Relationships subtabs"}
    >
      {items.map((it) => {
        const active = it.key === current;
        return (
          <Link
            key={it.key}
            to={it.to}
            role="tab"
            aria-selected={active}
            data-testid={`relationships-subtab-${it.key}`}
            data-active={active ? "true" : "false"}
            className={`pl-underline-tab inline-flex min-h-9 items-center rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] transition ${
              active
                ? "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/50"
                : "text-amber-200/70 hover:bg-amber-300/5 hover:text-amber-100"
            }`}
          >
            {isZh ? it.zh : it.en}
          </Link>
        );
      })}
    </div>
  );
}
