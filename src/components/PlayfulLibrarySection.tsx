/**
 * PlayfulLibrarySection — home preview for 命运通识馆 (General Knowledge
 * Hall of Destiny). Renders the shared six-hall grid with a compact
 * header and a secondary link to Historical Echoes.
 *
 * The full standalone experience lives at /life-studies; this section
 * is the landing-page preview that shares the same data source and
 * modal component so status/copy/routes never drift.
 */

import { Link } from "@tanstack/react-router";

import { DestinyCommonsGrid } from "@/components/destiny-commons/DestinyCommonsGrid";
import {
  DESTINY_COMMONS_ROUTE,
  HISTORICAL_ECHOES_ROUTE,
  comingHallCount,
  openHallCount,
} from "@/lib/destiny-commons";
import { useLang } from "@/lib/i18n";

export function PlayfulLibrarySection() {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const openN = openHallCount();
  const comingN = comingHallCount();

  return (
    <section
      id="destiny-commons"
      data-testid="destiny-commons-home"
      className="relative z-10 mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-16"
    >
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] uppercase tracking-[0.42em] text-gold-dust/80">
          {isZh
            ? "命运通识馆 · General Knowledge of Destiny"
            : "The General Knowledge Hall of Destiny"}
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight text-stone-warm md:text-4xl">
          {isZh
            ? "用六种知识语言，重新读懂同一段人生"
            : "Read One Life Through Six Languages of Knowledge"}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-stone-warm/65">
          {isZh
            ? "命盘给出人生的坐标，通识帮助你理解坐标如何落进现实。这里不增加另一套玄学结论，而是用数学、文学、地理、物理、经济与生物，把专业命理结果转译成可以观察、比较和自我探索的生活语言。"
            : "A chart offers coordinates. General knowledge helps you understand how those coordinates appear in real life. Rather than adding another divination system, this hall translates existing chart evidence through mathematics, literature, geography, physics, economics and biology — making it easier to observe, compare and reflect upon."}
        </p>
        <p className="mx-auto mt-4 text-[11px] uppercase tracking-[0.32em] text-stone-warm/50">
          {isZh
            ? `六座主题馆 · ${openN} 座已开放 · ${comingN} 座馆藏整理中`
            : `Six thematic halls · ${openN} open · ${comingN} collections in progress`}
        </p>
        <p className="mx-auto mt-3 max-w-xl text-[12px] leading-relaxed text-stone-warm/50">
          {isZh
            ? "数学馆让你看见多种人生维度如何共同改变曲线；语文馆为此刻的你找到一句终于读懂的话。"
            : "The Mathematics Hall shows how many life dimensions bend the curve together; the Literature Hall finds a line you can finally read for who you are now."}
        </p>
      </header>

      <div className="mt-12">
        <DestinyCommonsGrid isZh={isZh} />
      </div>

      <div className="mt-12 flex flex-col items-center gap-4">
        <Link
          to={DESTINY_COMMONS_ROUTE}
          data-testid="destiny-commons-cta"
          className="group relative inline-flex overflow-hidden rounded-full border border-gold-dust/45 bg-obsidian/80 px-10 py-4 transition-colors hover:border-gold-dust"
        >
          <span className="relative z-10 text-xs font-medium uppercase tracking-[0.32em] text-gold-dust">
            {isZh ? "进入命运通识馆" : "Enter the General Knowledge Hall"}
          </span>
          <span className="absolute inset-0 translate-y-full bg-gold-dust/10 transition-transform duration-500 group-hover:translate-y-0" />
        </Link>
        <p className="text-[11px] leading-relaxed text-stone-warm/55">
          {isZh ? "想从古人的经历里寻找回应？" : "Looking for an answer in lives once lived?"}{" "}
          <Link
            to={HISTORICAL_ECHOES_ROUTE}
            className="text-gold-dust underline decoration-gold-dust/40 underline-offset-4 hover:decoration-gold-dust"
          >
            {isZh ? "前往「历史回声」" : "Visit Historical Echoes"}
          </Link>
        </p>
      </div>
    </section>
  );
}
