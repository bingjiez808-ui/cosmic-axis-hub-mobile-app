/**
 * Guided Library V2 · membership entitlement + telemetry.
 *
 * DEMO ONLY. This module NEVER reads or writes real Supabase orders,
 * user profiles, or entitlement rows. Its sole job is to let the V2
 * demo mimic two paths side-by-side:
 *
 *   - guest / free — sees membership CTAs at natural break points
 *   - "以已购身份预览" — same UI but every membership CTA is replaced
 *     by "继续阅读" and links to the real V1 route so the reviewer can
 *     see the entitled-user layout without buying anything.
 *
 * The entitled preview is opt-in in three ways:
 *   1. `?entitled=1` on the /dev/guided-library-v2 URL
 *   2. localStorage flag `lod:library-v2:entitled-preview`
 *   3. the "以已购身份预览" toggle inside the V2 topbar
 *
 * All three are limited to the /dev preview route, which is gated by
 * `preview-guard.ts` — the production domain never renders this file.
 *
 * Telemetry is a session-storage buffer only. It never leaves the
 * browser. Real analytics wiring lives in the V1 stack.
 */

import { useEffect, useState } from "react";

const ENTITLED_KEY = "lod:library-v2:entitled-preview";
const TELEMETRY_KEY = "lod:library-v2:telemetry";

/**
 * Membership event contract — the exact list the spec asks for. Every
 * new event MUST be added here so the shape stays reviewable.
 */
export type MembershipEvent =
  | "membership_impression"
  | "membership_preview_open"
  | "membership_cta_click"
  | "membership_entitled_continue";

export interface TelemetryRecord {
  event: MembershipEvent;
  /** short abstract slot name, e.g. "shelf_premium_book" */
  slot: string;
  /** millis since epoch */
  at: number;
}

// ---------------- Entitlement ----------------

export function readEntitledFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const search = new URLSearchParams(window.location.search);
    if (search.get("entitled") === "1") return true;
    return window.localStorage.getItem(ENTITLED_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeEntitledFlag(next: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (next) window.localStorage.setItem(ENTITLED_KEY, "1");
    else window.localStorage.removeItem(ENTITLED_KEY);
  } catch {
    /* storage denied — ignore */
  }
}

/**
 * `useEntitledPreview` — reactive read of the demo-entitled flag.
 *
 * Returns `{ entitled, setEntitled }`. `setEntitled` writes localStorage
 * and updates the same-tab UI. The initial value is `false` on the
 * server render so hydration matches, then the real value hydrates in
 * `useEffect`.
 */
export function useEntitledPreview(): {
  entitled: boolean;
  setEntitled: (next: boolean) => void;
} {
  const [entitled, setEntitled] = useState(false);
  useEffect(() => {
    setEntitled(readEntitledFlag());
  }, []);
  const set = (next: boolean) => {
    writeEntitledFlag(next);
    setEntitled(next);
  };
  return { entitled, setEntitled: set };
}

// ---------------- Telemetry ----------------

function readBuffer(): TelemetryRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(TELEMETRY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TelemetryRecord[]) : [];
  } catch {
    return [];
  }
}

function writeBuffer(list: TelemetryRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    // Keep the buffer bounded so long browsing sessions never inflate it.
    const trimmed = list.slice(-200);
    window.sessionStorage.setItem(TELEMETRY_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

/**
 * Log a membership event. `membership_impression` de-duplicates per slot
 * per session so scrolling a card into view repeatedly does not inflate
 * counts. All other events log every time.
 */
export function logMembership(event: MembershipEvent, slot: string): void {
  const buf = readBuffer();
  if (event === "membership_impression") {
    const already = buf.some(
      (r) => r.event === "membership_impression" && r.slot === slot,
    );
    if (already) return;
  }
  buf.push({ event, slot, at: Date.now() });
  writeBuffer(buf);
}

export function readTelemetry(): TelemetryRecord[] {
  return readBuffer();
}

export function clearTelemetry(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(TELEMETRY_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Pure helper used by tests — takes a buffer and asserts the impression
 * de-dupe contract without touching sessionStorage.
 */
export function dedupeImpressions(
  buf: TelemetryRecord[],
): TelemetryRecord[] {
  const seen = new Set<string>();
  const out: TelemetryRecord[] = [];
  for (const r of buf) {
    if (r.event === "membership_impression") {
      const key = `${r.slot}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(r);
  }
  return out;
}
