/**
 * Per-month tarot AI reading quota, tracked in localStorage.
 * Sage: 10 / month · Oracle: unlimited · Free: 0.
 * Reset key rolls at each calendar month (YYYY-MM).
 */

export type TarotPlan = "free" | "sage" | "oracle";

export const TAROT_LIMITS: Record<TarotPlan, number> = {
  free: 0,
  sage: 10,
  oracle: Infinity,
};

const KEY = "lod:tarot-quota";
const monthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

type Store = { month: string; used: number };

function read(): Store {
  if (typeof window === "undefined") return { month: monthKey(), used: 0 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { month: monthKey(), used: 0 };
    const s = JSON.parse(raw) as Store;
    if (s.month !== monthKey()) return { month: monthKey(), used: 0 };
    return s;
  } catch {
    return { month: monthKey(), used: 0 };
  }
}

function write(s: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function tarotUsed(): number {
  return read().used;
}

export function tarotRemaining(plan: TarotPlan): number {
  const limit = TAROT_LIMITS[plan];
  if (!isFinite(limit)) return Infinity;
  return Math.max(0, limit - read().used);
}

export function tarotCanRead(plan: TarotPlan): boolean {
  return tarotRemaining(plan) > 0;
}

export function tarotConsume(plan: TarotPlan): boolean {
  if (!tarotCanRead(plan)) return false;
  const s = read();
  write({ month: s.month, used: s.used + 1 });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("lod:tarot-quota-changed"));
  }
  return true;
}
