/**
 * Deterministic yearly "energy score" for the life-timeline chart.
 *
 * Requirements the caller relies on:
 *   • Pure function of (birthISO, age) — no AI, no clock, no random.
 *   • Same (birthISO, age) always returns the same score.
 *   • Returns null when birthISO is missing/invalid — the chart then
 *     shows a "数据不足 / insufficient data" placeholder rather than a
 *     fabricated line.
 *   • Score is a *relative* trend indicator in [0, 100]; the chart
 *     labels it as such and never claims absolute good/bad.
 *
 * The generator combines two low-frequency sinusoids seeded by a
 * FNV-1a hash of the ISO birth string. This produces a smooth curve
 * (readable as a trend) that differs per birthdate but is fully
 * reproducible.
 */

function fnv1a(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function isValidBirth(iso: string | undefined | null): iso is string {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime());
}

/** Returns a score in [0, 100] or null when birthISO is missing/invalid. */
export function computeEnergyScore(birthISO: string | undefined | null, age: number): number | null {
  if (!isValidBirth(birthISO)) return null;
  if (!Number.isFinite(age) || age < 0 || age > 120) return null;
  const seed = fnv1a(birthISO);
  const phase1 = ((seed & 0xffff) / 0xffff) * Math.PI * 2;
  const phase2 = (((seed >>> 16) & 0xffff) / 0xffff) * Math.PI * 2;
  // Two smooth cycles: ~12y (Jupiter-ish) + ~9y (personal), plus a slow drift.
  const c1 = Math.sin((age / 12) * Math.PI * 2 + phase1);
  const c2 = Math.sin((age / 9) * Math.PI * 2 + phase2);
  const drift = Math.sin((age / 30) * Math.PI + phase1 * 0.5) * 0.4;
  const raw = c1 * 0.55 + c2 * 0.35 + drift * 0.25; // in ~[-1.15, 1.15]
  const scaled = (raw + 1.15) / 2.3; // → [0, 1]
  return Math.round(scaled * 100);
}

export type YearEnergyPoint = { age: number; score: number };

/** Returns null when birthISO cannot yield a score for the whole range. */
export function computeEnergyRange(
  birthISO: string | undefined | null,
  from: number,
  to: number,
): YearEnergyPoint[] | null {
  if (!isValidBirth(birthISO)) return null;
  if (!Number.isInteger(from) || !Number.isInteger(to) || to <= from) return null;
  const out: YearEnergyPoint[] = [];
  for (let a = from; a < to; a += 1) {
    const s = computeEnergyScore(birthISO, a);
    if (s == null) return null;
    out.push({ age: a, score: s });
  }
  return out;
}
