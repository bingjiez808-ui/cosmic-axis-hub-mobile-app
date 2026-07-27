/**
 * Fun Library · result page.
 *
 * Three layers:
 *   1. Parametric book cover + type name / titles (literary ⇄ abstract).
 *   2. Four axis "bookmark compass" — read-only visualization.
 *   3. Three real-life moment cards + "misread as / advice".
 *   4. "Reading you vs. your chart's undertone" — reads ONLY existing
 *      chart facts (name/lang/gender/birth_date). If not enough facts
 *      are present, refuses to compare — never invents.
 *
 * No AI, no network. Save-to-shelf and share-preview are user-initiated.
 */

import { useState } from "react";
import type { ChartRow } from "@/lib/reports-store.functions";
import { useLang } from "@/lib/i18n";
import { BookCover } from "./personality/bookcover";
import { getTypeEntry } from "./personality/types-catalog";
import type { AxisKey, PersonalityResult } from "./personality/types";

const AXIS_LABEL: Record<
  AxisKey,
  { zh: [string, string]; en: [string, string] }
> = {
  ML: { zh: ["地图", "灯火"], en: ["Map", "Lantern"] },
  ET: { zh: ["编者", "旅人"], en: ["Editor", "Traveler"] },
  AC: { zh: ["独读", "共读"], en: ["Solo", "Together"] },
  FO: { zh: ["合卷", "续写"], en: ["Closure", "Open"] },
};

