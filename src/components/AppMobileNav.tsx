import { Link, useRouterState } from "@tanstack/react-router";
import { CalendarCheck, ChartNoAxesCombined, Handshake, Home, LibraryBig, Network, UserRound } from "lucide-react";

import { useLang } from "@/lib/i18n";

const NAV_ITEMS = [
  { icon: Home, zh: "首页", en: "Home", to: "/" },
  { icon: ChartNoAxesCombined, zh: "命盘", en: "Chart", to: "/chart" },
  { icon: CalendarCheck, zh: "今日", en: "Today", to: "/today" },
  { icon: Network, zh: "通识", en: "Studies", to: "/life-studies" },
  { icon: LibraryBig, zh: "众生", en: "Hall", to: "/community" },
  { icon: Handshake, zh: "关系", en: "Bonds", to: "/bonds" },
  { icon: UserRound, zh: "读者证", en: "Pass", to: "/me" },
] as const;

export function AppMobileNav() {
  const { lang } = useLang();
  const zh = lang === "zh";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[430px] border-t border-amber-300/12 bg-[#090912]/96 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur-xl">
      <div className="grid grid-cols-7 gap-1">
        {NAV_ITEMS.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to as never}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[9px] ${
                active ? "bg-amber-300/14 text-amber-100" : "text-amber-100/55"
              }`}
            >
              <Icon aria-hidden className="h-[18px] w-[18px]" />
              <span className="max-w-full truncate">{zh ? item.zh : item.en}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
