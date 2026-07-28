import { Link, useRouterState } from "@tanstack/react-router";
import { useLang } from "@/lib/i18n";

/**
 * CommonsHallNav — the sub-navigation for 命运通识馆 / Commons of Destiny.
 * Distinct from PersonalWorkspaceNav (which belongs under /me/*). Used
 * by the Math Hall, Literature Hall, and the Commons index so the
 * personal-library shelf tabs do not leak into public/commons pages.
 */
type Item = {
  to: "/life-studies" | "/life-studies/math" | "/me/literature";
  labelZh: string;
  labelEn: string;
  status: "open" | "coming";
  testId: string;
};

const ITEMS: Item[] = [
  { to: "/life-studies", labelZh: "通识馆首页", labelEn: "Commons Home", status: "open", testId: "chn-home" },
  { to: "/life-studies/math", labelZh: "数学馆", labelEn: "Math Hall", status: "open", testId: "chn-math" },
  { to: "/me/literature", labelZh: "语文馆", labelEn: "Literature Hall", status: "open", testId: "chn-lit" },
];

const COMING = [
  { zh: "地理馆", en: "Geography" },
  { zh: "物理馆", en: "Physics" },
  { zh: "经济馆", en: "Economics" },
  { zh: "生物馆", en: "Biology" },
];

export function CommonsHallNav({ active }: { active?: Item["to"] }) {
  const { lang } = useLang();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = active ?? pathname;
  const isZh = lang === "zh";

  return (
    <div
      data-testid="commons-hall-nav"
      style={{ top: "calc(var(--site-nav-height, 96px) + 8px)" }}
      className="sticky z-40 mb-6 -mx-4 border-b border-amber-400/10 bg-[#0a0a12]/85 px-4 py-3 backdrop-blur md:-mx-8 md:px-8"
    >
      <nav
        role="navigation"
        aria-label={isZh ? "命运通识馆导航" : "Commons of Destiny"}
        className="mx-auto flex w-full max-w-[1100px] snap-x snap-mandatory items-center gap-2 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
        <span aria-hidden className="mx-1 h-4 w-px bg-amber-400/20" />
        {COMING.map((c) => (
          <span
            key={c.en}
            className="inline-flex min-h-11 shrink-0 snap-start cursor-not-allowed items-center rounded-full border border-amber-400/10 px-4 py-2 text-xs text-amber-200/40"
            title={isZh ? "馆藏整理中" : "Coming soon"}
          >
            {isZh ? c.zh : c.en} · {isZh ? "整理中" : "soon"}
          </span>
        ))}
      </nav>
    </div>
  );
}

export default CommonsHallNav;
