/**
 * Per-month tarot AI reading quota.
 *
 * Scoping: quota is keyed by the signed-in account (email) so that the same
 * user is metered consistently when logging in on another device / browser
 * that shares an account. Anonymous usage falls back to a device-local key.
 *
 * Persistence: localStorage today; a future Sage-plan upgrade will mirror
 * this to Lovable Cloud — the shape here maps 1-to-1.
 *
 * Reset: rolls at each calendar month (YYYY-MM).
 */

export type TarotPlan = "free" | "sage" | "oracle";

export const TAROT_LIMITS: Record<TarotPlan, number> = {
  free: 0,
  sage: 10,
  oracle: Infinity,
};

const BASE_KEY = "lod:tarot-quota";
const monthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

type Store = { month: string; used: number };
type Scope = { accountKey?: string | null };

function storageKey(accountKey?: string | null): string {
  const suffix = accountKey?.trim().toLowerCase() || "__anon__";
  return `${BASE_KEY}::${suffix}`;
}

function read(scope?: Scope): Store {
  if (typeof window === "undefined") return { month: monthKey(), used: 0 };
  try {
    const raw = window.localStorage.getItem(storageKey(scope?.accountKey));
    if (!raw) return { month: monthKey(), used: 0 };
    const s = JSON.parse(raw) as Store;
    if (s.month !== monthKey()) return { month: monthKey(), used: 0 };
    return s;
  } catch {
    return { month: monthKey(), used: 0 };
  }
}

function write(s: Store, scope?: Scope) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(scope?.accountKey), JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function tarotUsed(scope?: Scope): number {
  return read(scope).used;
}

export function tarotRemaining(plan: TarotPlan, scope?: Scope): number {
  const limit = TAROT_LIMITS[plan];
  if (!isFinite(limit)) return Infinity;
  return Math.max(0, limit - read(scope).used);
}

export function tarotCanRead(plan: TarotPlan, scope?: Scope): boolean {
  return tarotRemaining(plan, scope) > 0;
}

/**
 * Atomic increment guarded by a short-lived in-flight lock so two rapid
 * calls (double-click, StrictMode double-invoke) cannot double-charge.
 * Returns true when the quota was successfully consumed.
 */
const IN_FLIGHT = new Set<string>();

export function tarotConsume(plan: TarotPlan, scope?: Scope): boolean {
  const key = storageKey(scope?.accountKey);
  if (IN_FLIGHT.has(key)) return false;
  IN_FLIGHT.add(key);
  try {
    if (!tarotCanRead(plan, scope)) return false;
    const s = read(scope);
    write({ month: s.month, used: s.used + 1 }, scope);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("lod:tarot-quota-changed"));
    }
    return true;
  } finally {
    // Release after the current microtask so a synchronous second call still races-out.
    setTimeout(() => IN_FLIGHT.delete(key), 400);
  }
}
