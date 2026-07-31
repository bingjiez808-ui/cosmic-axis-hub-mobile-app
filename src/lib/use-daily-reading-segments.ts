/**
 * On-demand, per-section daily AI reading.
 *
 * Cost policy: today's score and facts are 100% deterministic and never call
 * AI. The AI layer is split into small sections ("overview", "actions",
 * "domain:<key>") and each one is generated ONLY when the visitor expands the
 * matching module. Every section is cached in localStorage per
 * chart + date + timezone + lang + score, so re-opening the page (or the same
 * module) that day costs zero additional AI calls.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import {
  generateDailyReading,
  type DailyReadingAI,
  type DailyReadingSection,
  type DailyReadingInput,
} from "./daily-reading.functions";

export type SegmentId = "overview" | "actions" | `domain:${string}`;

export type SegmentState = {
  data: DailyReadingAI | null;
  status: "idle" | "loading" | "error";
};

const IDLE: SegmentState = { data: null, status: "idle" };

export function parseSegment(id: SegmentId): {
  section: DailyReadingSection;
  targetDomain?: string;
} {
  if (id.startsWith("domain:")) {
    return { section: "domain", targetDomain: id.slice("domain:".length) };
  }
  return { section: id as DailyReadingSection };
}

export function useDailyReadingSegments(opts: {
  /** Stable per-day cache key, or null when AI is unavailable (no real chart). */
  baseKey: string | null;
  /** Builds the server payload for a given segment; return null to skip. */
  buildInput: (segment: SegmentId) => DailyReadingInput | null;
}) {
  const { baseKey, buildInput } = opts;
  const readingFn = useServerFn(generateDailyReading);
  const [segments, setSegments] = useState<Record<string, SegmentState>>({});
  const started = useRef<Set<string>>(new Set());
  const buildRef = useRef(buildInput);
  buildRef.current = buildInput;

  // A new day / chart / score invalidates every in-memory section.
  useEffect(() => {
    started.current = new Set();
    setSegments({});
  }, [baseKey]);

  const cacheKeyOf = useCallback(
    (segment: SegmentId) => (baseKey ? `${baseKey}|${segment}` : null),
    [baseKey],
  );

  const get = useCallback(
    (segment: SegmentId): SegmentState => segments[segment] ?? IDLE,
    [segments],
  );

  const run = useCallback(
    (segment: SegmentId, force: boolean) => {
      const cacheKey = cacheKeyOf(segment);
      if (!cacheKey) return;
      if (!force && started.current.has(segment)) return;

      if (!force) {
        try {
          const cached = window.localStorage.getItem(cacheKey);
          if (cached) {
            started.current.add(segment);
            setSegments((s) => ({
              ...s,
              [segment]: { data: JSON.parse(cached) as DailyReadingAI, status: "idle" },
            }));
            return;
          }
        } catch {
          /* ignore cache errors */
        }
      } else {
        try {
          window.localStorage.removeItem(cacheKey);
        } catch {
          /* ignore */
        }
      }

      const payload = buildRef.current(segment);
      if (!payload) return;

      started.current.add(segment);
      setSegments((s) => ({ ...s, [segment]: { data: null, status: "loading" } }));

      readingFn({ data: payload })
        .then((res) => {
          setSegments((s) => ({ ...s, [segment]: { data: res, status: "idle" } }));
          try {
            window.localStorage.setItem(cacheKey, JSON.stringify(res));
          } catch {
            /* quota — non-fatal */
          }
        })
        .catch(() => {
          started.current.delete(segment);
          setSegments((s) => ({ ...s, [segment]: { data: null, status: "error" } }));
        });
    },
    [cacheKeyOf, readingFn],
  );

  /** Called when a module is expanded: hydrates from cache or generates once. */
  const ensure = useCallback((segment: SegmentId) => run(segment, false), [run]);
  const retry = useCallback((segment: SegmentId) => run(segment, true), [run]);

  return { get, ensure, retry, available: baseKey !== null };
}
