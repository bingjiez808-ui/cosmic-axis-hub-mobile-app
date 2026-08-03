/**
 * Literature share card — three formats (quote, age-reread, my-annotation).
 * Rendered as pure HTML/CSS/SVG; no runtime AI. Aspect ratios: 9:16, 1:1, 4:5.
 *
 * The card intentionally omits chart_id, birth data, or any raw astrology
 * inputs. The user's stage is shown only when they explicitly opted in
 * (`show_age`).
 */

import { useMemo } from "react";

export type ShareCardFormat = "quote" | "age-reread" | "annotation";
export type ShareCardRatio = "9:16" | "1:1" | "4:5";

type Passage = {
  display_text_zh: string | null;
  display_text_en: string | null;
  original_text: string;
  work: {
    title_zh: string | null;
    title_original: string | null;
    author_zh: string | null;
    author_original: string | null;
    language: string;
  };
  citation_label: string | null;
};

export type LiteratureShareCardProps = {
  format: ShareCardFormat;
  ratio?: ShareCardRatio;
  passage: Passage;
  isZh: boolean;
  /** Age-reread only: user's stage label (never numeric age unless opted in). */
  stageLabel?: string | null;
  /** Annotation card only: user-authored line, must be user-confirmed. */
  annotation?: string | null;
  /** Library shelf number, e.g. passage slug tail. */
  shelfCode?: string | null;
};

const RATIO_TO_DIMENSIONS: Record<ShareCardRatio, { w: number; h: number }> = {
  "9:16": { w: 540, h: 960 },
  "1:1": { w: 720, h: 720 },
  "4:5": { w: 720, h: 900 },
};

export function LiteratureShareCard({
  format,
  ratio = "1:1",
  passage,
  isZh,
  stageLabel,
  annotation,
  shelfCode,
}: LiteratureShareCardProps) {
  const dims = RATIO_TO_DIMENSIONS[ratio];
  const displayText = isZh
    ? passage.display_text_zh ?? passage.original_text
    : passage.display_text_en ?? passage.original_text;
  const workTitle = isZh
    ? passage.work.title_zh ?? passage.work.title_original ?? ""
    : passage.work.title_original ?? passage.work.title_zh ?? "";
  const authorName = isZh
    ? passage.work.author_zh ?? passage.work.author_original ?? ""
    : passage.work.author_original ?? passage.work.author_zh ?? "";

  // Truncate long lines to prevent overflow
  const clamped = useMemo(() => clampText(displayText, ratio, format), [displayText, ratio, format]);

  return (
    <div
      data-share-card
      style={{
        width: dims.w,
        height: dims.h,
        maxWidth: "100%",
        aspectRatio: `${dims.w} / ${dims.h}`,
      }}
      className="relative overflow-hidden rounded-2xl bg-[#0a0a12] text-amber-50 shadow-2xl"
    >
      {/* Ambient library background */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(217,180,74,0.28), transparent 55%), radial-gradient(circle at 80% 85%, rgba(88,58,153,0.35), transparent 55%), linear-gradient(180deg, #0a0a12 0%, #12101c 100%)",
        }}
      />
      {/* Golden frame */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-4 rounded-xl border border-amber-400/25"
      />
      <div className="relative flex h-full w-full flex-col justify-between p-8">
        <header className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-amber-300/60">
          <span>{isZh ? "命运图书馆 · 语文馆" : "Destiny Library · Literature"}</span>
          {shelfCode && <span>№ {shelfCode}</span>}
        </header>

        <main className="flex flex-1 flex-col justify-center pt-6">
          {format === "age-reread" && stageLabel && (
            <div className="mb-4 text-xs text-amber-300/70">
              {isZh
                ? `${stageLabel}读到这一句：`
                : `Reading this line, ${stageLabel.toLowerCase()}:`}
            </div>
          )}
          <blockquote
            className="font-serif text-amber-50"
            style={{
              fontSize: `clamp(20px, ${ratio === "9:16" ? 3.6 : 3.2}vw, 34px)`,
              lineHeight: 1.5,
              letterSpacing: "0.02em",
            }}
          >
            "{clamped}"
          </blockquote>
          <div className="mt-6 text-sm text-amber-200/70">
            {authorName ? `— ${authorName}` : ""}
            {authorName && workTitle ? " · " : ""}
            {workTitle ? `《${workTitle}》` : ""}
          </div>

          {format === "annotation" && annotation && (
            <div className="mt-6 border-t border-amber-400/20 pt-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/60">
                {isZh ? "我的注解" : "My annotation"}
              </div>
              <p
                className="mt-2 font-serif text-amber-100"
                style={{ fontSize: `clamp(14px, 2vw, 18px)`, lineHeight: 1.6 }}
              >
                {clampText(annotation, ratio, "annotation")}
              </p>
              <p className="mt-3 text-[10px] italic text-amber-300/50">
                {isZh
                  ? "原文仍由作者写下，下一行由你继续。"
                  : "The original was written by them. The next line is yours."}
              </p>
            </div>
          )}
        </main>

        <footer className="mt-4 text-center text-[10px] text-amber-300/50">
          {isZh
            ? "命运图书馆为我翻到这一页"
            : "The library turned to this page for me"}
        </footer>
      </div>
    </div>
  );
}

function clampText(input: string, ratio: ShareCardRatio, format: ShareCardFormat): string {
  const max =
    format === "annotation"
      ? ratio === "9:16"
        ? 90
        : 120
      : ratio === "9:16"
        ? 60
        : 80;
  if (input.length <= max) return input;
  return input.slice(0, max - 1).trimEnd() + "…";
}