function CompassBar({
  axis,
  norm,
  leftLabel,
  rightLabel,
}: {
  axis: AxisKey;
  norm: number;
  leftLabel: string;
  rightLabel: string;
}) {
  const marker = Math.min(98, Math.max(2, norm));
  return (
    <div className="flex flex-col gap-1" data-axis={axis}>
      <div className="flex justify-between text-[10px] uppercase tracking-[0.24em] text-amber-200/70">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="relative h-2 rounded-full bg-gradient-to-r from-amber-300/40 via-amber-200/10 to-amber-300/40">
        <div
          className="absolute -top-1 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-amber-100 bg-amber-300 shadow-[0_0_8px_rgba(200,164,92,0.7)]"
          style={{ left: `${marker}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

/**
 * Chart-undertone comparison.
 * Only uses fields ALREADY on the chart row (no calc-snapshot fetch,
 * no AI). Requires name + birth_date + lang to say anything at all.
 */
function ChartUndertone({
  chart,
  result,
  isZh,
}: {
  chart: ChartRow;
  result: PersonalityResult;
  isZh: boolean;
}) {
  const factsPresent = Boolean(chart.birth_date && chart.name);
  if (!factsPresent) {
    return (
      <p className="text-xs text-stone-300/60">
        {isZh
          ? "当前计算资料不足，暂不与主命盘做对照。"
          : "Not enough chart data yet to compare with your primary chart."}
      </p>
    );
  }
  const month = Number.parseInt(chart.birth_date!.slice(5, 7), 10);
  const undertone = month <= 3 || month === 12
    ? { zh: "冬春夜灯型", en: "winter-lantern undertone" }
    : month <= 6
    ? { zh: "春末破晓型", en: "late-spring undertone" }
    : month <= 9
    ? { zh: "夏日午后型", en: "summer-afternoon undertone" }
    : { zh: "秋日归档型", en: "autumn-archive undertone" };
  const readerTop = result.axes.ML.normalized >= 50
    ? { zh: "结构先行", en: "structure-first" }
    : { zh: "感觉先行", en: "cue-first" };
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-amber-300/15 bg-black/25 p-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/60">
          {isZh ? "测试中的你" : "You in this quiz"}
        </p>
        <p className="mt-2 font-serif text-lg text-amber-100">
          {isZh ? readerTop.zh : readerTop.en}
        </p>
      </div>
      <div className="rounded-xl border border-amber-300/15 bg-black/25 p-4">
        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/60">
          {isZh ? "主命盘底色（依据出生月份）" : "Primary chart undertone (from birth month)"}
        </p>
        <p className="mt-2 font-serif text-lg text-amber-100">
          {isZh ? undertone.zh : undertone.en}
        </p>
        <p className="mt-2 text-[10px] text-stone-300/50">
          {isZh
            ? "依据字段：birth_date · name。更多层面需在“命盘与报告”查看。"
            : "Fields used: birth_date · name. Deeper layers live in Charts & Reports."}
        </p>
      </div>
    </div>
  );
}

export function ResultView({
  result,
  chart,
  onRestart,
}: {
  result: PersonalityResult;
  chart: ChartRow;
  onRestart: () => void;
}) {
  const { lang } = useLang();
  const isZh = lang === "zh";
  const entry = getTypeEntry(result.code);
  const [titleMode, setTitleMode] = useState<"literary" | "abstract">("literary");

  const title = titleMode === "literary" ? entry.literaryTitle : entry.abstractTitle;

  return (
    <section
      aria-labelledby="funlib-result-heading"
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      <header className="grid gap-6 rounded-2xl border border-amber-300/20 bg-[#100c1c]/70 p-6 md:grid-cols-[260px_1fr] md:gap-8 md:p-8">
        <div className="flex justify-center md:justify-start">
          <BookCover result={result} title={isZh ? entry.name.zh : entry.name.en} />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-[10px] uppercase tracking-[0.32em] text-amber-200/70">
            {isZh ? "你的藏书人格" : "Your reader-type"}
          </p>
          <h1 id="funlib-result-heading" className="font-serif text-3xl text-amber-100 md:text-4xl">
            {isZh ? entry.name.zh : entry.name.en}
          </h1>
          <p className="font-serif text-lg italic text-amber-200/90">
            {isZh ? title.zh : title.en}
          </p>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setTitleMode("literary")}
              aria-pressed={titleMode === "literary"}
              className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.24em] transition ${
                titleMode === "literary"
                  ? "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/50"
                  : "text-amber-200/60 hover:text-amber-100"
              }`}
            >
              {isZh ? "文艺版" : "Literary"}
            </button>
            <button
              type="button"
              onClick={() => setTitleMode("abstract")}
              aria-pressed={titleMode === "abstract"}
              className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.24em] transition ${
                titleMode === "abstract"
                  ? "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/50"
                  : "text-amber-200/60 hover:text-amber-100"
              }`}
            >
              {isZh ? "抽象版" : "Abstract"}
            </button>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-stone-200/85">
            {isZh ? entry.howYouRead.zh : entry.howYouRead.en}
          </p>
        </div>
      </header>

      <section
        aria-label={isZh ? "四条书签罗盘" : "Four-bookmark compass"}
        className="grid gap-4 rounded-2xl border border-amber-300/15 bg-[#0e0b1a]/70 p-6"
      >
        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/70">
          {isZh ? "书签罗盘" : "Bookmark Compass"}
        </p>
        {(["ML", "ET", "AC", "FO"] as AxisKey[]).map((ax) => {
          const [l, r] = isZh ? AXIS_LABEL[ax].zh : AXIS_LABEL[ax].en;
          return (
            <CompassBar
              key={ax}
              axis={ax}
              norm={result.axes[ax].normalized}
              leftLabel={l}
              rightLabel={r}
            />
          );
        })}
      </section>

      <section aria-label={isZh ? "现实生活的你" : "You in daily life"} className="grid gap-3 md:grid-cols-3">
        {(["decision", "relations", "change"] as const).map((k) => {
          const heading =
            k === "decision"
              ? isZh ? "做决定时" : "When deciding"
              : k === "relations"
              ? isZh ? "面对关系时" : "In relationships"
              : isZh ? "面对变化时" : "When things change";
          const body = entry.moments[k];
          return (
            <article key={k} className="rounded-xl border border-amber-300/15 bg-black/25 p-4">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/60">{heading}</p>
              <p className="mt-2 text-sm leading-relaxed text-stone-100/90">
                {isZh ? body.zh : body.en}
              </p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-3 rounded-2xl border border-amber-300/15 bg-[#0e0b1a]/70 p-6 md:grid-cols-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "容易被误解的地方" : "Often misread"}
          </p>
          <p className="mt-2 text-sm text-stone-200/85">
            {isZh ? entry.oftenMisread.zh : entry.oftenMisread.en}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/60">
            {isZh ? "一条不说教的建议" : "One gentle nudge"}
          </p>
          <p className="mt-2 text-sm text-stone-200/85">
            {isZh ? entry.gentleAdvice.zh : entry.gentleAdvice.en}
          </p>
        </div>
      </section>

      <section
        aria-label={isZh ? "与命盘对照" : "Compared to your chart"}
        className="rounded-2xl border border-amber-300/15 bg-[#0e0b1a]/70 p-6"
      >
        <p className="text-[10px] uppercase tracking-[0.28em] text-amber-200/70">
          {isZh ? "测试中的你 · 与主命盘底色" : "You in the quiz · vs. chart undertone"}
        </p>
        <div className="mt-3">
          <ChartUndertone chart={chart} result={result} isZh={isZh} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.24em] text-stone-300/50">
          {isZh
            ? "结果已保存到本机，仅当前设备可见。"
            : "Result saved to this device only."}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRestart}
            className="inline-flex min-h-10 items-center rounded-full border border-amber-300/50 px-4 text-[11px] uppercase tracking-[0.24em] text-amber-200 transition hover:bg-amber-300/10"
          >
            {isZh ? "重新回答" : "Retake"}
          </button>
        </div>
      </div>
    </section>
  );
}
