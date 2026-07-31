import { describe, expect, it } from "vitest";

import { backoffDelay, isRetryableError, retryWithBackoff } from "./ai-retry";

describe("ai-retry", () => {
  it("grows the delay exponentially and caps it", () => {
    const opts = { baseDelayMs: 500, maxDelayMs: 4000, jitter: 0 };
    expect(backoffDelay(1, opts)).toBe(500);
    expect(backoffDelay(2, opts)).toBe(1000);
    expect(backoffDelay(3, opts)).toBe(2000);
    expect(backoffDelay(9, opts)).toBe(4000);
  });

  it("applies full jitter within [0, raw]", () => {
    const d = backoffDelay(3, { baseDelayMs: 500, jitter: 1 }, () => 0.5);
    expect(d).toBe(1000);
  });

  it("returns the first success without waiting", async () => {
    let calls = 0;
    const out = await retryWithBackoff(async () => {
      calls++;
      return "ok";
    });
    expect(out).toBe("ok");
    expect(calls).toBe(1);
  });

  it("retries transient failures then succeeds", async () => {
    let calls = 0;
    const waits: number[] = [];
    const out = await retryWithBackoff(
      async () => {
        calls++;
        if (calls < 3) throw new Error("gateway timeout");
        return "late";
      },
      { baseDelayMs: 10, jitter: 0, sleep: async (ms) => void waits.push(ms) },
    );
    expect(out).toBe("late");
    expect(calls).toBe(3);
    expect(waits).toEqual([10, 20]);
  });

  it("gives up after the attempt budget", async () => {
    let calls = 0;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error("boom");
        },
        { attempts: 3, baseDelayMs: 1, jitter: 0, sleep: async () => {} },
      ),
    ).rejects.toThrow("boom");
    expect(calls).toBe(3);
  });

  it("does not retry non-retryable errors", async () => {
    let calls = 0;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          throw new Error("Unauthorized");
        },
        { baseDelayMs: 1, sleep: async () => {} },
      ),
    ).rejects.toThrow("Unauthorized");
    expect(calls).toBe(1);
  });

  it("stops when cancelled", async () => {
    let calls = 0;
    let cancelled = false;
    await expect(
      retryWithBackoff(
        async () => {
          calls++;
          cancelled = true;
          throw new Error("net");
        },
        { attempts: 5, baseDelayMs: 1, sleep: async () => {}, isCancelled: () => cancelled },
      ),
    ).rejects.toThrow("net");
    expect(calls).toBe(1);
  });

  it("classifies errors", () => {
    expect(isRetryableError({ status: 429 })).toBe(true);
    expect(isRetryableError({ status: 503 })).toBe(true);
    expect(isRetryableError({ status: 400 })).toBe(false);
    expect(isRetryableError(new Error("fetch failed"))).toBe(true);
    expect(isRetryableError(new Error("invalid payload"))).toBe(false);
  });
});
