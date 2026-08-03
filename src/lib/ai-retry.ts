/**
 * Exponential-backoff retry helper for AI / network calls.
 *
 * Report generation fans out one call per dimension. Without retries a single
 * transient hiccup (rate limit, cold start, dropped socket) used to poison the
 * whole report. Every dimension call now goes through `retryWithBackoff`, and
 * the caller degrades that one dimension instead of failing the report.
 */

export type RetryOptions = {
  /** Total attempts, including the first one. Default 3. */
  attempts?: number;
  /** Base delay in ms for attempt 1. Default 600. */
  baseDelayMs?: number;
  /** Upper bound for a single wait. Default 8000. */
  maxDelayMs?: number;
  /** Full-jitter factor 0..1. Default 1 (full jitter). */
  jitter?: number;
  /** Return false to stop retrying a given error. Default: retry everything. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Observability hook, fired after each failed attempt. */
  onRetry?: (info: { error: unknown; attempt: number; delayMs: number }) => void;
  /** Abort further attempts (e.g. the request became stale). */
  isCancelled?: () => boolean;
  /** Injectable for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable for tests. */
  random?: () => number;
};

/** Non-retryable: auth / validation problems will fail identically on retry. */
export function isRetryableError(error: unknown): boolean {
  const status = (error as { status?: number; statusCode?: number } | null)?.status ??
    (error as { statusCode?: number } | null)?.statusCode;
  if (typeof status === "number") {
    if (status === 408 || status === 425 || status === 429) return true;
    if (status >= 500) return true;
    return false;
  }
  const msg = String((error as Error)?.message ?? error ?? "").toLowerCase();
  if (!msg) return true;
  if (msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("invalid")) {
    return false;
  }
  return true;
}

export function backoffDelay(
  attempt: number,
  { baseDelayMs = 600, maxDelayMs = 8000, jitter = 1 }: RetryOptions = {},
  random: () => number = Math.random,
): number {
  const raw = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
  const j = Math.min(1, Math.max(0, jitter));
  // Full jitter: pick uniformly in [raw * (1 - j), raw].
  return Math.round(raw * (1 - j) + raw * j * random());
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function retryWithBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    shouldRetry = isRetryableError,
    onRetry,
    isCancelled,
    sleep = defaultSleep,
    random = Math.random,
  } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
    if (isCancelled?.()) throw lastError ?? new Error("cancelled");
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const isLast = attempt >= attempts;
      if (isLast || !shouldRetry(error, attempt) || isCancelled?.()) throw error;
      const delayMs = backoffDelay(attempt, options, random);
      onRetry?.({ error, attempt, delayMs });
      await sleep(delayMs);
    }
  }
  throw lastError;
}
