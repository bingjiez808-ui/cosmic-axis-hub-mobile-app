/**
 * Pure helpers for the Premium Deep Reading in-app reader UI.
 *
 * Kept in a dedicated module (no React, no DOM) so they can be
 * exercised by unit tests without a jsdom/happy-dom setup.
 */

export type ChapterLite = { key: string; title: string };

/**
 * Scroll progress percentage for a scroll container.
 * Returns 0 when the viewport already contains the whole document
 * (`scrollHeight <= clientHeight`) — nothing to scroll, so "at start"
 * is the same as "at end" and 0 avoids showing a false 100 %.
 */
export function computeScrollProgress(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
): number {
  const denom = scrollHeight - clientHeight;
  if (!Number.isFinite(denom) || denom <= 0) return 0;
  const pct = (scrollTop / denom) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, Math.round(pct * 10) / 10));
}

/** Zero-based index of `currentKey` in `chapters`, or -1 when unknown. */
export function chapterIndex(chapters: ChapterLite[], currentKey: string | null): number {
  if (!currentKey) return -1;
  return chapters.findIndex((c) => c.key === currentKey);
}

/**
 * Prev/next chapter keys around `currentKey`. Returns null on the
 * boundary so the caller can disable the corresponding button.
 */
export function neighborChapters(
  chapters: ChapterLite[],
  currentKey: string | null,
): { prev: string | null; next: string | null } {
  const idx = chapterIndex(chapters, currentKey);
  if (idx < 0) return { prev: null, next: null };
  return {
    prev: idx > 0 ? chapters[idx - 1].key : null,
    next: idx < chapters.length - 1 ? chapters[idx + 1].key : null,
  };
}

/**
 * Audit metadata rendered to the user (weakened row). Never includes
 * hashes or token counts — those are for backend audit only.
 */
export type ReaderAuditMeta = {
  generated_at?: string | null;
  report_schema_version?: string | null;
  prompt_version?: string | null;
  model_id?: string | null;
  calculation_version?: string | null;
};

export function formatAuditLine(meta: ReaderAuditMeta, lang: "zh" | "en"): string {
  const parts: string[] = [];
  if (meta.generated_at) {
    try {
      const d = new Date(meta.generated_at);
      parts.push(
        d.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      );
    } catch {
      parts.push(meta.generated_at.slice(0, 10));
    }
  }
  if (meta.report_schema_version) parts.push(`schema ${meta.report_schema_version}`);
  if (meta.prompt_version) parts.push(`prompt ${meta.prompt_version}`);
  if (meta.model_id) parts.push(`model ${meta.model_id}`);
  if (meta.calculation_version) parts.push(`calc ${meta.calculation_version}`);
  return parts.join(" · ");
}

/** True when a report has locally-derived facts (v2 schema). */
export function hasFacts(content: { facts?: unknown } | null | undefined): boolean {
  return !!content && content.facts != null;
}
