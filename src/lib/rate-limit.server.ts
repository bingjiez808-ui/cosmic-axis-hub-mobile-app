/**
 * In-memory per-key rate limiter for server functions.
 *
 * Worker instances are short-lived and there can be more than one, so this is
 * a best-effort throttle to blunt scripted abuse (AI key burn, delete floods,
 * feedback spam) — not a hard quota. Durable per-user quotas that must resist
 * multi-instance drift belong in a DB table (see `tarot_usage`).
 *
 * Because state lives in-memory it clears whenever the worker cold-starts.
 * That's acceptable for the surfaces that use it: authenticated only, small
 * blast radius, and every AI-consuming path is also gated by
 * `requireSupabaseAuth`.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Prune old buckets opportunistically so the map doesn't grow forever. */
function prune(now: number) {
  if (buckets.size < 500) return;
  for (const [k, v] of buckets) {
    if (v.resetAt <= now) buckets.delete(k);
  }
}

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  prune(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterMs: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterMs: bucket.resetAt - now };
  }
  bucket.count += 1;
  return { ok: true, retryAfterMs: 0 };
}

/**
 * Throws a user-friendly Error when the caller is over the limit. Returns a
 * caller-safe message without leaking implementation details.
 */
export function enforceRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  label = "requests",
): void {
  const r = rateLimit(key, limit, windowMs);
  if (r.ok) return;
  const seconds = Math.max(1, Math.ceil(r.retryAfterMs / 1000));
  throw new Error(`RATE_LIMITED: too many ${label}. Try again in ${seconds}s.`);
}
