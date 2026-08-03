/**
 * Resumable progress for the multi-call report generation.
 *
 * Each dimension is written to local storage as soon as it lands, keyed by the
 * report fingerprint. A refresh, tab crash, or navigation mid-generation
 * therefore resumes: only the missing dimensions are re-requested.
 */

export type DimensionStatus = "pending" | "ok" | "degraded";

export type ReportProgressSnapshot<D extends { key: string } = { key: string }> = {
  fingerprint: string;
  version: string;
  summary: string;
  dimensions: D[];
  /** Dimension keys that fell back to the deterministic template. */
  degraded: string[];
  updatedAt: number;
};

const KEY_PREFIX = "lod.report-progress:";
/** Stale partials are ignored — the chart brief may have changed since. */
const MAX_AGE_MS = 30 * 60 * 1000;

function storageKey(fingerprint: string) {
  return `${KEY_PREFIX}${fingerprint}`;
}

export function loadReportProgress<D extends { key: string }>(
  fingerprint: string,
  version: string,
  now: number = Date.now(),
): ReportProgressSnapshot<D> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(fingerprint));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReportProgressSnapshot<D>;
    if (parsed?.fingerprint !== fingerprint || parsed?.version !== version) return null;
    if (!Array.isArray(parsed.dimensions)) return null;
    if (now - (parsed.updatedAt ?? 0) > MAX_AGE_MS) return null;
    return { ...parsed, degraded: parsed.degraded ?? [] };
  } catch {
    return null;
  }
}

export function saveReportProgress<D extends { key: string }>(
  snapshot: Omit<ReportProgressSnapshot<D>, "updatedAt"> & { updatedAt?: number },
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      storageKey(snapshot.fingerprint),
      JSON.stringify({ ...snapshot, updatedAt: snapshot.updatedAt ?? Date.now() }),
    );
  } catch {
    /* quota / private mode — progress is an optimisation, never required */
  }
}

export function clearReportProgress(fingerprint: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(fingerprint));
  } catch {
    /* ignore */
  }
}

/** Keys still missing from a snapshot, in canonical order. */
export function pendingDimensionKeys<D extends { key: string }>(
  allKeys: readonly string[],
  snapshot: ReportProgressSnapshot<D> | null,
): string[] {
  if (!snapshot) return [...allKeys];
  const done = new Set(
    snapshot.dimensions.filter((d) => !snapshot.degraded.includes(d.key)).map((d) => d.key),
  );
  return allKeys.filter((k) => !done.has(k));
}
