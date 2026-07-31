/**
 * chart-hydration — one canonical way to obtain a COMPLETE chart input
 * (date + time + place + gender) on any surface that reads a natal chart.
 *
 * Why this exists:
 *   The URL search params only reliably carry `readingId` when a visitor
 *   reopens a saved chart from the bookshelf. Gender in particular is never
 *   part of the link. Zi Wei Dou Shu *requires* gender, so every surface
 *   that built a calculation snapshot straight from `search` silently
 *   produced `ziwei: unavailable → gender_missing`, and the AI prompt then
 *   said "本次缺少紫微排盘".
 *
 * Resolution order (all read-only, RLS-scoped to the caller):
 *   1. fields already present in `search`
 *   2. the persisted chart row referenced by `readingId`
 *   3. the caller's chart matching the same birth date/time
 *   4. the caller's primary chart
 *
 * Anonymous visitors simply keep `search` unchanged.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { getChartById, listUserCharts } from "@/lib/reports-store.functions";
import type { ReportSearchLike } from "@/lib/report-input";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ChartInputPatch = {
  name?: string;
  date?: string;
  time?: string;
  place?: string;
  gender?: "male" | "female";
  readingId?: string;
};

/** True when the input can drive ALL FOUR systems (ziwei needs gender). */
export function isChartInputComplete(s: ReportSearchLike | undefined | null): boolean {
  if (!s) return false;
  return Boolean(
    s.date && s.time && s.place && (s.gender === "male" || s.gender === "female"),
  );
}

/** Which fields are still missing — used for diagnostics / gates. */
export function missingChartInputFields(s: ReportSearchLike | undefined | null): string[] {
  const out: string[] = [];
  if (!s?.date) out.push("date");
  if (!s?.time) out.push("time");
  if (!s?.place) out.push("place");
  if (!(s?.gender === "male" || s?.gender === "female")) out.push("gender");
  return out;
}

/**
 * Async resolver — usable outside React (server-fn callers, event handlers).
 * Returns only the fields it could fill in; never overwrites existing ones.
 */
export async function resolveChartInputPatch(
  search: ReportSearchLike,
): Promise<ChartInputPatch | null> {
  if (isChartInputComplete(search)) return null;
  const rid = (search.readingId ?? "").trim();
  let row: Awaited<ReturnType<typeof getChartById>> | null = null;

  try {
    if (UUID_RE.test(rid)) {
      row = await getChartById({ data: { chartId: rid } });
    }
    if (!row) {
      const charts = await listUserCharts();
      const list = Array.isArray(charts) ? charts : [];
      const sameBirth = search.date
        ? list.find(
            (c) =>
              c.birth_date === search.date &&
              (!search.time || !c.birth_time || c.birth_time.slice(0, 5) === search.time.slice(0, 5)),
          )
        : undefined;
      const target = sameBirth ?? list.find((c) => c.is_primary) ?? null;
      if (target) row = await getChartById({ data: { chartId: target.id } });
    }
  } catch {
    /* anonymous visitor or transient error — keep the URL-only input */
    return null;
  }
  if (!row) return null;

  const patch: ChartInputPatch = {};
  if (!search.name && row.name) patch.name = row.name;
  if (!search.date && row.birth_date) patch.date = row.birth_date;
  if (!search.time && row.birth_time) patch.time = row.birth_time.slice(0, 5);
  if (!search.place && row.birth_place) patch.place = row.birth_place;
  if (!(search.gender === "male" || search.gender === "female") && row.gender) {
    patch.gender = row.gender;
  }
  if (!rid && row.id) patch.readingId = row.id;
  return Object.keys(patch).length > 0 ? patch : null;
}

/**
 * React hook (stateful variant) — returns the merged search plus a
 * `hydrating` flag. Callers that create/lookup DB rows keyed by the chart
 * input (report generation) MUST wait for `hydrating === false`, otherwise
 * the first pass runs with `gender: ""` and hashes to a DIFFERENT chart row
 * than the hydrated pass — producing a duplicate report + a fresh AI run
 * (and therefore a different summary on each visit).
 */
export function useHydratedChartSearchState(search: ReportSearchLike | undefined): {
  search: ReportSearchLike | undefined;
  hydrating: boolean;
} {
  const [patch, setPatch] = useState<ChartInputPatch | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const reqRef = useRef(0);
  const complete = isChartInputComplete(search);
  const key = [
    search?.date ?? "",
    search?.time ?? "",
    search?.place ?? "",
    search?.gender ?? "",
    search?.readingId ?? "",
  ].join("|");

  useEffect(() => {
    if (!search || complete) {
      setPatch(null);
      setHydrating(false);
      return;
    }
    const req = ++reqRef.current;
    let cancelled = false;
    setHydrating(true);
    void (async () => {
      const next = await resolveChartInputPatch(search);
      if (cancelled || req !== reqRef.current) return;
      setPatch(next);
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, complete]);

  const merged = useMemo(() => {
    if (!search) return search;
    if (!patch) return search;
    return { ...search, ...patch };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, patch, search]);

  return { search: merged, hydrating };
}

/**
 * React hook — returns `search` merged with whatever the persisted chart
 * can supply. Stable identity while nothing changes, so it is safe in
 * `useMemo`/`useEffect` dependency arrays.
 */
export function useHydratedChartSearch(
  search: ReportSearchLike | undefined,
): ReportSearchLike | undefined {
  return useHydratedChartSearchState(search).search;
}

