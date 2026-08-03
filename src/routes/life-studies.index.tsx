import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, Network } from "lucide-react";

import {
  DESTINY_COMMONS_HALLS,
  HISTORICAL_ECHOES_ROUTE,
  comingHallCount,
  openHallCount,
} from "@/lib/destiny-commons";
import { useLang } from "@/lib/i18n";

/**
 * /life-studies — canonical route for 命运通识馆 (General Knowledge Hall
 * of Destiny). Renders the same shared six-hall grid used by the home
 * preview section. Main-nav "命运通识馆" already points here.
 */
export const Route = createFileRoute("/life-studies/")({
  head: () => ({
    meta: [
      { title: "命运通识馆 · General Knowledge Hall of Destiny" },
      {
        name: "description",
        content:
          "用数学、文学、地理、物理、经济与生物六种知识语言，把专业命盘结果转译成可以观察、比较和自我探索的生活语言。",
      },
      { property: "og:title", content: "命运通识馆 · General Knowledge Hall of Destiny" },
      {
        property: "og:description",
        content:
          "Read one life through six languages of knowledge — mathematics, literature, geography, physics, economics, biology.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://cosmic-axis-hub.lovable.app/life-studies" },
    ],
    links: [{ rel: "canonical", href: "https://cosmic-axis-hub.lovable.app/life-studies" }],
  }),
  component: DestinyCommonsPage,
});

function DestinyCommonsPage() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const openN = openHallCount();
  const comingN = comingHallCount();

  return (
    <main
      className="relative min-h-screen bg-[#090912] px-4 pb-28 pt-[calc(env(safe-area-inset-top)+0.75rem)] text-amber-50"
    >
      <div className="mb-5 flex items-center justify-between">
        <Link
          to="/"
          aria-label={isZh ? "返回首页" : "Back home"}
          className="grid h-11 w-11 place-items-center rounded-full border border-amber-300/15 bg-white/[0.035] text-amber-100"
        >
          <ArrowLeft aria-hidden className="h-5 w-5" />
        </Link>
        <span className="rounded-full border border-amber-300/15 px-3 py-1 text-[11px] text-amber-100/65">
          {isZh ? "命运通识馆" : "Life Studies"}
        </span>
      </div>

      <div>
        <section className="rounded-[32px] border border-amber-300/16 bg-gradient-to-br from-amber-300/10 via-[#15111a] to-[#090912] p-5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
            <Network aria-hidden className="h-6 w-6" />
          </div>
          <p className="mt-5 text-[10px] uppercase tracking-[0.3em] text-amber-300/70">
            {isZh ? "六馆目录" : "Six Halls"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-normal text-amber-50">
            {isZh
              ? "用六种知识语言，重新读懂人生"
              : "Read life through six languages"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-amber-100/62">
            {isZh
              ? "数学、语文、地理、物理、经济与生物，把命盘结果转译成更容易观察和行动的生活语言。"
              : "Math, literature, geography, physics, economics and biology translate chart evidence into clearer everyday language."}
          </p>
          <div className="mt-4 flex gap-2 text-[11px] text-amber-100/55">
            <span className="rounded-full border border-emerald-300/30 bg-emerald-300/8 px-3 py-1">
              {isZh ? `${openN} 座开放` : `${openN} open`}
            </span>
            <span className="rounded-full border border-amber-300/15 bg-white/[0.035] px-3 py-1">
              {isZh ? `${comingN} 座整理中` : `${comingN} in progress`}
            </span>
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-amber-300/12 bg-white/[0.035] p-3">
          <div className="mb-2 px-1 text-sm font-medium text-amber-100">
            {isZh ? "选择一座馆" : "Choose a hall"}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DESTINY_COMMONS_HALLS.map((hall) => {
              const open = hall.status === "open";
              const content = (
                <>
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-300/9 text-xs font-semibold text-amber-200">
                    {hall.code}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-amber-50">
                      {isZh ? hall.nameZh : hall.nameEn}
                    </span>
                    <span className="mt-0.5 block text-xs text-amber-100/45">
                      {open ? (isZh ? "已开放" : "Open") : (isZh ? "馆藏整理中" : "Collection in progress")}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="h-5 w-5 text-amber-100/35" />
                </>
              );
              return open ? (
                <Link key={hall.id} to={hall.route as never} className="flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-white/10 bg-black/18 p-3">
                  {content}
                </Link>
              ) : (
                <div key={hall.id} className="flex min-h-[92px] flex-col items-start justify-between rounded-2xl border border-white/10 bg-black/18 p-3 opacity-70">
                  {content}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-amber-300/12 bg-white/[0.035] p-5">
          <p className="text-[10px] uppercase tracking-[0.26em] text-amber-300/70">
            {isZh ? "延伸阅读" : "Also nearby"}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-amber-100/62">
            {isZh
              ? "想从古人的经历里寻找回应？历史回声会按你此刻的人生阶段匹配相似处境的历史人物。"
              : "Historical Echoes matches figures from history to your current life stage."}
          </p>
          <Link
            to={HISTORICAL_ECHOES_ROUTE}
            className="mt-4 flex min-h-12 items-center justify-between rounded-2xl bg-amber-300 px-4 text-sm font-semibold text-[#111016]"
          >
            {isZh ? "前往历史回声" : "Open Historical Echoes"}
            <ChevronRight aria-hidden className="h-5 w-5" />
          </Link>
        </section>

      </div>
    </main>
  );
}
