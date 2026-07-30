import { Link, createFileRoute } from "@tanstack/react-router";

import { CommonsHallNav } from "@/components/CommonsHallNav";

import { DestinyCommonsGrid } from "@/components/destiny-commons/DestinyCommonsGrid";
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
      className="relative min-h-screen bg-obsidian/10 pb-24 text-stone-warm"
      style={{ paddingTop: "calc(var(--site-nav-height, 96px) + 24px)" }}
    >
      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">
        {/* Breadcrumb */}
        <nav aria-label={isZh ? "面包屑" : "Breadcrumb"} className="mb-6 text-[11px] uppercase tracking-[0.28em] text-stone-warm/45">
          <Link to="/" className="hover:text-gold-dust">
            {isZh ? "导览室" : "Guide Hall"}
          </Link>
          <span className="mx-2 text-stone-warm/25">/</span>
          <span className="text-stone-warm/70">
            {isZh ? "命运通识馆" : "General Knowledge Hall"}
          </span>
        </nav>

        <header className="mx-auto max-w-3xl text-center">
          <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust/80">
            {isZh
              ? "命运通识馆 · General Knowledge of Destiny"
              : "The General Knowledge Hall of Destiny"}
          </p>
          <h1 className="mt-4 font-serif text-3xl leading-tight text-stone-warm md:text-4xl lg:text-5xl">
            {isZh
              ? "用六种知识语言，重新读懂同一段人生"
              : "Read One Life Through Six Languages of Knowledge"}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-stone-warm/70 md:text-base">
            {isZh
              ? "命盘给出人生的坐标，通识帮助你理解坐标如何落进现实。这里不增加另一套玄学结论，而是用数学、文学、地理、物理、经济与生物，把专业命理结果转译成可以观察、比较和自我探索的生活语言。"
              : "A chart offers coordinates. General knowledge helps you understand how those coordinates appear in real life. Rather than adding another divination system, this hall translates existing chart evidence through mathematics, literature, geography, physics, economics and biology — making it easier to observe, compare and reflect upon."}
          </p>
          <p className="mx-auto mt-5 text-[11px] uppercase tracking-[0.32em] text-stone-warm/50">
            {isZh
              ? `六座主题馆 · ${openN} 座已开放 · ${comingN} 座馆藏整理中`
              : `Six thematic halls · ${openN} open · ${comingN} collections in progress`}
          </p>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-[10px] uppercase tracking-[0.24em]">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-200">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
              {isZh ? "已开放" : "Open"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-stone-warm/60">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full border border-current" />
              {isZh ? "馆藏整理中" : "Collection in progress"}
            </span>
          </div>
        </header>
      </div>

      {/* Sub-navigation renders inline between Hero and grid so it never
          overlaps the title on any viewport; side bookmark takes over
          after the user scrolls past it. */}
      <CommonsHallNav active="/life-studies" />

      <div className="mx-auto max-w-[1280px] px-5 sm:px-8">

        <div className="mt-14">
          <DestinyCommonsGrid isZh={isZh} />
        </div>

        {/* Historical Echoes cross-link */}
        <section className="mx-auto mt-16 max-w-2xl rounded-2xl border border-white/8 bg-obsidian/50 p-6 text-center">
          <p className="text-[10px] uppercase tracking-[0.32em] text-gold-dust/70">
            {isZh ? "延伸阅读" : "Also nearby"}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-stone-warm/70">
            {isZh
              ? "想从古人的经历里寻找回应？「历史回声」是命运通识馆之外的独立功能，按你此刻的人生阶段匹配相似处境的历史人物。"
              : "Looking for an answer in lives once lived? Historical Echoes is a separate feature that matches figures from history to the life stage you are in right now."}
          </p>
          <Link
            to={HISTORICAL_ECHOES_ROUTE}
            className="mt-5 inline-flex min-h-[44px] items-center rounded-full border border-gold-dust/45 px-6 py-2.5 text-[11px] uppercase tracking-[0.28em] text-gold-dust transition hover:bg-gold-dust/10"
          >
            {isZh ? "前往「历史回声」" : "Visit Historical Echoes"}
          </Link>
        </section>

        {/* Methodology note */}
        <section className="mx-auto mt-10 max-w-3xl text-center text-[11px] leading-relaxed text-stone-warm/45">
          {isZh
            ? "共 6 座主题馆使用同一份配置渲染。命盘事实仍由项目既有四大体系与确定性计算模块产生；六馆只负责使用不同学科框架进行呈现、解释与自我探索。"
            : `All ${DESTINY_COMMONS_HALLS.length} halls render from a single shared configuration. Chart facts still come from the project's four traditions and deterministic calculators — these halls only reframe existing evidence.`}
        </section>
      </div>
    </main>
  );
}
