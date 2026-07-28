import { describe, expect, it } from "vitest";

import {
  MEMBERSHIP_PLANS,
  MEMBERSHIP_PAYMENT_METHODS,
  newIdempotencyKey,
  tierCovers,
} from "@/lib/membership-plans";

describe("membership-plans", () => {
  it("prices reflect ¥19.9 sage and ¥39.9 oracle (in cents)", () => {
    expect(MEMBERSHIP_PLANS.sage.priceCents).toBe(1990);
    expect(MEMBERSHIP_PLANS.oracle.priceCents).toBe(3990);
  });

  it("exposes four payment methods", () => {
    expect(MEMBERSHIP_PAYMENT_METHODS).toEqual([
      "wechat",
      "alipay",
      "visa",
      "unionpay",
    ]);
  });

  it("Oracle strictly covers Sage; Sage does not cover Oracle", () => {
    expect(tierCovers("oracle", "sage")).toBe(true);
    expect(tierCovers("oracle", "oracle")).toBe(true);
    expect(tierCovers("sage", "sage")).toBe(true);
    expect(tierCovers("sage", "oracle")).toBe(false);
    expect(tierCovers("none", "sage")).toBe(false);
    expect(tierCovers("none", "oracle")).toBe(false);
  });

  it("idempotency keys are unique, bounded, and prefixed", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a.startsWith("mem_")).toBe(true);
    expect(a.length).toBeLessThanOrEqual(60);
    expect(a.length).toBeGreaterThanOrEqual(8);
  });
});
