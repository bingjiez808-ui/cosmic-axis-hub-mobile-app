import { Link, useRouterState } from "@tanstack/react-router";


import { useLang } from "@/lib/i18n";

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
  to:
    | "/me/home"
    | "/me/profile"
    | "/me/friends"
    | "/me/echoes"
    | "/me/membership"
    | "/me/fun-library";
  /**
   * Extra pathnames whose "active" state should light up this tab —
   * used so /me/friends AND /me/match both highlight the
   * "Relationships" entry, and old direct links stay coherent.
   */
  alsoActiveFor?: string[];
  labelZh: string;
  labelEn: string;
  testId: string;
};

const ITEMS: Item[] = [
  { to: "/me/home", labelZh: "书架主页", labelEn: "Library Home", testId: "pwn-home" },
  { to: "/me/profile", labelZh: "命盘与报告", labelEn: "Charts & Reports", testId: "pwn-profile" },
  {
    to: "/me/friends",
    alsoActiveFor: ["/me/match", "/me/relationships"],
    labelZh: "关系与适配",
    labelEn: "Relationships",
    testId: "pwn-relationships",
  },
  { to: "/me/echoes", labelZh: "历史回声", labelEn: "Echoes", testId: "pwn-echoes" },
  { to: "/me/fun-library", labelZh: "趣味图书馆", labelEn: "Fun Library", testId: "pwn-fun-library" },
  { to: "/me/membership", labelZh: "会员与订单", labelEn: "Membership", testId: "pwn-membership" },
];

export function PersonalWorkspaceNav({ active }: { active?: string }) {
  const { lang } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = active ?? pathname;
  const isZh = lang === "zh";

  const isItemActive = (it: Item) =>
    current === it.to || (it.alsoActiveFor?.some((p) => current === p) ?? false);

  return (
    <div
      data-testid="personal-workspace-nav"
      style={{ top: "calc(var(--site-nav-height, 96px) + 8px)" }}
      className="sticky z-40 mb-6 -mx-4 border-b border-amber-400/10 bg-[#0a0a12]/85 px-4 py-3 backdrop-blur md:-mx-8 md:px-8"
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
                  className={`inline-flex min-h-11 shrink-0 snap-start items-center rounded-full px-4 py-2 text-xs transition ${
                    activeItem
                      ? "border border-amber-300 bg-amber-300/10 text-amber-100"
                      : "border border-amber-400/25 text-amber-200/80 hover:border-amber-300/60 hover:text-amber-100"
                  }`}
                >
                  {isZh ? it.labelZh : it.labelEn}
                </Link>
              );
            })}
          </nav>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#0a0a12] to-transparent md:hidden"
          />
        </div>
      </div>
    </div>
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
      className="mb-4 flex items-center gap-2"
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
            className={`inline-flex min-h-9 items-center rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] transition ${
              active
                ? "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/50"
                : "text-amber-200/70 hover:text-amber-100"
            }`}
          >
            {isZh ? it.zh : it.en}
          </Link>
        );
      })}
    </div>
  );
}
